// @signatures: ProfClassroomRouter, details, plan, move, behavior, layout
const express = require('express');
const router = express.Router();
const { Student, Classroom, Homework, GameLevel, Submission, GameProgress } = require('../models/prof.models');

/**
 * 🎓 BLOC PROF : LOGIQUE CLASSE (/api/classroom)
 */

router.get('/:classId', async (req, res) => {
    try {
        const cls = await Classroom.findById(req.params.classId).lean();
        if (!cls) return res.status(404).json({ error: "Classe introuvable" });
        res.json(cls);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/plan/:classId', async (req, res) => {
    try {
        const { teacherId } = req.query;
        const classId = req.params.classId;
        const clsObj = await Classroom.findById(classId).lean();
        const className = clsObj?.name;

        // 1. Récupérer les données
        const [students, hws, games, subs, progs] = await Promise.all([
            Student.find({ classId }).lean(),
            Homework.find({ targetClassrooms: className, isPunishment: false }).lean(),
            GameLevel.find({ targetClassrooms: className }).lean(),
            Submission.find({}).lean(),
            GameProgress.find({}).lean()
        ]);

        // 2. Calculer les indicateurs avec le nouveau code couleur (V17:15)
        const studentsWithIndicators = students.map(s => {
            const indicators = [];
            const sId = String(s._id);

            // -- CHECK HOMEWORKS --
            hws.forEach(hw => {
                const isAssigned = hw.isAllClass || (hw.assignedStudents || []).some(id => String(id) === sId);
                if (isAssigned) {
                    const sub = subs.find(sub => String(sub.studentId) === sId && String(sub.homeworkId) === String(hw._id));
                    
                    if (!sub) {
                        indicators.push({ type: 'hw', status: 'todo' }); // Orange
                    } else {
                        // Mappage des notes
                        let gradeStatus = 'grade-B'; // Défaut
                        const g = (sub.grade || "").toUpperCase();
                        if (g === 'C') gradeStatus = 'grade-C';
                        if (g === 'B') gradeStatus = 'grade-B';
                        if (g === 'A') gradeStatus = 'grade-A';
                        if (g === 'A+') gradeStatus = 'grade-Aplus';
                        
                        indicators.push({ type: 'hw', status: gradeStatus });
                    }
                }
            });

            // -- CHECK GAMES --
            games.forEach(g => {
                const isAssigned = g.isAllClass || (g.assignedStudents || []).some(id => String(id) === sId);
                if (isAssigned) {
                    const prog = progs.find(p => String(p.studentId) === sId && String(p.gameId) === String(g._id));
                    
                    if (!prog) {
                        indicators.push({ type: 'game', status: 'todo' }); // Violet
                    } else if (prog.levelReached >= 1) {
                        indicators.push({ type: 'game', status: 'done' }); // Violet Foncé
                    } else {
                        indicators.push({ type: 'game', status: 'started' }); // Rose Clair
                    }
                }
            });

            return {
                ...s,
                indicators,
                myNote: (s.teacherNotes || []).find(n => n.teacherId && String(n.teacherId) === String(teacherId))?.text || ""
            };
        });

        res.json(studentsWithIndicators);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/move', async (req, res) => {
    try {
        await Student.findByIdAndUpdate(req.body.studentId, { seatX: req.body.x, seatY: req.body.y });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/layout', async (req, res) => {
    try {
        const { classId, separators } = req.body;
        await Classroom.findByIdAndUpdate(classId, { "layout.separators": separators });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/behavior', async (req, res) => {
    try {
        const { studentId, type, teacherId, extraData } = req.body;
        const s = await Student.findById(studentId);
        if (!s) return res.status(404).json({ error: "Élève non trouvé" });
        let r = s.behaviorRecords.find(x => x.teacherId && String(x.teacherId) === String(teacherId));
        if (!r) { s.behaviorRecords.push({ teacherId, crosses: 0, bonuses: 0 }); r = s.behaviorRecords[s.behaviorRecords.length-1]; }
        if (type === 'CROSS') r.crosses++;
        if (type === 'BONUS') r.bonuses++;
        if (type === 'REMOVE_CROSS') r.crosses = Math.max(0, r.crosses - 1);
        if (type === 'REMOVE_BONUS') r.bonuses = Math.max(0, r.bonuses - 1);
        if (type === 'SAVE_NOTE') {
            let n = s.teacherNotes.find(x => String(x.teacherId) === String(teacherId));
            if (!n) s.teacherNotes.push({ teacherId, text: extraData }); else n.text = extraData;
        }
        if (type === 'REMOVE_PUNISHMENT') s.punishmentStatus = 'NONE';
        await s.save();
        res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
