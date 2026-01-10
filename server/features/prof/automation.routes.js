const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Helper Arborescence Racine
const getWorksFolder = async (classroom) => {
    const rootName = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
    const rootId = await DriveService.getOrCreateFolder(rootName);
    return await DriveService.getOrCreateFolder("1Travaux", rootId);
};

// --- CRÉATION / MODIF CHAPITRE (SYNC DRIVE) ---
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, isArchived, subject, classroom } = req.body;
        const Chapter = mongoose.model('Chapter');
        
        if (_id) {
            const chap = await Chapter.findById(_id);
            if (chap.driveFolderId && title !== chap.title) {
                await DriveService.renameFolder(chap.driveFolderId, title);
            }
            const updated = await Chapter.findByIdAndUpdate(_id, { title, isArchived }, { new: true });
            return res.json(updated);
        }

        // Création physique sur Drive dans 1Travaux
        const worksId = await getWorksFolder(classroom);
        const driveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId);

        const newChap = await Chapter.create({ 
            title: title || "Nouveau Dossier", 
            subject, 
            classroom, 
            driveFolderId: driveId,
            isArchived: false 
        });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUPPRESSION CHAPITRE (SYNC DRIVE) ---
router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ASSIGNER ET DÉPLACER PHYSIQUEMENT UNE PRODUCTION ---
router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const chapter = await mongoose.model('Chapter').findById(req.body.chapterId);
        
        if (session.driveFolderId && chapter.driveFolderId) {
            // DÉPLACEMENT PHYSIQUE SUR DRIVE
            await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
        }

        session.chapterId = req.body.chapterId;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// (Garder les autres routes ScanSession, Upload, etc.)
router.get('/scan-sessions', async (req, res) => {
    res.json(await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 }));
});
router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-26`;
        const finalTitle = title ? `${title.trim()}_${dateStr}` : dateStr;
        
        // Par défaut, les nouvelles productions vont dans PRODUCTIONS à la racine de la classe
        const rootName = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
        const rootId = await DriveService.getOrCreateFolder(rootName);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        
        const newSession = await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId });
        res.json(newSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;