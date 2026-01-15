const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AIService = require('../../services/ai.service');

router.get('/all', async (req, res) => {
    res.json(await mongoose.model('Homework').find({}));
});

router.post('/analyze-homework', async (req, res) => {
    const { userText, homeworkInstruction, classroom, playerId, homeworkId, levelIndex } = req.body;
    const style = await mongoose.model('TeacherStyle').findOne({ teacherId: "jean_vuillet" });
    const analysis = await AIService.analyzeSubmission(userText, homeworkInstruction, classroom, style?.pedagogicalMemory || "");
    
    if (playerId) {
        await mongoose.model('Player').findByIdAndUpdate(playerId, {
            $push: { spellingMistakes: { $each: analysis.corrections || [] } }
        });
    }
    await mongoose.model('Submission').create({ playerId, homeworkId, levelIndex, originalTranscription: userText, feedback: analysis.feedback_fond, grade: analysis.grade });
    res.json(analysis);
});

router.post('/', async (req, res) => {
    const { _id, ...data } = req.body;
    const r = _id ? await mongoose.model('Homework').findByIdAndUpdate(_id, data, { new: true }) : await mongoose.model('Homework').create(data);
    res.json(r);
});

module.exports = router;