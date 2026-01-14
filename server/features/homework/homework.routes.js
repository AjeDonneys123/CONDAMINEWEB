const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });
const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

/**
 * 📄 DOMAINE : HOMEWORK
 */

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const { _id, chapterId, title, classroom } = req.body;

        let homeworkDriveId = null;
        let constructedPath = "MON_DRIVE";

        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                const subName = normalize(chapter.subject);
                constructedPath = `CONDACLASSE / ${classroom} / ${subName} / ${chapter.title} / ${title}`;

                // Suture Drive
                const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
                const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
                const subId = await DriveService.getOrCreateFolder(subName, classId);
                const chapId = await DriveService.getOrCreateFolder(normalize(chapter.title), subId);
                
                homeworkDriveId = await DriveService.getOrCreateFolder(normalize(title), chapId);
                
                // Tiroirs US #4
                await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);
            }
        }

        const payload = { ...req.body, driveFolderId: homeworkDriveId };
        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Homework.findByIdAndUpdate(_id, payload, { new: true });
        } else {
            result = await Homework.create(payload);
        }

        // On renvoie bien le drivePath pour le bandeau vert
        res.json({ ...result._doc, drivePath: constructedPath });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// FIX 404 : Route de suppression explicite
router.delete('/:id', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const hw = await Homework.findById(req.params.id);
        if (hw?.driveFolderId) {
            await DriveService.deleteFile(hw.driveFolderId).catch(() => {});
        }
        await Homework.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { homeworkId, type } = req.body;
        const homework = await mongoose.model('Homework').findById(homeworkId);
        if (!homework?.driveFolderId) throw new Error("Dossier Drive non initialisé");

        const subjectFolderId = await DriveService.getOrCreateFolder("SUJET", homework.driveFolderId);
        const file = await DriveService.uploadFile(subjectFolderId, `${type.toUpperCase()}_${Date.now()}.jpg`, req.file.buffer, req.file.mimetype);

        res.json({ ok: true, imageUrl: file.url });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;