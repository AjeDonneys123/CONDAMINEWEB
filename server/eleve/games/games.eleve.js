// @signatures: EleveGames, list, score
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/list/:studentId', async (req, res) => {
    const student = await mongoose.model('Student').findById(req.params.studentId).lean();
    if (!student) return res.json([]);
    res.json(await mongoose.model('GameLevel').find({ targetClassrooms: student.currentClass }).lean());
});

router.post('/score', async (req, res) => {
    const { studentId, gameId, score } = req.body;
    await mongoose.model('GameProgress').findOneAndUpdate({ studentId, gameId }, { lastScore: score }, { upsert: true });
    res.json({ ok: true });
});

module.exports = router;
