const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');

// --- IA JEUX (RESTAURÉE AVEC GEMINI 2.0) ---
router.post('/generate-game-content', async (req, res) => {
    const { topic, numQuestions } = req.body;
    console.log(`🎮 [GAME AI] Génération de ${numQuestions} questions sur : ${topic}`);

    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Clé IA manquante" });

    // Modèle Gemini 2.0 Flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const prompt = `
    Tu es un générateur de quiz pour un jeu vidéo éducatif.
    Sujet : "${topic}"
    Nombre de questions : ${numQuestions}
    
    Format attendu (JSON strict uniquement) :
    [
        {
            "q": "Texte de la question ?",
            "options": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
            "a": 0  (Index de la bonne réponse : 0, 1, 2 ou 3)
        }
    ]
    `;

    try {
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }], 
                generationConfig: { response_mime_type: "application/json" } 
            })
        });

        const data = await r.json();
        
        if (data.error) {
            console.error("❌ Erreur Game AI :", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        const jsonText = data.candidates[0].content.parts[0].text;
        const questions = JSON.parse(jsonText);
        
        console.log(`✅ [GAME AI] ${questions.length} questions générées.`);
        res.json(questions);

    } catch (e) { 
        console.error("❌ Crash Game AI :", e);
        res.status(500).json({ error: "Erreur technique IA" }); 
    }
});

// --- CRUD NIVEAUX ---
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