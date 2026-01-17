const express = require('express');
const router = express.Router();
const GamesExpertDB = require('./experts/games.db');
const QuizCreatorExpertAI = require('./experts/quiz-creator.ai');
const mongoose = require('mongoose');

router.post('/generate', async (req, res) => {
    try {
        const quiz = await QuizCreatorExpertAI.generate(req.body.topic, req.body.count);
        res.json(quiz);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', async (req, res) => res.json(await GamesExpertDB.getAll()));
router.post('/', async (req, res) => res.json(await GamesExpertDB.saveQuiz(req.body)));

router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;