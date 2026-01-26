const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const StudioExpert = require('./experts/studio.expert');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// Upload simple (pour le découpage manuel)
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    const publicUrl = `/uploads/${req.file.filename}`;
    res.json({ url: publicUrl });
});

// Génération Text-to-Image
router.post('/generate-asset', asyncHandler(async (req, res) => {
    const { prompt, type } = req.body;
    const result = await StudioExpert.generateAsset(prompt, type);
    res.json({ ok: true, ...result });
}));

// NOUVEAU : Remix Image-to-Image (via description vision)
router.post('/remix-asset', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Image requise" });
    const result = await StudioExpert.remixAsset(req.file);
    // Nettoyage fichier temp
    try { fs.unlinkSync(req.file.path); } catch(e){}
    res.json({ ok: true, ...result });
}));

// NOUVEAU : Génération de Code de Jeu
router.post('/generate-code', asyncHandler(async (req, res) => {
    const { projectId, gameIdea } = req.body;
    const code = await StudioExpert.generateGame(projectId, gameIdea);
    res.json({ ok: true, code });
}));

router.post('/projects', asyncHandler(async (req, res) => {
    const project = await StudioExpert.saveProject(req.body);
    res.json(project);
}));

router.get('/projects/:userId', asyncHandler(async (req, res) => {
    const projects = await StudioExpert.getUserProjects(req.params.userId);
    res.json(projects);
}));

module.exports = router;