const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const StudioExpert = require('./experts/studio.expert');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- CONFIGURATION UPLOAD (MULTER) ---
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Nom de fichier propre et unique
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.png';
        cb(null, 'studio_' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });

// --- ROUTE 1 : UPLOAD D'IMAGE (CRITIQUE POUR LE DÉCOUPAGE) ---
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        console.error("❌ [STUDIO] Upload échoué: Pas de fichier");
        return res.status(400).json({ error: "Fichier manquant" });
    }
    
    // On renvoie l'URL publique accessible par le navigateur
    const publicUrl = `/uploads/${req.file.filename}`;
    console.log(`✅ [STUDIO] Image sauvegardée : ${publicUrl}`);
    res.json({ url: publicUrl });
});

// --- ROUTE 2 : GÉNÉRATION IA ---
router.post('/generate-asset', asyncHandler(async (req, res) => {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt manquant" });

    const result = await StudioExpert.generateAsset(prompt, type);
    res.json({ ok: true, ...result });
}));

// --- ROUTE 3 : SAUVEGARDE PROJET ---
router.post('/projects', asyncHandler(async (req, res) => {
    const project = await StudioExpert.saveProject(req.body);
    res.json(project);
}));

// --- ROUTE 4 : LECTURE PROJETS ---
router.get('/projects/:userId', asyncHandler(async (req, res) => {
    const projects = await StudioExpert.getUserProjects(req.params.userId);
    res.json(projects);
}));

module.exports = router;