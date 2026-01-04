/* 🔒 FICHIER CŒUR ÉLÈVE - NE PAS MODIFIER LA LOGIQUE SANS TESTER */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');

// Route Devoirs (Lecture Seule)
router.get('/homework/:classroom', async (req, res) => {
    try {
        const list = await mongoose.model('Homework').find({ 
            $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] 
        }).sort({ date: -1 });
        res.json(list);
    } catch(e) { res.status(500).json([]); }
});

router.post('/report-bug', async (req, res) => {
    try { await mongoose.model('Bug').create(req.body); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false }); }
});

// --- ANALYSE IA (GEMINI 2.0) AVEC NETTOYAGE RENFORCÉ ---
router.post('/analyze-homework', async (req, res) => {
    const { userText, homeworkInstruction, playerId, classroom, homeworkId, levelIndex } = req.body;
    
    // 1. Prompt Strict
    const prompt = `
    Tu es un professeur de français bienveillant.
    Consigne : "${homeworkInstruction}"
    Réponse élève : "${userText}"
    
    Tâche : Note (/20), Commente (HTML), Corrige.
    
    RÉPOND UNIQUEMENT CE JSON BRUT (Sans markdown, sans \`\`\`) :
    {
        "grade": "Note/20",
        "feedback_fond": "Commentaire HTML (<b>Gras</b>, <br> sauts de ligne)",
        "corrections": [
            { "wrong": "mot_faux", "correct": "mot_juste", "rule": "Règle" }
        ]
    }`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;

    try {
        const resp = await fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } }) 
        });
        
        const result = await resp.json();
        if(result.error) throw new Error(result.error.message);

        // 2. NETTOYAGE CHIRURGICAL (C'est ça qui manquait !)
        let rawText = result.candidates[0].content.parts[0].text;
        // On enlève les balises Markdown qui cassent tout
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        let aiJson;
        try {
            aiJson = JSON.parse(rawText);
        } catch (parseError) {
            console.error("❌ JSON IA Invalide :", rawText);
            // Fallback pour ne pas afficher du vide
            aiJson = { grade: "?/20", feedback_fond: "L'IA a eu un problème de formatage. Réessayez.", corrections: [] };
        }
        
        // 3. Sauvegardes BDD
        if (playerId && homeworkId) {
            await mongoose.model('Submission').findOneAndUpdate(
                { homeworkId, playerId },
                { classroom, submittedAt: Date.now(), $push: { levelsResults: { levelIndex, userText, aiFeedback: aiJson.feedback_fond, grade: aiJson.grade } } },
                { upsert: true }
            );
        }

        if (aiJson.corrections && aiJson.corrections.length > 0 && playerId) {
            await mongoose.model('Player').findByIdAndUpdate(playerId, {
                $push: { spellingMistakes: { $each: aiJson.corrections } }
            });
        }

        res.json(aiJson);

    } catch (e) { 
        console.error("❌ CRASH IA Route :", e);
        res.status(500).json({ error: "Erreur IA" }); 
    }
});

router.get('/player-mistakes/:id', async (req, res) => {
    const p = await mongoose.model('Player').findById(req.params.id);
    res.json(p ? p.spellingMistakes : []);
});

module.exports = router;