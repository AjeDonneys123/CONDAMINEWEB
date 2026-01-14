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
    } catch (e) { res.status(500).json({ error: "IA Fail" }); }
});

router.post('/', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) return res.json(await mongoose.model('GameLevel').findByIdAndUpdate(_id, data, { new: true }));
        res.json(await mongoose.model('GameLevel').create(data));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;