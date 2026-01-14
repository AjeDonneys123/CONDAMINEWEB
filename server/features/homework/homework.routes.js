const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });

// Normalisation stricte (US #5)
const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").trim() : "SANS_TITRE";

/**
 * 📄 DOMAINE : HOMEWORK (LOGIQUE IDENTIQUE AUX SCANS)
 */

// SAUVEGARDE + CRÉATION STRUCTURE DRIVE (US #4 & #7)
router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const { _id, title, classroom, chapterId } = req.body;

        // 1. On crée/récupère le devoir en BDD
        let homework;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            homework = await Homework.findByIdAndUpdate(_id, req.body, { new: true });
        } else {
            homework = await Homework.create(req.body);
        }

        // 2. LOGIQUE DRIVE (Copie conforme de ScanSession)
        // Si le dossier Drive n'existe pas encore, on le génère
        if (!homework.driveFolderId) {
            const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classFolderId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
            
            // On vérifie si on doit le mettre dans un chapitre
            let parentId = classFolderId;
            if (chapterId) {
                const chapter = await mongoose.model('Chapter').findById(chapterId);
                if (chapter?.driveFolderId) parentId = chapter.driveFolderId;
            }

            // Création de la racine du devoir
            const hwFolderId = await DriveService.getOrCreateFolder(normalize(title), parentId);
            
            // Création des 3 tiroirs standards (US #4)
            const subjectId = await DriveService.getOrCreateFolder("SUJET", hwFolderId);
            const copiesId = await DriveService.getOrCreateFolder("COPIES", hwFolderId);
            const correctionsId = await DriveService.getOrCreateFolder("CORRECTIONS", hwFolderId);

            // Mise à jour finale de l'objet
            homework = await Homework.findByIdAndUpdate(homework._id, {
                driveFolderId: hwFolderId,
                subjectFolderId: subjectId,
                copiesFolderId: copiesId,
                correctionsFolderId: correctionsId
            }, { new: true });
        }

        res.json(homework);
    } catch (e) {
        console.error("❌ [HOMEWORK] Erreur Sauvegarde:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// UPLOAD DE DOCUMENT (POST /api/homework/upload-to-drive)
router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { homeworkId, type } = req.body; // type = 'doc' ou 'qimg'
        const homework = await mongoose.model('Homework').findById(homeworkId);
        
        if (!homework || !homework.subjectFolderId) {
            return res.status(400).json({ error: "Le dossier Drive n'est pas encore initialisé." });
        }

        // Upload physique dans le tiroir SUJET (Comme dans les Scans)
        const file = await DriveService.uploadFile(
            homework.subjectFolderId, 
            `${type.toUpperCase()}_${Date.now()}.jpg`, 
            req.file.buffer, 
            req.file.mimetype
        );

        res.json({ ok: true, imageUrl: file.url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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