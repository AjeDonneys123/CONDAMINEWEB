const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #8 : RESTAURATION MIROIR (BDD -> DRIVE)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        if (!classroom) return res.status(400).json({ error: "Classe non sélectionnée" });

        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(teacherId);
        if (!prof) return res.status(404).json({ error: "Prof non trouvé" });
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // 1. Point d'entrée DEVOIRS de la classe
        const { devoirsId } = await DriveService.getMirrorPathId(teacherName, classroom);

        // MODE NUKE : Suppression radicale
        if (mode === 'nuke') {
            if (devoirsId) await DriveService.deleteEntity(devoirsId);
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            await DriveService.getMirrorPathId(teacherName, classroom);
            return res.json({ ok: true, message: "Nettoyage terminé." });
        }

        // --- MODE RESTAURATION (SYNC) ---
        console.log(`📡 [RESTAURATION] Alignement du Drive pour ${classroom}...`);
        const chapters = await mongoose.model('Chapter').find({ classroom });
        const homeworks = await mongoose.model('Homework').find({ classroom });

        for (const section of prof.subjectSections) {
            // Création dossier Matière (ex: HISTOIRE)
            const { subjectId } = await DriveService.getMirrorPathId(teacherName, classroom, section.name);
            
            // On traite les chapitres liés (en gérant les vieux tags type "H")
            const secChapters = chapters.filter(c => 
                c.subject === section.name || (section.name.startsWith(c.subject) && c.subject.length === 1)
            );

            for (const chap of secChapters) {
                // Création dossier Chapitre
                const chapId = await DriveService.getOrCreateFolder(chap.title, subjectId);
                // On met à jour la BDD pour pointer vers le nouvel ID physique
                await mongoose.model('Chapter').findByIdAndUpdate(chap._id, { driveFolderId: chapId, subject: section.name });

                // Création dossier Devoirs
                const chHws = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of chHws) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapId);
                    // US #4 : Sous-dossiers
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    // Update BDD
                    await mongoose.model('Homework').findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }
        res.json({ ok: true, message: "Restauration du Drive terminée !" });

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