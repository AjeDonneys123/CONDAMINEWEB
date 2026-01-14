const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * 📄 DOMAINE : HOMEWORK (Mode Full Drive)
 */

const normalize = (n) => n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").trim();

// POST /api/homework/upload-to-drive
// Gère l'upload direct vers le Drive sans passer par Cloudinary
router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { classroom, title, type } = req.body; // type = 'doc' ou 'qimg'
        
        // 1. On assure la structure physique (US #4)
        const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
        const hwRootId = await DriveService.getOrCreateFolder("DEVOIRS_MANUELS", classId);
        const thisHwId = await DriveService.getOrCreateFolder(normalize(title || "DEVOIR_SANS_NOM"), hwRootId);
        const subjectFolderId = await DriveService.getOrCreateFolder("SUJET", thisHwId);

        // 2. Upload
        const file = await DriveService.uploadFile(
            subjectFolderId, 
            `${type.toUpperCase()}_${Date.now()}`, 
            req.file.buffer, 
            req.file.mimetype
        );

        res.json({ ok: true, imageUrl: file.url, driveId: file.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const { _id, ...data } = req.body;
        if (_id) return res.json(await Homework.findByIdAndUpdate(_id, data, { new: true }));
        res.json(await Homework.create(data));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;