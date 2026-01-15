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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 : Synchro Miroir Totale (Force l'alignement BDD -> Drive)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        if (!prof) throw new Error("Enseignant non trouvé");
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        const classChapters = await Chapter.find({ classroom });
        const classHomeworks = await Homework.find({ classroom });

        for (const section of prof.subjectSections) {
            const chaps = classChapters.filter(c => c.subject === section.name);
            for (const chap of chaps) {
                // On s'assure que le chemin vers le chapitre existe
                const { chapterId: driveChapId } = await DriveService.getMirrorPathId(teacherName, classroom, section.name, chap.title);
                
                // Si l'ID a changé ou était nul, on met à jour la BDD
                if (chap.driveFolderId !== driveChapId) {
                    await Chapter.findByIdAndUpdate(chap._id, { driveFolderId: driveChapId });
                }

                // Pour chaque devoir, on vérifie s'il est au bon endroit
                const hws = classHomeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwDriveId = await DriveService.getOrCreateFolder(hw.title, driveChapId);
                    await DriveService.getOrCreateFolder("SUJET", hwDriveId);
                    await DriveService.getOrCreateFolder("COPIES", hwDriveId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwDriveId);
                    
                    if (hw.driveFolderId !== hwDriveId) {
                        await Homework.findByIdAndUpdate(hw._id, { driveFolderId: hwDriveId });
                    }
                }
            }
        }
        res.json({ ok: true, message: "Le Drive est maintenant le miroir exact de vos archives." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        const { chapterId: driveId } = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);

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

router.delete('/chapters/:id', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;