const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AIService = require('../../services/ai.service');

router.get('/all', async (req, res) => {
    try {
        const Game = mongoose.model('GameLevel');
        res.json(await Game.find({}));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/generate', async (req, res) => {
    try {
        const quiz = await AIService.generateQuiz(req.body.topic);
        res.json(quiz);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const Game = mongoose.model('GameLevel');
        const { _id, ...data } = req.body;
        const result = _id ? await Game.findByIdAndUpdate(_id, data, { new: true }) : await Game.create(data);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;