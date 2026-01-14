const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });

// Helper de normalisation stricte (US #5)
const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").trim() : "SANS_TITRE";

/**
 * 📄 DOMAINE : HOMEWORK
 */

// POST /api/homework/upload-to-drive
router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { classroom, title, type, chapterId } = req.body;
        if(!req.file) throw new Error("Fichier manquant");

        // 1. Trouver le dossier parent (Dossier du Chapitre ou dossier par défaut)
        let parentDriveId = null;
        if (chapterId && chapterId !== 'none') {
            const chapter = await mongoose.model('Chapter').findById(chapterId);
            if (chapter && chapter.driveFolderId) {
                parentDriveId = chapter.driveFolderId;
            }
        }

        // Si pas de chapitre, on crée dans un dossier générique par classe
        if (!parentDriveId) {
            const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
            parentDriveId = await DriveService.getOrCreateFolder("DEVOIRS_NON_CLASSES", classId);
        }

        // 2. Créer le dossier du devoir (US #4)
        const homeworkFolderId = await DriveService.getOrCreateFolder(normalize(title), parentDriveId);
        const subjectFolderId = await DriveService.getOrCreateFolder("SUJET", homeworkFolderId);

        // 3. Upload physique
        const file = await DriveService.uploadFile(
            subjectFolderId, 
            `${type.toUpperCase()}_${Date.now()}.jpg`, 
            req.file.buffer, 
            req.file.mimetype
        );

        res.json({ ok: true, imageUrl: file.url, driveId: file.id, homeworkDriveId: homeworkFolderId });
    } catch (e) {
        console.error("❌ Erreur Upload Drive Devoir:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// SAUVEGARDE + SYNC DRIVE (US #7 Miroir Physique)
router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const { _id, chapterId, title, classroom, ...data } = req.body;

        // 1. On récupère le dossier Drive du Chapitre pour la synchro
        let driveFolderId = null;
        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter && chapter.driveFolderId) {
                // Création/Récupération du dossier du devoir dans le dossier du chapitre
                driveFolderId = await DriveService.getOrCreateFolder(normalize(title), chapter.driveFolderId);
                // On s'assure que la structure SUJET existe (US #4)
                await DriveService.getOrCreateFolder("SUJET", driveFolderId);
                await DriveService.getOrCreateFolder("COPIES", driveFolderId);
                await DriveService.getOrCreateFolder("CORRECTIONS", driveFolderId);
            }
        }

        // 2. Sauvegarde BDD
        let homework;
        const payload = { 
            ...data, 
            title, 
            classroom, 
            chapterId: chapterId === 'none' ? null : chapterId,
            driveFolderId: driveFolderId // On stocke l'ID Drive du devoir
        };

        if (_id) {
            homework = await Homework.findByIdAndUpdate(_id, payload, { new: true });
        } else {
            homework = await Homework.create(payload);
        }

        // 3. Distribution élèves (Raccourcis)
        if (req.body.targetPlayerIds?.length > 0 && driveFolderId) {
            const Player = mongoose.model('Player');
            const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
            const elevesRootId = await DriveService.getOrCreateFolder("ELEVES", classId);

            for (const pId of req.body.targetPlayerIds) {
                const student = await Player.findById(pId);
                if (student) {
                    const studentFolderId = await DriveService.getOrCreateFolder(normalize(`${student.lastName}_${student.firstName}`), elevesRootId);
                    const studentHwFolderId = await DriveService.getOrCreateFolder("DEVOIRS", studentFolderId);
                    // On crée le lien symbolique Drive vers le dossier du devoir (US Distribution)
                    await DriveService.createShortcut(driveFolderId, studentHwFolderId, title);
                }
            }
        }

        res.json(homework);
    } catch (e) {
        console.error("❌ Erreur Sauvegarde Devoir:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

router.delete('/:id', async (req, res) => {
    try {
        const hw = await mongoose.model('Homework').findById(req.params.id);
        if (hw?.driveFolderId) {
            await DriveService.deleteFile(hw.driveFolderId).catch(() => {});
        }
        await mongoose.model('Homework').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;