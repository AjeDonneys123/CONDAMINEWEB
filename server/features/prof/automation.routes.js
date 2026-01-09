const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// --- SUPPRIMER UNE PHOTO PRÉCISE ---
router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        
        // 1. Supprimer sur Drive
        const fileId = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/);
        if (fileId) await DriveService.deleteFolder(fileId[1]);

        // 2. Supprimer de la BDD
        const field = type === 'quest' ? { questionUrls: url } : { copyUrls: url };
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(
            sessionId, 
            { $pull: field }, 
            { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (result && result.id) {
            const field = type === 'quest' ? { $push: { questionUrls: result.link } } : { $push: { copyUrls: result.link } };
            const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        res.status(500).json({ error: "Echec Drive" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scan-sessions', async (req, res) => {
    res.json(await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 }));
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-26`;
        const finalTitle = title ? `${title}_${dateStr}` : dateStr;
        const rootId = await DriveService.getOrCreateFolder(classroom === '1D' ? '1BFI' : classroom);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        res.json(await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    if (session?.driveFolderId) await DriveService.deleteFolder(session.driveFolderId);
    await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

router.patch('/scan-sessions/:id/instructions', async (req, res) => {
    await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { teacherInstruction: req.body.text });
    res.json({ ok: true });
});

router.patch('/scan-sessions/:id/rename', async (req, res) => {
    const { newPrefix } = req.body;
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    const suffix = session.title.split('_').pop();
    const newTitle = newPrefix ? `${newPrefix}_${suffix}` : suffix;
    if (session.driveFolderId) await DriveService.renameFolder(session.driveFolderId, newTitle);
    session.title = newTitle; await session.save();
    res.json(session);
});

module.exports = router;