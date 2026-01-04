/* 🎮 HUB CENTRAL DES JEUX (IA + GESTION BDD) */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');

// 1. GÉNÉRATION IA (Robustesse Max)
router.post('/generate-game-content', async (req, res) => {
    const { topic, numQuestions } = req.body;
    console.log(`🎮 [GAME AI] Génération sur : ${topic}`);

    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Clé IA manquante" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    // Prompt optimisé pour éviter le bla-bla
    const prompt = `
    Agis comme un moteur de jeu vidéo.
    Génère un tableau JSON de ${numQuestions || 5} questions QCM sur le thème : "${topic}".
    
    Règles IMPÉRATIVES :
    1. PAS de texte avant ou après. PAS de balises markdown (\`\`\`).
    2. Format JSON strict : [{"q":"Question...","options":["A","B","C","D"],"a":0}]
    3. 'a' est l'index de la bonne réponse (0, 1, 2 ou 3).
    `;

    try {
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } })
        });

        const data = await r.json();
        
        if (data.error) {
            console.error("❌ Erreur Google :", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        let jsonText = data.candidates[0].content.parts[0].text;
        // Nettoyage agressif
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const questions = JSON.parse(jsonText);
        console.log(`✅ [GAME AI] ${questions.length} questions générées.`);
        res.json(questions);

    } catch (e) { 
        console.error("❌ Crash Parsing Game AI :", e);
        res.status(500).json({ error: "L'IA a généré un format invalide." }); 
    }
});

// 2. LECTURE DES NIVEAUX
router.get('/game-levels/all', async (req, res) => {
    try {
        const levels = await mongoose.model('GameLevel').find({}).sort({ createdAt: -1 });
        res.json(levels);
    } catch(e) { 
        console.error("❌ Erreur lecture niveaux:", e);
        res.status(500).json([]); 
    }
});

// 3. SAUVEGARDE / MISE À JOUR
router.post('/game-levels', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        console.log("💾 [GAME SAVE]", data.title, data.classroom);

        if (_id) {
            await mongoose.model('GameLevel').findByIdAndUpdate(_id, data);
        } else {
            await mongoose.model('GameLevel').create(data);
        }
        res.json({ ok: true });
    } catch(e) { 
        console.error("❌ Erreur sauvegarde niveau:", e);
        res.status(500).json({error: e.message}); 
    }
});

// 4. SUPPRESSION
router.delete('/game-levels/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

module.exports = router;