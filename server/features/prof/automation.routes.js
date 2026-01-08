const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const { google } = require('googleapis');

// Configuration OAuth2 sécurisée pour Prod et Dev
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// --- PROXY IMAGE (Fix affichage Render) ---
router.get('/view-thumbnail/:fileId', async (req, res) => {
    try {
        const file = await drive.files.get({ fileId: req.params.fileId, fields: 'thumbnailLink' });
        if (!file.data.thumbnailLink) return res.status(404).send("Pas de miniature");
        
        const response = await fetch(file.data.thumbnailLink.replace(/=s\d+/, '=s800'));
        const buffer = await response.buffer();
        res.set('Content-Type', 'image/jpeg');
        res.send(buffer);
    } catch (e) {
        console.error("❌ [PROXY ERR]", e.message);
        res.status(500).send("Erreur Proxy");
    }
});

router.get('/google/drive/list', async (req, res) => {
    try {
        const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if(!rootId) throw new Error("ID Dossier manquant dans les variables d'environnement");
        
        const driveRes = await drive.files.list({
            q: `'${rootId}' in parents and trashed = false`,
            fields: 'files(id, name, thumbnailLink, mimeType)',
            pageSize: 50
        });
        res.json({ ok: true, files: driveRes.data.files || [] });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.get('/scans', async (req, res) => {
    try {
        const Submission = mongoose.model('Submission');
        const data = await Submission.find({}).populate('playerId').sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

module.exports = router;