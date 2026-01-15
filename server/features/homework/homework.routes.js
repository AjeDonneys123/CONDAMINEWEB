const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });
const normalize = (n) => DriveService.normalizeName(n);

/**
 * 📄 DOMAINE : DEVOIRS
 */

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const { _id, chapterId, title, classroom } = req.body;

        // 1. Détermination de la hiérarchie physique
        let homeworkDriveId = null;
        let fullPathReport = "CONDA CLASSE";

        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                // On utilise la CLASSE passée par le front (active) pour éviter les erreurs 2A/2CD
                const classRootId = await DriveService.getClassRoot(classroom);
                const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classRootId);
                
                // On utilise le NOM de la matière stocké dans le chapitre
                const subjectId = await DriveService.getOrCreateFolder(chapter.subject, devoirsId);
                const chapId = await DriveService.getOrCreateFolder(chapter.title, subjectId);
                
                // Création du dossier du devoir
                homeworkDriveId = await DriveService.getOrCreateFolder(title, chapId);
                
                // US #4 : Structure interne obligatoire
                await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);

                fullPathReport = `CONDA CLASSE / ${classroom.toUpperCase()} / DEVOIRS / ${normalize(chapter.subject)} / ${normalize(chapter.title)} / ${normalize(title)}`;
            }
        }

        const payload = { 
            ...req.body, 
            driveFolderId: homeworkDriveId, 
            classroom // On force la classe active
        };

        const result = _id 
            ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) 
            : await Homework.create(payload);

        res.json({
            ...result._doc,
            drivePath: fullPathReport,
            message: _id ? "Modifications enregistrées" : "Devoir initialisé sur Drive"
        });

    } catch (e) { 
        console.error("❌ Erreur Homework Save:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { homeworkId, type } = req.body;
        const homework = await mongoose.model('Homework').findById(homeworkId);
        if (!homework?.driveFolderId) throw new Error("Dossier Drive racine manquant");

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