// @signatures: ProfStudio, projects, save, uploadAsset, detectBg, removeBgSpecialized, saveEdition, importZombieSounds
const express = require('express');
const router = express.Router();
const { StudioProject } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const StudioExpert = require('../../domains/studio/experts/studio.expert'); 
const EditionExpert = require('../../domains/studio/experts/edition.expert');
const SoundLibraryExpert = require('../../domains/studio/experts/sound-library.expert'); // ✅ IMPORT AJOUTÉ
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
const upload = multer({ dest: tempDir });
const localGamesDir = path.join(process.cwd(), 'studio-games');
if (!fs.existsSync(localGamesDir)) fs.mkdirSync(localGamesDir, { recursive: true });

const sanitizeProjectKey = (raw) => String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);

// --- CHARGEMENT PROJETS (SÉCURISÉ) ---
router.get('/projects/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return res.json([]);
        const projects = await StudioProject.find({ teacherId: userId }).sort({ isTrashed: 1, updatedAt: -1 }).lean();
        res.json(projects);
    } catch (e) { res.json([]); }
});

router.post('/', async (req, res) => {
    try {
        const data = req.body;
        if (data._id === "null" || data._id === "") delete data._id;
        let result;
        if (data._id) result = await StudioProject.findByIdAndUpdate(data._id, data, { new: true });
        else result = await StudioProject.create(data);
        res.json(result);
    } catch (e) { res.status(500).json({ error: "Save fail" }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await StudioProject.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Delete fail" });
    }
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

// SAUVEGARDE GOMME MANUELLE
router.post('/save-edition', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Blob manquant" });
        const result = await EditionExpert.saveErasedImage(req.file.path, req.file.originalname);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTE DÉTOURAGE IA (Celle qui plantait)
router.post('/remove-bg-specialized', async (req, res) => {
    try {
        const { url } = req.body;
        // On appelle l'expert pour traiter l'image
        const result = await StudioExpert.specializedBgRemoval(url);
        
        if (result) res.json(result);
        else res.status(500).json({ error: "Échec détourage (API Error ou Clé manquante)" });
    } catch (e) { 
        console.error("Crash Route RemoveBG:", e);
        res.status(500).json({ error: e.message }); 
    }
});

// ✅ ROUTE IMPORTATION SONS ZOMBIE (Celle qui manquait et causait le 404)
router.post('/import-zombie-sounds', async (req, res) => {
    try {
        const sounds = await SoundLibraryExpert.getZombieDefaults();
        res.json({ sounds });
    } catch (e) {
        console.error("Import Zombie Sounds Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// BRIDGE LOCAL STUDIO: lecture script console depuis fichier local
router.get('/local-code/:projectKey', async (req, res) => {
    try {
        const projectKey = sanitizeProjectKey(req.params.projectKey);
        if (!projectKey) return res.status(400).json({ error: "projectKey manquant" });
        const filePath = path.join(localGamesDir, `${projectKey}.js`);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Script local introuvable" });
        const code = fs.readFileSync(filePath, 'utf8');
        res.json({ ok: true, projectKey, code });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// BRIDGE LOCAL STUDIO: écriture script console vers fichier local
router.post('/local-code/:projectKey', async (req, res) => {
    try {
        const projectKey = sanitizeProjectKey(req.params.projectKey);
        const code = String(req.body?.code || '');
        if (!projectKey) return res.status(400).json({ error: "projectKey manquant" });
        if (!code.trim()) return res.status(400).json({ error: "code manquant" });
        const filePath = path.join(localGamesDir, `${projectKey}.js`);
        fs.writeFileSync(filePath, code, 'utf8');
        res.json({ ok: true, projectKey, filePath });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
