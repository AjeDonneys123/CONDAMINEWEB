




const express = require('express');
const router = express.Router();
const HomeworkDB = require('./db/homework.db');
const HomeworkAI = require('./ai/homework.ai');
const mongoose = require('mongoose');

router.get('/all', async (req, res) => {
    try { res.json(await HomeworkDB.getAll()); } catch (e) { res.status(500).json([]); }
});

router.post('/analyze-homework', async (req, res) => {
    try {
        const { userText, homeworkId, levelIndex, playerId } = req.body;
        const homework = await mongoose.model('Homework').findById(homeworkId);
        const lvl = homework.levels[levelIndex];
        
        const analysis = await HomeworkAI.analyze(userText, lvl.instruction, lvl.aiHints);
        
        await mongoose.model('Submission').create({ 
            playerId, homeworkId, levelIndex, 
            feedback: analysis.feedback_fond, 
            grade: analysis.grade 
        });
        res.json(analysis);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try { res.json(await HomeworkDB.save(req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('Homework').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;




