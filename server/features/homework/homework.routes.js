const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const Teacher = mongoose.model('Teacher');
        const { _id, chapterId, title, classroom, teacherId } = req.body;

        let homeworkDriveId = null;
        let pathStr = "CONDA CLASSE";

        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            const prof = await Teacher.findById(teacherId);
            
            if (chapter && prof) {
                const teacherName = `${prof.firstName} ${prof.lastName}`;
                const chapId = await DriveService.getPathFolder(teacherName, classroom, chapter.subject, chapter.title);
                homeworkDriveId = await DriveService.getOrCreateFolder(title, chapId);
                
                await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);

                pathStr = `CONDA CLASSE / ${DriveService.normalize(teacherName)} / ${classroom.toUpperCase()} / DEVOIRS / ${DriveService.normalize(chapter.subject)} / ${DriveService.normalize(chapter.title)} / ${DriveService.normalize(title)}`;
            }
        }

        const payload = { ...req.body, driveFolderId: homeworkDriveId, classroom };
        const result = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);

        res.json({
            ...result._doc,
            drivePath: pathStr,
            message: _id ? "Modifications sauvegardées" : "Espace Drive créé"
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

module.exports = router;