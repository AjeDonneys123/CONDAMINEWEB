// @signatures: ProfStudio, projects, save, uploadAsset, detectBg
const express = require('express');
const router = express.Router();
const { StudioProject } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// SÉCURITÉ : Création dossier temp
const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
const upload = multer({ dest: tempDir });

/**
 * 🎬 ROUTER STUDIO PROF V106
 */

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

// ✅ ROUTE D'UPLOAD (Celle que le front cherchait)
router.post('/upload-asset', upload.single('file'), async (req, res) => {
    console.log("📥 [STUDIO-ROUTE] Upload reçu :", req.file?.originalname);
    try {
        if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
        
        const folderId = await ProfDrive.getOrCreateFolder("STUDIO_ASSETS");
        const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
        
        try { fs.unlinkSync(req.file.path); } catch(e) {}

        const url = `/api/proxy/${driveFile.id}`;
        console.log("✅ [STUDIO-ROUTE] URL générée :", url);
        res.json({ url });
    } catch (e) {
        console.error("❌ [STUDIO-ROUTE] Erreur :", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/detect-bg-by-id', async (req, res) => {
    res.json({ color: "#FFFFFF" });
});

module.exports = router;
