const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');
const AIService = require('../../services/ai.service');

router.get('/all', async (req, res) => {
    try {
        const data = await mongoose.model('Homework').find({}).sort({ date: -1 });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const { _id, chapterId, title, classroom, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const chap = await mongoose.model('Chapter').findById(chapterId);

        if (!prof || !chap) throw new Error("Données manquantes");

        let driveId = req.body.driveFolderId;
        if (!driveId) {
            const teacherName = `${prof.firstName} ${prof.lastName}`;
            const pathInfo = await DriveService.getMirrorPathId(teacherName, classroom, chap.subject, chap.title);
            driveId = await DriveService.getOrCreateFolder(title, pathInfo.chapterId);
            if (driveId) {
                await DriveService.getOrCreateFolder("SUJET", driveId);
                await DriveService.getOrCreateFolder("COPIES", driveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", driveId);
            }
        }

        const payload = { ...req.body, driveFolderId: driveId };
        const r = _id ? await mongoose.model('Homework').findByIdAndUpdate(_id, payload, { new: true }) : await mongoose.model('Homework').create(payload);
        res.json(r);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const hw = await mongoose.model('Homework').findById(req.params.id);
        if (hw?.driveFolderId) await DriveService.deleteEntity(hw.driveFolderId);
        await mongoose.model('Homework').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;