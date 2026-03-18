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
        const result = await ClassroomExpert.applyPlanFromImage(req.body.classId, req.file);
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

// 2. RÉCUPÉRATION INFOS CLASSE
router.get('/:classId', async (req, res) => {
    try {
        const cls = await Classroom.findById(req.params.classId).lean();
        if (!cls) return res.status(404).json({ error: "Classe introuvable" });
        res.json(cls);
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

        for (const student of students) {
            if (applyCrossDecay(student.behaviorRecords || [])) {
                student.markModified('behaviorRecords');
                await student.save();
            }
        }

        const [hws, games, learnings, subs, progs] = await Promise.all([
            Homework.find({ targetClassrooms: className, isPunishment: false, isEnabled: { $ne: false } }).lean(),
            GameLevel.find({ targetClassrooms: className, isEnabled: { $ne: false } }).lean(),
            LearningModule.find({ targetClassrooms: className, isEnabled: { $ne: false } }).lean(),
            Submission.find({}).lean(),
            GameProgress.find({}).lean()
        ]);

        const studentsWithIndicators = students.map(s => {
            const indicators = [];
            const sId = String(s._id);
            const hwNotes = [];
            let gameLevelsValidated = 0;
            let learningProgressValue = 0;
            let homeworkAssigned = 0;
            let gameAssigned = 0;
            let learningAssigned = 0;
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
                myNote: (s.teacherNotes || []).find(n => n.teacherId && String(n.teacherId) === String(teacherId))?.text || ""
            };
        });
        res.json(studentsWithIndicators);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. ACTIONS UNITAIRES
router.post('/move', async (req, res) => {
    try {
        await Student.findByIdAndUpdate(req.body.studentId, { seatX: req.body.x, seatY: req.body.y });
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
        if (!r) { s.behaviorRecords.push({ teacherId, crosses: 0, bonuses: 0, nextCrossRemovalAt: null }); r = s.behaviorRecords[s.behaviorRecords.length-1]; }
        if (type === 'CROSS') {
            const hadNoCross = Number(r.crosses || 0) <= 0;
            r.crosses = Number(r.crosses || 0) + 1;
            if (hadNoCross || !r.nextCrossRemovalAt) r.nextCrossRemovalAt = new Date(Date.now() + CROSS_DECAY_MS);
            if (Number(r.crosses || 0) >= 3) {
                await assignPunishmentTemplate(s, teacherId);
            }
        }
        if (type === 'BONUS') r.bonuses++;
        if (type === 'REMOVE_CROSS') {
            r.crosses = Math.max(0, Number(r.crosses || 0) - 1);
            if (r.crosses <= 0) r.nextCrossRemovalAt = null;
            else if (!r.nextCrossRemovalAt) r.nextCrossRemovalAt = new Date(Date.now() + CROSS_DECAY_MS);
        }
        if (type === 'REMOVE_BONUS') r.bonuses = Math.max(0, r.bonuses - 1);
        if (type === 'SAVE_NOTE') {
            let n = s.teacherNotes.find(x => String(x.teacherId) === String(teacherId));
            if (!n) s.teacherNotes.push({ teacherId, text: extraData }); else n.text = extraData;
        }
        if (type === 'SAVE_NICKNAME') {
            s.nickname = String(extraData || '').trim().slice(0, 40);
        }
        if (type === 'REMOVE_PUNISHMENT') {
            s.punishmentStatus = 'NONE';
            s.punishmentDueDate = null;
            resetLateMailState(s);
        }

        if ((s.punishmentStatus === 'PENDING' || s.punishmentStatus === 'LATE') && s.punishmentDueDate) {
            const dueTs = new Date(s.punishmentDueDate).getTime();
            if (Number.isFinite(dueTs) && dueTs <= Date.now()) {
                s.punishmentStatus = 'LATE';
                await sendLatePunishmentMail(s);
            }
        }

        s.markModified('behaviorRecords');
        await s.save(); res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
