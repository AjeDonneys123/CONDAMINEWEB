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

// --- SUPPRESSION PHYSIQUE SUR GOOGLE DRIVE ---
router.delete('/google/drive/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        console.log(`🗑️ [DRIVE] Suppression du fichier : ${fileId}`);
        
        await drive.files.delete({
            fileId: fileId
        });

        res.json({ ok: true, message: "Fichier supprimé de Google Drive." });
    } catch (e) {
        console.error("❌ [DRIVE ERR] Impossible de supprimer :", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Proxy de Miniature
router.get('/view-thumbnail/:fileId', async (req, res) => {
    try {
        const file = await drive.files.get({ fileId: req.params.fileId, fields: 'thumbnailLink' });
        if (!file.data.thumbnailLink) return res.status(404).send("Pas de miniature");
        const response = await fetch(file.data.thumbnailLink.replace(/=s\d+/, '=s800'));
        const buffer = await response.buffer();
        res.set('Content-Type', 'image/jpeg');
        res.send(buffer);
    } catch (e) { res.status(500).send("Erreur"); }
});

router.get('/google/drive/list', async (req, res) => {
    try {
        const driveRes = await drive.files.list({
            q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType)',
            pageSize: 50
        });
        res.json({ ok: true, files: driveRes.data.files });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ... (Reste des routes scans/view-copy inchangé)
module.exports = router;