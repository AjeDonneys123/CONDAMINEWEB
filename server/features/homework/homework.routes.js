const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });

// Normalisation pour correspondre à ton Drive : on garde les espaces et majuscules
const normalize = (n) => n ? n.trim() : "SANS_TITRE";

/**
 * 📄 DOMAINE : HOMEWORK
 */

// Sauvegarde et création physique immédiate
router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const { _id, chapterId, title, classroom, ...data } = req.body;

        let finalDriveId = null;

        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                // 1. On s'assure d'avoir la racine du Chapitre sur Drive
                let chapterDriveId = chapter.driveFolderId;
                
                if (!chapterDriveId) {
                    console.log(`🔍 Recherche du dossier chapitre "${chapter.title}" sur Drive...`);
                    const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
                    const classId = await DriveService.getOrCreateFolder(classroom, condaRootId);
                    const subId = await DriveService.getOrCreateFolder(chapter.subject === 'H' ? 'HISTOIRE' : chapter.subject, classId);
                    chapterDriveId = await DriveService.getOrCreateFolder(chapter.title, subId);
                    
                    // On met à jour le chapitre en BDD pour ne plus avoir à chercher
                    chapter.driveFolderId = chapterDriveId;
                    await chapter.save();
                }

                // 2. Création du dossier du DEVOIR dans le dossier du CHAPITRE
                if (chapterDriveId) {
                    finalDriveId = await DriveService.getOrCreateFolder(normalize(title), chapterDriveId);
                    // Création de la structure interne US #4
                    await DriveService.getOrCreateFolder("SUJET", finalDriveId);
                    await DriveService.getOrCreateFolder("COPIES", finalDriveId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", finalDriveId);
                }
            }
        }

        // Sauvegarde BDD
        const payload = { 
            ...data, title, classroom, 
            chapterId: chapterId === 'none' ? null : chapterId,
            driveFolderId: finalDriveId 
        };

        let homework;
        if (_id) {
            homework = await Homework.findByIdAndUpdate(_id, payload, { new: true });
        } else {
            homework = await Homework.create(payload);
        }

        // 3. Raccourcis pour les élèves (si sélectionnés)
        if (req.body.targetPlayerIds?.length > 0 && finalDriveId) {
            const Player = mongoose.model('Player');
            const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classId = await DriveService.getOrCreateFolder(classroom, condaRootId);
            const elevesRootId = await DriveService.getOrCreateFolder("ELEVES", classId);

            for (const pId of req.body.targetPlayerIds) {
                const student = await Player.findById(pId);
                if (student) {
                    const studentFolderId = await DriveService.getOrCreateFolder(`${student.lastName}_${student.firstName}`, elevesRootId);
                    const studentHwFolderId = await DriveService.getOrCreateFolder("DEVOIRS", studentFolderId);
                    await DriveService.createShortcut(finalDriveId, studentHwFolderId, title);
                }
            }
        }

        res.json(homework);
    } catch (e) {
        console.error("Erreur Devoir:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

module.exports = router;