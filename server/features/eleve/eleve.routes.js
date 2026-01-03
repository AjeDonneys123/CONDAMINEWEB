const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Convertit une image en format Gemini
async function fileToPart(url) {
    if(!url) return null;
    try {
        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();
        return { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType: 'image/jpeg' } };
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

// --- ANALYSE IA + SAUVEGARDE COPIE (SUBMISSION) ---
router.post('/analyze-homework', async (req, res) => {
    const { userText, homeworkInstruction, playerId, classroom, homeworkId, levelIndex, questionImage } = req.body;
    const Player = mongoose.model('Player');
    const Submission = mongoose.model('Submission');
    const geminiKey = process.env.GEMINI_API_KEY;
    
    console.log(`🤖 [IA] Sauvegarde de la copie pour l'élève: ${playerId}`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`;
    const prompt = `Tu es un professeur de français expert. Sujet: ${homeworkInstruction}. Réponse élève: ${userText}.
    RÈGLE : Le tableau "corrections" ne contient que l'orthographe. Les conseils de fond vont dans "feedback_fond".
    RÉPONDS UNIQUEMENT EN JSON :
    {
      "feedback_fond": "Commentaire HTML",
      "grade": "xx/20",
      "corrections": [{"wrong": "...", "correct": "...", "rule": "..."}]
    }`;

    try {
        let parts = [{ text: prompt }];
        if (questionImage) { const p = await fileToPart(questionImage); if(p) parts.push(p); }

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

        // --- LOGIQUE DE SAUVEGARDE DE LA COPIE ---
        if (playerId && homeworkId) {
            const copyData = {
                levelIndex,
                userText,
                aiFeedback: aiJson.feedback_fond,
                grade: aiJson.grade
            };

            // On met à jour la copie globale (Submissions)
            // On utilise l'opérateur $pull pour éviter les doublons de la même question
            await Submission.findOneAndUpdate(
                { homeworkId, playerId },
                { 
                    classroom, 
                    submittedAt: Date.now(),
                    $pull: { levelsResults: { levelIndex } } 
                },
                { upsert: true }
            );
            
            // On ajoute la nouvelle correction
            await Submission.findOneAndUpdate(
                { homeworkId, playerId },
                { $push: { levelsResults: copyData } }
            );
        }

        // Sauvegarde des fautes dans le carnet rose
        if (playerId && playerId !== "prof" && aiJson.corrections?.length > 0) {
            await Player.findByIdAndUpdate(playerId, { $push: { spellingMistakes: { $each: aiJson.corrections } } });
        }

        res.json(aiJson);
    } catch (e) {
        console.error("💥 Erreur analyse/sauvegarde:", e.message);
        res.status(500).json({ error: "IA Error" });
    }
});

router.get('/player-mistakes/:id', async (req, res) => {
    const Player = mongoose.model('Player');
    const p = await Player.findById(req.params.id);
    res.json(p ? p.spellingMistakes : []);
});

module.exports = router;