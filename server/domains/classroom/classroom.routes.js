const express = require('express');
const router = express.Router();
const ClassroomExpert = require('./experts/classroom.expert');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });

// GET PLAN CLASSE (Sécurisé anti-crash)
router.get('/plan/:classId', asyncHandler(async (req, res) => {
    const teacherId = req.query.teacherId;

    // MODE SECOURS : Si pas de teacherId, on renvoie juste les élèves (sans notes/indicateurs)
    // Cela évite l'erreur 400 "Bad Request" qui masque les élèves
    if (!teacherId || teacherId === 'undefined' || teacherId === 'null') {
        console.warn("⚠️ [PLAN] Pas de TeacherID, chargement simple.");
        const students = await mongoose.model('Student').find({ classId: req.params.classId }).lean();
        return res.json(students);
    }

    try {
        const students = await ClassroomExpert.getClassroomData(req.params.classId, teacherId);
        res.json(students);
    } catch (e) {
        console.error("❌ [PLAN] Erreur Data Enrichie:", e);
        // En cas d'erreur de l'expert, on fallback sur la liste simple aussi
        const students = await mongoose.model('Student').find({ classId: req.params.classId }).lean();
        res.json(students);
    }
}));

router.get('/:classId', asyncHandler(async (req, res) => {
    const cls = await mongoose.model('Classroom').findById(req.params.classId).lean();
    if (!cls) return res.status(404).json({ error: "Classe introuvable" });
    res.json(cls);
}));

router.post('/layout', asyncHandler(async (req, res) => { res.json(await ClassroomExpert.updateLayoutSeparators(req.body.classId, req.body.separators)); }));

router.post('/import-plan', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    try {
        const result = await ClassroomExpert.applyPlanFromImage(req.body.classId, req.file);
        try { fs.unlinkSync(req.file.path); } catch(e){}
        res.json({ ok: true, count: result.length, message: `Plan appliqué !` });
    } catch (e) {
        try { fs.unlinkSync(req.file.path); } catch(e){}
        res.status(500).json({ error: e.message });
    }
}));

router.post('/swap', asyncHandler(async (req, res) => { const { id1, id2 } = req.body; await ClassroomExpert.swapSeats(id1, id2); res.json({ ok: true }); }));
router.post('/move', asyncHandler(async (req, res) => { const { studentId, x, y } = req.body; await ClassroomExpert.moveStudentTo(studentId, x, y); res.json({ ok: true }); }));

router.post('/behavior', asyncHandler(async (req, res) => {
    const { studentId, type, teacherId, extraData } = req.body;
    const result = await ClassroomExpert.addBehavior(studentId, type, teacherId, extraData);
    res.json(result);
}));

router.post('/redemption', asyncHandler(async (req, res) => { res.json(await ClassroomExpert.applyWeeklyRedemption(req.body.classId, req.body.teacherId)); }));

module.exports = router;