const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');

// Route Devoirs
router.get('/homework/:classroom', async (req, res) => {
    const list = await mongoose.model('Homework').find({ 
        $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] 
    }).sort({ date: -1 });
    res.json(list);
});

router.post('/report-bug', async (req, res) => {
    try { await mongoose.model('Bug').create(req.body); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false }); }
});

// --- ANALYSE IA (GEMINI 2.0 FLASH) + SAUVEGARDE FAUTES ---
router.post('/analyze-homework', async (req, res) => {
    const { userText, homeworkInstruction, playerId, classroom, homeworkId, levelIndex } = req.body;
    
    // Prompt optimisé pour la convention Rouge => Vert
    const prompt = `
    Tu es un professeur de français. 
    Consigne : "${homeworkInstruction}"
    Réponse élève : "${userText}"
    
    Tâche : 
    1. Note sur 20.
    2. Commentaire pédagogique bienveillant (HTML).
    3. Repère les fautes d'orthographe/grammaire.
    
    Réponds UNIQUEMENT ce JSON :
    {
        "grade": "Note/20",
        "feedback_fond": "Commentaire HTML...",
        "corrections": [
            { "wrong": "mot_faux", "correct": "mot_juste", "rule": "Nom de la règle" }
        ]
    }`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;

    try {
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } }) });
        const result = await resp.json();
        
        if(result.error) throw new Error(result.error.message);

        const aiJson = JSON.parse(result.candidates[0].content.parts[0].text);
        
        // 1. Sauvegarde Résultat Copie
        if (playerId && homeworkId) {
            await mongoose.model('Submission').findOneAndUpdate(
                { homeworkId, playerId },
                { classroom, submittedAt: Date.now(), $push: { levelsResults: { levelIndex, userText, aiFeedback: aiJson.feedback_fond, grade: aiJson.grade } } },
                { upsert: true }
            );
        }

        // 2. SAUVEGARDE DES FAUTES DANS LE CARNET ÉLÈVE (Player)
        if (aiJson.corrections && aiJson.corrections.length > 0 && playerId) {
            await mongoose.model('Player').findByIdAndUpdate(playerId, {
                $push: { spellingMistakes: { $each: aiJson.corrections } }
            });
            console.log(`✅ ${aiJson.corrections.length} fautes sauvegardées pour l'élève.`);
        }

        res.json(aiJson);

    } catch (e) { 
        console.error("❌ CRASH IA :", e);
        res.status(500).json({ error: "Erreur IA" }); 
    }
});

router.get('/player-mistakes/:id', async (req, res) => {
    const p = await mongoose.model('Player').findById(req.params.id);
    res.json(p ? p.spellingMistakes : []);
});

module.exports = router;