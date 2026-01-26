const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const HomeworkDB = require('./experts/homework.db');
const HomeworkAI = require('./experts/homework.ai');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- NOUVELLE ROUTE : ANNULER UNE PUNITION ---
router.post('/remove-punishment', asyncHandler(async (req, res) => {
    const { homeworkId, studentId } = req.body;
    
    // 1. Retirer l'élève du devoir Punition
    await mongoose.model('Homework').findByIdAndUpdate(homeworkId, {
        $pull: { assignedStudents: studentId }
    });

    // 2. Remettre le statut de l'élève à la normale
    await mongoose.model('Student').findByIdAndUpdate(studentId, {
        punishmentStatus: 'NONE',
        punishmentDueDate: null
    });

    res.json({ ok: true, message: "Punition annulée." });
}));

// --- ROUTE : GÉNÉRER GRILLE DE CORRECTION ---
router.post('/generate-hints', asyncHandler(async (req, res) => {
    const { instruction, assets } = req.body;
    if (!assets || assets.length === 0) return res.status(400).json({ error: "Aucun document chargé." });
    const hints = await HomeworkAI.generateHintsFromAssets(instruction, assets);
    res.json({ hints });
}));

router.post('/', asyncHandler(async (req, res) => {
    const Homework = mongoose.model('Homework');
    const data = req.body;
    let result;
    if (data._id) result = await Homework.findByIdAndUpdate(data._id, data, { new: true });
    else result = await Homework.create(data);
    res.json(result);
}));

router.get('/all', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Homework').find({}).sort({ date: -1 }).lean());
}));

router.get('/submissions', asyncHandler(async (req, res) => {
    const subs = await mongoose.model('Submission').find({}, 'studentId homeworkId grade createdAt').lean();
    res.json(subs);
}));

router.get('/submission/:id', asyncHandler(async (req, res) => {
    const sub = await HomeworkDB.getSubmissionDetails(req.params.id);
    if (!sub) return res.status(404).json({ error: "Copie introuvable" });
    res.json(sub);
}));

router.put('/submission/:id', asyncHandler(async (req, res) => {
    const updated = await HomeworkDB.updateSubmission(req.params.id, req.body);
    res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Homework').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

const multer = require('multer');
const upload = multer({ dest: 'public/uploads/' });
router.post('/upload', upload.array('files'), (req, res) => {
    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
});

router.post('/analyze-homework', (req, res) => HomeworkDB.processSubmission(req.body, HomeworkAI).then(r => res.json(r)));

module.exports = router;