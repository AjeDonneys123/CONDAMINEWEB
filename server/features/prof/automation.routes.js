const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

let folderCache = {};

function cleanString(str) {
    if (!str) return "";
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function getOrCreateFolderCached(name, parentId = null) {
    const cacheKey = `${name}-${parentId || 'root'}`;
    if (folderCache[cacheKey]) return folderCache[cacheKey];
    const rootId = parentId || process.env.GOOGLE_DRIVE_FOLDER_ID;
    const search = await drive.files.list({
        q: `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${rootId}' in parents and trashed = false`,
        fields: 'files(id)'
    });
    let folderId = (search.data.files && search.data.files.length > 0) ? search.data.files[0].id : (await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] }, fields: 'id' })).data.id;
    folderCache[cacheKey] = folderId;
    return folderId;
}

// --- MOTEUR IA AVEC CONTEXTE (Vision multi-images) ---
async function analyzeCopyWithContext(fileId, context = {}) {
    // 1. Récupération de l'image de la copie élève
    const imgRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    
    // Construction du prompt enrichi
    const parts = [
        { text: `
            Agis comme un professeur expert. Analyse cette copie d'élève.
            
            CONTEXTE DE CORRECTION FOURNI :
            - Consignes spécifiques : ${context.teacherPrompt || "Aucune consigne."}
            ${context.questionsUrl ? "- Photo du sujet (FEUILLE DE QUESTIONS) jointe." : ""}
            ${context.docUrls?.length > 0 ? "- Photos de DOCUMENTS DE RÉFÉRENCE (SUPPORT) jointes." : ""}

            MISSION :
            1. Identifie l'élève.
            2. Corrige la pertinence du fond (réponses aux questions) et la forme (orthographe).
            
            Réponds en JSON strict :
            {"studentName": "Nom", "originalText": "Transcription brute", "correctedHtml": "Html avec <s class='text-red-500'>faux</s> <b class='text-green-600'>juste</b>", "grade": "Note/20", "feedback": "Commentaire détaillé sur le fond", "mistakes": []}
        `},
        { inline_data: { mime_type: "image/jpeg", data: Buffer.from(imgRes.data).toString('base64') } }
    ];

    // On ajoute l'image du sujet si présente
    if (context.questionsUrl) {
        const qBuf = await fetch(context.questionsUrl).then(r => r.buffer());
        parts.push({ inline_data: { mime_type: "image/jpeg", data: qBuf.toString('base64') } });
    }

    // On ajoute les documents de référence
    if (context.docUrls && context.docUrls.length > 0) {
        for (let url of context.docUrls) {
            const dBuf = await fetch(url).then(r => r.buffer());
            parts.push({ inline_data: { mime_type: "image/jpeg", data: dBuf.toString('base64') } });
        }
    }

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
    }).then(r => r.json());

    return JSON.parse(aiRes.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim());
}

router.post('/process-copy', async (req, res) => {
    const { fileId, homeworkTitle, teacherPrompt, questionsUrl, docUrls } = req.body;
    try {
        const analysis = await analyzeCopyWithContext(fileId, { teacherPrompt, questionsUrl, docUrls });
        const Player = mongoose.model('Player');
        const allPlayers = await Player.find({});
        const student = allPlayers.find(p => cleanString(p.firstName).includes(cleanString(analysis.studentName)) || cleanString(analysis.studentName).includes(cleanString(p.firstName)));

        const classId = await getOrCreateFolderCached(student ? student.classroom : "❓ INCONNU");
        const studentId = await getOrCreateFolderCached(student ? `${student.firstName} ${student.lastName}` : analysis.studentName, classId);
        const hwId = await getOrCreateFolderCached(homeworkTitle || "Trimestre 2", studentId);

        await Promise.all([
            drive.files.update({ fileId, addParents: hwId, removeParents: (await drive.files.get({ fileId, fields: 'parents' })).data.parents.join(','), fields: 'id, parents' }),
            drive.files.create({ requestBody: { name: `Correction_${analysis.studentName}.txt`, parents: [hwId] }, media: { mimeType: 'text/plain', body: `NOTE: ${analysis.grade}\n\n${analysis.feedback}` } }),
            mongoose.model('Submission').create({ playerId: student?._id, driveFileId: fileId, originalTranscription: analysis.originalText, correctedTranscription: analysis.correctedHtml, feedback: analysis.feedback, grade: analysis.grade })
        ]);

        res.json({ ok: true, student: analysis.studentName });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.get('/google/drive/list', async (req, res) => {
    try {
        const driveRes = await drive.files.list({ q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`, fields: 'files(id, name, thumbnailLink, mimeType)', pageSize: 50 });
        res.json({ ok: true, files: driveRes.data.files || [] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/view-thumbnail/:fileId', async (req, res) => {
    try {
        const file = await drive.files.get({ fileId: req.params.fileId, fields: 'thumbnailLink' });
        const response = await fetch(file.data.thumbnailLink.replace(/=s\d+/, '=s800'));
        res.send(await response.buffer());
    } catch (e) { res.status(500).send("Err"); }
});

module.exports = router;