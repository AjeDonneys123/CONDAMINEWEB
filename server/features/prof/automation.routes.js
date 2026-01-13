const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getChapter = () => mongoose.model('Chapter');

// Helper interne pour créer la structure Drive sans bloquer la réponse API
const provisionDriveFolder = async (chapterId, title, classroom) => {
    try {
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teachId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
        const classId = await DriveService.getOrCreateFolder(classroom, teachId);
        const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
        const driveId = await DriveService.getOrCreateFolder(title, worksId);
        
        await mongoose.model('Chapter').findByIdAndUpdate(chapterId, { driveFolderId: driveId });
        console.log(`✨ Drive Provisioning Complete for: ${title}`);
    } catch (e) {
        console.error("❌ Drive Provisioning Failed:", e.message);
    }
};

// --- ROUTES CHAPITRES (LOCKED LOGIC - US #2 & #7 OPTIMISÉES) ---

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const Chapter = getChapter();

        if (_id) {
            // MISE À JOUR FLUIDE
            const existing = await Chapter.findById(_id);
            if (!existing) return res.status(404).json({ error: "Introuvable" });

            if (existing.driveFolderId && title && title !== existing.title) {
                DriveService.renameFolder(existing.driveFolderId, title).catch(() => {});
            }
            
            const updateData = { ...req.body };
            delete updateData._id;
            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }

        // CRÉATION INSTANTANÉE (User Story #2 en arrière-plan)
        // 1. On crée d'abord en BDD pour avoir un ID immédiatement
        const newChap = await Chapter.create({ 
            title: title || "Nouveau Dossier", 
            classroom, 
            subject, 
            teacherId, 
            driveFolderId: null, // Sera rempli par la tâche de fond
            isArchived: false 
        });

        // 2. On lance la création Drive en tâche de fond (SANS await)
        provisionDriveFolder(newChap._id, newChap.title, classroom);

        // 3. On répond immédiatement au client
        res.json(newChap);

    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await getChapter().find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await getChapter().findById(req.params.id);
        if (chap?.driveFolderId) DriveService.deleteFile(chap.driveFolderId).catch(() => {});
        await getChapter().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;