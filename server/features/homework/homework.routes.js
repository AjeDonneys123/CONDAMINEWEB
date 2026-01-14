const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });
const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").trim() : "SANS_TITRE";

/**
 * 📄 DOMAINE : HOMEWORK
 */

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

// SAUVEGARDE + SUTURE DRIVE (US #7 Miroir Physique)
router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const { _id, chapterId, title, classroom, ...data } = req.body;

        let homeworkDriveId = null;

        // On cherche le dossier du chapitre parent pour y ranger le devoir
        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter && chapter.driveFolderId) {
                // Création du dossier du devoir à l'intérieur du chapitre
                homeworkDriveId = await DriveService.getOrCreateFolder(normalize(title), chapter.driveFolderId);
                // Structure obligatoire US #4
                await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);
            }
        }

        const payload = { 
            ...data, title, classroom, 
            chapterId: chapterId === 'none' ? null : chapterId,
            driveFolderId: homeworkDriveId 
        };

        const result = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);
        res.json(result);
    } catch (e) {
        console.error("❌ [HOMEWORK] Erreur Sauvegarde/Drive:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { classroom, title, type, chapterId } = req.body;
        
        let parentDriveId = null;
        if (chapterId && chapterId !== 'none') {
            const chap = await mongoose.model('Chapter').findById(chapterId);
            parentDriveId = chap?.driveFolderId;
        }

        if (!parentDriveId) {
            const root = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const cls = await DriveService.getOrCreateFolder(normalize(classroom), root);
            parentDriveId = await DriveService.getOrCreateFolder("DEVOIRS_LIBRES", cls);
        }

        const hwFolderId = await DriveService.getOrCreateFolder(normalize(title), parentDriveId);
        const subjectFolderId = await DriveService.getOrCreateFolder("SUJET", hwFolderId);

        const file = await DriveService.uploadFile(
            subjectFolderId, 
            `${type.toUpperCase()}_${Date.now()}.jpg`, 
            req.file.buffer, 
            req.file.mimetype
        );

        res.json({ ok: true, imageUrl: file.url, driveId: file.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
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