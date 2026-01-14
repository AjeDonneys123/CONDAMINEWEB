const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AIService = require('../../services/ai.service');

/**
 * 🕹️ DOMAINE : GAMES
 * Centralisation Prof + Élève
 */

// Lister tous les quiz
router.get('/all', async (req, res) => {
    try {
        const GameLevel = mongoose.model('GameLevel');
        const data = await GameLevel.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: "Erreur BDD" });
    }
});

// Sauvegarder ou modifier un quiz (Prof)
router.post('/', async (req, res) => {
    try {
        const GameLevel = mongoose.model('GameLevel');
        const { _id, ...data } = req.body;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const updated = await GameLevel.findByIdAndUpdate(_id, data, { new: true });
            return res.json(updated);
        }
        const created = await GameLevel.create(data);
        res.json(created);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GÉNÉRATION IA (POST /api/games/generate)
router.post('/generate', async (req, res) => {
    try {
        const { topic, numQuestions } = req.body;
        if (!topic) return res.status(400).json({ error: "Sujet requis" });
        
        console.log(`[GAMES] Génération IA pour : ${topic}`);
        const quizContent = await AIService.generateQuiz(topic, numQuestions || 5);
        res.json(quizContent);
    } catch (e) {
        console.error("Erreur IA route:", e.message);
        res.status(500).json({ error: "L'IA n'a pas pu répondre" });
    }
});

// Supprimer un quiz
router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;