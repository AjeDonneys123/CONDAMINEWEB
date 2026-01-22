const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const DriveEngine = require('../../core/drive.engine');
const StructureDrive = require('../structure/experts/structure.drive');
const HomeworkDB = require('./experts/homework.db'); // Import de l'expert

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- ROUTES EXISTANTES ---
router.post('/', asyncHandler(async (req, res) => {
    // ... (Code upload inchangé, voir version précédente pour gain de place) ...
    // Je remets le code court pour la snippet, le serveur ne change pas cette partie
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
    // On renvoie l'ID de la soumission (_id) pour pouvoir cliquer dessus
    const subs = await mongoose.model('Submission').find({}, 'studentId homeworkId grade createdAt').lean();
    res.json(subs);
}));

// --- NOUVEAU V210 : GESTION DES CORRECTIONS ---

// 1. Lire le détail d'une copie (Texte + Feedback)
router.get('/submission/:id', asyncHandler(async (req, res) => {
    const sub = await HomeworkDB.getSubmissionDetails(req.params.id);
    if (!sub) return res.status(404).json({ error: "Copie introuvable" });
    res.json(sub);
}));

// 2. Mettre à jour une copie (Note, Feedback, Texte)
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

router.post('/analyze-homework', (req, res) => HomeworkDB.processSubmission(req.body, require('./experts/homework.ai')).then(r => res.json(r)));

module.exports = router;