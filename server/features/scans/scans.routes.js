const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScan = () => mongoose.model('ScanSession');

// Versant PROF : Capturer et lister
router.get('/sessions', async (req, res) => {
    try { res.json(await getScan().find({}).sort({ createdAt: -1 })); } catch (e) { res.json([]); }
});

router.post('/sessions', async (req, res) => {
    try { res.json(await getScan().create(req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScan().findById(sessionId);
        const folderId = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        const driveFile = await DriveService.uploadImage(folderId || "root", `${type}_${Date.now()}.jpg`, imageBase64);
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            await getScan().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } });
            res.json({ ok: true });
        } else { res.status(500).send("Drive Fail"); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Versant ÉLÈVE : Voir ses propres copies corrigées
router.get('/my-productions/:playerId', async (req, res) => {
    try {
        const submissions = await mongoose.model('Submission').find({ playerId: req.params.playerId }).sort({ createdAt: -1 });
        res.json(submissions);
    } catch (e) { res.json([]); }
});

module.exports = router;