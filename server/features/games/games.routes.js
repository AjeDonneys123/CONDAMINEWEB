const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AIService = require('../../services/ai.service');

/**
 * 🕹️ DOMAINE : JEUX (Quiz & Niveaux)
 */

// US #10 : Endpoint de génération IA (Fix 404)
router.post('/generate', async (req, res) => {
    try {
        const { topic, numQuestions } = req.body;
        if (!topic) return res.status(400).json({ error: "Sujet manquant" });
        
        const quiz = await AIService.generateQuiz(topic, numQuestions || 5);
        res.json(quiz);
    } catch (e) {
        res.status(500).json({ error: "L'IA n'a pas pu générer le quiz", detail: e.message });
    }
});

// US #1 : Liste de tous les jeux
router.get('/all', async (req, res) => {
    try {
        const Game = mongoose.model('GameLevel');
        const data = await Game.find({}).sort({ _id: -1 });
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

// Sauvegarde ou modification (Upsert)
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #9 : Suppression par ID
router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;