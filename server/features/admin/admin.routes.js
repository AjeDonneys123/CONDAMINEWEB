const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #15 : Fix Error 500 Players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        res.json(await Player.find({}).sort({ classroom: 1, lastName: 1 }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 : SYNCHRO TOTALE (BDD + DRIVE)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        if (!prof) throw new Error("Professeur introuvable");
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // --- PHASE 1 : NETTOYAGE BDD (LA VÉRITÉ DES ARCHIVES) ---
        // On force tous les chapitres à avoir le nom complet de la matière au lieu des codes H/G/E
        const classChapters = await Chapter.find({ classroom });
        for (let chap of classChapters) {
            // On cherche la section du prof qui correspond (soit par nom exact, soit par initiale)
            const matchedSection = prof.subjectSections.find(s => 
                s.name.toUpperCase() === chap.subject.toUpperCase() || 
                s.name.toUpperCase().startsWith(chap.subject.toUpperCase())
            );
            if (matchedSection && chap.subject !== matchedSection.name) {
                console.log(`🧹 BDD Cleanup: ${chap.title} (${chap.subject} -> ${matchedSection.name})`);
                await Chapter.findByIdAndUpdate(chap._id, { subject: matchedSection.name });
            }
        }

        // --- PHASE 2 : MIROIR PHYSIQUE DRIVE ---
        const devoirsRootId = await DriveService.getDevoirsRootId(teacherName, classroom);

        // 1. On évacue tout l'existant Drive dans une sauvegarde
        const backupId = await DriveService.getOrCreateFolder(`BACKUP_SYNC_${Date.now()}`, 
            await DriveService.getOrCreateFolder(classroom, 
                await DriveService.getOrCreateFolder(teacherName, 
                    await DriveService.getOrCreateFolder("CONDA CLASSE")
                )
            )
        );
        const currentFiles = await DriveService.listChildren(devoirsRootId);
        for (const file of currentFiles) {
            await DriveService.moveEntity(file.id, backupId);
        }

        // 2. On reconstruit tout à partir de la BDD maintenant propre
        const cleanChapters = await Chapter.find({ classroom });
        const homeworks = await Homework.find({ classroom });

        for (const section of prof.subjectSections) {
            const subjectFolderId = await DriveService.getOrCreateFolder(section.name, devoirsRootId);
            const chaps = cleanChapters.filter(c => c.subject === section.name);
            
            for (const chap of chaps) {
                const chapFolderId = await DriveService.getOrCreateFolder(chap.title, subjectFolderId);
                await Chapter.findByIdAndUpdate(chap._id, { driveFolderId: chapFolderId });

                const hws = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwFolderId = await DriveService.getOrCreateFolder(hw.title, chapFolderId);
                    await DriveService.getOrCreateFolder("SUJET", hwFolderId);
                    await DriveService.getOrCreateFolder("COPIES", hwFolderId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwFolderId);
                    await Homework.findByIdAndUpdate(hw._id, { driveFolderId: hwFolderId });
                }
            }
        }

        res.json({ ok: true, message: "Base de données nettoyée et Drive reconstruit à 100%." });
    } catch (e) {
        console.error("❌ Synchro Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const root = await DriveService.getDevoirsRootId(teacherName, classroom);
        const subId = await DriveService.getOrCreateFolder(subject, root);
        const driveId = await DriveService.getOrCreateFolder(title, subId);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.json([]); }
});

module.exports = router;