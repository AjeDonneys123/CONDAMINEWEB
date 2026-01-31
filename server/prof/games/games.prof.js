// @signatures: ProfGamesRouter, all, create, generate
const express = require('express');
const router = express.Router();
const { GameLevel } = require('../models/prof.models');
const ProfAI = require('../core/prof.ai');

/**
 * 🕹️ BLOC PROF : LOGIQUE JEUX (/api/games)
 */

router.get('/all', async (req, res) => {
    res.json(await GameLevel.find({}).lean());
});

router.post('/', async (req, res) => {
    const quiz = await GameLevel.create(req.body);
    res.json(quiz);
});

router.post('/generate', async (req, res) => {
    const { topic, count } = req.body;
    const system = "Tu es un professeur expert. Réponds UNIQUEMENT en JSON pur (Array d'objets {q, options, a}).";
    const raw = await ProfAI.ask(`Génère un quiz de ${count} questions sur: ${topic}`, system);
    res.json(ProfAI.sanitize(raw));
});

module.exports = router;
