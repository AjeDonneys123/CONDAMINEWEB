const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');

// 1. IA GENERATION DE QUIZ (C'était le 404 generate-game-content)
router.post('/generate-game-content', async (req, res) => {
    const { topic, numQuestions } = req.body;
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Clé IA manquante" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const prompt = `Génère un quiz QCM de ${numQuestions || 5} questions sur : "${topic}".
    JSON STRICT: [{"q":"Question","options":["A","B","C","D"],"a":0}] (a=index bonne réponse). PAS DE MARKDOWN.`;

    try {
        const r = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } })
        });
        const data = await r.json();
        if (data.error) throw new Error(data.error.message);
        
        let jsonText = data.candidates[0].content.parts[0].text;
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(jsonText));
    } catch (e) { 
        console.error("Game AI Error:", e);
        res.status(500).json({ error: "Erreur IA Jeu" }); 
    }
});

// 2. CRUD NIVEAUX DE JEU (C'était le 404 game-levels/all)
router.get('/game-levels/all', async (req, res) => {
    try { res.json(await mongoose.model('GameLevel').find({}).sort({ createdAt: -1 })); } catch(e) { res.json([]); }
});

router.post('/game-levels', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) await mongoose.model('GameLevel').findByIdAndUpdate(_id, data);
        else await mongoose.model('GameLevel').create(data);
        res.json({ ok: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

router.delete('/game-levels/:id', async (req, res) => {
    await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

module.exports = router;