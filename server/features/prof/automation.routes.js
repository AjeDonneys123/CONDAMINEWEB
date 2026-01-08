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

// --- RÉCUPÉRER LES COPIES D'UN ÉLÈVE (FIX ROBUSTE) ---
router.get('/scans/player/:playerId', async (req, res) => {
    try {
        const Submission = mongoose.model('Submission');
        const { playerId } = req.params;

        // On vérifie que l'ID est valide pour MongoDB
        if (!mongoose.Types.ObjectId.isValid(playerId)) {
            return res.status(400).json({ error: "ID Élève invalide" });
        }

        const data = await Submission.find({ playerId: playerId }).sort({ createdAt: -1 });
        console.log(`📂 [API] ${data.length} archives trouvées pour l'élève ${playerId}`);
        res.json(data || []);
    } catch (e) {
        console.error("❌ Erreur /scans/player :", e.message);
        res.status(500).json([]);
    }
});

// --- LISTE GLOBALE ---
router.get('/scans', async (req, res) => {
    try {
        const Submission = mongoose.model('Submission');
        const data = await Submission.find({}).populate('playerId').sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

// --- PROXY IMAGE DRIVE ---
router.get('/view-copy/:driveFileId', async (req, res) => {
    try {
        const fileMetadata = await drive.files.get({ fileId: req.params.driveFileId, fields: 'thumbnailLink' });
        if (fileMetadata.data.thumbnailLink) {
            const response = await fetch(fileMetadata.data.thumbnailLink.replace(/=s\d+/, '=s1600'));
            const buffer = await response.buffer();
            res.set('Content-Type', 'image/jpeg');
            return res.send(buffer);
        }
        const response = await drive.files.get({ fileId: req.params.driveFileId, alt: 'media' }, { responseType: 'stream' });
        response.data.pipe(res);
    } catch (e) { res.status(404).send("Image introuvable"); }
});

module.exports = router;