const express = require('express');
const router = express.Router();
const QuizCreatorExpertAI = require('./experts/quiz-creator.ai');
const mongoose = require('mongoose');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 🎮 ROUTES GAMES V77 - RESTAURATION DELETE
 */

router.post('/generate', asyncHandler(async (req, res) => {
    const { topic, count } = req.body;
    const quiz = await QuizCreatorExpertAI.generate(topic, count || 5);
    res.json(quiz);
}));

router.get('/all', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('GameLevel').find({}).lean());
}));

router.post('/', asyncHandler(async (req, res) => {
    const Model = mongoose.model('GameLevel');
    const result = req.body._id ? 
        await Model.findByIdAndUpdate(req.body._id, req.body, { new: true }) : 
        await Model.create(req.body);
    res.json(result);
}));

// --- ROUTE RESTAURÉE V77 ---
router.delete('/:id', asyncHandler(async (req, res) => {
    console.log(`🗑️ [API] Suppression Quiz : ${req.params.id}`);
    await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;