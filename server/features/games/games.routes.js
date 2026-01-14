const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AIService = require('../../services/ai.service');

/**
 * 🕹️ DOMAINE : GAMES
 */

router.get('/all', async (req, res) => {
    try {
        const GameLevel = mongoose.model('GameLevel');
        const data = await GameLevel.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: "Erreur récupération jeux" });
    }
});

router.post('/generate', async (req, res) => {
    const { topic, numQuestions } = req.body;
    console.log(`🤖 [IA] Tentative de génération pour : "${topic}"`);
    
    try {
        const quiz = await AIService.generateQuiz(topic, numQuestions);
        console.log("✅ [IA] Quiz généré avec succès.");
        res.json(quiz);
    } catch (e) {
        console.error("❌ [IA] Échec de la route /generate :", e.message);
        res.status(500).json({ 
            error: "L'IA a échoué.", 
            details: e.message 
        });
    }
});

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

router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;