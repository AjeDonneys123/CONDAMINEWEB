const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// ROUTE DE DIAGNOSTIC
router.get('/drive-check', async (req, res) => {
    const status = await DriveService.testConnection();
    res.json(status);
});

router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        res.json(await Player.find({}).sort({ classroom: 1, lastName: 1 }));
    } catch (e) { res.status(500).json({ error: "DB_ERR" }); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } 
    catch (e) { res.status(500).json([]); }
});

// US #8 & #9 : SYNC ET NUKE (L'ARME ULTIME)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        const isReady = await DriveService.checkAuth();
        if (!isReady) return res.status(401).json({ error: "Drive déconnecté." });

        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        const classFolderId = await DriveService.getClassFolderId(teacherName, classroom);

        if (mode === 'nuke') {
            console.log(`🧨 [NUKE] Vidage intégral de la classe ${classroom}...`);
            const trashItems = await DriveService.listEverythingInside(classFolderId);
            for (const item of trashItems) {
                await DriveService.deleteEntity(item.id);
            }
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
            return res.json({ ok: true, message: "Nettoyage terminé." });
        }

        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
        const chapters = await mongoose.model('Chapter').find({ classroom });
        const homeworks = await mongoose.model('Homework').find({ classroom });

        for (const section of prof.subjectSections) {
            const subId = await DriveService.getOrCreateFolder(section.name, devoirsId);
            const classChaps = chapters.filter(c => c.subject === section.name);
            for (const chap of classChaps) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, subId);
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
        res.json({ ok: true, message: "Synchronisation terminée." });
    } catch (e) {
        console.error("❌ Synchro Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const classId = await DriveService.getClassFolderId(`${prof.firstName} ${prof.lastName}`, classroom);
        const devRoot = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        const subId = await DriveService.getOrCreateFolder(subject, devRoot);
        const driveId = await DriveService.getOrCreateFolder(title, subId);

        let result = _id ? await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true })
                         : await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;