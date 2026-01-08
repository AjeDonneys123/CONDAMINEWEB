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

// --- ROUTE DE TEST ---
router.get('/google/drive/list', async (req, res) => {
    console.log("🔍 [DRIVE] Appel de la liste reçu.");
    try {
        const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!rootId) throw new Error("ID Dossier manquant dans .env");

        const driveRes = await drive.files.list({
            q: `'${rootId}' in parents and trashed = false`,
            fields: 'files(id, name, thumbnailLink, mimeType)',
            pageSize: 50
        });
        res.json({ ok: true, files: driveRes.data.files || [] });
    } catch (e) {
        console.error("❌ Erreur Drive:", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Diagnostic rapide
router.get('/test-google', async (req, res) => {
    try {
        const token = await oauth2Client.getAccessToken();
        res.json({ ok: !!token.token, message: token.token ? "Google Connecté ✅" : "Erreur Jeton" });
    } catch (e) { res.json({ ok: false, message: e.message }); }
});

module.exports = router;