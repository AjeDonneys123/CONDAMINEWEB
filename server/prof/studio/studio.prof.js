// @signatures: ProfStudio, projects, save, uploadAsset, detectBg, removeBgSpecialized
const express = require('express');
const router = express.Router();
const { StudioProject } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const StudioExpert = require('../../domains/studio/experts/studio.expert'); 
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

// ✅ ROUTE DÉTOURAGE SPÉCIALISÉ
router.post('/remove-bg-specialized', async (req, res) => {
    console.log("📥 [STUDIO-ROUTE] Requête remove-bg-specialized reçue.");
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "URL manquante" });
        
        const result = await StudioExpert.specializedBgRemoval(url);
        
        if (result) {
            res.json(result);
        } else {
            res.status(500).json({ error: "Échec du détourage (voir logs serveur)" });
        }
    } catch (e) {
        console.error("❌ [STUDIO-ROUTE] Erreur fatale :", e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
