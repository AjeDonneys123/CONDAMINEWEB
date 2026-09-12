// @signatures: ProfClassroomRouter, details, plan, move, behavior, layout, importPlan
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Student, Classroom, Homework, GameLevel, LearningModule, Submission, GameProgress } = require('../models/prof.models');
const ClassroomExpert = require('../../domains/classroom/experts/classroom.expert'); // Indispensable pour l'IA
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendLatePunishmentMail, resetLateMailState } = require('../../services/punishmentMailer');

// Configuration Multer pour l'import d'image
const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });
const CROSS_DECAY_MS = 14 * 24 * 60 * 60 * 1000;
const PUNISHMENT_DUE_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeClassName(v = '') {
    const raw = String(v || '').trim().toUpperCase();
    return { raw, clean: raw.replace(/\s+/g, '') };
}

async function getStudentsForClassOrGroup(classId) {
    const clsObj = await Classroom.findById(classId).lean();
    if (!clsObj) return { clsObj: null, students: [] };

    if (clsObj.type === 'GROUP') {
        const students = await Student.find({ assignedGroups: clsObj._id }).lean();
        return { clsObj, students };
    }

    const classNameRaw = String(clsObj?.name || '').trim();
    const classNameClean = classNameRaw.toUpperCase().replace(/\s+/g, '');
    const classNameRegex = classNameRaw
        ? new RegExp(`^\\s*${classNameRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
        : null;

    const directQuery = classNameRegex
        ? {
            $or: [
                { classId: clsObj._id },
                { currentClass: classNameRaw },
                { currentClass: classNameRegex },
                { currentClass: classNameClean }
            ]
        }
        : { classId: clsObj._id };

    const directStudents = await Student.find(directQuery).lean();

    const Enrollment = mongoose.models.Enrollment ? mongoose.model('Enrollment') : null;
    const enrollments = Enrollment ? await Enrollment.find({ classId: clsObj._id }, 'studentId').lean() : [];
    const enrollmentIds = enrollments
        .map((e) => String(e?.studentId || ''))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    const enrollmentStudents = enrollmentIds.length > 0
        ? await Student.find({ _id: { $in: enrollmentIds } }).lean()
        : [];

    const byId = new Map();
    [...directStudents, ...enrollmentStudents].forEach((s) => {
        if (!s?._id) return;
        byId.set(String(s._id), s);
    });

    return { clsObj, students: [...byId.values()] };
}

async function resolveBridgeClass(classId, className = '') {
    let clsObj = await Classroom.findById(classId).lean().catch(() => null);
    if (clsObj || !String(className || '').trim()) return clsObj;

    // An old Slides tab can retain the id of a deleted/recreated classroom.
    // Its displayed class name (for example "5B") is stable, so repair that
    // association here instead of making the board permanently disconnected.
    const escapedName = String(className).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escapedName) return null;
    clsObj = await Classroom.findOne({ name: new RegExp(`^\\s*${escapedName}\\s*$`, 'i') })
        .sort({ updatedAt: -1 })
        .lean();
    return clsObj;
}

async function getBridgeStudents(classroom) {
    if (!classroom?._id) return [];
    const { students } = await getStudentsForClassOrGroup(classroom._id);
    return students;
}

// The phone board can place pupils which do not yet have a persisted seat.
// The Slides board must use the exact same projection: otherwise those pupils
// silently disappear from the mirrored plan and only the manually seated ones
// are displayed.
function buildBridgePlanStudents(classroom, students = []) {
    const cols = Math.max(1, Number(classroom?.layout?.cols || 6));
    const highestSeatRow = students.reduce((max, s) => Number.isInteger(s?.seatY) ? Math.max(max, s.seatY + 1) : max, 0);
    const rows = Math.max(1, Number(classroom?.layout?.rows || 5), highestSeatRow, Math.ceil(students.length / cols));
    const isValidSeat = (student) => Number.isInteger(student?.seatX)
        && Number.isInteger(student?.seatY)
        && student.seatX >= 0 && student.seatX < cols
        && student.seatY >= 0 && student.seatY < rows;

    const projected = students.filter(isValidSeat).map(s => ({
        ...s,
        seatX: s.seatX,
        seatY: s.seatY
    }));

    return { cols, rows, students: projected };
}

function buildBridgePersistentDebts(students = []) {
    return students.map((student) => {
        const records = Array.isArray(student?.behaviorRecords) ? student.behaviorRecords : [];
        const scores = records.flatMap((record) => Array.isArray(record?.scores) ? record.scores : []);
        const hasPunishment = scores.some((score) => Boolean(score?.punishment)) || String(student?.punishmentStatus || '') === 'PENDING' || String(student?.punishmentStatus || '') === 'LATE';
        const hasIncomplete = scores.some((score) => Boolean(score?.workIncomplete)) || records.some((record) => Boolean(record?.workIncomplete));
        if (!hasPunishment && !hasIncomplete) return null;
        const incScore = scores.find((s) => s.workIncomplete && s.workIncompleteText);
        const incRecord = records.find((r) => r.workIncomplete && r.workIncompleteText);
        const text = String(incScore?.workIncompleteText || incRecord?.workIncompleteText || student?.workIncompleteText || '').trim();
        return {
            studentId: String(student._id),
            name: `${String(student.nickname || student.firstName || '').trim()} ${String(student.lastName || '').trim().slice(0, 1)}.`.trim(),
            status: hasPunishment ? 'punishment' : 'incomplete',
            text: text
        };
    }).filter(Boolean).sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr', { sensitivity: 'base' }));
}

async function assignPunishmentTemplate(student, teacherId) {
    const { raw, clean } = normalizeClassName(student.currentClass || '');
    if (!raw) return false;

    const punishments = await Homework.find({
        isPunishment: true,
        teacherId,
        targetClassrooms: { $in: [raw, clean] }
    }).sort({ updatedAt: -1 });

    const selected = punishments.find(p => {
        const targets = (p.targetClassrooms || []).map(c => String(c || '').trim().toUpperCase());
        return targets.includes(raw) || targets.includes(clean);
    });

    if (!selected) return false;

    const sid = String(student._id);
    const alreadyAssigned = (selected.assignedStudents || []).some(id => String(id) === sid);
    if (!alreadyAssigned) {
        selected.assignedStudents = [...(selected.assignedStudents || []), student._id];
        await selected.save();
    }

    if (student.punishmentStatus === 'NONE' || !student.punishmentDueDate) {
        student.punishmentStatus = 'PENDING';
        student.punishmentDueDate = new Date(Date.now() + PUNISHMENT_DUE_MS);
        resetLateMailState(student);
    }

    return true;
}

async function ensureStudentPunishmentState(student) {
    if (!student) return false;
    let changed = false;

    if (student.punishmentStatus === 'NONE') {
        const records = (student.behaviorRecords || []).filter((r) => Number(r.crosses || 0) >= 3 && r.teacherId);
        for (const rec of records) {
            const assigned = await assignPunishmentTemplate(student, rec.teacherId);
            if (assigned) {
                changed = true;
                break;
            }
        }
    }

    if ((student.punishmentStatus === 'PENDING' || student.punishmentStatus === 'LATE') && student.punishmentDueDate) {
        const dueTs = new Date(student.punishmentDueDate).getTime();
        if (Number.isFinite(dueTs) && dueTs <= Date.now() && student.punishmentStatus !== 'LATE') {
            student.punishmentStatus = 'LATE';
            await sendLatePunishmentMail(student);
            changed = true;
        }
    }

    return changed;
}

function applyCrossDecay(behaviorRecords = []) {
    const now = Date.now();
    let changed = false;
    for (const r of behaviorRecords) {
        let crosses = Number(r.crosses || 0);
        let nextTs = r.nextCrossRemovalAt ? new Date(r.nextCrossRemovalAt).getTime() : null;

        if (crosses <= 0) {
            if (r.crosses !== 0) { r.crosses = 0; changed = true; }
            if (r.nextCrossRemovalAt) { r.nextCrossRemovalAt = null; changed = true; }
            continue;
        }

        if (!nextTs || Number.isNaN(nextTs)) {
            nextTs = now + CROSS_DECAY_MS;
            r.nextCrossRemovalAt = new Date(nextTs);
            changed = true;
        }

        while (crosses > 0 && nextTs <= now) {
            crosses -= 1;
            changed = true;
            if (crosses > 0) nextTs += CROSS_DECAY_MS;
        }

        if (crosses !== Number(r.crosses || 0)) {
            r.crosses = crosses;
            changed = true;
        }

        if (crosses <= 0) {
            if (r.nextCrossRemovalAt) { r.nextCrossRemovalAt = null; changed = true; }
        } else {
            const currentTs = r.nextCrossRemovalAt ? new Date(r.nextCrossRemovalAt).getTime() : null;
            if (currentTs !== nextTs) {
                r.nextCrossRemovalAt = new Date(nextTs);
                changed = true;
            }
        }
    }
    return changed;
}

function gradeToNumber(raw = '') {
    const txt = String(raw || '').trim().toUpperCase();
    if (!txt) return 0;
    const m = txt.match(/(\d+(?:[.,]\d+)?)/);
    if (m) {
        const n = Number(String(m[1]).replace(',', '.'));
        if (Number.isFinite(n)) return Math.max(0, Math.min(20, n));
    }
    const map = {
        'A+': 20, 'A': 18, 'A-': 16,
        'B+': 15, 'B': 14, 'B-': 13,
        'C+': 12, 'C': 11, 'C-': 10,
        'D+': 8, 'D': 7, 'D-': 6,
        'E': 4, 'F': 0
    };
    return map[txt] ?? 0;
}

/**
 * 🎓 BLOC PROF : LOGIQUE CLASSE (/api/classroom)
 * Version avec FIX 404 sur /import-plan
 */

// 1. IMPORTATION IA (La route qui manquait)
router.post('/import-plan', upload.single('file'), async (req, res) => {
    console.log("📥 [CLASSROOM-ROUTE] Import plan request received");
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    try {
        console.log(`📂 [CLASSROOM-ROUTE] File: ${req.file.path}, ClassId: ${req.body.classId}`);
        const isTextPlan = /(?:csv|tab-separated-values|text\/plain)/i.test(String(req.file.mimetype || ''))
            || /\.(?:csv|tsv|txt)$/i.test(String(req.file.originalname || ''));
        const result = isTextPlan
            ? await ClassroomExpert.applyPlanFromGridText(req.body.classId, fs.readFileSync(req.file.path, 'utf8'))
            : await ClassroomExpert.applyPlanFromImage(req.body.classId, req.file);
        console.log(`✅ [CLASSROOM-ROUTE] Result success, count: ${result?.length}`);
        // Nettoyage local après traitement
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ ok: true, count: result.length, message: "Plan synchronisé par l'IA !" });
    } catch (e) {
        console.error("💥 [CLASSROOM-ROUTE] ERROR:", e.stack || e.message);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
    }
});

router.post('/import-plan-sheet', async (req, res) => {
    try {
        const result = await ClassroomExpert.applyPlanFromSheetUrl(req.body.classId, req.body.sheetUrl);
        res.json({ ok: true, count: result.length, message: `${result.length} élève(s) placé(s) depuis Google Sheets.` });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.get('/debts/:classId', async (req, res) => {
    try {
        const teacherId = String(req.query.teacherId || '').trim();
        const { clsObj, students } = await getStudentsForClassOrGroup(req.params.classId);
        if (!clsObj) return res.status(404).json({ error: 'Classe/Groupe introuvable' });
        const debts = students.map((student) => {
            const record = (student.behaviorRecords || []).find((item) => String(item?.teacherId || '') === teacherId);
            const scores = Array.isArray(record?.scores) ? record.scores : [];
            const punishment = scores.some((score) => Boolean(score?.punishment)) || (student.punishmentStatus && student.punishmentStatus !== 'NONE');
            const workIncomplete = scores.some((score) => Boolean(score?.workIncomplete)) || Boolean(record?.workIncomplete);
            const boardWarning = scores.some((score) => Boolean(score?.boardWarning));
            const legacyDebt = Boolean(record?.forcedSix || Number(record?.forcedSixCount || 0) > 0);
            if (!punishment && !workIncomplete && !boardWarning && !legacyDebt) return null;
            return {
                id: student._id,
                name: `${String(student.nickname || student.firstName || '').trim()} ${String(student.lastName || '').trim()}`.trim(),
                status: punishment ? 'punishment' : (workIncomplete || legacyDebt ? 'incomplete' : 'warning')
            };
        }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
        res.json(debts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// État léger et stable destiné à l'extension Google Slides.
router.get('/bridge-state/:classId', async (req, res) => {
    try {
        const fallbackName = String(req.query.className || '').trim();
        const classroom = await resolveBridgeClass(req.params.classId, fallbackName);
        if (!classroom) return res.status(404).json({ error: 'Classe/Groupe introuvable' });
        // Notes and the plan use the same bridge, but the whole student list
        // is costly to rebuild on every live-score poll. Only send it while
        // the teacher has explicitly opened the plan.
        const includePlan = classroom.classPlanVisible === true || String(req.query.includePlan || '') === '1';
        const students = includePlan ? await getBridgeStudents(classroom) : [];
        let activePersistentDebts = Array.isArray(classroom.activePersistentDebts) ? classroom.activePersistentDebts : null;
        // Migration douce des classes déjà existantes : le premier état lu
        // reconstitue les dettes à partir des mêmes données que la page prof.
        if (!activePersistentDebts) {
            const debtStudents = includePlan ? students : await getBridgeStudents(classroom);
            activePersistentDebts = buildBridgePersistentDebts(debtStudents);
            await Classroom.updateOne({ _id: classroom._id }, { $set: { activePersistentDebts } });
        }
        // A warning must never survive a class/group change.  Older records
        // may contain a pupil from a previous class; validate them against
        // the current membership before giving them to the extension.
        const rawHourWarnings = Array.isArray(classroom.activeHourWarnings) ? classroom.activeHourWarnings : [];
        let activeHourWarnings = rawHourWarnings.filter((row) => Number(row?.expiresAt || 0) > Date.now());
        if (activeHourWarnings.length) {
            const warningStudents = includePlan ? students : await getBridgeStudents(classroom);
            const currentStudentIds = new Set(warningStudents.map((student) => String(student?._id || '')));
            activeHourWarnings = activeHourWarnings.filter((row) => currentStudentIds.has(String(row?.studentId || '')));
            if (activeHourWarnings.length !== rawHourWarnings.length) {
                await Classroom.updateOne({ _id: classroom._id }, { $set: { activeHourWarnings } });
            }
        }
        const projectedPlan = includePlan
            ? buildBridgePlanStudents(classroom, students)
            : {
                cols: Math.max(1, Number(classroom?.layout?.cols || 6)),
                rows: Math.max(1, Number(classroom?.layout?.rows || 5)),
                students: []
            };
        console.info('[CondaWeb bridge] état plan extension', {
            classId: String(classroom._id),
            className: classroom.name,
            sourceStudents: includePlan ? students.length : 0,
            projectedStudents: projectedPlan.students.length,
            cols: projectedPlan.cols,
            rows: projectedPlan.rows,
            includePlan
        });
        return res.json({
            _id: String(classroom._id || req.params.classId),
            name: classroom.name || '',
            layout: { ...(classroom.layout || {}), cols: projectedPlan.cols, rows: projectedPlan.rows },
            classPlanVisible: classroom.classPlanVisible === true,
            classPoints: Number(classroom.classPoints ?? 10),
            activeStudentHighlight: classroom.activeStudentHighlight || '',
            activeStudentHighlightTime: classroom.activeStudentHighlightTime || null,
            activeStudentBonusAlert: classroom.activeStudentBonusAlert || '',
            activeStudentBonusAlertTime: classroom.activeStudentBonusAlertTime || null,
            activeScoreAlerts: Array.isArray(classroom.activeScoreAlerts) ? classroom.activeScoreAlerts : [],
            scoreAlertSyncVersion: Number(classroom.scoreAlertSyncVersion || 0),
            scoreAlertReplayId: String(classroom.scoreAlertReplayId || ''),
            activeHourWarnings,
            activePersistentDebts,
            classNotification: classroom.classNotification ? {
                text: String(classroom.classNotification.text || ''),
                createdAt: classroom.classNotification.createdAt || null
            } : null,
            planStudentCount: projectedPlan.students.length,
            planStudents: projectedPlan.students.map((student) => ({
                _id: String(student._id),
                firstName: student.firstName || '',
                nickname: student.nickname || '',
                lastName: student.lastName || '',
                seatX: student.seatX !== null && student.seatX !== undefined && Number.isFinite(Number(student.seatX)) ? Number(student.seatX) : null,
                seatY: student.seatY !== null && student.seatY !== undefined && Number.isFinite(Number(student.seatY)) ? Number(student.seatY) : null
            }))
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// The classroom phone and the Google Slides bridge share this state directly.
// It deliberately does not require an active course/presentation.
router.put('/:classId/bridge-plan', async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.classId);
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });
        classroom.classPlanVisible = Boolean(req.body?.visible);
        await classroom.save();
        console.info('[CondaWeb bridge] plan de classe', { classId: String(classroom._id), visible: classroom.classPlanVisible });
        return res.json({ ok: true, classId: String(classroom._id), classPlanVisible: classroom.classPlanVisible });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// Notification de classe (mémo devoirs) — affichée au tableau, effacée par VALIDER
router.put('/:classId/notification', async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.classId);
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });
        const text = String(req.body?.text || '').trim().slice(0, 500);
        if (!text) return res.status(400).json({ error: 'Texte requis' });
        classroom.classNotification = { text, createdAt: new Date() };
        classroom.markModified('classNotification');
        await classroom.save();
        console.info('[CondaWeb] notification de classe créée', { classId: String(classroom._id), text });
        return res.json({ ok: true, classNotification: classroom.classNotification });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.delete('/:classId/notification', async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.classId);
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });
        classroom.classNotification = null;
        classroom.markModified('classNotification');
        await classroom.save();
        console.info('[CondaWeb] notification de classe effacée', { classId: String(classroom._id) });
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// The extension normally polls classroom state, but a teacher can explicitly
// request a replay after a score change.  The version is durable, so a slow
// Google Slides tab cannot silently miss the instruction.
router.post('/:classId/score-alerts/sync', async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.classId);
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });
        const alerts = Array.isArray(classroom.activeScoreAlerts) ? classroom.activeScoreAlerts : [];
        const latest = alerts[alerts.length - 1];
        if (!latest?.id) return res.json({ ok: true, replayed: false, scoreAlertSyncVersion: Number(classroom.scoreAlertSyncVersion || 0) });

        classroom.scoreAlertSyncVersion = Number(classroom.scoreAlertSyncVersion || 0) + 1;
        classroom.scoreAlertReplayId = String(latest.id);
        await classroom.save();
        console.info('[CondaWeb notes] synchronisation demandée', {
            classId: String(classroom._id),
            alertId: classroom.scoreAlertReplayId,
            version: classroom.scoreAlertSyncVersion
        });
        return res.json({
            ok: true,
            replayed: true,
            scoreAlertSyncVersion: classroom.scoreAlertSyncVersion,
            scoreAlertReplayId: classroom.scoreAlertReplayId
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// 2. RÉCUPÉRATION INFOS CLASSE
router.get('/:classId', async (req, res) => {
    try {
        const cls = await Classroom.findById(req.params.classId);
        if (!cls) return res.status(404).json({ error: "Classe introuvable" });
        if (cls.classPointsInitialized !== true) {
            cls.classPoints = 10;
            cls.classPointsInitialized = true;
            await cls.save();
        }
        res.json(cls.toObject());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. PLAN DE CLASSE ENRICHI (Indicateurs Julian)
router.get('/plan/:classId', async (req, res) => {
    try {
        const { teacherId } = req.query;
        const classId = req.params.classId;
        const { clsObj, students } = await getStudentsForClassOrGroup(classId);
        if (!clsObj) return res.status(404).json({ error: "Classe/Groupe introuvable" });
        const className = clsObj?.name;

        const cols = Math.max(2, Number(clsObj?.layout?.cols || 6));
        const defaultRows = Math.max(2, Number(clsObj?.layout?.rows || 5));

        // 1. Identifier les élèves déjà assis à une place valide et unique
        const occupiedSeats = new Set();
        const seatedStudents = [];
        const unseatedStudents = [];

        students.forEach((s) => {
            const hasValidCoords = Number.isInteger(s.seatX) && Number.isInteger(s.seatY)
                && s.seatX >= 0 && s.seatX < cols && s.seatY >= 0;
            const seatKey = hasValidCoords ? `${s.seatX}-${s.seatY}` : null;

            if (hasValidCoords && !occupiedSeats.has(seatKey)) {
                occupiedSeats.add(seatKey);
                seatedStudents.push(s);
            } else {
                unseatedStudents.push(s);
            }
        });

        // 2. Si des élèves n'ont pas de place attribuée, les placer au hasard sur les places vides
        if (unseatedStudents.length > 0) {
            const maxSeatedRow = seatedStudents.reduce((max, s) => Math.max(max, s.seatY + 1), 0);
            const neededRows = Math.max(defaultRows, maxSeatedRow, Math.ceil(students.length / cols));

            const availableSeats = [];
            for (let y = 0; y < neededRows; y++) {
                for (let x = 0; x < cols; x++) {
                    const key = `${x}-${y}`;
                    if (!occupiedSeats.has(key)) {
                        availableSeats.push({ x, y });
                    }
                }
            }

            let extraRow = neededRows;
            while (availableSeats.length < unseatedStudents.length) {
                for (let x = 0; x < cols; x++) {
                    availableSeats.push({ x, y: extraRow });
                }
                extraRow++;
            }

            // Mélange aléatoire (Fisher-Yates) des places disponibles
            for (let i = availableSeats.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableSeats[i], availableSeats[j]] = [availableSeats[j], availableSeats[i]];
            }

            const bulkOps = [];
            unseatedStudents.forEach((student, idx) => {
                const seat = availableSeats[idx];
                student.seatX = seat.x;
                student.seatY = seat.y;
                occupiedSeats.add(`${seat.x}-${seat.y}`);
                bulkOps.push({
                    updateOne: {
                        filter: { _id: student._id },
                        update: { $set: { seatX: seat.x, seatY: seat.y } }
                    }
                });
            });

            if (bulkOps.length > 0) {
                await Student.bulkWrite(bulkOps, { ordered: false });
            }

            if (neededRows > defaultRows) {
                await Classroom.updateOne({ _id: clsObj._id }, { $set: { 'layout.rows': neededRows } });
            }
        }

        for (const student of students) {
            let needsSave = false;
            if (applyCrossDecay(student.behaviorRecords || [])) {
                needsSave = true;
            }
            if (await ensureStudentPunishmentState(student)) {
                needsSave = true;
            }
            if (needsSave) {
                await Student.updateOne(
                    { _id: student._id },
                    {
                        $set: {
                            behaviorRecords: student.behaviorRecords,
                            punishmentStatus: student.punishmentStatus,
                            punishmentDueDate: student.punishmentDueDate,
                            punishmentLateMailSentAt: student.punishmentLateMailSentAt || null,
                            punishmentLateMailTo: student.punishmentLateMailTo || '',
                            punishmentLateMailError: student.punishmentLateMailError || ''
                        }
                    }
                );
            }
        }

        const [hws, games, learnings, subs, progs] = await Promise.all([
            Homework.find({ targetClassrooms: className, isPunishment: false, isEnabled: { $ne: false } }).lean(),
            GameLevel.find({ targetClassrooms: className, isEnabled: { $ne: false } }).lean(),
            LearningModule.find({ targetClassrooms: className, isEnabled: { $ne: false } }).lean(),
            Submission.find({}).lean(),
            GameProgress.find({}).lean()
        ]);
        let nextLearningReference = learnings.reduce((max, learning) => Math.max(max, Number(learning.referenceNumber || 0)), 0) + 1;
        const missingLearningReferences = learnings
            .filter((learning) => Number(learning.referenceNumber || 0) < 1)
            .sort((a, b) => new Date(a.createdAt || a.date || 0) - new Date(b.createdAt || b.date || 0));
        if (missingLearningReferences.length) {
            missingLearningReferences.forEach((learning) => {
                learning.referenceNumber = nextLearningReference;
                nextLearningReference += 1;
            });
            await LearningModule.bulkWrite(missingLearningReferences.map((learning) => ({
                updateOne: { filter: { _id: learning._id }, update: { $set: { referenceNumber: learning.referenceNumber } } }
            })), { ordered: false });
        }

        const studentsWithIndicators = students.map(s => {
            const indicators = [];
            const sId = String(s._id);
            const hwNotes = [];
            let gameLevelsValidated = 0;
            let learningProgressValue = 0;
            let homeworkAssigned = 0;
            let gameAssigned = 0;
            let learningAssigned = 0;
            let learningOpened = 0;
            let learningFullyValidated = 0;
            const learningReferences = [];
            hws.forEach(hw => {
                const isAssigned = hw.isAllClass || (hw.assignedStudents || []).some(id => String(id) === sId);
                if (isAssigned) {
                    homeworkAssigned += 1;
                    const sub = subs.find(sub => String(sub.studentId) === sId && String(sub.homeworkId) === String(hw._id));
                    const note = sub ? gradeToNumber(sub.grade) : 0;
                    hwNotes.push(note);
                    if (!sub) indicators.push({ type: 'hw', status: 'todo' });
                    else indicators.push({ type: 'hw', status: 'grade-' + (sub.grade || "B").replace('+', 'plus') });
                }
            });
            games.forEach(g => {
                const isAssigned = g.isAllClass || (g.assignedStudents || []).some(id => String(id) === sId);
                if (isAssigned) {
                    gameAssigned += 1;
                    const prog = progs.find(p => String(p.studentId) === sId && String(p.gameId) === String(g._id));
                    const levelReached = Number(prog?.levelReached || 0);
                    gameLevelsValidated += Math.max(0, levelReached);
                    if (!prog) indicators.push({ type: 'game', status: 'todo' });
                    else if (prog.levelReached >= 1) indicators.push({ type: 'game', status: 'done' });
                    else indicators.push({ type: 'game', status: 'started' });
                }
            });
            learnings.forEach((m) => {
                const isAssigned = m.isAllClass || (m.assignedStudents || []).some(id => String(id) === sId);
                if (!isAssigned) return;
                learningAssigned += 1;
                const completion = (m.completions || []).find((c) => String(c?.studentId || '') === sId);
                learningProgressValue += Math.max(0, Number(completion?.currentStep || 0));
                if (completion) learningOpened += 1;
                const validatedCount = Array.isArray(completion?.validatedStepIndexes) ? completion.validatedStepIndexes.length : 0;
                const totalSteps = Math.max(1, (m.steps || []).length);
                const percent = completion?.completedAt ? 100 : Math.min(100, Math.round((validatedCount / totalSteps) * 100));
                if (percent >= 100) learningFullyValidated += 1;
                learningReferences.push({
                    id: String(m._id),
                    number: Number(m.referenceNumber || 0),
                    title: String(m.title || 'Apprentissage'),
                    percent,
                    status: percent <= 0 ? 'red' : percent < 60 ? 'yellow' : percent < 100 ? 'light-green' : 'dark-green'
                });
            });
            const hwAvg = hwNotes.length > 0
                ? Math.round((hwNotes.reduce((a, b) => a + b, 0) / hwNotes.length) * 10) / 10
                : 0;
            return {
                ...s,
                indicators,
                activityStats: {
                    homework: hwAvg,
                    game: gameLevelsValidated,
                    learning: learningProgressValue
                },
                activityTotals: {
                    homework: homeworkAssigned,
                    game: gameAssigned,
                    learning: learningAssigned
                },
                learningStatus: learningAssigned === 0 || learningOpened === 0
                    ? 'yellow'
                    : (learningFullyValidated >= learningAssigned ? 'green' : 'orange'),
                learningReferences: learningReferences.sort((a, b) => a.number - b.number),
                myNote: (s.teacherNotes || []).find(n => n.teacherId && String(n.teacherId) === String(teacherId))?.text || ""
            };
        });
        res.json(studentsWithIndicators);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. ACTIONS UNITAIRES
router.post('/move', async (req, res) => {
    try {
        const { studentId, x, y, swapStudentId, swapX, swapY } = req.body;
        await Student.findByIdAndUpdate(studentId, { seatX: x, seatY: y });
        if (swapStudentId && Number.isInteger(swapX) && Number.isInteger(swapY)) {
            await Student.findByIdAndUpdate(swapStudentId, { seatX: swapX, seatY: swapY });
        }
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/layout', async (req, res) => {
    try {
        const result = await ClassroomExpert.updateLayout(req.body.classId, req.body);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/behavior', async (req, res) => {
    try {
        const { studentId, type, teacherId, extraData } = req.body;
        const s = await Student.findById(studentId);
        if (!s) return res.status(404).json({ error: "Élève non trouvé" });
        applyCrossDecay(s.behaviorRecords || []);
        let r = s.behaviorRecords.find(x => x.teacherId && String(x.teacherId) === String(teacherId));
        if (!r) { s.behaviorRecords.push({ teacherId, baseScore: 15, crosses: 0, bonuses: 0, nextCrossRemovalAt: null }); r = s.behaviorRecords[s.behaviorRecords.length-1]; }
        const ensureScores = () => {
            if (!Array.isArray(r.scores) || r.scores.length === 0) {
                const legacy = Math.max(0, Math.min(20, Number(r.baseScore ?? 15) + Number(r.bonuses || 0) * 0.5 - Number(r.crosses || 0)));
                r.scores = [{ id: `note-${Date.now()}`, value: legacy, createdAt: new Date() }];
                r.selectedScoreId = r.scores[0].id;
            }
            return r.scores;
        };
        if (type === 'ADD_SCORE') {
            const scores = ensureScores();
            const score = { id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, value: Math.max(0, Math.min(20, Number(extraData?.value ?? 15))), createdAt: new Date() };
            scores.push(score); r.selectedScoreId = score.id;
        }
        if (type === 'SELECT_SCORE') { ensureScores(); r.selectedScoreId = String(extraData?.scoreId || extraData || ''); }
        let appliedClassPointDelta = 0;
        let currentTargetScore = null;
        if (type === 'ADJUST_SCORE') {
            const scores = ensureScores();
            const scoreId = String(extraData?.scoreId || r.selectedScoreId || scores[scores.length - 1].id);
            const score = scores.find(x => String(x.id || x._id) === scoreId) || scores[scores.length - 1];
            currentTargetScore = score;
            const requestedDelta = Number(extraData?.delta || 0);
            const safeDelta = requestedDelta === 0 ? 0 : (requestedDelta < 0 ? -0.5 : 0.5);
            const previousScore = Number(score.value || 0);
            score.value = Math.max(0, Math.min(20, previousScore + safeDelta));
            appliedClassPointDelta = Number(score.value) - previousScore;
            r.selectedScoreId = String(score.id || score._id);
        }
        if (type === 'DELETE_SCORE') {
            const scores = ensureScores();
            if (scores.length > 1) {
                const scoreId = String(extraData?.scoreId || r.selectedScoreId || scores[scores.length - 1].id);
                const remaining = scores.filter(x => String(x.id) !== scoreId);
                if (remaining.length > 0 && remaining.length < scores.length) {
                    r.scores = remaining;
                    r.selectedScoreId = remaining[remaining.length - 1].id;
                }
            }
        }
        if (['TOGGLE_SCORE_PUNISHMENT', 'TOGGLE_SCORE_INCOMPLETE', 'TOGGLE_SCORE_WARNING'].includes(type)) {
            const scores = ensureScores();
            const scoreId = String(extraData?.scoreId || r.selectedScoreId || scores[scores.length - 1].id);
            const score = scores.find(x => String(x.id || x._id) === scoreId) || scores[scores.length - 1];
            currentTargetScore = score;
            r.selectedScoreId = String(score.id || score._id);
            if (type === 'TOGGLE_SCORE_WARNING') {
                score.boardWarning = !Boolean(score.boardWarning);
            } else {
                const field = type === 'TOGGLE_SCORE_PUNISHMENT' ? 'punishment' : 'workIncomplete';
                const penaltyDelta = type === 'TOGGLE_SCORE_INCOMPLETE' ? 6 : 9;
                const hadPenaltyReason = Boolean(score.punishment || score.workIncomplete);
                score[field] = !Boolean(score[field]);
                const hasPenaltyReason = Boolean(score.punishment || score.workIncomplete);
                const prevValue = Number(score.value || 0);
                if (!hadPenaltyReason && hasPenaltyReason) {
                    score.value = Math.max(0, Math.min(20, Number(score.value || 0) - penaltyDelta));
                    score.penaltyAmount = penaltyDelta;
                } else if (hadPenaltyReason && !hasPenaltyReason) {
                    const restoreAmount = Math.max(0, Number(score.penaltyAmount || penaltyDelta));
                    score.value = Math.max(0, Math.min(20, Number(score.value || 0) + restoreAmount));
                    score.penaltyAmount = 0;
                }
                appliedClassPointDelta = Number(score.value) - prevValue;
                if (field === 'workIncomplete' && !score.workIncomplete) {
                    score.workIncompleteText = '';
                }
                if (field === 'punishment' && !score.punishment) {
                    score.punishmentText = '';
                }
                r.workIncomplete = scores.some((item) => Boolean(item?.workIncomplete));
                if (!r.workIncomplete) r.workIncompleteText = '';
                s.workIncomplete = Boolean(r.workIncomplete);
                if (!s.workIncomplete) s.workIncompleteText = '';
                if (type === 'TOGGLE_SCORE_PUNISHMENT') {
                    const hasAnyPunishment = scores.some((item) => Boolean(item?.punishment));
                    if (hasAnyPunishment) {
                        const assigned = await assignPunishmentTemplate(s, teacherId);
                        if (!assigned) {
                            s.punishmentStatus = 'PENDING';
                            s.punishmentDueDate = new Date(Date.now() + PUNISHMENT_DUE_MS);
                            resetLateMailState(s);
                        }
                    } else {
                        s.punishmentStatus = 'NONE';
                        s.punishmentDueDate = null;
                        r.punishmentText = '';
                        resetLateMailState(s);
                    }
                }
            }
        }
        if (type === 'TOGGLE_FORCED_SIX') {
            r.forcedSix = !Boolean(r.forcedSix);
            r.forcedSixCount = r.forcedSix ? Math.max(1, Number(r.forcedSixCount || 0)) : 0;
        }
        if (type === 'ADD_FORCED_SIX') {
            const scores = ensureScores();
            if (!r.forcedSix) {
                const scoreId = String(extraData?.scoreId || r.selectedScoreId || scores[scores.length - 1].id);
                const score = scores.find(x => String(x.id || x._id) === scoreId) || scores[scores.length - 1];
                score.value = Math.max(0, Math.min(20, Number(score.value || 0) - 9));
                r.forcedSixScoreId = String(score.id || score._id);
                r.forcedSixDebtAmount = 9;
                appliedClassPointDelta = -9;
            }
            r.forcedSix = true;
            r.forcedSixCount = Math.max(1, Number(r.forcedSixCount || 0) + 1);
        }
        if (type === 'RESOLVE_FORCED_SIX') {
            const scores = ensureScores();
            const targetScoreId = String(r.forcedSixScoreId || extraData?.scoreId || r.selectedScoreId || scores[scores.length - 1].id);
            const score = scores.find(x => String(x.id || x._id) === targetScoreId) || scores[scores.length - 1];
            const restoreAmount = Math.max(0, Number(r.forcedSixDebtAmount || 9));
            score.value = Math.max(0, Math.min(20, Number(score.value || 0) + restoreAmount));
            appliedClassPointDelta = restoreAmount;
            r.forcedSix = false;
            r.forcedSixCount = 0;
            r.forcedSixScoreId = '';
            r.forcedSixDebtAmount = 0;
        }
        if (type === 'ADD_CROSS') {
            r.crosses = (r.crosses || 0) + 1;
            r.lastCrossDate = new Date();
            r.nextCrossRemovalAt = new Date(Date.now() + CROSS_DECAY_MS);
            if (r.crosses >= 3) {
                const assigned = await assignPunishmentTemplate(s, teacherId);
                if (!assigned) {
                    s.punishmentStatus = 'PENDING';
                    s.punishmentDueDate = new Date(Date.now() + PUNISHMENT_DUE_MS);
                    resetLateMailState(s);
                }
            }
        }
        if (type === 'ADD_BONUS') r.bonuses = (r.bonuses || 0) + 1;
        if (type === 'REMOVE_CROSS') {
            r.crosses = Math.max(0, (r.crosses || 0) - 1);
            if (r.crosses === 0) r.nextCrossRemovalAt = null;
            else if (!r.nextCrossRemovalAt) r.nextCrossRemovalAt = new Date(Date.now() + CROSS_DECAY_MS);
        }
        if (type === 'REMOVE_BONUS') r.bonuses = Math.max(0, r.bonuses - 1);
        if (type === 'SAVE_NOTE') {
            let n = s.teacherNotes.find(x => String(x.teacherId) === String(teacherId));
            if (!n) s.teacherNotes.push({ teacherId, text: extraData }); else n.text = extraData;
        }
        if (type === 'SAVE_INCOMPLETE_WORK_DETAILS') {
            const scores = ensureScores();
            const scoreId = String(extraData?.scoreId || r.selectedScoreId || scores[scores.length - 1].id);
            const score = scores.find(x => String(x.id || x._id) === scoreId) || scores[scores.length - 1];
            const workText = String(extraData?.workIncompleteText ?? '').trim();
            const punishText = String(extraData?.punishmentText ?? '').trim();
            if (score) {
                if (score.workIncomplete) score.workIncompleteText = workText;
                else score.workIncompleteText = '';
                if (score.punishment) score.punishmentText = punishText;
                else score.punishmentText = '';
            }
            if (r.workIncomplete) r.workIncompleteText = workText;
            else r.workIncompleteText = '';
            if (scores.some(x => Boolean(x.punishment))) r.punishmentText = punishText;
            else r.punishmentText = '';
            s.workIncomplete = Boolean(r.workIncomplete);
            s.workIncompleteText = r.workIncompleteText;
        }
        if (type === 'SAVE_NICKNAME') {
            s.nickname = String(extraData || '').trim().slice(0, 40);
        }
        if (type === 'REMOVE_PUNISHMENT') {
            s.punishmentStatus = 'NONE';
            s.punishmentDueDate = null;
            resetLateMailState(s);
        }
        if (type === 'ADD_PUNISHMENT') {
            const assigned = await assignPunishmentTemplate(s, teacherId);
            if (!assigned) {
                s.punishmentStatus = 'PENDING';
                s.punishmentDueDate = new Date(Date.now() + PUNISHMENT_DUE_MS);
                resetLateMailState(s);
            }
        }

        if ((s.punishmentStatus === 'PENDING' || s.punishmentStatus === 'LATE') && s.punishmentDueDate) {
            const dueTs = new Date(s.punishmentDueDate).getTime();
            if (Number.isFinite(dueTs) && dueTs <= Date.now()) {
                s.punishmentStatus = 'LATE';
                await sendLatePunishmentMail(s);
            }
        }

        s.markModified('behaviorRecords');
        await s.save();
        const scoreClassId = String(extraData?.classId || '').trim();
        if (scoreClassId && mongoose.Types.ObjectId.isValid(scoreClassId) && ['TOGGLE_SCORE_PUNISHMENT', 'TOGGLE_SCORE_INCOMPLETE', 'TOGGLE_SCORE_WARNING'].includes(type)) {
            const classroomForDebts = await Classroom.findById(scoreClassId);
            if (classroomForDebts) {
                const displayName = `${String(s.nickname || s.firstName || '').trim()} ${String(s.lastName || '').trim().slice(0, 1)}.`.trim();
                const scores = Array.isArray(r.scores) ? r.scores : [];
                const hasPunishment = scores.some((score) => Boolean(score?.punishment)) || String(s.punishmentStatus || '') === 'PENDING' || String(s.punishmentStatus || '') === 'LATE';
                const hasIncomplete = scores.some((score) => Boolean(score?.workIncomplete)) || Boolean(r.workIncomplete);
                const studentId = String(s._id);
                const debts = (Array.isArray(classroomForDebts.activePersistentDebts) ? classroomForDebts.activePersistentDebts : [])
                    .filter((row) => String(row?.studentId || '') !== studentId);
                if (hasPunishment || hasIncomplete) debts.push({ studentId, name: displayName, status: hasPunishment ? 'punishment' : 'incomplete' });
                classroomForDebts.activePersistentDebts = debts.slice(0, 40);

                // Only the board warning is temporary. It expires precisely
                // when the next hour begins and is removed rather than being
                // shown again in the following class period.
                if (type === 'TOGGLE_SCORE_WARNING') {
                    const selected = currentTargetScore || scores.find((score) => String(score?.id || score?._id || '') === String(r.selectedScoreId || '')) || scores[scores.length - 1];
                    const warnings = (Array.isArray(classroomForDebts.activeHourWarnings) ? classroomForDebts.activeHourWarnings : [])
                        .filter((row) => Number(row?.expiresAt || 0) > Date.now() && String(row?.studentId || '') !== studentId);
                    if (selected?.boardWarning) {
                        const nextHour = new Date();
                        nextHour.setMinutes(60, 0, 0);
                        warnings.push({ studentId, name: displayName, expiresAt: nextHour.getTime(), kind: 'board-warning' });
                    }
                    classroomForDebts.activeHourWarnings = warnings.slice(0, 8);
                }
                await classroomForDebts.save();
            }
        }
        const liveAlertTypes = new Set(['ADJUST_SCORE', 'TOGGLE_SCORE_WARNING', 'TOGGLE_SCORE_PUNISHMENT', 'TOGGLE_SCORE_INCOMPLETE', 'ADD_PUNISHMENT', 'ADD_FORCED_SIX']);
        if (scoreClassId && mongoose.Types.ObjectId.isValid(scoreClassId) && liveAlertTypes.has(type)) {
            const displayName = String(s.nickname || '').trim()
                || (s.firstName ? `${String(s.firstName).trim()} ${String(s.lastName || '').trim().slice(0, 1)}.` : '')
                || (s.lastName ? `${String(s.lastName).trim()}` : 'Élève');
            let message = '';
            let alertType = 'warning';
            let alertScore = null;

            const scores = Array.isArray(r.scores) ? r.scores : [];
            const selected = currentTargetScore || scores.find((row) => String(row?.id || row?._id || '') === String(r.selectedScoreId || '')) || scores[scores.length - 1] || null;
            const targetScoreValue = (selected && selected.value !== null && selected.value !== undefined && Number.isFinite(Number(selected.value)))
                ? Number(selected.value)
                : null;

            if (type === 'ADJUST_SCORE' && appliedClassPointDelta !== 0) {
                const absoluteDelta = Math.abs(appliedClassPointDelta);
                const formattedDelta = Number.isInteger(absoluteDelta) ? String(absoluteDelta) : absoluteDelta.toFixed(1).replace('.', ',');
                message = `${displayName} ${appliedClassPointDelta > 0 ? '+' : '−'}${formattedDelta}`;
                alertType = appliedClassPointDelta > 0 ? 'positive' : 'negative';
                alertScore = targetScoreValue;
            } else {
                if (type === 'TOGGLE_SCORE_WARNING' && selected?.boardWarning) {
                    message = `Avertissement au tableau : ${displayName}`;
                    alertType = 'warning';
                    alertScore = null;
                } else if (type === 'TOGGLE_SCORE_PUNISHMENT') {
                    if (selected?.punishment) {
                        message = `Punition · ${displayName} −9`;
                        alertType = 'negative';
                        alertScore = targetScoreValue;
                    }
                } else if (type === 'ADD_PUNISHMENT') {
                    message = `Punition : ${displayName}`;
                    alertType = 'negative';
                    alertScore = null;
                } else if (type === 'TOGGLE_SCORE_INCOMPLETE') {
                    if (selected?.workIncomplete) {
                        message = `Travail non fait · ${displayName} −6`;
                        alertType = 'negative';
                        alertScore = targetScoreValue;
                    } else {
                        message = `Travail validé · ${displayName} +6`;
                        alertType = 'positive';
                        alertScore = targetScoreValue;
                    }
                } else if (type === 'ADD_FORCED_SIX') {
                    message = `Note forcée à 6 · ${displayName}`;
                    alertType = 'negative';
                    alertScore = targetScoreValue;
                }
            }
            if (message) {
                const now = new Date();
                const alert = {
                    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
                    message,
                    type: alertType,
                    studentId: String(s._id),
                    studentName: displayName,
                    pointsDelta: appliedClassPointDelta,
                    score: alertScore !== null && Number.isFinite(alertScore) ? Number(alertScore) : null,
                    createdAt: now
                };
                await Classroom.updateOne(
                    { _id: scoreClassId },
                    {
                        $set: {
                            activeStudentBonusAlert: message,
                            activeStudentBonusAlertTime: now,
                            scoreAlertReplayId: alert.id
                        },
                        $inc: { scoreAlertSyncVersion: 1 },
                        $push: { activeScoreAlerts: { $each: [alert], $slice: -6 } }
                    }
                );
            }
        }
        if (type === 'ADJUST_SCORE' && scoreClassId && appliedClassPointDelta !== 0 && mongoose.Types.ObjectId.isValid(scoreClassId)) {
            await Classroom.updateOne(
                { _id: scoreClassId, classPointsInitialized: { $ne: true } },
                { $set: { classPoints: 10, classPointsInitialized: true } }
            );
            await Classroom.updateOne({ _id: scoreClassId }, { $inc: { classPoints: appliedClassPointDelta } });
        }
        res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:classId/adjust-all-scores', async (req, res) => {
    try {
        const { classId } = req.params;
        const teacherId = String(req.body?.teacherId || '').trim();
        const delta = Number(req.body?.delta) < 0 ? -1 : 1;
        if (!teacherId) return res.status(400).json({ error: 'Professeur requis' });

        const [{ clsObj, students: classStudents }, cls] = await Promise.all([
            getStudentsForClassOrGroup(classId),
            Classroom.findById(classId)
        ]);
        if (!clsObj || !cls) return res.status(404).json({ error: 'Classe introuvable' });

        const ids = classStudents.map((student) => student?._id).filter(Boolean);
        const studentDocs = await Student.find({ _id: { $in: ids } });
        let totalAppliedDelta = 0;
        await Promise.all(studentDocs.map(async (student) => {
            let record = student.behaviorRecords.find((row) => row?.teacherId && String(row.teacherId) === teacherId);
            if (!record) {
                student.behaviorRecords.push({ teacherId, baseScore: 15, crosses: 0, bonuses: 0, scores: [] });
                record = student.behaviorRecords[student.behaviorRecords.length - 1];
            }
            if (!Array.isArray(record.scores) || record.scores.length === 0) {
                const legacyValue = Math.max(0, Math.min(20, Number(record.baseScore ?? 15) + Number(record.bonuses || 0) * .5 - Number(record.crosses || 0)));
                record.scores = [{ id: `note-${Date.now()}-${student._id}`, value: legacyValue, createdAt: new Date() }];
                record.selectedScoreId = record.scores[0].id;
            }
            const selectedId = String(record.selectedScoreId || record.scores[record.scores.length - 1].id);
            const selectedScore = record.scores.find((score) => String(score.id) === selectedId) || record.scores[record.scores.length - 1];
            const previousScore = Number(selectedScore.value || 0);
            selectedScore.value = Math.max(0, Math.min(20, previousScore + delta));
            totalAppliedDelta += Number(selectedScore.value) - previousScore;
            record.selectedScoreId = selectedScore.id;
            student.markModified('behaviorRecords');
            await student.save();
        }));

        if (cls.classPointsInitialized !== true) {
            cls.classPoints = 10;
            cls.classPointsInitialized = true;
        }
        cls.classPoints = Number(cls.classPoints || 0) + totalAppliedDelta;
        const now = new Date();
        const alert = {
            id: `${now.getTime()}-class-${Math.random().toString(36).slice(2, 8)}`,
            message: delta < 0 ? 'Toute la classe : −1 par élève' : 'Toute la classe : +1 par élève',
            type: delta < 0 ? 'negative' : 'positive',
            createdAt: now
        };
        cls.activeStudentBonusAlert = alert.message;
        cls.activeStudentBonusAlertTime = now;
        cls.activeScoreAlerts = [...(Array.isArray(cls.activeScoreAlerts) ? cls.activeScoreAlerts : []), alert].slice(-6);
        cls.scoreAlertSyncVersion = Number(cls.scoreAlertSyncVersion || 0) + 1;
        cls.scoreAlertReplayId = alert.id;
        await cls.save();

        res.json({ ok: true, adjustedStudents: studentDocs.length, appliedDelta: totalAppliedDelta, classPoints: cls.classPoints, alert });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:classId/live-action', async (req, res) => {
    try {
        const { classId } = req.params;
        const { action, studentName, message, warnings } = req.body;
        const cls = await Classroom.findById(classId);
        if (!cls) return res.status(404).json({ error: "Classe introuvable" });

        let liveAlert = null;
        if (action === 'highlight') {
            cls.activeStudentHighlight = message || studentName;
            cls.activeStudentHighlightTime = new Date();
            liveAlert = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: 'highlight',
                studentName: String(message || studentName || '').trim(),
                message: String(message || studentName || '').trim(),
                createdAt: cls.activeStudentHighlightTime
            };
        } else if (action === 'bonus') {
            cls.activeStudentBonusAlert = `Félicitations à ${studentName} !`;
            cls.activeStudentBonusAlertTime = new Date();
            liveAlert = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: 'positive',
                studentName: String(studentName || '').trim(),
                message: cls.activeStudentBonusAlert,
                createdAt: cls.activeStudentBonusAlertTime
            };
        } else if (action === 'bonus-message') {
            const now = new Date();
            const alert = {
                id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
                message: String(message || studentName || '').trim(),
                createdAt: now
            };
            // Mise à jour atomique : deux appuis rapprochés ne peuvent plus
            // s'écraser mutuellement dans le tableau d'alertes.
            await Classroom.updateOne(
                { _id: classId },
                {
                    $set: {
                        activeStudentBonusAlert: alert.message,
                        activeStudentBonusAlertTime: now,
                        scoreAlertReplayId: alert.id
                    },
                    $inc: { scoreAlertSyncVersion: 1 },
                    $push: { activeScoreAlerts: { $each: [alert], $slice: -6 } }
                }
            );
            return res.json({ ok: true, alert });
        } else if (action === 'class-bonus') {
            cls.activeStudentBonusAlert = message || 'Bravo +1';
            cls.activeStudentBonusAlertTime = new Date();
            liveAlert = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: 'positive',
                message: cls.activeStudentBonusAlert,
                createdAt: cls.activeStudentBonusAlertTime
            };
        } else if (action === 'hour-warnings') {
            const now = Date.now();
            cls.activeHourWarnings = Array.isArray(warnings)
                ? warnings
                    .map((row) => ({
                        studentId: String(row?.studentId || ''),
                        name: String(row?.name || '').trim(),
                        expiresAt: Number(row?.expiresAt || 0)
                    }))
                    .filter((row) => row.studentId && row.name && row.expiresAt > now)
                    .slice(0, 8)
                : [];
        } else if (action === 'add-point') {
            cls.classPoints = (cls.classPoints || 0) + 1;
        } else if (action === 'remove-point') {
            cls.classPoints = Math.max(0, (cls.classPoints || 0) - 1);
        }

        // Les actions venant du téléphone doivent toujours apparaître dans
        // le même flux que les variations de notes. Les anciens champs seuls
        // étaient parfois lus trop tard par le tableau et disparaissaient.
        if (liveAlert) {
            cls.activeScoreAlerts = [...(Array.isArray(cls.activeScoreAlerts) ? cls.activeScoreAlerts : []), liveAlert].slice(-6);
            cls.scoreAlertSyncVersion = Number(cls.scoreAlertSyncVersion || 0) + 1;
            cls.scoreAlertReplayId = liveAlert.id;
        }
        await cls.save();
        res.json(cls);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
