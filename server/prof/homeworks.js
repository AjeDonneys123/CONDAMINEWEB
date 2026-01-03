const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GESTION DEVOIRS
router.get('/homework-all', async (req, res) => { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); });

router.post('/homework', async (req, res) => {
    const { _id, ...data } = req.body;
    if (_id) await mongoose.model('Homework').findByIdAndUpdate(_id, data);
    else await mongoose.model('Homework').create(data);
    res.json({ ok: true });
});

router.delete('/homework/:id', async (req, res) => { await mongoose.model('Homework').findByIdAndDelete(req.params.id); res.json({ ok: true }); });

// GESTION COPIES
router.get('/submissions/:homeworkId', async (req, res) => {
    res.json(await mongoose.model('Submission').find({ homeworkId: req.params.homeworkId }).populate('playerId', 'firstName lastName classroom'));
});

router.put('/submissions/:id', async (req, res) => {
    await mongoose.model('Submission').findByIdAndUpdate(req.params.id, { levelsResults: req.body.levelsResults });
    res.json({ ok: true });
});

// NOUVEAU : EXTRACTION OCR VIA GEMINI
router.post('/extract-text', async (req, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "Pas d'image fournie" });

    try {
        // 1. Récupérer l'image en buffer
        const imgResp = await fetch(imageUrl);
        const buffer = await imgResp.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");

        // 2. Préparer l'appel Gemini Vision
        const key = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`;
        
        const payload = {
            contents: [{
                parts: [
                    { text: "Transcris tout le texte visible dans cette image. Ne mets aucun commentaire, juste le texte brut." },
                    { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                ]
            }]
        };

        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await r.json();
        const extractedText = data.candidates[0].content.parts[0].text;

        res.json({ text: extractedText.trim() });
    } catch (e) {
        console.error("Erreur OCR:", e);
        res.status(500).json({ error: "Erreur lors de l'extraction du texte." });
    }
});

module.exports = router;