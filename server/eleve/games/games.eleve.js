// @signatures: EleveGames, studioMirror, score
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 🎮 ROUTE MIROIR TOTALE V106
 * Fusionne le visuel du Studio avec les questions du Quiz de Test.
 */
router.get('/studio-mirror', async (req, res) => {
    try {
        const StudioProject = mongoose.model('StudioProject');
        const GameLevel = mongoose.model('GameLevel');

        // 1. On prend le dernier visuel du Studio
        const project = await StudioProject.findOne({}).sort({ updatedAt: -1 }).lean();
        // 2. On prend les questions du Quiz de Test
        const testQuiz = await GameLevel.findOne({ isTestGame: true }).sort({ updatedAt: -1 }).lean();
        
        if (!project) return res.json(null);

        // 3. FUSION : On injecte les questions et les fiches dans le projet visuel
        const fullMirror = {
            ...project,
            levels: testQuiz?.levels || [],
            globalIntro: testQuiz?.globalIntro || { sheetUrl: "", videoUrl: "" }
        };

        res.json(fullMirror);
    } catch (e) {
        res.status(500).json(null);
    }
});

router.post('/score', async (req, res) => {
    const { studentId, gameId, score, levelReached } = req.body;
    await mongoose.model('GameProgress').findOneAndUpdate(
        { studentId, gameId }, 
        { lastScore: score, levelReached: levelReached || 1, updatedAt: new Date() }, 
        { upsert: true }
    );
    res.json({ ok: true });
});

module.exports = router;
