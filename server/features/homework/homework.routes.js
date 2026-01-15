const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const { _id, chapterId, title, classroom } = req.body;

        let homeworkDriveId = null;
        let pathStr = "CONDA CLASSE";

        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                const classRootId = await DriveService.getClassRoot(classroom);
                const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classRootId);
                const subjectId = await DriveService.getOrCreateFolder(chapter.subject, devoirsId);
                const chapId = await DriveService.getOrCreateFolder(chapter.title, subjectId);
                
                homeworkDriveId = await DriveService.getOrCreateFolder(title, chapId);
                
                await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);

                pathStr = `CONDA CLASSE / ${classroom.toUpperCase()} / DEVOIRS / ${DriveService.normalize(chapter.subject)} / ${DriveService.normalize(chapter.title)} / ${DriveService.normalize(title)}`;
            }
        }

        const payload = { ...req.body, driveFolderId: homeworkDriveId, classroom };
        const result = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);

        res.json({
            ...result._doc,
            drivePath: pathStr,
            message: _id ? "Mise à jour réussie" : "Création réussie"
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

module.exports = router;