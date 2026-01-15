const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// LISTE DES CHAPITRES
router.get('/chapters', async (req, res) => {
    try {
        const data = await mongoose.model('Chapter').find({}).lean();
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// CRÉATION DE CHAPITRE (BDD + DRIVE)
router.post('/chapters', async (req, res) => {
    try {
        const { teacherId, classroom, subject, title, _id } = req.body;
        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(teacherId);
        
        if (!prof) throw new Error("Compte enseignant introuvable.");

        // US #4 & #5 : CRÉATION PHYSIQUE SUR DRIVE
        console.log(`📡 [STRUCTURE] Création Drive pour: ${title} (${subject})`);
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const driveContext = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);
        
        if (!driveContext.chapterId) throw new Error("Échec de création du dossier Google Drive.");

        const Chapter = mongoose.model('Chapter');
        let result;
        if (_id) {
            result = await Chapter.findByIdAndUpdate(_id, { 
                title, subject, classroom, driveFolderId: driveContext.chapterId 
            }, { new: true });
        } else {
            result = await Chapter.create({ 
                title, subject, classroom, driveFolderId: driveContext.chapterId, teacherId 
            });
        }
        res.json(result);
    } catch (e) { 
        console.error("❌ [STRUCTURE_ERROR]:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.post('/chapters/archive', async (req, res) => {
    try {
        const { id, isArchived } = req.body;
        await mongoose.model('Chapter').findByIdAndUpdate(id, { isArchived });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteEntity(chap.driveFolderId);
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        if (mode === 'nuke') {
            const { devoirsId } = await DriveService.getMirrorPathId(teacherName, classroom);
            if (devoirsId) await DriveService.deleteEntity(devoirsId);
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            return res.json({ message: "Nuke OK" });
        }

        // Restauration miroir complète
        const chapters = await mongoose.model('Chapter').find({ classroom });
        for (const chap of chapters) {
            await DriveService.getMirrorPathId(teacherName, classroom, chap.subject, chap.title);
        }
        res.json({ message: "Sync OK" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;