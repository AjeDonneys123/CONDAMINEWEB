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

        let parentDriveId = null;
        if (chapterId && chapterId !== 'none') {
            const chapter = await mongoose.model('Chapter').findById(chapterId);
            if (chapter?.driveFolderId) parentDriveId = chapter.driveFolderId;
        }

        if (!parentDriveId) {
            const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
            parentDriveId = await DriveService.getOrCreateFolder("DEVOIRS_LIBRES", classId);
        }

        const homeworkFolderId = await DriveService.getOrCreateFolder(normalize(title), parentDriveId);
        const subjectFolderId = await DriveService.getOrCreateFolder("SUJET", homeworkFolderId);

        const file = await DriveService.uploadFile(
            subjectFolderId, 
            `${type.toUpperCase()}_${Date.now()}.jpg`, 
            req.file.buffer, 
            req.file.mimetype
        );

        res.json({ ok: true, imageUrl: file.url, driveId: file.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/homework/all
router.get('/all', async (req, res) => {
    try { 
        res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); 
    } catch (e) { res.status(500).json([]); }
});

// POST /api/homework (Sauvegarde)
router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const { _id, ...data } = req.body;
        
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const updated = await Homework.findByIdAndUpdate(_id, data, { new: true });
            return res.json(updated);
        }
        const created = await Homework.create(data);
        res.json(created);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/homework/:id (RÉPARÉ : US #9 Nettoyage Drive + BDD)
router.delete('/:id', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const homework = await Homework.findById(req.params.id);
        
        if (!homework) return res.status(404).json({ error: "Devoir introuvable" });

        // Suppression physique sur Google Drive si l'ID est stocké
        if (homework.driveFolderId) {
            console.log(`🗑️ [DRIVE] Suppression du dossier : ${homework.driveFolderId}`);
            await DriveService.deleteFile(homework.driveFolderId).catch(err => {
                console.warn("⚠️ Dossier Drive déjà supprimé ou inaccessible.");
            });
        }

        // Suppression en BDD
        await Homework.findByIdAndDelete(req.params.id);
        
        res.json({ ok: true, message: "Devoir et dossier Drive supprimés." });
    } catch (e) {
        console.error("❌ [DELETE HOMEWORK] Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;