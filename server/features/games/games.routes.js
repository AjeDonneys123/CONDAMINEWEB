const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AIService = require('../../services/ai.service');

/**
 * 🕹️ DOMAINE : GAMES
 */

router.get('/all', async (req, res) => {
    try {
        const data = await mongoose.model('GameLevel').find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/generate', async (req, res) => {
    try {
        const { topic, numQuestions } = req.body;
        const quiz = await AIService.generateQuiz(topic, numQuestions);
        res.json(quiz);
    } catch (e) { res.status(500).json({ error: "IA Fail", details: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const Game = mongoose.model('GameLevel');
        const { _id, ...data } = req.body;
        if (_id) return res.json(await Game.findByIdAndUpdate(_id, data, { new: true }));
        res.json(await Game.create(data));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;