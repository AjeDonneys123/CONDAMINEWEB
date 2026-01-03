const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');

// 1. IA GENERATION DE QUIZ
router.post('/generate-game-content', async (req, res) => {
    console.log("🤖 [GAME] Demande de génération IA reçue...");
    const { topic, numQuestions } = req.body;

    // Vérification de la clé API
    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ [GAME] Erreur : Aucune clé GEMINI_API_KEY trouvée dans .env");
        return res.status(500).json({ error: "Clé IA manquante sur le serveur." });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const prompt = `Quiz QCM ${numQuestions} questions sur: ${topic}. Format JSON strict: [{"q":"Question?","options":["A","B","C","D"],"a":0}] (a = index bonne réponse). Pas de markdown.`;

    try {
        console.log(`📡 [GAME] Envoi à Gemini : ${topic}`);
        const r = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } })
        });

        const data = await r.json();
        
        if (data.error) {
            console.error("❌ [GAME] Erreur Google:", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        let jsonText = data.candidates[0].content.parts[0].text;
        
        // Nettoyage de sécurité (si l'IA met des balises markdown)
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const json = JSON.parse(jsonText);
        
        console.log("✅ [GAME] Quiz généré !");
        res.json(json);

    } catch (e) { 
        console.error("💥 [GAME] Crash IA :", e);
        res.status(500).json({ error: "Erreur interne IA" }); 
    }
});

// 2. CRUD NIVEAUX DE JEU
router.get('/game-levels/all', async (req, res) => {
    try {
        const levels = await mongoose.model('GameLevel').find({}).sort({ createdAt: -1 });
        res.json(levels);
    } catch(e) { console.error(e); res.status(500).json([]); }
});

router.post('/game-levels', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) await mongoose.model('GameLevel').findByIdAndUpdate(_id, data);
        else await mongoose.model('GameLevel').create(data);
        res.json({ ok: true });
    } catch(e) { console.error(e); res.status(500).json({error: e.message}); }
});

router.delete('/game-levels/:id', async (req, res) => {
    await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

module.exports = router;