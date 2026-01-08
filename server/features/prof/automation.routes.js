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

// --- PROXY DE MINIATURE (FIX IMAGES GRISES) ---
router.get('/view-thumbnail/:fileId', async (req, res) => {
    try {
        // On récupère d'abord l'URL de la miniature via l'API
        const file = await drive.files.get({
            fileId: req.params.fileId,
            fields: 'thumbnailLink'
        });

        if (!file.data.thumbnailLink) return res.status(404).send("Pas de miniature");

        // On force une plus haute résolution dans le proxy (=s800)
        const highResUrl = file.data.thumbnailLink.replace(/=s\d+/, '=s800');
        
        const response = await fetch(highResUrl);
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
        const driveRes = await drive.files.list({
            q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType)', // On a juste besoin de l'ID ici
            pageSize: 50
        });
        res.json({ ok: true, files: driveRes.data.files });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.get('/scans', async (req, res) => {
    try {
        const data = await mongoose.model('Submission').find({}).populate('playerId').sort({ createdAt: -1 });
        res.json(data);
    } catch (e) { res.json([]); }
});

router.get('/view-copy/:driveFileId', async (req, res) => {
    try {
        const response = await drive.files.get({ fileId: req.params.driveFileId, alt: 'media' }, { responseType: 'stream' });
        response.data.pipe(res);
    } catch (e) { res.status(404).send("Erreur"); }
});

module.exports = router;