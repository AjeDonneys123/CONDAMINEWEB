// @signatures: ProfStudio, projects, save, uploadAsset, detectBg, removeBgSpecialized, saveEdition
const express = require('express');
const router = express.Router();
const { StudioProject } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const StudioExpert = require('../../domains/studio/experts/studio.expert'); 
const EditionExpert = require('../../domains/studio/experts/edition.expert'); // V459
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
const upload = multer({ dest: tempDir });

router.get('/projects/:userId', async (req, res) => {
    try {
        const projects = await StudioProject.find({ teacherId: req.params.userId }).sort({ updatedAt: -1 }).lean();
        res.json(projects);
    } catch (e) { res.status(500).json([]); }
});

router.post('/', async (req, res) => {
    try {
        const data = req.body;
        let result;
        if (data._id) result = await StudioProject.findByIdAndUpdate(data._id, data, { new: true });
        else result = await StudioProject.create(data);
        res.json(result);
    } catch (e) { res.status(500).json({ error: "Save fail" }); }
});

router.post('/upload-asset', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
        const folderId = await ProfDrive.getOrCreateFolder("STUDIO_ASSETS");
        const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
        try { fs.unlinkSync(req.file.path); } catch(e) {}
        res.json({ url: `/api/proxy/${driveFile.id}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ NOUVELLE ROUTE : SAUVEGARDE ÉDITION (GOMME) V459
router.post('/save-edition', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Blob manquant" });
        const result = await EditionExpert.saveErasedImage(req.file.path, req.file.originalname);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/remove-bg-specialized', async (req, res) => {
    try {
        const { url } = req.body;
        const result = await StudioExpert.specializedBgRemoval(url);
        if (result) res.json(result);
        else res.status(500).json({ error: "Échec détourage" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
