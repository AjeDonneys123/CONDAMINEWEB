const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

async function fileToPart(url) {
    if(!url) return null;
    try {
        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();
        return { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType: 'image/jpeg' } };
    } catch(e) { return null; }
}

router.get('/homework/:classroom', async (req, res) => {
    const list = await mongoose.model('Homework').find({ $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] }).sort({ date: -1 });
    res.json(list);
});

router.post('/analyze-homework', async (req, res) => {
    const { userText, homeworkInstruction, playerId, classroom, homeworkId, levelIndex, teacherDocUrls, questionImage } = req.body;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const prompt = `Professeur expert. Sujet: ${homeworkInstruction}. Réponse: ${userText}. JSON: {"feedback_fond": "HTML", "grade": "xx/20"}`;

    try {
        let parts = [{ text: prompt }];
        if (questionImage) { const p = await fileToPart(questionImage); if(p) parts.push(p); }
        if (teacherDocUrls) for (let u of teacherDocUrls) { const p = await fileToPart(u); if(p) parts.push(p); }

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { response_mime_type: "application/json" } }) });
        const result = await response.json();
        const aiJson = JSON.parse(result.candidates[0].content.parts[0].text);

        if (playerId && homeworkId) {
            await mongoose.model('Submission').findOneAndUpdate(
                { homeworkId, playerId },
                { classroom, submittedAt: Date.now(), $push: { levelsResults: { levelIndex, userText, aiFeedback: aiJson.feedback_fond, grade: aiJson.grade } } },
                { upsert: true }
            );
        }
        res.json(aiJson);
    } catch (e) { res.status(500).json({ error: "IA error" }); }
});

router.get('/player-mistakes/:id', async (req, res) => {
    const p = await mongoose.model('Player').findById(req.params.id);
    res.json(p ? p.spellingMistakes : []);
});

router.post('/delete-mistake', async (req, res) => {
    await mongoose.model('Player').findByIdAndUpdate(req.body.playerId, { $pull: { spellingMistakes: { _id: req.body.mistakeId } } });
    res.json({ ok: true });
});

module.exports = router;