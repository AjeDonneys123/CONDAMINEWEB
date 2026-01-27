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

router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => { 
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" }); 
    const { sessionId, type } = req.body; 
    let finalUrl = "";
    try {
        const scansFolderId = await DriveEngine.getOrCreateFolder("SCANS_ARCHIVE");
        const driveFile = await DriveEngine.uploadFile(req.file.filename, req.file.path, scansFolderId);
        finalUrl = `/api/structure/proxy/${driveFile.id}`;
        try { fs.unlinkSync(req.file.path); } catch(e) {}
    } catch (e) {
        return res.status(500).json({ error: "Erreur Drive." });
    }
    const update = {}; 
    if (type === 'SUBJECT') update.$push = { subjectUrls: finalUrl }; 
    if (type === 'COPY') update.$push = { copyUrls: finalUrl }; 
    const session = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, update, { new: true }); 
    res.json({ url: finalUrl, session }); 
}));

router.delete('/sessions/:id', asyncHandler(async (req, res) => { await mongoose.model('ScanSession').findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// --- ROUTE DE CORRECTION V131 (FORCE REFRESH) ---
router.post('/correct/:sessionId', asyncHandler(async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session introuvable" });

    const students = await mongoose.model('Student').find({}, 'firstName lastName').lean();
    if (req.body.instructions) session.aiInstructions = req.body.instructions;

    // ICI : ON NE REGARDE PLUS CE QUI EXISTE DÉJÀ. ON ECRASE TOUT.
    // On repart d'une feuille blanche pour les corrections de cette session.
    console.log(`♻️ [V131] Démarrage Recorrection FORCÉE pour ${session.copyUrls.length} copies.`);
    
    const finalResults = [];
    
    for (const copyUrl of session.copyUrls) {
        // Protection Fichiers Perdus
        if (!copyUrl.includes('/proxy/')) {
            finalResults.push({ 
                originalUrl: copyUrl, 
                studentName: "Fichier Perdu", 
                grade: "N/A", 
                appreciation: "Image locale non retrouvée.", 
                mistakes: [] 
            });
            continue;
        }

        try {
            console.log(`🤖 Analyse de : ${copyUrl}`);
            const aiResult = await ScanAI.correctCopy(copyUrl, session.subjectUrls, session.aiInstructions, students);
            
            finalResults.push({ 
                originalUrl: copyUrl,
                studentName: aiResult.studentname || aiResult.studentName || "Inconnu",
                grade: aiResult.grade || "?",
                appreciation: aiResult.appreciation || "Pas d'avis.",
                transcription: aiResult.transcription || aiResult.analyse || "Texte brut IA : " + JSON.stringify(aiResult),
                mistakes: aiResult.mistakes || []
            });
        } catch (e) {
            finalResults.push({ originalUrl: copyUrl, studentName: "Erreur", grade: "?", appreciation: "Erreur Technique", transcription: e.message });
        }
    }

    session.corrections = finalResults;
    await session.save();
    res.json(session);
}));

module.exports = router;