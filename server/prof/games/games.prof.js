// @signatures: ProfGamesRouter, all, create, delete, generate, generateContent, getById, streamToBuffer, testData, uploadAsset
const express = require('express');
const router = express.Router();
const { GameLevel, GameProgress } = require('../models/prof.models');
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
    const { topic, count } = req.body;
    const teacherId = String(req.body?.teacherId || '').trim();
    const requestedCount = parseInt(count) || 5;
    try {
        const promptParts = [{ text: `Génère exactement ${requestedCount} questions sur le sujet : "${topic}".` }];
        const raw = await ProfAI.ask(promptParts, "Tu es un expert Quiz JSON. Renvoie un tableau d'objets [{q, options, a}]. 'options' est un tableau de 4 chaînes et 'a' est l'index de la bonne réponse (0-3).", { teacherId });
        const rows = ProfAI.sanitize(raw);
        if (!rows.length) {
            return res.status(500).json({ error: "Aucun quiz JSON exploitable renvoyé par Gemini." });
        }
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: String(e?.message || 'Erreur IA') });
    }
    if (req.file) try { fs.unlinkSync(req.file.path); } catch(e){}
});

// --- 2. ROUTES POUR L'ONGLET ACTIVITÉS (Gestion) ---

router.get('/all', async (req, res) => {
    try {
        const list = await GameLevel.find({}).lean();
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

// Utilisé par l'onglet Élèves (suivi activité)
router.get('/progress', async (req, res) => {
    try {
        const progs = await GameProgress.find({}, 'studentId gameId levelReached lastScore').lean();
        res.json(progs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/save-progress', async (req, res) => {
    try {
        const { studentId, gameId, score, levelReached } = req.body;
        const safeLevelReached = Math.max(0, Number(levelReached || 0));
        const existing = await GameProgress.findOne({ studentId, gameId });
        if (existing) {
            await GameProgress.updateOne(
                { _id: existing._id },
                {
                    lastScore: score,
                    levelReached: Math.max(Number(existing.levelReached || 0), safeLevelReached),
                    updatedAt: new Date()
                }
            );
        } else {
            await GameProgress.create({
                studentId,
                gameId,
                lastScore: score,
                levelReached: safeLevelReached,
                updatedAt: new Date()
            });
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const data = req.body;
        // Nettoyage préventif
        if (data.levels) data.levels.forEach(l => { if(!l._id) delete l._id; });
        if (!data._id || data._id === "null") delete data._id;
        if (typeof data.isEnabled !== 'boolean') data.isEnabled = true;

        const quiz = data._id 
            ? await GameLevel.findByIdAndUpdate(data._id, { $set: data }, { new: true })
            : await GameLevel.create(data);
        res.json(quiz);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const game = await GameLevel.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled } },
            { new: true }
        ).lean();
        if (!game) return res.status(404).json({ error: "Jeu introuvable" });
        res.json(game);
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
