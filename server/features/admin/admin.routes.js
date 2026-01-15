const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #15 : Players
router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 & #9 : REMISE À ZÉRO TOTALE (Bouton de la dernière chance)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const devoirsRootId = await DriveService.getDevoirsRootId(teacherName, classroom);

        // SI MODE NUKE : ON EFFACE TOUT BDD + DRIVE POUR CETTE CLASSE
        if (mode === 'nuke') {
            console.log(`🧨 [NUKE] Nettoyage total pour ${classroom}`);
            // 1. Drive
            const files = await DriveService.listChildren(devoirsRootId);
            for (const f of files) await DriveService.deleteFile(f.id);
            // 2. BDD
            await Chapter.deleteMany({ classroom });
            await Homework.deleteMany({ classroom });
            return res.json({ ok: true, message: "Base de données et Drive vidés. Repartez sur du propre !" });
        }

        // SINON : SYNCHRO CLASSIQUE (Reconstruction)
        const chapters = await Chapter.find({ classroom });
        const homeworks = await Homework.find({ classroom });

        for (const section of prof.subjectSections) {
            const subFolderId = await DriveService.getOrCreateFolder(section.name, devoirsRootId);
            const secChapters = chapters.filter(c => c.subject === section.name);
            for (const chap of secChapters) {
                const chapFolderId = await DriveService.getOrCreateFolder(chap.title, subFolderId);
                await Chapter.findByIdAndUpdate(chap._id, { driveFolderId: chapFolderId });
                const hws = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapFolderId);
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    await Homework.findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }
        res.json({ ok: true, message: "Miroir Drive reconstruit avec succès." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #6 : Synchro des matières (Renommer / Supprimer)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className, deletedSection } = req.body;
        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(req.params.id);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // US #9 : Si une section a été supprimée, on la vire du Drive
        if (deletedSection && className) {
            const devoirsRoot = await DriveService.getDevoirsRootId(teacherName, className);
            const children = await DriveService.listChildren(devoirsRoot);
            const target = children.find(c => c.name === DriveService.normalize(deletedSection));
            if (target) await DriveService.deleteFile(target.id);
        }

        const updated = await Teacher.findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ user: { id: updated._id, firstName: updated.firstName, lastName: updated.lastName, subjectSections: updated.subjectSections, role: 'prof' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const root = await DriveService.getDevoirsRootId(`${prof.firstName} ${prof.lastName}`, classroom);
        const subId = await DriveService.getOrCreateFolder(subject, root);
        const driveId = await DriveService.getOrCreateFolder(title, subId);

        let result = _id ? await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true }) 
                         : await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;