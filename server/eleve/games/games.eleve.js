// @signatures: EleveGames, list, score, studioMirror
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 🎮 ROUTE MIROIR : Julian récupère le dernier projet du Studio
 */
router.get('/studio-mirror', async (req, res) => {
    try {
        const StudioProject = mongoose.model('StudioProject');
        // On cherche le projet le plus récent dans toute la base
        const project = await StudioProject.findOne({}).sort({ updatedAt: -1 }).lean();
        
        if (!project) return res.json(null);
        res.json(project);
    } catch (e) {
        res.status(500).json(null);
    }
});

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const GameLevel = mongoose.model('GameLevel');
        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);
        const myClass = (student.currentClass || "").trim().toUpperCase();
        const query = { $or: [ { assignedStudents: student._id }, { targetClassrooms: myClass }, { isTestGame: true } ] };
        const games = await GameLevel.find(query).sort({ updatedAt: -1 }).lean();
        res.json(games);
    } catch (e) { res.status(500).json([]); }
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
