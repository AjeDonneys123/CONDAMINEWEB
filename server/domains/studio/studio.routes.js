// @signatures: DELETE /:id, GET /:id, GET /projects/:userId, POST /, POST /fix-code, POST /generate-asset, POST /generate-game, POST /remix-asset, POST /upload-asset
const express = require('express');
const router = express.Router();
const StudioExpert = require('./experts/studio.expert');
const StudioDB = require('./db/studio.db');
const StudioDrive = require('./experts/studio.drive');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
const upload = multer({ dest: tempDir });

router.get('/projects/:userId', asyncHandler(async (req, res) => {
    res.json(await StudioExpert.getUserProjects(req.params.userId));
}));

router.get('/:id', asyncHandler(async (req, res) => {
    const project = await StudioDB.findProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
}));

router.post('/', asyncHandler(async (req, res) => {
    res.json(await StudioExpert.saveProject(req.body));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await StudioDB.deleteProject(req.params.id);
    res.json({ ok: true });
}));

// --- UPLOAD ASSET DEPUIS PC VERS DRIVE ---
router.post('/upload-asset', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    
    console.log(`📤 [STUDIO-UPLOAD] Réception : ${req.file.originalname}`);
    
    try {
        // 1. Envoi vers Google Drive (via l'Expert Drive Studio)
        const driveData = await StudioDrive.uploadAsset(req.file.path, req.file.originalname);
        
        if (!driveData || !driveData.id) {
            throw new Error("Échec de l'upload Google Drive");
        }

        // 2. On génère l'URL Proxy pour le frontend
        const finalUrl = `/api/structure/proxy/${driveData.id}`;
        
        // 3. On déplace le fichier dans uploads/ pour une sauvegarde locale (optionnel mais recommandé)
        const finalLocalPath = path.join(process.cwd(), 'public', 'uploads', `studio-${Date.now()}-${req.file.originalname}`);
        fs.renameSync(req.file.path, finalLocalPath);

        console.log(`✅ [STUDIO-UPLOAD] Terminé : ${finalUrl}`);
        res.json({ 
            url: finalUrl, 
            driveId: driveData.id,
            localPath: finalLocalPath 
        });

    } catch (e) {
        console.error("❌ [STUDIO-UPLOAD] Erreur:", e.message);
        // Nettoyage temp en cas d'erreur
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Erreur lors de l'archivage Cloud." });
    }
}));

router.post('/generate-asset', asyncHandler(async (req, res) => {
    const { prompt, type } = req.body;
    const result = await StudioExpert.generateAsset(prompt, type || 'character');
    res.json(result);
}));

router.post('/generate-game', asyncHandler(async (req, res) => {
    const { projectId, gameIdea } = req.body;
    const result = await StudioExpert.generateGame(projectId, gameIdea);
    res.json(result);
}));

module.exports = router;
