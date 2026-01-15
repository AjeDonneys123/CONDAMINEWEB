const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const HomeworkService = require('../../services/homework.service');
const DriveService = require('../../services/drive.service');

/**
 * 📄 ROUTER : DEVOIRS
 * Risque réduit : La logique complexe est dans HomeworkService.
 */

router.get('/all', async (req, res) => {
    try {
        res.json(await mongoose.model('Homework').find({}).sort({ date: -1 }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/analyze-homework', async (req, res) => {
    try {
        const result = await HomeworkService.processSubmission(req.body);
        res.json(result.analysis);
    } catch (e) { res.status(500).json({ error: "Échec analyse" }); }
});

router.post('/', async (req, res) => {
    try {
        const { _id, chapterId, title, classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const prof = await Teacher.findById(teacherId);
        const chap = await Chapter.findById(chapterId);

        let driveId = req.body.driveFolderId;
        if (!driveId && prof && chap) {
            const teacherName = `${prof.firstName} ${prof.lastName}`;
            const pathInfo = await DriveService.getMirrorPathId(teacherName, classroom, chap.subject, chap.title);
            driveId = await DriveService.getOrCreateFolder(title, pathInfo.chapterId);
            if (driveId) {
                await DriveService.getOrCreateFolder("SUJET", driveId);
                await DriveService.getOrCreateFolder("COPIES", driveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", driveId);
            }
        }
        const r = _id ? await mongoose.model('Homework').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true }) 
                       : await mongoose.model('Homework').create({ ...req.body, driveFolderId: driveId });
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