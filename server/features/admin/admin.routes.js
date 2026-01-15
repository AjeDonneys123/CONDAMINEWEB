const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

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

// US #8 & #9 : NUKE RADICAL (LANCE-FLAMMES)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        const isReady = await DriveService.checkAuth();
        if (!isReady) return res.status(401).json({ error: "Drive déconnecté." });

        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // 1. On récupère le dossier de la classe
        const classFolderId = await DriveService.getClassFolder(teacherName, classroom);

        if (mode === 'nuke') {
            console.log(`🧨 [LANCE-FLAMMES] Nettoyage intégral de ${classroom}...`);
            
            // 2. On liste TOUS les enfants du dossier classe (DEVOIRS, H, GEO, etc.)
            const children = await DriveService.listAllChildren(classFolderId);
            
            // 3. On les supprime TOUS un par un
            for (const item of children) {
                await DriveService.deleteEntity(item.id);
            }
            
            // 4. On vide la BDD
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            
            // 5. On recrée le dossier DEVOIRS tout neuf
            await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
            
            return res.json({ ok: true, message: "Drive pulvérisé et recréé à neuf." });
        }

        // MODE SYNC CLASSIQUE (Reconstruction)
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
        res.status(500).json({ error: e.message });
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const classId = await DriveService.getClassFolder(teacherName, classroom);
        const devRoot = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        const subId = await DriveService.getOrCreateFolder(subject, devRoot);
        const driveId = await DriveService.getOrCreateFolder(title, subId);

        let result = _id ? await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true })
                         : await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className, deletedSection } = req.body;
        const prof = await mongoose.model('Teacher').findById(req.params.id);
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        if (deletedSection && className) {
            const classId = await DriveService.getClassFolder(teacherName, className);
            const devRoot = await DriveService.getOrCreateFolder("DEVOIRS", classId);
            const children = await DriveService.listAllChildren(devRoot);
            const target = children.find(c => c.name === DriveService.normalize(deletedSection));
            if (target) await DriveService.deleteEntity(target.id);
        }
        const updated = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ user: { id: updated._id, firstName: updated.firstName, lastName: updated.lastName, subjectSections: updated.subjectSections, role: 'prof' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;