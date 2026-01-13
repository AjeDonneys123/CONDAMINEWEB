const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');

// --- ROUTES CHAPITRES ---
router.get('/chapters-all', async (req, res) => {
    try {
        const data = await getChapter().find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, ...body } = req.body;
        if (_id) {
            const updated = await getChapter().findByIdAndUpdate(_id, body, { new: true });
            return res.json(updated);
        }
        const newChap = await getChapter().create({ ...body, isArchived: false });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ROUTES SCANS ---
router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await getScanSession().find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const session = await getScanSession().create(req.body);
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// FIX : Route upload photo (Celle qui causait la 404)
router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScanSession().findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session non trouvée" });

        // On utilise l'ID dossier Drive de la session (fallback sur root si absent)
        const targetFolder = session.driveFolderId || "root";
        const fileName = `${type}_${Date.now()}.jpg`;

        const driveFile = await DriveService.uploadImage(targetFolder, fileName, imageBase64);
        
        if (driveFile) {
            const updateField = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(
                sessionId, 
                { $push: { [updateField]: driveFile.id } }, 
                { new: true }
            );
            res.json(updated);
        } else {
            res.status(500).json({ error: "Échec Drive" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const updated = await getScanSession().findByIdAndUpdate(req.params.id, { chapterId: req.body.chapterId }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;