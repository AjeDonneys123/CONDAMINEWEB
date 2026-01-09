const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const fetch = require('node-fetch');
const { google } = require('googleapis');

const upload = multer({ storage: multer.memoryStorage() });

const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// --- TRANSCRIPTION AUDIO ---
router.post('/transcribe-audio', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ ok: false, error: "Audio manquant" });
        const base64Audio = req.file.buffer.toString('base64');
        const payload = {
            contents: [{ parts: [
                { text: "Transcris ce message vocal d'instructions pédagogiques. Réponds uniquement avec le texte." },
                { inline_data: { mime_type: "audio/webm", data: base64Audio } }
            ]}]
        };
        const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(r => r.json());

        const text = aiRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
        res.json({ ok: true, text: text.trim() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// --- MOTEUR IA V4 ---
async function analyzeCopyWithFullContext(fileId, context) {
    const imgRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    const studentImgBase64 = Buffer.from(imgRes.data).toString('base64');
    
    const parts = [
        { text: `Agis comme un professeur expert. Analyse cette copie d'élève.
          CONSIGNES DU MAÎTRE : "${context.teacherPrompt}"
          CONTEXTE SUJET/DOCS : ${context.questionsText || "Se référer aux images jointes"}
          
          RÉPONDS UNIQUEMENT EN JSON :
          {"studentName": "Prénom", "originalText": "Transcription brute", "correctedHtml": "Html avec <s class='text-red-500'>faux</s> et <b class='text-green-600'>juste</b>", "grade": "X/20", "feedback": "Commentaire"}` 
        },
        { inline_data: { mime_type: "image/jpeg", data: studentImgBase64 } }
    ];

    if (context.questionsUrls && context.questionsUrls.length > 0) {
        for (const url of context.questionsUrls) {
            try {
                const qRes = await fetch(url).then(r => r.buffer());
                parts.push({ inline_data: { mime_type: "image/jpeg", data: qRes.toString('base64') } });
            } catch (e) { console.error("Doc sujet invalide"); }
        }
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
    }).then(r => r.json());

    const jsonText = res.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());
}

router.post('/process-copy-v4', async (req, res) => {
    try {
        const { fileId, context } = req.body;
        const result = await analyzeCopyWithFullContext(fileId, context);
        await mongoose.model('Submission').create({
            driveFileId: fileId,
            originalTranscription: result.originalText,
            correctedTranscription: result.correctedHtml,
            feedback: result.feedback,
            grade: result.grade
        });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/scans', async (req, res) => {
    try {
        const data = await mongoose.model('Submission').find({}).populate('playerId').sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

module.exports = router;