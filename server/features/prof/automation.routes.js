const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const fetch = require('node-fetch');
const { google } = require('googleapis');
const { Readable } = require('stream');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // Augmentation limite 10Mo

const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// --- UPLOAD DIRECT ---
router.post('/manual-upload-scan', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) throw new Error("Fichier absent");
        const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        const driveRes = await drive.files.create({
            requestBody: {
                name: `iPhone_Batch_${Date.now()}.jpg`,
                parents: [rootId]
            },
            media: {
                mimeType: 'image/jpeg',
                body: Readable.from(req.file.buffer)
            },
            fields: 'id'
        });

        res.json({ ok: true, fileId: driveRes.data.id });
    } catch (e) {
        console.error("❌ Erreur upload:", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Les autres routes (list, thumbnail, process, etc.)
router.get('/google/drive/list', async (req, res) => {
    try {
        const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const driveRes = await drive.files.list({
            q: `'${rootId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name, thumbnailLink, mimeType)',
            pageSize: 50
        });
        res.json({ ok: true, files: driveRes.data.files || [] });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.get('/view-thumbnail/:fileId', async (req, res) => {
    try {
        const file = await drive.files.get({ fileId: req.params.fileId, fields: 'thumbnailLink' });
        const response = await fetch(file.data.thumbnailLink.replace(/=s\d+/, '=s600'));
        res.send(await response.buffer());
    } catch (e) { res.status(500).send("Err"); }
});

module.exports = router;