const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #8 & #9 : RECONSTRUCTION CONFORME (Miroir de Fer)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        if (!classroom) return res.status(400).json({ error: "Classe non sélectionnée" });

        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) return res.status(404).json({ error: "Prof non trouvé" });
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // 1. Accès à la racine
        const { devoirsId } = await DriveService.getMirrorPathId(teacherName, classroom);

        // --- MODE NUKE : ON PULVÉRISE LE DOSSIER DEVOIRS ---
        if (mode === 'nuke') {
            console.log(`🧨 [NUKE] Extermination du dossier DEVOIRS pour ${classroom}`);
            if (devoirsId) await DriveService.deleteEntity(devoirsId);
            
            // On vide la BDD pour cette classe
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            
            // On recrée le dossier DEVOIRS vide
            await DriveService.getMirrorPathId(teacherName, classroom);
            return res.json({ ok: true, message: "Nettoyage terminé. Drive et BDD conformes." });
        }

        // --- MODE SYNC : ALIGNEMENT BDD -> DRIVE ---
        const chapters = await mongoose.model('Chapter').find({ classroom });
        const homeworks = await mongoose.model('Homework').find({ classroom });

        for (const section of prof.subjectSections) {
            const { subjectId } = await DriveService.getMirrorPathId(teacherName, classroom, section.name);
            const secChapters = chapters.filter(c => c.subject === section.name);
            
            for (const chap of secChapters) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, subjectId);
                await mongoose.model('Chapter').findByIdAndUpdate(chap._id, { driveFolderId: chapId });

                const hws = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapId);
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    await mongoose.model('Homework').findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }
        res.json({ ok: true, message: "Synchronisation miroir terminée." });
    } catch (e) {
        console.error("❌ Synchro Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.get('/chapters', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        let driveId = req.body.driveFolderId || null;

        if (prof) {
            const { chapterId } = await DriveService.getMirrorPathId(`${prof.firstName} ${prof.lastName}`, classroom, subject, title);
            driveId = chapterId;
        }

        let result = _id ? await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true })
                         : await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;