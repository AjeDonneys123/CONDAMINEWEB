// @signatures: ProfGamesRouter, all, create, delete, generate, generateContent, streamToBuffer, uploadAsset, testData
const express = require('express');
const router = express.Router();
const { GameLevel } = require('../models/prof.models');
const ProfAI = require('../core/prof.ai');
const ProfDrive = require('../core/drive.prof'); 
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });

// --- ZONE 1 : ROUTES DU STUDIO (Prioritaires) ---
// Ces routes sont utilisées par l'éditeur de jeu (Mario/Zombie)

// Charge le jeu de test pour le moteur
router.get('/test-data', async (req, res) => {
    try {
        const game = await GameLevel.findOne({ isTestGame: true }).sort({ updatedAt: -1 }).lean()
                  || await GameLevel.findOne({}).sort({ updatedAt: -1 }).lean();
        res.json(game || null);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/generate-content', upload.single('file'), async (req, res) => {
    // ... (Code IA inchangé, condensé pour la lisibilité)
    try {
        const promptParts = [{ text: `Sujet : "${req.body.topic}".` }];
        const raw = await ProfAI.ask(promptParts, "Tu es un expert Quiz JSON.");
        res.json(ProfAI.sanitize(raw));
    } catch (e) { res.status(500).json({ error: "Erreur IA" }); } 
    if (req.file) try { fs.unlinkSync(req.file.path); } catch(e){}
});

router.post('/upload-asset', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    try {
        const folderId = await ProfDrive.getOrCreateFolder("CONDA_GAMES_ASSETS");
        const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
        res.json({ url: `/api/structure/proxy/${driveFile.id}`, name: req.file.originalname });
        try { fs.unlinkSync(req.file.path); } catch(e){}
    } catch (e) { res.status(500).json({ error: "Erreur Drive" }); }
});

// --- ZONE 2 : ROUTES DES ACTIVITÉS (Gestion) ---
// Ces routes sont utilisées par la liste des activités (Suppression, Liste)

router.get('/all', async (req, res) => {
    try { res.json(await GameLevel.find({}).lean()); } 
    catch (e) { res.status(500).json([]); }
});

router.post('/', async (req, res) => {
    try {
        const data = req.body;
        // Nettoyage IDs vides
        if (data.levels) data.levels.forEach(l => { if(!l._id) delete l._id; });
        if (!data._id) delete data._id;
        
        const quiz = data._id 
            ? await GameLevel.findByIdAndUpdate(data._id, { $set: data }, { new: true })
            : await GameLevel.create(data);
        res.json(quiz);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🔥 LA ROUTE DE SUPPRESSION (DOIT ÊTRE APRÈS /test-data)
router.delete('/:id', async (req, res) => {
    try {
        await GameLevel.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const game = await GameLevel.findById(req.params.id).lean();
        if (!game) return res.status(404).json({ error: "Jeu introuvable" });
        res.json(game);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
