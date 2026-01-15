const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');
const AIService = require('../../services/ai.service');

router.get('/all', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        res.json(await Homework.find({}).sort({ date: -1 }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/analyze-homework', async (req, res) => {
    try {
        const { userText, homeworkInstruction, classroom, playerId, homeworkId, levelIndex } = req.body;
        const style = await mongoose.model('TeacherStyle').findOne({ teacherId: "jean_vuillet" });
        const analysis = await AIService.analyzeSubmission(userText, homeworkInstruction, classroom, style?.pedagogicalMemory || "");
        
        if (playerId) {
            await mongoose.model('Player').findByIdAndUpdate(playerId, {
                $push: { spellingMistakes: { $each: analysis.corrections || [] } }
            });
        }
        await mongoose.model('Submission').create({ playerId, homeworkId, levelIndex, originalTranscription: userText, feedback: analysis.feedback_fond, grade: analysis.grade });
        res.json(analysis);
    } catch (e) { res.status(500).json({ error: e.message }); }
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

        const Homework = mongoose.model('Homework');
        const payload = { ...req.body, driveFolderId: driveId };
        const r = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);
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