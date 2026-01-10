const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// --- RÉPARATION LOGIQUE DOSSIERS (CHAPTERS) ---
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, isArchived, subject, classroom } = req.body;
        const Chapter = mongoose.model('Chapter');
        if (_id) {
            const updated = await Chapter.findByIdAndUpdate(_id, { title, isArchived }, { new: true });
            return res.json(updated);
        }
        const newChap = await Chapter.create({ title, subject, classroom, isArchived: false });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ASSIGNER UN SCAN À UN DOSSIER (ENREGISTRER) ---
router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const { chapterId } = req.body;
        // On met à jour le scan avec l'ID du dossier
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(
            req.params.id, 
            { chapterId: chapterId }, 
            { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUPPRESSION SESSION ---
router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId).catch(() => {});
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// (Reste des routes : list, upload, rename, instructions, productions inchangées)
router.get('/scan-sessions', async (req, res) => {
    const data = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
    res.json(data);
});
router.post('/scan-upload-photo', async (req, res) => {
    const { sessionId, type, imageBase64 } = req.body;
    const session = await mongoose.model('ScanSession').findById(sessionId);
    const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
    if (result) {
        const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
        return res.json(updated);
    }
    res.status(500).json({ error: "Fail" });
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
router.post('/scan-sessions', async (req, res) => {
    const { classroom, title } = req.body;
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-26`;
    const finalTitle = title ? `${title.trim()}_${dateStr}` : dateStr;
    const root = (classroom === '1BFI' || classroom === '1D') ? '1BFI' : classroom;
    const rootId = await DriveService.getOrCreateFolder(root);
    const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
    const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
    res.json(await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId }));
});

module.exports = router;