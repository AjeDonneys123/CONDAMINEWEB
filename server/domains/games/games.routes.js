const express = require('express');
const router = express.Router();
const QuizCreatorExpertAI = require('./experts/quiz-creator.ai');
const mongoose = require('mongoose');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/generate', asyncHandler(async (req, res) => {
    const { topic, count } = req.body;
    const quiz = await QuizCreatorExpertAI.generate(topic, count || 5);
    res.json(quiz);
}));

router.get('/all', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('GameLevel').find({}).lean());
}));

// --- NOUVEAU V205 : RÉCUPÉRER TOUS LES PROGRÈS ---
router.get('/progress', asyncHandler(async (req, res) => {
    const progs = await mongoose.model('GameProgress').find({}, 'studentId gameId levelReached lastScore').lean();
    res.json(progs);
}));

router.post('/', asyncHandler(async (req, res) => {
    const Model = mongoose.model('GameLevel');
    const result = req.body._id ? 
        await Model.findByIdAndUpdate(req.body._id, req.body, { new: true }) : 
        await Model.create(req.body);
    res.json(result);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    console.log(`🗑️ [API] Suppression Quiz : ${req.params.id}`);
    await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;