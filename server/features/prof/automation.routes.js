const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Helper pour garantir l'accès au dossier 1Travaux
const getWorksFolder = async (classroom) => {
    const rootName = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
    const rootId = await DriveService.getOrCreateFolder(rootName);
    // On crée "1Travaux" à l'intérieur du dossier de classe
    return await DriveService.getOrCreateFolder("1Travaux", rootId);
};

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, isArchived, subject, classroom } = req.body;
        const Chapter = mongoose.model('Chapter');
        
        if (_id) {
            const chap = await Chapter.findById(_id);
            // Sync Renommage si le titre a changé
            if (chap.driveFolderId && title && title !== chap.title) {
                await DriveService.renameFolder(chap.driveFolderId, title);
            }
            const updated = await Chapter.findByIdAndUpdate(_id, { title, isArchived }, { new: true });
            return res.json(updated);
        }

        // --- CRÉATION NOUVEAU DOSSIER ---
        console.log(`📂 [DRIVE] Préparation dossier pour ${classroom}...`);
        const worksId = await getWorksFolder(classroom);
        const folderTitle = title || "Nouveau Dossier";
        const driveId = await DriveService.getOrCreateFolder(folderTitle, worksId);

        if (!driveId) throw new Error("Impossible de créer le dossier sur Google Drive");

        const newChap = await Chapter.create({ 
            title: folderTitle, 
            subject, 
            classroom, 
            driveFolderId: driveId,
            isArchived: false 
        });

        console.log(`✅ [DRIVE] Dossier créé dans 1Travaux : ${folderTitle} (ID: ${driveId})`);
        res.json(newChap);
    } catch (e) {
        console.error("❌ Erreur Chapitres:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// Garder le reste des routes (Sessions, Delete, Rename, etc.) identiques
router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.status(500).json([]); }
});
router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/scan-sessions', async (req, res) => {
    res.json(await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 }));
});
router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const chapter = await mongoose.model('Chapter').findById(req.body.chapterId);
        if (session.driveFolderId && chapter.driveFolderId) await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
        session.chapterId = req.body.chapterId;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (result && result.id) {
            const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
            const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        res.status(500).json({ error: "Echec Drive" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const dateStr = `${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-26`;
        const finalTitle = title ? `${title.trim()}_${dateStr}` : dateStr;
        const rootName = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
        const rootId = await DriveService.getOrCreateFolder(rootName);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        res.json(await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;