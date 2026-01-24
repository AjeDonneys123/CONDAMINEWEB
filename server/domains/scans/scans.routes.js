const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const ScanAI = require('./ai/scan.ai');

const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const upload = multer({ dest: uploadDir });
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ... (Routes GET/POST sessions et upload inchangées) ...
router.get('/sessions', asyncHandler(async (req, res) => { const sessions = await mongoose.model('ScanSession').find({}).sort({ date: -1 }).lean(); res.json(sessions); }));
router.post('/sessions', asyncHandler(async (req, res) => { const { title, teacherId } = req.body; const session = await mongoose.model('ScanSession').create({ title: title || `${new Date().toLocaleDateString('fr-FR').slice(0,5)} Nouveau Scan`, teacherId }); res.json(session); }));
router.patch('/sessions/:id', asyncHandler(async (req, res) => { const { title, chapterId } = req.body; const updateData = {}; if (title) updateData.title = title; if (chapterId) updateData.chapterId = chapterId; const session = await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true }); res.json(session); }));
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => { if (!req.file) return res.status(400).json({ error: "No file" }); const url = `/uploads/${req.file.filename}`; const { sessionId, type } = req.body; const update = {}; if (type === 'SUBJECT') update.$push = { subjectUrls: url }; if (type === 'COPY') update.$push = { copyUrls: url }; const session = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, update, { new: true }); res.json({ url, session }); }));
router.delete('/sessions/:id', asyncHandler(async (req, res) => { await mongoose.model('ScanSession').findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// --- UPDATE : ROUTE DE CORRECTION AVEC CHARGEMENT ÉLÈVES ---
router.post('/correct/:sessionId', asyncHandler(async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session introuvable" });

    // 1. Récupération de TOUS les élèves (Light) pour l'identification
    const students = await mongoose.model('Student').find({}, 'firstName lastName').lean();

    if (req.body.instructions) {
        session.aiInstructions = req.body.instructions;
        await session.save();
    }

    const results = [];
    for (const copyUrl of session.copyUrls) {
        // Appel IA avec la liste des élèves
        const aiResult = await ScanAI.correctCopy(copyUrl, session.subjectUrls, session.aiInstructions, students);
        
        const entry = { 
            originalUrl: copyUrl,
            studentName: aiResult.studentName, // Nouveau champ
            transcription: aiResult.transcription,
            mistakes: aiResult.mistakes,
            appreciation: aiResult.appreciation, // Nouveau champ
            grade: aiResult.grade 
        };
        results.push(entry);
    }

    session.corrections = results;
    await session.save();
    res.json(session);
}));

module.exports = router;