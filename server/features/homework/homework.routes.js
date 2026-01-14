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

// POST /api/homework/upload-to-drive
router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { classroom, title, type, chapterId } = req.body;
        if(!req.file) throw new Error("Fichier manquant");

        console.log(`☁️ [DRIVE] Upload pour ${title} (${type})`);

        // 1. Recherche du dossier parent (Chapitre)
        let parentDriveId = null;
        if (chapterId && chapterId !== 'none') {
            const chapter = await mongoose.model('Chapter').findById(chapterId);
            if (chapter?.driveFolderId) parentDriveId = chapter.driveFolderId;
        }

        // Fallback dossier de classe
        if (!parentDriveId) {
            const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
            parentDriveId = await DriveService.getOrCreateFolder("DEVOIRS_LIBRES", classId);
        }

        // 2. Dossier Devoir > SUJET
        const homeworkFolderId = await DriveService.getOrCreateFolder(normalize(title), parentDriveId);
        const subjectFolderId = await DriveService.getOrCreateFolder("SUJET", homeworkFolderId);

        // 3. Upload
        const file = await DriveService.uploadFile(
            subjectFolderId, 
            `${type.toUpperCase()}_${Date.now()}.jpg`, 
            req.file.buffer, 
            req.file.mimetype
        );

        res.json({ ok: true, imageUrl: file.url, driveId: file.id });
    } catch (e) {
        console.error("❌ [HOMEWORK] Erreur upload Drive:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// SAUVEGARDE ET DISTRIBUTION (US #Distribution)
router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const Player = mongoose.model('Player');
        const { _id, chapterId, title, classroom, targetPlayerIds, ...data } = req.body;

        // 1. Sync Drive Folder
        let homeworkDriveId = null;
        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter?.driveFolderId) {
                homeworkDriveId = await DriveService.getOrCreateFolder(normalize(title), chapter.driveFolderId);
            }
        }

        // 2. Save BDD
        const payload = { ...data, title, classroom, chapterId: chapterId === 'none' ? null : chapterId, targetPlayerIds, driveFolderId: homeworkDriveId };
        const homework = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);

        // 3. Création des raccourcis pour les élèves ciblés (US #Challenge)
        if (targetPlayerIds?.length > 0 && homeworkDriveId) {
            const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
            const elevesRootId = await DriveService.getOrCreateFolder("ELEVES", classId);

            for (const pId of targetPlayerIds) {
                const student = await Player.findById(pId);
                if (student) {
                    const studentFolderId = await DriveService.getOrCreateFolder(normalize(`${student.lastName}_${student.firstName}`), elevesRootId);
                    const studentHwFolderId = await DriveService.getOrCreateFolder("DEVOIRS", studentFolderId);
                    // On crée un raccourci pointant vers le dossier du devoir
                    await DriveService.createShortcut(homeworkDriveId, studentHwFolderId, title);
                }
            }
        }

        res.json(homework);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

module.exports = router;