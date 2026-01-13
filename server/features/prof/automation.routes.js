const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getChapter = () => mongoose.model('Chapter');

// Helper : Provisioning Drive en arrière-plan (User Story #2)
const provisionDriveFolder = async (chapterId, title, classroom) => {
    try {
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teachId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
        const classId = await DriveService.getOrCreateFolder(classroom, teachId);
        const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
        const driveId = await DriveService.getOrCreateFolder(title, worksId);
        
        await mongoose.model('Chapter').findByIdAndUpdate(chapterId, { driveFolderId: driveId });
        console.log(`✨ Drive Provisioning Success: ${title}`);
    } catch (e) {
        console.error("❌ Drive Provisioning Error:", e.message);
    }
};

// --- ROUTES CHAPITRES (LOCKED LOGIC - US #2 & #7) ---

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await getChapter().find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const Chapter = getChapter();

        // CAS 1 : RENOMMAGE / MISE À JOUR (User Story #7)
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const existing = await Chapter.findById(_id);
            if (!existing) return res.status(404).json({ error: "Dossier introuvable" });

            // Synchro Drive en arrière-plan
            if (existing.driveFolderId && title && title !== existing.title) {
                DriveService.renameFolder(existing.driveFolderId, title).catch(e => console.error("Drive Rename Fail", e));
            }
            
            const updateData = { ...req.body };
            delete updateData._id;
            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }

        // CAS 2 : CRÉATION (User Story #2)
        const newChap = await Chapter.create({ 
            title: title || "Nouveau Dossier", 
            classroom, 
            subject, 
            teacherId, 
            isArchived: false 
        });

        // Lancement provisioning Drive en arrière-plan pour fluidité
        provisionDriveFolder(newChap._id, newChap.title, classroom);

        res.json(newChap);
    } catch (e) { 
        console.error("Erreur API Chapters:", e.message);
        res.status(500).json({ error: e.message }); 
    }
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