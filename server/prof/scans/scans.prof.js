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
    const url = `/api/prof/structure/proxy/${driveFile.id}`;
    
    const update = type === 'SUBJECT' ? { $push: { subjectUrls: url } } : { $push: { copyUrls: url } };
    await ScanSession.findByIdAndUpdate(sessionId, update);
    res.json({ url });
});

module.exports = router;
