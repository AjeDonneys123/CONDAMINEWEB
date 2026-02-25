// @signatures: ProfScansRouter, sessions, upload
const express = require('express');
const router = express.Router();
const { ScanSession } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const multer = require('multer');
const upload = multer({ dest: 'public/uploads/temp' });

/**
 * 📸 BLOC PROF : LOGIQUE SCANS (/api/scans)
 */

router.get('/sessions', async (req, res) => {
    res.json(await ScanSession.find({}).sort({ date: -1 }).lean());
});

router.post('/upload', upload.single('file'), async (req, res) => {
    const { sessionId, type } = req.body;
    const folderId = await ProfDrive.getOrCreateFolder("SCANS");
    const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
    const url = `/api/structure/proxy/${driveFile.id}`;
    
    const update = type === 'SUBJECT' ? { $push: { subjectUrls: url } } : { $push: { copyUrls: url } };
    await ScanSession.findByIdAndUpdate(sessionId, update);
    res.json({ url });
});

router.post('/delete-file', async (req, res) => {
    try {
        const { sessionId, url, type } = req.body || {};
        if (!sessionId || !url) return res.status(400).json({ error: "sessionId/url manquants" });
        const session = await ScanSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });

        const fileId = String(url).includes('/proxy/') ? String(url).split('/proxy/')[1] : '';
        if (fileId) {
            try {
                await ProfDrive.deleteFile(fileId);
            } catch (e) {
                console.error(`❌ [SCANS] Drive delete fail fileId=${fileId}:`, e.message);
            }
        }

        if (type === 'SUBJECT') {
            await ScanSession.updateOne({ _id: sessionId }, { $pull: { subjectUrls: url } });
        } else {
            await ScanSession.updateOne(
                { _id: sessionId },
                { $pull: { copyUrls: url, corrections: { originalUrl: url } } }
            );
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
