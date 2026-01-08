const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// --- 1. LISTE DES COPIES (RACINE DRIVE) ---
router.get('/google/drive/list', async (req, res) => {
    try {
        const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!rootId) return res.status(500).json({ ok: false, error: "ID Dossier Racine absent du .env" });

        const driveRes = await drive.files.list({
            q: `'${rootId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name, thumbnailLink, mimeType)',
            pageSize: 50
        });
        res.json({ ok: true, files: driveRes.data.files || [] });
    } catch (e) {
        console.error("❌ Erreur Liste Drive:", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// --- 2. PROXY DE MINIATURE (JPEG) ---
router.get('/view-thumbnail/:fileId', async (req, res) => {
    try {
        const file = await drive.files.get({ fileId: req.params.fileId, fields: 'thumbnailLink' });
        if (!file.data.thumbnailLink) return res.status(404).send("Pas de miniature");
        
        const response = await fetch(file.data.thumbnailLink.replace(/=s\d+/, '=s600'));
        const buffer = await response.buffer();
        res.set('Content-Type', 'image/jpeg');
        res.send(buffer);
    } catch (e) { res.status(500).send("Err"); }
});

// --- 3. DIAGNOSTIC ---
router.get('/test-google', async (req, res) => {
    try {
        const token = await oauth2Client.getAccessToken();
        res.json({ ok: !!token.token, message: token.token ? "Google Connecté ✅" : "Erreur Jeton" });
    } catch (e) { res.json({ ok: false, message: e.message }); }
});

// --- 4. RÉCUPÉRER TOUS LES SCANS ---
router.get('/scans', async (req, res) => {
    try {
        const data = await mongoose.model('Submission').find({}).populate('playerId').sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

module.exports = router;