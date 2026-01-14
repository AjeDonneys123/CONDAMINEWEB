const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });
const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const { _id, chapterId, title, classroom } = req.body;

        let homeworkDriveId = null;

        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                // On passe par Devoirs
                const hwRootId = await DriveService.getHomeworkRoot(classroom);
                const subId = await DriveService.getOrCreateFolder(normalize(chapter.subject), hwRootId);
                const chapId = await DriveService.getOrCreateFolder(normalize(chapter.title), subId);
                homeworkDriveId = await DriveService.getOrCreateFolder(normalize(title), chapId);
                
                await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);
            }
        }

        const payload = { ...req.body, driveFolderId: homeworkDriveId };
        const result = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);

        res.json({
            ...result._doc,
            drivePath: `... / Devoirs / ${result.title}`,
            message: "Devoir synchronisé"
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { homeworkId, type } = req.body;
        const homework = await mongoose.model('Homework').findById(homeworkId);
        if (!homework?.driveFolderId) throw new Error("Dossier Drive absent");

        const subjectFolderId = await DriveService.getOrCreateFolder("SUJET", homework.driveFolderId);
        const file = await DriveService.uploadFile(subjectFolderId, `${type.toUpperCase()}_${Date.now()}.jpg`, req.file.buffer, req.file.mimetype);

        res.json({ ok: true, imageUrl: file.url });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

module.exports = router;