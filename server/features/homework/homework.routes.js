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
        const { _id, chapterId, title } = req.body;

        let homeworkDriveId = null;
        let constructedPath = "JEAN VUILLET / DEVOIRS";

        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                // Chemin : DEVOIRS / MATIERE / CHAPITRE / DEVOIR
                const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
                const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
                const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", teacherId);
                const subId = await DriveService.getOrCreateFolder(normalize(chapter.subject), devoirsId);
                const chapId = await DriveService.getOrCreateFolder(normalize(chapter.title), subId);
                
                homeworkDriveId = await DriveService.getOrCreateFolder(normalize(title), chapId);
                constructedPath = `JEAN VUILLET / DEVOIRS / ${chapter.subject.toUpperCase()} / ${chapter.title} / ${title}`;

                // Sous-dossiers US #4
                await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);
            }
        }

        const payload = { ...req.body, driveFolderId: homeworkDriveId };
        const result = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);

        res.json({ ...result._doc, drivePath: constructedPath });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

router.delete('/:id', async (req, res) => {
    try {
        const hw = await mongoose.model('Homework').findById(req.params.id);
        if (hw?.driveFolderId) await DriveService.deleteFile(hw.driveFolderId);
        await mongoose.model('Homework').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;