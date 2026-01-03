const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Route Devoirs
router.get('/homework/:classroom', async (req, res) => {
    const list = await mongoose.model('Homework').find({ 
        $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] 
    }).sort({ date: -1 });
    res.json(list);
});

// Route Signalement Bug (NOUVEAU)
router.post('/report-bug', async (req, res) => {
    try {
        const Bug = mongoose.model('Bug');
        const newBug = new Bug(req.body);
        await newBug.save();
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// Route Analyse IA (Garder code Gemini 2.0 précédent)
router.post('/analyze-homework', async (req, res) => {
    const { userText, homeworkInstruction, playerId, classroom, homeworkId, levelIndex } = req.body;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const prompt = `Professeur FR. Sujet: ${homeworkInstruction}. Réponse: ${userText}. JSON: {"feedback_fond": "HTML", "grade": "xx/20", "corrections": []}`;
    try {
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } }) });
        const result = await resp.json();
        const aiJson = JSON.parse(result.candidates[0].content.parts[0].text);
        if (playerId && homeworkId) {
            await mongoose.model('Submission').findOneAndUpdate(
                { homeworkId, playerId },
                { classroom, submittedAt: Date.now(), $push: { levelsResults: { levelIndex, userText, aiFeedback: aiJson.feedback_fond, grade: aiJson.grade } } },
                { upsert: true }
            );
        }
        res.json(aiJson);
    } catch (e) { res.status(500).json({ error: "IA Error" }); }
});

router.get('/player-mistakes/:id', async (req, res) => {
    const p = await mongoose.model('Player').findById(req.params.id);
    res.json(p ? p.spellingMistakes : []);
});

module.exports = router;