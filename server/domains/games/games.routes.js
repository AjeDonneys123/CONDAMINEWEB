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

router.get('/progress', asyncHandler(async (req, res) => {
    const progs = await mongoose.model('GameProgress').find({}, 'studentId gameId levelReached lastScore').lean();
    res.json(progs);
}));

// --- CORRECTION SAUVEGARDE SCORE ---
router.post('/save-progress', asyncHandler(async (req, res) => {
    const { studentId, gameId, score, levelReached } = req.body;
    const GameProgress = mongoose.model('GameProgress');

    // 1. On cherche s'il y a déjà une progression
    const existing = await GameProgress.findOne({ studentId, gameId });

    if (existing) {
        // On ne met à jour le niveau que si on fait mieux (pour ne pas perdre le statut "Violet" si on rejoue et perd)
        // Mais on met toujours à jour le score et la date (pour le suivi)
        const newLevel = Math.max(existing.levelReached || 0, levelReached);
        
        await GameProgress.updateOne(
            { _id: existing._id },
            { 
                lastScore: score, 
                levelReached: newLevel,
                updatedAt: new Date() 
            }
        );
    } else {
        // Première fois : on crée l'entrée (Bleu si 0, Violet si 1)
        await GameProgress.create({
            studentId,
            gameId,
            lastScore: score,
            levelReached: levelReached, // Accepte 0 explicitement maintenant
            updatedAt: new Date()
        });
    }
    
    res.json({ ok: true });
}));

router.post('/', asyncHandler(async (req, res) => {
    const Model = mongoose.model('GameLevel');
    const result = req.body._id ? 
        await Model.findByIdAndUpdate(req.body._id, req.body, { new: true }) : 
        await Model.create(req.body);
    res.json(result);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;