const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const ScanAI = require('./ai/scan.ai');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- CONFIGURATION MULTER STRICTE ---
const uploadDir = path.join(process.cwd(), 'public', 'uploads');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // On force l'extension .jpg si elle manque ou est bizarre
        let ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.png' && ext !== '.jpeg' && ext !== '.jpg' && ext !== '.webp') {
            ext = '.jpg';
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'scan-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });

// ROUTES
router.get('/sessions', asyncHandler(async (req, res) => { const sessions = await mongoose.model('ScanSession').find({}).sort({ date: -1 }).lean(); res.json(sessions); }));
router.post('/sessions', asyncHandler(async (req, res) => { const { title, teacherId } = req.body; const session = await mongoose.model('ScanSession').create({ title: title || `Scan ${new Date().toLocaleDateString('fr-FR')}`, teacherId }); res.json(session); }));
router.patch('/sessions/:id', asyncHandler(async (req, res) => { const { title, chapterId } = req.body; const updateData = {}; if (title) updateData.title = title; if (chapterId) updateData.chapterId = chapterId; const session = await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true }); res.json(session); }));

router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => { 
    if (!req.file) return res.status(400).json({ error: "No file" }); 
    
    // On construit l'URL avec le nom de fichier EXACT généré par Multer
    const url = `/uploads/${req.file.filename}`; 
    const { sessionId, type } = req.body; 
    
    const update = {}; 
    if (type === 'SUBJECT') update.$push = { subjectUrls: url }; 
    if (type === 'COPY') update.$push = { copyUrls: url }; 
    
    const session = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, update, { new: true }); 
    res.json({ url, session }); 
}));

router.delete('/sessions/:id', asyncHandler(async (req, res) => { await mongoose.model('ScanSession').findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

router.post('/correct/:sessionId', asyncHandler(async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session introuvable" });

    const students = await mongoose.model('Student').find({}, 'firstName lastName').lean();

    if (req.body.instructions) {
        session.aiInstructions = req.body.instructions;
        await session.save();
    }

    const results = [];
    for (const copyUrl of session.copyUrls) {
        try {
            const aiResult = await ScanAI.correctCopy(copyUrl, session.subjectUrls, session.aiInstructions, students);
            const entry = { 
                originalUrl: copyUrl,
                studentName: aiResult.studentName,
                transcription: aiResult.transcription,
                mistakes: aiResult.mistakes,
                appreciation: aiResult.appreciation,
                grade: aiResult.grade 
            };
            results.push(entry);
        } catch (e) {
            console.error("Erreur copie spécifique:", e);
        }
    }

    session.corrections = results;
    await session.save();
    res.json(session);
}));

module.exports = router;