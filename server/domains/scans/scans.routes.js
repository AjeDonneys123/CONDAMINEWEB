// @signatures: DELETE /sessions/:id, GET /sessions, PATCH /sessions/:id, POST /correct/:sessionId, POST /delete-file, POST /sessions, POST /upload
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ScanAI = require('./ai/scan.ai');
const DriveEngine = require('../../core/drive.engine');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
const upload = multer({ dest: tempDir });

router.get('/sessions', asyncHandler(async (req, res) => { res.json(await mongoose.model('ScanSession').find({}).sort({ date: -1 }).lean()); }));
router.post('/sessions', asyncHandler(async (req, res) => { const { title, teacherId } = req.body; res.json(await mongoose.model('ScanSession').create({ title, teacherId })); }));
router.patch('/sessions/:id', asyncHandler(async (req, res) => { res.json(await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })); }));
router.delete('/sessions/:id', asyncHandler(async (req, res) => { await mongoose.model('ScanSession').findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// --- SUPPRESSION FICHIER (DRIVE + BDD) V165 ---
router.post('/delete-file', asyncHandler(async (req, res) => {
    const { sessionId, url, type } = req.body;
    const session = await mongoose.model('ScanSession').findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session introuvable" });

    // 1. Suppression du Drive si Proxy
    if (url.includes('/proxy/')) {
        const driveId = url.split('/proxy/')[1];
        try {
            const drive = require('googleapis').google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
            await drive.files.update({ fileId: driveId, resource: { trashed: true } });
            console.log(`🗑️ [DRIVE] Fichier ${driveId} mis à la corbeille.`);
        } catch (e) { console.error("❌ Drive delete error:", e.message); }
    }

    // 2. Mise à jour BDD
    const update = {};
    if (type === 'SUBJECT') update.$pull = { subjectUrls: url };
    else {
        update.$pull = { 
            copyUrls: url,
            corrections: { originalUrl: url } // Supprime aussi la correction associée
        };
    }

    await mongoose.model('ScanSession').updateOne({ _id: sessionId }, update);
    res.json({ ok: true });
}));

router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => { 
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" }); 
    const { sessionId, type } = req.body; 
    let finalUrl = "";
    try {
        const folderName = type === 'SUBJECT' ? "SCANS_SUJETS" : "SCANS_COPIES";
        const folderId = await DriveEngine.getOrCreateFolder(folderName);
        const ext = path.extname(req.file.originalname) || '.jpg';
        const driveName = `scan-${sessionId}-${Date.now()}${ext}`;
        const driveFile = await DriveEngine.uploadFile(driveName, req.file.path, folderId);
        finalUrl = `/api/structure/proxy/${driveFile.id}`;
        try { fs.unlinkSync(req.file.path); } catch(e) {}
    } catch (e) {
        console.error("Drive Upload Error:", e);
        return res.status(500).json({ error: "Erreur Drive." });
    }
    const update = type === 'SUBJECT' ? { $push: { subjectUrls: finalUrl } } : { $push: { copyUrls: finalUrl } }; 
    const session = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, update, { new: true }); 
    res.json({ url: finalUrl, session }); 
}));

router.post('/correct/:sessionId', asyncHandler(async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session introuvable" });
    const students = await mongoose.model('Student').find({}, 'firstName lastName').lean();
    if (req.body.instructions) session.aiInstructions = req.body.instructions;
    const finalResults = [];
    for (const copyUrl of session.copyUrls) {
        if (!copyUrl.includes('/proxy/')) continue;
        try {
            const aiResult = await ScanAI.correctCopy(copyUrl, session.subjectUrls, session.aiInstructions, students);
            finalResults.push({ 
                originalUrl: copyUrl,
                studentName: aiResult.studentName || "Inconnu",
                grade: aiResult.grade || "?",
                appreciation: aiResult.appreciation || "Pas d'avis.",
                transcription: aiResult.transcription || "...",
                mistakes: aiResult.mistakes || []
            });
        } catch (e) { console.error("Corr Error:", e); }
    }
    session.corrections = finalResults;
    await session.save();
    res.json(session);
}));

module.exports = router;
