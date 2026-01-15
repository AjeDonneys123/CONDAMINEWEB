const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 📄 DOMAINE : DEVOIRS
 */

// Liste tous les devoirs
router.get('/all', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        res.json(await Homework.find({}).sort({ date: -1 }));
    } catch (e) { res.status(500).json([]); }
});

// US #4 & #7 : Création/Update avec Miroir Drive
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
            message: _id ? "Mise à jour réussie" : "Espace Drive créé"
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #9 : Suppression par ID (Fix 404)
router.delete('/:id', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const hw = await Homework.findById(req.params.id);
        if (hw?.driveFolderId) await DriveService.deleteFile(hw.driveFolderId);
        await Homework.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;