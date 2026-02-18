// @signatures: ProfGamesRouter, all, create, delete, generate, generateContent, getById, streamToBuffer, testData, uploadAsset
const express = require('express');
const router = express.Router();
const { GameLevel } = require('../models/prof.models');
const ProfAI = require('../core/prof.ai');
const ProfDrive = require('../core/drive.prof'); 
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });

/**
 * 🛡️ ROUTEUR HYBRIDE : STUDIO & ACTIVITÉS
 * Ce fichier est le point critique de partage.
 * ORDRE IMPÉRATIF : Routes spécifiques (/test-data, /upload) AVANT les routes dynamiques (/:id).
 */

// --- 1. ROUTES POUR LE STUDIO (Moteur de Jeu) ---

// 🔥 CRITIQUE : Cette route alimente le bouton "TESTER" du Studio
router.get('/test-data', async (req, res) => {
    try {
        const game = await GameLevel.findOne({ isTestGame: true }).sort({ updatedAt: -1 }).lean()
                  || await GameLevel.findOne({}).sort({ updatedAt: -1 }).lean();
        res.json(game || null);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/upload-asset', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    try {
        const folderId = await ProfDrive.getOrCreateFolder("CONDA_GAMES_ASSETS");
        const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
        const url = `/api/structure/proxy/${driveFile.id}`;
        try { fs.unlinkSync(req.file.path); } catch(e){}
        res.json({ url, name: req.file.originalname });
    } catch (e) { res.status(500).json({ error: "Erreur Drive" }); }
});

router.post('/generate-content', upload.single('file'), async (req, res) => {
    const { topic } = req.body;
    try {
        const promptParts = [{ text: `Sujet : "${topic}".` }];
        const raw = await ProfAI.ask(promptParts, "Tu es un expert Quiz JSON.");
        res.json(ProfAI.sanitize(raw));
    } catch (e) { res.status(500).json({ error: "Erreur IA" }); }
    if (req.file) try { fs.unlinkSync(req.file.path); } catch(e){}
});

// --- 2. ROUTES POUR L'ONGLET ACTIVITÉS (Gestion) ---

router.get('/all', async (req, res) => {
    try {
        const list = await GameLevel.find({}).lean();
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

router.post('/', async (req, res) => {
    try {
        const data = req.body;
        // Nettoyage préventif
        if (data.levels) data.levels.forEach(l => { if(!l._id) delete l._id; });
        if (!data._id || data._id === "null") delete data._id;

        const quiz = data._id 
            ? await GameLevel.findByIdAndUpdate(data._id, { $set: data }, { new: true })
            : await GameLevel.create(data);
        res.json(quiz);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🔥 CRITIQUE : Route de suppression pour l'onglet Activité
router.delete('/:id', async (req, res) => {
    try {
        await GameLevel.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Récupération par ID (DOIT ÊTRE EN DERNIER)
router.get('/:id', async (req, res) => {
    try {
        const game = await GameLevel.findById(req.params.id).lean();
        if (!game) return res.status(404).json({ error: "Jeu introuvable" });
        res.json(game);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
