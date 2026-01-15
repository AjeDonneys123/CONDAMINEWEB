const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

router.get('/all', async (req, res) => {
    try {
        const data = await mongoose.model('Homework').find({}).sort({ date: -1 });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const { _id, chapterId, title, classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const prof = await Teacher.findById(teacherId);
        const chap = await Chapter.findById(chapterId);

        if (!prof || !chap) throw new Error("Données enseignant ou dossier introuvables");

        let driveId = req.body.driveFolderId;
        if (!driveId) {
            console.log(`📡 Création miroir Drive pour: ${title}`);
            const teacherName = `${prof.firstName} ${prof.lastName}`;
            const pathInfo = await DriveService.getMirrorPathId(teacherName, classroom, chap.subject, chap.title);
            driveId = await DriveService.getOrCreateFolder(title, pathInfo.chapterId);
            if (driveId) {
                await DriveService.getOrCreateFolder("SUJET", driveId);
                await DriveService.getOrCreateFolder("COPIES", driveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", driveId);
            } else {
                throw new Error("Impossible de créer le dossier sur Google Drive");
            }
        }

        const Homework = mongoose.model('Homework');
        const payload = { ...req.body, driveFolderId: driveId };
        const result = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);
        res.json(result);
    } catch (e) { 
        console.error("❌ [HW_ROUTE] Error:", e.message);
        res.status(500).json({ error: e.message }); 
    }
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