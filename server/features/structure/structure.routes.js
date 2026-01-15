const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

router.get('/chapters', async (req, res) => {
    try {
        res.json(await mongoose.model('Chapter').find({}));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { teacherId, classroom, subject, title, _id } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const { chapterId } = await DriveService.getMirrorPathId(`${prof.firstName} ${prof.lastName}`, classroom, subject, title);
        
        let result;
        if (_id) {
            result = await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: chapterId }, { new: true });
        } else {
            result = await mongoose.model('Chapter').create({ ...req.body, driveFolderId: chapterId });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters/archive', async (req, res) => {
    try {
        const { id, isArchived } = req.body;
        await mongoose.model('Chapter').findByIdAndUpdate(id, { isArchived });
        res.json({ ok: true });
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

router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        if (mode === 'nuke') {
            const { devoirsId } = await DriveService.getMirrorPathId(teacherName, classroom);
            if (devoirsId) await DriveService.deleteEntity(devoirsId);
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            return res.json({ message: "Nuke OK" });
        }

        const chapters = await mongoose.model('Chapter').find({ classroom });
        for (const chap of chapters) {
            await DriveService.getMirrorPathId(teacherName, classroom, chap.subject, chap.title);
        }
        res.json({ message: "Sync OK" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;