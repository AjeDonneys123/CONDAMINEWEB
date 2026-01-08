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

// --- RÉCUPÉRER LES COPIES D'UN ÉLÈVE PRÉCIS (FIX) ---
router.get('/scans/player/:playerId', async (req, res) => {
    try {
        const Submission = mongoose.model('Submission');
        // On s'assure de chercher par l'ID de l'élève
        const data = await Submission.find({ playerId: req.params.playerId }).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { 
        console.error("❌ Erreur scans player:", e.message);
        res.status(500).json([]); 
    }
});

// --- LISTE GLOBALE DES SCANS ---
router.get('/scans', async (req, res) => {
    try {
        const Submission = mongoose.model('Submission');
        const data = await Submission.find({}).populate('playerId').sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { 
        res.status(500).json([]); 
    }
});

// --- PROXY IMAGE DRIVE ---
router.get('/view-copy/:driveFileId', async (req, res) => {
    try {
        const fileMetadata = await drive.files.get({
            fileId: req.params.driveFileId,
            fields: 'thumbnailLink'
        });

        if (fileMetadata.data.thumbnailLink) {
            const highResUrl = fileMetadata.data.thumbnailLink.replace(/=s\d+/, '=s1600');
            const response = await fetch(highResUrl);
            const buffer = await response.buffer();
            res.set('Content-Type', 'image/jpeg');
            return res.send(buffer);
        }
        
        const response = await drive.files.get({ fileId: req.params.driveFileId, alt: 'media' }, { responseType: 'stream' });
        response.data.pipe(res);
    } catch (e) { 
        res.status(404).send("Image introuvable"); 
    }
});

// --- MAGIC SYNC (CORE) ---
router.post('/process-copy', async (req, res) => {
    const { fileId, homeworkTitle } = req.body;
    try {
        // Logique simplifiée de test pour restaurer la connexion
        res.json({ ok: true, message: "Moteur prêt." });
    } catch (e) { res.status(500).json({ ok: false }); }
});

module.exports = router;