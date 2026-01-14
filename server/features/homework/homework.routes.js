const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

/**
 * 📄 DOMAINE : HOMEWORK (SYNC DRIVE V3)
 */

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Chapter = mongoose.model('Chapter');
        const { _id, chapterId, title, classroom } = req.body;

        let homeworkDriveId = null;

        // 1. RECONSTRUCTION DU CHEMIN PHYSIQUE DRIVE
        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                const subName = chapter.subject === 'H' ? 'HISTOIRE' : chapter.subject === 'G' ? 'GEOGRAPHIE' : chapter.subject === 'E' ? 'EMC' : normalize(chapter.subject);
                
                // On synchronise toute l'arborescence
                const path = ["CONDACLASSE", normalize(classroom), subName, chapter.title, title];
                homeworkDriveId = await DriveService.syncPath(path);

                // On s'assure que les dossiers techniques existent
                if (homeworkDriveId) {
                    await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                    await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);
                }

                // On met à jour l'ID Drive du chapitre s'il était manquant
                if (!chapter.driveFolderId) {
                    // On récupère l'ID du dossier chapitre (l'avant-dernier du chemin)
                    const chapterPath = ["CONDACLASSE", normalize(classroom), subName, chapter.title];
                    chapter.driveFolderId = await DriveService.syncPath(chapterPath);
                    await chapter.save();
                }
            }
        }

        // 2. SAUVEGARDE BDD
        const payload = { ...req.body, driveFolderId: homeworkDriveId };
        const result = _id ? await Homework.findByIdAndUpdate(_id, payload, { new: true }) : await Homework.create(payload);

        // 3. DISTRIBUTION (RACCOURCIS)
        if (req.body.targetPlayerIds?.length > 0 && homeworkDriveId) {
            const Player = mongoose.model('Player');
            const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classId = await DriveService.getOrCreateFolder(normalize(classroom), rootId);
            const elevesRootId = await DriveService.getOrCreateFolder("ELEVES", classId);

            for (const pId of req.body.targetPlayerIds) {
                const student = await Player.findById(pId);
                if (student) {
                    const studentFolderId = await DriveService.getOrCreateFolder(normalize(`${student.lastName}_${student.firstName}`), elevesRootId);
                    const studentHwFolderId = await DriveService.getOrCreateFolder("DEVOIRS", studentFolderId);
                    await DriveService.createShortcut(homeworkDriveId, studentHwFolderId, title);
                }
            }
        }

        res.json(result);
    } catch (e) {
        console.error("❌ [HOMEWORK] Sync Crash:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// Upload direct avec reconstruction du chemin
router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { classroom, title, type, chapterId } = req.body;
        const Chapter = mongoose.model('Chapter');
        
        let path = ["CONDACLASSE", normalize(classroom)];
        
        const chapter = await Chapter.findById(chapterId);
        if (chapter) {
            const subName = chapter.subject === 'H' ? 'HISTOIRE' : chapter.subject === 'G' ? 'GEOGRAPHIE' : 'EMC';
            path.push(subName, chapter.title, title, "SUJET");
        } else {
            path.push("DEVOIRS_LIBRES", title, "SUJET");
        }

        const targetFolderId = await DriveService.syncPath(path);
        const file = await DriveService.uploadFile(targetFolderId, `${type.toUpperCase()}_${Date.now()}.jpg`, req.file.buffer, req.file.mimetype);

        res.json({ ok: true, imageUrl: file.url, driveId: file.id });
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