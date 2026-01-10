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

// --- NOUVELLE ROUTE : SUPPRESSION PHOTO ---
router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        console.log(`🗑️ Demande de suppression photo (${type}) pour session ${sessionId}`);

        // 1. Extraction ID Drive depuis l'URL
        const idMatch = url.match(/[-\w]{25,}/);
        if (idMatch) {
            await DriveService.deleteFolder(idMatch[0]); // deleteFolder gère aussi les fichiers
        }

        // 2. Mise à jour BDD
        const field = type === 'quest' ? { questionUrls: url } : { copyUrls: url };
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(
            sessionId,
            { $pull: field },
            { new: true }
        );

        res.json(updated);
    } catch (e) {
        console.error("❌ Erreur suppression photo:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- RESTE DES ROUTES ---
router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const finalTitle = title ? `${title.trim()}_${getSuffix()}` : getSuffix();
        const root = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
        const rootId = await DriveService.getOrCreateFolder(root);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        const newSession = await mongoose.model('ScanSession').create({
            title: finalTitle, classroom, driveFolderId: hwId, createdAt: Date.now()
        });
        res.json(newSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/rename', async (req, res) => {
    try {
        const { newPrefix } = req.body;
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const suffix = session.title.split('_').pop();
        const newTitle = newPrefix ? `${newPrefix}_${suffix}` : suffix;
        if (session.driveFolderId) await DriveService.renameFolder(session.driveFolderId, newTitle);
        session.title = newTitle; await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        if (session?.driveFolderId) await DriveService.deleteFolder(session.driveFolderId);
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (result && result.link) {
            const field = type === 'quest' ? { $push: { questionUrls: result.link } } : { $push: { copyUrls: result.link } };
            const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        res.status(500).json({ error: "Drive fail" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/instructions', async (req, res) => {
    await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { teacherInstruction: req.body.text });
    res.json({ ok: true });
});

module.exports = router;