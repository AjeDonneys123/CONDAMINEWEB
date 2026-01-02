const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper pour convertir une URL d'image en format compris par Gemini
async function fileToPart(url) {
    if(!url) return null;
    try {
        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();
        const mimeType = url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        return { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType } };
    } catch(e) { return null; }
}

router.get('/homework/:classroom', async (req, res) => {
    const Homework = mongoose.model('Homework');
    try {
        const cls = req.params.classroom;
        const list = await Homework.find({ $or: [{ classroom: cls }, { classroom: "Toutes" }] }).sort({ date: -1 });
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

router.post('/analyze-homework', async (req, res) => {
    const { userText, homeworkInstruction, playerId, classroom, teacherDocUrls, questionImage } = req.body;
    const Player = mongoose.model('Player');
    const geminiKey = process.env.GEMINI_API_KEY;
    
    console.log("🤖 [IA] Analyse Multimodale lancée (Images + Texte)");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`;
    
    const prompt = `Tu es un professeur de français expert.
    CONTEXTE : Tu corriges un élève de la classe ${classroom}.
    CONSIGNE : ${homeworkInstruction}.
    RÉPONSE ÉLÈVE : ${userText}.

    TES SOURCES (Images jointes) : 
    - Les documents de cours (Ligne 1).
    - L'image spécifique de la question (Ligne 2).
    
    INSTRUCTIONS DE CORRECTION :
    1. Analyse le FOND : Vérifie si la réponse est historiquement et textuellement juste par rapport aux images.
    2. Analyse la FORME : Identifie les fautes d'orthographe, grammaire et syntaxe.
    
    RÈGLE CRITIQUE : 
    - Le tableau "corrections" ne doit contenir QUE des fautes de langue (orthographe/grammaire).
    - Les remarques sur le contenu (ex: "C'est bien Mahomet") doivent aller dans "feedback_fond".

    RÉPONDS UNIQUEMENT EN JSON :
    {
      "feedback_fond": "Ton avis sur le contenu historique/pédagogique en HTML",
      "grade": "xx/20",
      "corrections": [
        {"wrong": "mot faux", "correct": "mot juste", "rule": "Règle expliquée simplement"}
      ]
    }`;

    try {
        let parts = [{ text: prompt }];

        // On ajoute les documents de cours s'ils existent
        if (teacherDocUrls && Array.isArray(teacherDocUrls)) {
            for (let imgUrl of teacherDocUrls) {
                const part = await fileToPart(imgUrl);
                if (part) parts.push(part);
            }
        }

        // On ajoute l'image de la question (Ligne 2)
        if (questionImage) {
            const qPart = await fileToPart(questionImage);
            if (qPart) parts.push(qPart);
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts }], 
                generationConfig: { response_mime_type: "application/json" } 
            })
        });

        const result = await response.json();
        const aiJson = JSON.parse(result.candidates[0].content.parts[0].text);

        if (playerId && playerId !== "prof" && aiJson.corrections?.length > 0) {
            await Player.findByIdAndUpdate(playerId, { $push: { spellingMistakes: { $each: aiJson.corrections } } });
        }
        res.json(aiJson);
    } catch (e) {
        console.error("💥 Erreur IA Multimodale:", e.message);
        res.status(500).json({ error: "IA Error" });
    }
});

router.get('/player-mistakes/:id', async (req, res) => {
    const Player = mongoose.model('Player');
    const p = await Player.findById(req.params.id);
    res.json(p ? p.spellingMistakes : []);
});

module.exports = router;