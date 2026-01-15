const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #15 : Diagnostic BDD complet (Pour l'explorateur DatabaseViewer)
router.get('/database-dump', async (req, res) => {
    try {
        const dump = {
            players: await mongoose.model('Player').find({}).lean(),
            teachers: await mongoose.model('Teacher').find({}).lean(),
            chapters: await mongoose.model('Chapter').find({}).lean(),
            homework: await mongoose.model('Homework').find({}).lean(),
            games: await mongoose.model('GameLevel').find({}).lean(),
            scans: await mongoose.model('ScanSession').find({}).lean()
        };
        res.json(dump);
    } catch (e) {
        console.error("❌ Erreur Dump BDD:", e.message);
        res.status(500).json({ error: "Impossible de dumper la base" });
    }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } 
    catch (e) { res.status(500).json([]); }
});

// US #8 & #9 : SYNC ET NUKE SÉCURISÉ
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        if (!classroom) return res.status(400).json({ error: "Classe non spécifiée" });

        const isReady = await DriveService.checkAuth();
        if (!isReady) return res.status(401).json({ error: "Drive non authentifié" });

        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const { classFolderId, devoirsFolderId } = await DriveService.getSpecificDevoirsFolder(teacherName, classroom);

        if (mode === 'nuke') {
            if (devoirsFolderId) await DriveService.deleteEntity(devoirsFolderId);
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
            return res.json({ ok: true, message: "Classe nettoyée." });
        }

        // Reconstruction
        const chapters = await mongoose.model('Chapter').find({ classroom });
        const homeworks = await mongoose.model('Homework').find({ classroom });

        for (const section of prof.subjectSections) {
            const subId = await DriveService.getOrCreateFolder(section.name, devoirsFolderId);
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
        res.json({ ok: true, message: "Synchronisation réussie." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const { classFolderId } = await DriveService.getSpecificDevoirsFolder(`${prof.firstName} ${prof.lastName}`, classroom);
        const devRoot = await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
        const subId = await DriveService.getOrCreateFolder(subject, devRoot);
        const driveId = await DriveService.getOrCreateFolder(title, subId);
        let result = _id ? await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true })
                         : await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;