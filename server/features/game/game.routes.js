/* 🎮 HUB JEUX - CORRECTION IA (FORCE 4 OPTIONS) */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const multer = require('multer');

// Config Upload (Mémoire)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// 1. GÉNÉRATION IA (IMAGE + TEXTE)
router.post('/generate-game-content', upload.array('images', 3), async (req, res) => {
    const { topic, numQuestions } = req.body;
    const files = req.files || [];

    console.log(`🎮 [GAME AI] Génération sur "${topic}" (${files.length} imgs)`);

    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Clé IA manquante" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    // Prompt Renforcé : "STRICTEMENT 4 OPTIONS"
    const textPrompt = `
    Agis comme un moteur de jeu vidéo éducatif.
    Sujet : "${topic}" ${files.length > 0 ? "+ Analyse des images fournies" : ""}.
    Tâche : Générer un quiz QCM de ${numQuestions || 5} questions.
    
    RÈGLES ABSOLUES :
    1. Réponds UNIQUEMENT un JSON brut.
    2. CHAQUE question doit avoir EXACTEMENT 4 options (ni 3, ni 5).
    3. Format : [{"q":"Question...","options":["A","B","C","D"],"a":0}]
    4. 'a' est l'index de la bonne réponse (0, 1, 2 ou 3).
    `;

    const parts = [{ text: textPrompt }];
    files.forEach(f => parts.push({ inline_data: { mime_type: f.mimetype, data: f.buffer.toString('base64') } }));

    try {
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: parts }] })
        });

        const data = await r.json();
        if (data.error) throw new Error(data.error.message);

        let jsonText = data.candidates[0].content.parts[0].text;
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let questions = JSON.parse(jsonText);

        // --- NETTOYAGE DE SÉCURITÉ ---
        // Si l'IA a mis 5 options, on coupe à 4 et on vérifie que la réponse est valide.
        questions = questions.map(q => {
            // Force 4 options max
            if (q.options.length > 4) q.options = q.options.slice(0, 4);
            // Si pas assez, on comble
            while (q.options.length < 4) q.options.push("-");
            
            // Si la bonne réponse était l'option 5 (index 4), on la ramène à 0 pour éviter le crash
            if (q.a >= 4) q.a = 0;
            
            return q;
        });

        console.log(`✅ [GAME AI] ${questions.length} questions générées (Nettoyées).`);
        res.json(questions);

    } catch (e) { 
        console.error("❌ Erreur Game AI :", e);
        res.status(500).json({ error: "L'IA a échoué. Réessaie." }); 
    }
});

// 2. LECTURE
router.get('/game-levels/all', async (req, res) => {
    try { res.json(await mongoose.model('GameLevel').find({}).sort({ createdAt: -1 })); } catch(e) { res.status(500).json([]); }
});

// 3. SAUVEGARDE
router.post('/game-levels', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) await mongoose.model('GameLevel').findByIdAndUpdate(_id, data);
        else await mongoose.model('GameLevel').create(data);
        res.json({ ok: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// 4. SUPPRESSION
router.delete('/game-levels/:id', async (req, res) => {
    try { await mongoose.model('GameLevel').findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false }); }
});

module.exports = router;