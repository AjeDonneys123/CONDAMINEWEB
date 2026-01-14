const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 📸 DOMAINE : SCANS
 */

const normalize = (n) => n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").trim();

router.get('/sessions', async (req, res) => {
    try { res.json(await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 })); } catch (e) { res.status(500).json([]); }
});

router.post('/sessions', async (req, res) => {
    try {
        const { title, classroom } = req.body;
        const session = await mongoose.model('ScanSession').create({ title, classroom });

        const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
        const sessId = await DriveService.getOrCreateFolder(normalize(title), classId);
        
        const subjectId = await DriveService.getOrCreateFolder("SUJET", sessId);
        const copiesId = await DriveService.getOrCreateFolder("COPIES", sessId);
        const correctionsId = await DriveService.getOrCreateFolder("CORRECTIONS", sessId);

        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(session._id, {
            driveFolderId: sessId, subjectFolderId: subjectId, copiesFolderId: copiesId, correctionsFolderId: correctionsId
        }, { new: true });

        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/upload', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await mongoose.model('ScanSession').findById(sessionId);
        const folderId = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        const driveFile = await DriveService.uploadImage(folderId, `${type.toUpperCase()}_${Date.now()}.jpg`, imageBase64);
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } });
            res.json({ ok: true });
        } else { res.status(500).send("Drive Fail"); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const s = await mongoose.model('ScanSession').findById(req.params.id);
        if (s?.driveFolderId) await DriveService.deleteFile(s.driveFolderId);
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;