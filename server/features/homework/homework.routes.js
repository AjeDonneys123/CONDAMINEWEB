const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });

// Normalisation douce : on garde les espaces et la casse pour correspondre au Drive manuel
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

        // 1. RÉCUPÉRATION DU DOSSIER PARENT (CHAPITRE)
        if (chapterId && chapterId !== 'none') {
            const chapter = await Chapter.findById(chapterId);
            if (chapter) {
                // On cherche l'ID Drive du chapitre s'il est manquant ou invalide
                if (!chapter.driveFolderId) {
                    console.log(`🔍 Suture Drive pour le chapitre : ${chapter.title}`);
                    const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
                    const classId = await DriveService.getOrCreateFolder(softNormalize(classroom), rootId);
                    const subName = chapter.subject === 'H' ? 'HISTOIRE' : chapter.subject === 'G' ? 'GEOGRAPHIE' : 'EMC';
                    const subId = await DriveService.getOrCreateFolder(subName, classId);
                    
                    // On cherche le dossier par son nom exact
                    chapter.driveFolderId = await DriveService.getOrCreateFolder(chapter.title, subId);
                    await chapter.save();
                }

                // 2. CRÉATION DU DOSSIER DU DEVOIR DANS LE CHAPITRE
                if (chapter.driveFolderId) {
                    homeworkDriveId = await DriveService.getOrCreateFolder(softNormalize(title), chapter.driveFolderId);
                    
                    // Création des tiroirs de production (US #4)
                    await DriveService.getOrCreateFolder("SUJET", homeworkDriveId);
                    await DriveService.getOrCreateFolder("COPIES", homeworkDriveId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", homeworkDriveId);
                }
            }
        }

        // 3. SAUVEGARDE BDD
        const payload = { 
            ...req.body, 
            driveFolderId: homeworkDriveId 
        };
        
        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Homework.findByIdAndUpdate(_id, payload, { new: true });
        } else {
            result = await Homework.create(payload);
        }

        // 4. DISTRIBUTION RACCOURCIS ÉLÈVES
        if (req.body.targetPlayerIds?.length > 0 && homeworkDriveId) {
            const Player = mongoose.model('Player');
            const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classId = await DriveService.getOrCreateFolder(softNormalize(classroom), rootId);
            const elevesRootId = await DriveService.getOrCreateFolder("ELEVES", classId);

            for (const pId of req.body.targetPlayerIds) {
                const student = await Player.findById(pId);
                if (student) {
                    const studentFolderId = await DriveService.getOrCreateFolder(softNormalize(`${student.lastName}_${student.firstName}`), elevesRootId);
                    const studentHwFolderId = await DriveService.getOrCreateFolder("DEVOIRS", studentFolderId);
                    await DriveService.createShortcut(homeworkDriveId, studentHwFolderId, title);
                }
            }
        }

        res.json(result);
    } catch (e) {
        console.error("❌ Error Homework Sync:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// Upload direct vers Drive
router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { homeworkId, type } = req.body;
        const homework = await mongoose.model('Homework').findById(homeworkId);
        
        if (!homework || !homework.driveFolderId) {
            return res.status(400).json({ error: "Dossier Drive non initialisé. Sauvegardez le devoir d'abord." });
        }

        // On cible le sous-dossier SUJET du devoir
        const subjectFolderId = await DriveService.getOrCreateFolder("SUJET", homework.driveFolderId);

        const file = await DriveService.uploadFile(
            subjectFolderId, 
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