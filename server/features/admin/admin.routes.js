const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #15 : Fix Error 500 sur Players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 : SYNCHRO MIROIR ABSOLUE (CORRIGÉ : Pas de "google is not defined")
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) throw new Error("Professeur non identifié");
        
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const chapters = await mongoose.model('Chapter').find({ classroom });
        const homeworks = await mongoose.model('Homework').find({ classroom });

        // 1. On récupère les IDs de la structure de base
        const { devoirsRootId } = await DriveService.getMirrorPathId(teacherName, classroom, "INIT");

        // 2. VIDAGE : On déplace tout l'existant dans un dossier SAUVEGARDE (Nuke)
        const backupName = `SAUVEGARDE_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}_${Date.now()}`;
        const classRootId = await DriveService.getOrCreateFolder(classroom, await DriveService.getOrCreateFolder(teacherName, await DriveService.getOrCreateFolder("CONDA CLASSE")));
        const backupId = await DriveService.getOrCreateFolder(backupName, classRootId);
        
        const currentFiles = await DriveService.listChildren(devoirsRootId);
        for (const file of currentFiles) {
            if (file.name !== backupName) {
                await DriveService.moveEntity(file.id, backupId);
            }
        }

        // 3. RECONSTRUCTION : On recrée tout selon la BDD (Miroir exact)
        for (const section of prof.subjectSections) {
            // Recrée le dossier Matière
            const { subjectId } = await DriveService.getMirrorPathId(teacherName, classroom, section.name);
            
            const secChapters = chapters.filter(c => c.subject === section.name);
            for (const chap of secChapters) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, subjectId);
                await mongoose.model('Chapter').findByIdAndUpdate(chap._id, { driveFolderId: chapId });

                const chapHw = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of chapHw) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapId);
                    // US #4
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    await mongoose.model('Homework').findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }

        res.json({ ok: true, message: `Miroir Drive reconstitué pour ${teacherName}` });
    } catch (e) {
        console.error("❌ Erreur Sync Miroir:", e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        const { chapterId } = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: chapterId }, { new: true });
        } else {
            result = await mongoose.model('Chapter').create({ ...req.body, driveFolderId: chapterId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.json([]); }
});

module.exports = router;