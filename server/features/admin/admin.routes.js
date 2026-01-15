const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Route Players (Fix 500)
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        res.json(await Player.find({}).sort({ classroom: 1, lastName: 1 }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 : Synchronisation Miroir Conforme
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        if (!prof) throw new Error("Prof non identifié");
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        const classChapters = await Chapter.find({ classroom });
        const classHomeworks = await Homework.find({ classroom });

        for (const section of prof.subjectSections) {
            const subjectId = await DriveService.getPathFolder(teacherName, classroom, section.name);
            const chaps = classChapters.filter(c => c.subject === section.name);
            
            for (const chap of chaps) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, subjectId);
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
        res.json({ ok: true, message: `Drive de ${teacherName} aligné !` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(teacherId);
        if(!prof) throw new Error("Prof requis");
        
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const driveId = await DriveService.getPathFolder(teacherName, classroom, subject, title);

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