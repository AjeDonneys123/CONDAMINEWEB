const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });
const softNormalize = (n) => n ? n.trim() : "SANS_TITRE";

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

        // 1. NAVIGATION ET SUTURE DRIVE
        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                const subName = chapter.subject === 'H' ? 'HISTOIRE' : chapter.subject === 'G' ? 'GEOGRAPHIE' : 'EMC';
                
                // On construit le chemin pour le renvoyer au client
                constructedPath = `CONDACLASSE / ${classroom} / ${subName} / ${chapter.title}`;

                // On s'assure d'avoir la racine du Chapitre
                if (!chapter.driveFolderId) {
                    const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
                    const classId = await DriveService.getOrCreateFolder(softNormalize(classroom), rootId);
                    const subId = await DriveService.getOrCreateFolder(subName, classId);
                    chapter.driveFolderId = await DriveService.getOrCreateFolder(chapter.title, subId);
                    await chapter.save();
                }

                // Création du dossier du DEVOIR
                if (chapter.driveFolderId) {
                    homeworkDriveId = await DriveService.getOrCreateFolder(softNormalize(title), chapter.driveFolderId);
                    constructedPath += ` / ${softNormalize(title)}`;
                    
                    // US #4 : Tiroirs
                    await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                    await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);
                }
            }
        }

        const payload = { ...req.body, driveFolderId: homeworkDriveId };
        const result = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);

        // On renvoie l'objet + le chemin construit pour l'UI
        res.json({
            ...result._doc,
            drivePath: constructedPath
        });
    } catch (e) {
        console.error("❌ Homework Sync Error:", e.message);
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

module.exports = router;