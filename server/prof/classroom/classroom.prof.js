// @signatures: ProfClassroomRouter, details, plan, move, behavior, layout, importPlan
const express = require('express');
const router = express.Router();
const { Student, Classroom, Homework, GameLevel, Submission, GameProgress } = require('../models/prof.models');
const ClassroomExpert = require('../../domains/classroom/experts/classroom.expert'); // Indispensable pour l'IA
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration Multer pour l'import d'image
const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });
const CROSS_DECAY_MS = 14 * 24 * 60 * 60 * 1000;

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
        const clsObj = await Classroom.findById(classId).lean();
        const className = clsObj?.name;

        const [students, hws, games, subs, progs] = await Promise.all([
            Student.find({ classId }).lean(),
            Homework.find({ targetClassrooms: className, isPunishment: false }).lean(),
            GameLevel.find({ targetClassrooms: className }).lean(),
            Submission.find({}).lean(),
            GameProgress.find({}).lean()
        ]);

        const studentsWithIndicators = students.map(s => {
            const indicators = [];
            const sId = String(s._id);
            hws.forEach(hw => {
                const isAssigned = hw.isAllClass || (hw.assignedStudents || []).some(id => String(id) === sId);
                if (isAssigned) {
                    const sub = subs.find(sub => String(sub.studentId) === sId && String(sub.homeworkId) === String(hw._id));
                    if (!sub) indicators.push({ type: 'hw', status: 'todo' });
                    else indicators.push({ type: 'hw', status: 'grade-' + (sub.grade || "B").replace('+', 'plus') });
                }
            });
            games.forEach(g => {
                const isAssigned = g.isAllClass || (g.assignedStudents || []).some(id => String(id) === sId);
                if (isAssigned) {
                    const prog = progs.find(p => String(p.studentId) === sId && String(p.gameId) === String(g._id));
                    if (!prog) indicators.push({ type: 'game', status: 'todo' });
                    else if (prog.levelReached >= 1) indicators.push({ type: 'game', status: 'done' });
                    else indicators.push({ type: 'game', status: 'started' });
                }
            });
            return { ...s, indicators, myNote: (s.teacherNotes || []).find(n => n.teacherId && String(n.teacherId) === String(teacherId))?.text || "" };
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
        if (type === 'REMOVE_PUNISHMENT') s.punishmentStatus = 'NONE';
        s.markModified('behaviorRecords');
        await s.save(); res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
