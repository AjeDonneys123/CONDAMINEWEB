const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getChapter = () => mongoose.model('Chapter');

// --- ROUTES CHAPITRES (LOCKED LOGIC - US #7 OPTIMISÉE) ---

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const Chapter = getChapter();

        if (_id) {
            // MISE À JOUR (User Story #7 - Version Fluide)
            const existing = await Chapter.findById(_id);
            if (!existing) return res.status(404).json({ error: "Dossier non trouvé" });

            // On lance le renommage Drive EN ARRIÈRE-PLAN (pas de await)
            if (existing.driveFolderId && title && title !== existing.title) {
                DriveService.renameFolder(existing.driveFolderId, title)
                    .then(() => console.log(`✅ Drive Sync Background: ${title}`))
                    .catch(e => console.error("❌ Drive Sync Background Fail:", e.message));
            }
            
            // On met à jour la BDD immédiatement
            const updateData = { ...req.body };
            delete updateData._id;
            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            
            // On répond TOUT DE SUITE au client
            return res.json(updated);
        }

        // CRÉATION (Reste synchrone pour garantir la structure US #2)
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teachId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
        const classId = await DriveService.getOrCreateFolder(classroom, teachId);
        const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
        const driveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId);
        
        const newChap = await Chapter.create({ 
            title: title || "Nouveau Dossier", classroom, subject, teacherId, 
            driveFolderId: driveId, isArchived: false 
        });
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