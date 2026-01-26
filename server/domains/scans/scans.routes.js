const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ScanAI = require('./ai/scan.ai');
const DriveEngine = require('../../core/drive.engine');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.png' && ext !== '.jpeg' && ext !== '.jpg') ext = '.jpg';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'scan-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

router.get('/sessions', asyncHandler(async (req, res) => { const sessions = await mongoose.model('ScanSession').find({}).sort({ date: -1 }).lean(); res.json(sessions); }));
router.post('/sessions', asyncHandler(async (req, res) => { const { title, teacherId } = req.body; const session = await mongoose.model('ScanSession').create({ title: title || `Scan ${new Date().toLocaleDateString('fr-FR')}`, teacherId }); res.json(session); }));
router.patch('/sessions/:id', asyncHandler(async (req, res) => { const { title, chapterId } = req.body; const updateData = {}; if (title) updateData.title = title; if (chapterId) updateData.chapterId = chapterId; const session = await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true }); res.json(session); }));

// --- UPLOAD STRICT DRIVE V4 (GARANTI SANS LOCAL) ---
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => { 
    if (!req.file) return res.status(400).json({ error: "No file" }); 
    
    const { sessionId, type } = req.body; 
    let finalUrl = "";

    try {
        console.log(`☁️ [SCAN] Upload Drive FORCÉ : ${req.file.filename}`);
        
        const scansFolderId = await DriveEngine.getOrCreateFolder("SCANS_ARCHIVE");
        const driveFile = await DriveEngine.uploadFile(req.file.filename, req.file.path, scansFolderId);
        
        finalUrl = `/api/structure/proxy/${driveFile.id}`;
        
        console.log(`✅ [SCAN] Drive OK : ${finalUrl}`);

        // SUPPRESSION LOCALE IMMÉDIATE
        try { fs.unlinkSync(req.file.path); } catch(e) {}

    } catch (e) {
        console.error("❌ ECHEC DRIVE :", e.message);
        // ON REFUSE L'UPLOAD SI LE DRIVE ÉCHOUE
        // Cela force à régler le problème Drive plutôt que de créer des liens morts
        return res.status(500).json({ error: "Echec Connexion Drive. Vérifiez les logs serveur." });
    }

    const update = {}; 
    if (type === 'SUBJECT') update.$push = { subjectUrls: finalUrl }; 
    if (type === 'COPY') update.$push = { copyUrls: finalUrl }; 
    
    const session = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, update, { new: true }); 
    res.json({ url: finalUrl, session }); 
}));

router.delete('/sessions/:id', asyncHandler(async (req, res) => { await mongoose.model('ScanSession').findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

router.post('/correct/:sessionId', asyncHandler(async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session introuvable" });

    const students = await mongoose.model('Student').find({}, 'firstName lastName').lean();
    if (req.body.instructions) session.aiInstructions = req.body.instructions;

    const existingCorrectionsMap = new Map();
    if (session.corrections && session.corrections.length > 0) {
        session.corrections.forEach(c => existingCorrectionsMap.set(c.originalUrl, c));
    }

    const finalResults = [];
    
    for (const copyUrl of session.copyUrls) {
        if (existingCorrectionsMap.has(copyUrl)) {
            finalResults.push(existingCorrectionsMap.get(copyUrl));
            continue;
        }

        // PROTECTION ANTI-CRASH : On ignore les fichiers locaux (perdus)
        if (!copyUrl.includes('/proxy/')) {
            finalResults.push({
                originalUrl: copyUrl,
                studentName: "Fichier Perdu",
                grade: "N/A",
                appreciation: "Fichier local introuvable (Serveur redémarré).",
                mistakes: []
            });
            continue;
        }

        try {
            const aiResult = await ScanAI.correctCopy(copyUrl, session.subjectUrls, session.aiInstructions, students);
            finalResults.push({ 
                originalUrl: copyUrl,
                studentName: aiResult.studentName,
                grade: aiResult.grade,
                appreciation: aiResult.appreciation,
                transcription: aiResult.transcription,
                mistakes: aiResult.mistakes
            });
        } catch (e) {
            finalResults.push({ originalUrl: copyUrl, studentName: "Erreur IA", grade: "?", appreciation: "Erreur technique" });
        }
    }

    session.corrections = finalResults;
    await session.save();
    res.json(session);
}));

module.exports = router;