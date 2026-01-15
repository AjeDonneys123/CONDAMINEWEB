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
    } catch (e) {
        console.error("❌ Erreur /api/players:", e.message);
        res.status(500).json({ error: "Impossible de charger les élèves" });
    }
});

// US #8 : Synchro Drive Forcee (Le bouton de secours)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        const classChapters = await Chapter.find({ classroom });
        const classHomeworks = await Homework.find({ classroom });

        const classRootId = await DriveService.getClassRoot(classroom);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classRootId);

        for (const section of prof.subjectSections) {
            const secId = await DriveService.getOrCreateFolder(section.name, devoirsId);
            const chaps = classChapters.filter(c => c.subject === section.name);
            
            for (const chap of chaps) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, secId);
                await Chapter.findByIdAndUpdate(chap._id, { driveFolderId: chapId });

                const hws = classHomeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapId);
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    await Homework.findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }
        res.json({ ok: true, message: "Miroir Drive aligné sur les archives !" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections } = req.body;
        const updatedTeacher = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ user: { id: updatedTeacher._id, firstName: updatedTeacher.firstName, lastName: updatedTeacher.lastName, subjectSections: updatedTeacher.subjectSections, role: 'prof' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        const classRootId = await DriveService.getClassRoot(classroom);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classRootId);
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

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.json([]); }
});

module.exports = router;