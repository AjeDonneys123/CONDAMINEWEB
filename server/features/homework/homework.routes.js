const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 📄 DOMAINE : DEVOIRS (MIROIR)
 */

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const Teacher = mongoose.model('Teacher');
        const { _id, chapterId, title, classroom, teacherId } = req.body;

        let hwDriveId = null;
        let pathLog = "CONDA CLASSE";

        if (chapterId && chapterId !== 'none') {
            const chap = await Chapter.findById(chapterId);
            const prof = await Teacher.findById(teacherId);
            if (chap && prof) {
                const teacherName = `${prof.firstName} ${prof.lastName}`;
                const pathInfo = await DriveService.getMirrorPathId(teacherName, classroom, chap.subject, chap.title);
                
                hwDriveId = await DriveService.getOrCreateFolder(title, pathInfo.chapterId);
                
                // US #4 : Sous-dossiers obligatoires
                if (hwDriveId) {
                    await DriveService.getOrCreateFolder("SUJET", hwDriveId);
                    await DriveService.getOrCreateFolder("COPIES", hwDriveId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwDriveId);
                    pathLog = `CONDA CLASSE / ${DriveService.normalize(teacherName)} / ${classroom.toUpperCase()} / DEVOIRS / ${DriveService.normalize(chap.subject)} / ${DriveService.normalize(chap.title)} / ${DriveService.normalize(title)}`;
                }
            }
        }

        const payload = { ...req.body, driveFolderId: hwDriveId, classroom };
        const result = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);

        res.json({
            ...result._doc,
            drivePath: pathLog,
            message: _id ? "Mise à jour miroir réussie" : "Espace Devoir créé sur Drive"
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({})); } catch (e) { res.status(500).json([]); }
});

module.exports = router;