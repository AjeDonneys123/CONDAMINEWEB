const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AIService = require('../../services/ai.service');

/**
 * 🕹️ DOMAINE : GAMES
 */

// GET /api/games/all
router.get('/all', async (req, res) => {
    try {
        const GameLevel = mongoose.model('GameLevel');
        const data = await GameLevel.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: "Erreur BDD" });
    }
});

// POST /api/games/generate
router.post('/generate', async (req, res) => {
    try {
        const { topic, numQuestions } = req.body;
        if (!topic) return res.status(400).json({ error: "Sujet requis" });
        
        const quiz = await AIService.generateQuiz(topic, numQuestions || 5);
        res.json(quiz);
    } catch (e) {
        console.error("❌ [GAMES] Erreur route generate:", e.message);
        res.status(500).json({ error: "L'IA 2.0 n'a pas pu répondre.", details: e.message });
    }
});

// POST /api/games (Save/Update)
router.post('/', async (req, res) => {
    try {
        const Game = mongoose.model('GameLevel');
        const { _id, ...data } = req.body;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const updated = await Game.findByIdAndUpdate(_id, data, { new: true });
            return res.json(updated);
        }
        const created = await Game.create(data);
        res.json(created);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/games/:id
router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;