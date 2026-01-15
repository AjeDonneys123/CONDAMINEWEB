const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #15 : Fix Crash Players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        res.json(await Player.find({}).sort({ classroom: 1, lastName: 1 }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Route Chapters All (Fix 404)
router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        res.json(await Chapter.find({}));
    } catch (e) { res.status(500).json([]); }
});

// US #8 & #9 : NUKE & SYNC
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        if (!prof) throw new Error("Prof non trouvé");
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // ID du dossier DEVOIRS cible
        const devoirsId = await DriveService.getSpecificDevoirsId(teacherName, classroom);

        if (mode === 'nuke') {
            console.log(`🧨 EXECUTION NUKE: ${teacherName} > ${classroom}`);
            // 1. On vide le contenu du dossier DEVOIRS sur le Drive
            const files = await DriveService.listChildren(devoirsId);
            for (const f of files) {
                await DriveService.deleteEntity(f.id);
            }
            // 2. On vide la BDD pour cette classe
            await Chapter.deleteMany({ classroom });
            await Homework.deleteMany({ classroom });
            
            return res.json({ ok: true, message: "Nettoyage terminé : Drive et BDD sont vierges." });
        }

        // SYNC CLASSIQUE : Reconstruction miroir
        const chapters = await Chapter.find({ classroom });
        const homeworks = await Homework.find({ classroom });

        for (const section of prof.subjectSections) {
            const subId = await DriveService.getOrCreateFolder(section.name, devoirsId);
            const chaps = chapters.filter(c => c.subject === section.name);
            for (const chap of chaps) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, subId);
                await Chapter.findByIdAndUpdate(chap._id, { driveFolderId: chapId });
                const hws = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapId);
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    await Homework.findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }
        res.json({ ok: true, message: "Synchronisation miroir réussie." });
    } catch (e) {
        console.error("❌ Synchro Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const devoirsId = await DriveService.getSpecificDevoirsId(`${prof.firstName} ${prof.lastName}`, classroom);
        const subId = await DriveService.getOrCreateFolder(subject, devoirsId);
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

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className, deletedSection } = req.body;
        const prof = await mongoose.model('Teacher').findById(req.params.id);
        if (deletedSection && className) {
            const devId = await DriveService.getSpecificDevoirsId(`${prof.firstName} ${prof.lastName}`, className);
            const children = await DriveService.listChildren(devId);
            const target = children.find(c => c.name === DriveService.normalize(deletedSection));
            if (target) await DriveService.deleteEntity(target.id);
        }
        const updated = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ user: { id: updated._id, firstName: updated.firstName, lastName: updated.lastName, subjectSections: updated.subjectSections, role: 'prof' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteEntity(chap.driveFolderId);
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;