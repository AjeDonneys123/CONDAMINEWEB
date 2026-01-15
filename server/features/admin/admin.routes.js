const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #15 : Fix Error 500 sur Players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        res.json(await Player.find({}).sort({ classroom: 1, lastName: 1 }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 : MIROIR ABSOLU (NUKE & REBUILD)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) throw new Error("Professeur non trouvé");
        
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const chapters = await mongoose.model('Chapter').find({ classroom });
        const homeworks = await mongoose.model('Homework').find({ classroom });

        // 1. Récupérer la racine physique
        const devoirsRootId = await DriveService.getDevoirsRootId(teacherName, classroom);

        // 2. VIDAGE : On déplace tout dans un dossier de secours
        const backupName = `SAUVEGARDE_SYNC_${Date.now()}`;
        const classRootId = await DriveService.getOrCreateFolder(classroom, await DriveService.getOrCreateFolder(teacherName, await DriveService.getOrCreateFolder("CONDA CLASSE")));
        const backupId = await DriveService.getOrCreateFolder(backupName, classRootId);
        
        const currentFiles = await DriveService.listChildren(devoirsRootId);
        for (const file of currentFiles) {
            await DriveService.moveEntity(file.id, backupId);
        }

        // 3. RECONSTRUCTION CONFORME AUX ARCHIVES (Matières > Chapitres > Devoirs)
        for (const section of prof.subjectSections) {
            // Création du dossier Matière avec le NOM COMPLET (ex: HISTOIRE au lieu de H)
            const subjectFolderId = await DriveService.getOrCreateFolder(section.name, devoirsRootId);
            
            // On cherche les chapitres qui appartiennent à cette matière
            // (on gère le cas où le chapitre a "H" ou "HISTOIRE" en BDD)
            const secChapters = chapters.filter(c => 
                c.subject === section.name || (section.name.startsWith(c.subject) && c.subject.length === 1)
            );

            for (const chap of secChapters) {
                const chapFolderId = await DriveService.getOrCreateFolder(chap.title, subjectFolderId);
                await mongoose.model('Chapter').findByIdAndUpdate(chap._id, { driveFolderId: chapFolderId, subject: section.name });

                // Devoirs dans ce chapitre
                const chapHw = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of chapHw) {
                    const hwFolderId = await DriveService.getOrCreateFolder(hw.title, chapFolderId);
                    await DriveService.getOrCreateFolder("SUJET", hwFolderId);
                    await DriveService.getOrCreateFolder("COPIES", hwFolderId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwFolderId);
                    await mongoose.model('Homework').findByIdAndUpdate(hw._id, { driveFolderId: hwFolderId });
                }
            }
        }

        res.json({ ok: true, message: `Miroir Drive reconstruit (Matières complètes) pour ${teacherName}` });
    } catch (e) {
        console.error("❌ Echec Synchro:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        const rootId = await DriveService.getDevoirsRootId(teacherName, classroom);
        const subId = await DriveService.getOrCreateFolder(subject, rootId);
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