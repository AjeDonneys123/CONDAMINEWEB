const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const fetch = require('node-fetch');
const { google } = require('googleapis');
const { Readable } = require('stream'); // Importation manquante corrigée

// Configuration Multer pour les scans directs
const upload = multer({ storage: multer.memoryStorage() });

// Configuration OAuth2 sécurisée
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

let folderCache = {};

function cleanString(str) {
    if (!str) return "";
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function getOrCreateFolderCached(name, parentId = null) {
    const rootId = parentId || process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootId) throw new Error("GOOGLE_DRIVE_FOLDER_ID manquant");

    const cacheKey = `${name}-${rootId}`;
    if (folderCache[cacheKey]) return folderCache[cacheKey];

    const safeName = name.replace(/'/g, "\\'");
    const search = await drive.files.list({
        q: `name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and '${rootId}' in parents and trashed = false`,
        fields: 'files(id)'
    });

    let folderId;
    if (search.data.files && search.data.files.length > 0) {
        folderId = search.data.files[0].id;
    } else {
        const folder = await drive.files.create({
            requestBody: { name: safeName, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] },
            fields: 'id'
        });
        folderId = folder.data.id;
    }
    folderCache[cacheKey] = folderId;
    return folderId;
}

// --- 1. LISTER LES PHOTOS (FIX DRIVE) ---
router.get('/google/drive/list', async (req, res) => {
    try {
        const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!rootId) return res.status(500).json({ ok: false, error: "ID Dossier manquant dans .env" });

        const driveRes = await drive.files.list({
            q: `'${rootId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name, thumbnailLink, mimeType)',
            pageSize: 50
        });
        res.json({ ok: true, files: driveRes.data.files || [] });
    } catch (e) {
        console.error("❌ Erreur liste drive:", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// --- 2. UPLOAD DIRECT DEPUIS IPHONE (FIX STREAM) ---
router.post('/manual-upload-scan', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) throw new Error("Pas de fichier");
        const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        const driveRes = await drive.files.create({
            requestBody: {
                name: `iPhoneScan_${Date.now()}.jpg`,
                parents: [rootId]
            },
            media: {
                mimeType: 'image/jpeg',
                body: Readable.from(req.file.buffer) // Utilisation du module stream corrigé
            },
            fields: 'id'
        });

        res.json({ ok: true, fileId: driveRes.data.id });
    } catch (e) {
        console.error("❌ Erreur upload direct:", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// --- 3. PROXY IMAGE (Fix affichage sur Render) ---
router.get('/view-thumbnail/:fileId', async (req, res) => {
    try {
        const file = await drive.files.get({ fileId: req.params.fileId, fields: 'thumbnailLink' });
        if (!file.data.thumbnailLink) return res.status(404).send("Pas de miniature");
        
        const response = await fetch(file.data.thumbnailLink.replace(/=s\d+/, '=s1000'));
        const buffer = await response.buffer();
        res.set('Content-Type', 'image/jpeg');
        res.send(buffer);
    } catch (e) { res.status(500).send("Erreur miniature"); }
});

router.get('/view-copy/:driveFileId', async (req, res) => {
    try {
        const file = await drive.files.get({ fileId: req.params.driveFileId, fields: 'thumbnailLink' });
        const url = file.data.thumbnailLink ? file.data.thumbnailLink.replace(/=s\d+/, '=s1600') : null;
        if (!url) throw new Error("Pas de lien");
        const response = await fetch(url);
        res.set('Content-Type', 'image/jpeg');
        res.send(await response.buffer());
    } catch (e) { res.status(404).send("Image introuvable"); }
});

// --- 4. RÉCUPÉRATION SCANS ---
router.get('/scans', async (req, res) => {
    try {
        const Submission = mongoose.model('Submission');
        const data = await Submission.find({}).populate('playerId').sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

router.get('/scans/player/:playerId', async (req, res) => {
    try {
        const data = await mongoose.model('Submission').find({ playerId: req.params.playerId }).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

module.exports = router;