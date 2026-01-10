const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Helper Date JJ-MM-26
const getSuffix = () => {
    const now = new Date();
    const jj = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${jj}-${mm}-26`;
};

// --- LISTE DES DEVOIRS ---
router.get('/scan-sessions', async (req, res) => {
    try {
        const ScanSession = mongoose.model('ScanSession');
        const data = await ScanSession.find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

// --- CRÉATION ---
router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const dateStr = getSuffix();
        const finalTitle = title ? `${title.trim()}_${dateStr}` : dateStr;
        const rootFolder = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
        
        const rootId = await DriveService.getOrCreateFolder(rootFolder);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);

        const newSession = await mongoose.model('ScanSession').create({
            title: finalTitle, classroom, driveFolderId: hwId, createdAt: Date.now()
        });
        res.json(newSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RENOMMAGE ---
router.patch('/scan-sessions/:id/rename', async (req, res) => {
    try {
        const { newPrefix } = req.body;
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const parts = session.title.split('_');
        const suffix = parts[parts.length - 1];
        const newTitle = newPrefix ? `${newPrefix.trim()}_${suffix}` : suffix;

        if (session.driveFolderId) await DriveService.renameFolder(session.driveFolderId, newTitle);
        session.title = newTitle;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUPPRESSION ---
router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        if (session?.driveFolderId) await DriveService.deleteFolder(session.driveFolderId);
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// --- UPLOAD PHOTO ---
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
        res.status(500).json({ error: "Drive fail" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;