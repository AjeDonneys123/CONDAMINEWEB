const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configuration Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcjt0dfsc',
    api_key: process.env.CLOUDINARY_API_KEY || '252514332881269',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'n8W3iO0H_Xp7F-u0XQz_D_kIu0o'
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'condamine', allowed_formats: ['jpg', 'png', 'jpeg'] }
});
const upload = multer({ storage: storage });

// --- ROUTE UNIFIÉE D'UPLOAD (Indispensable pour Scans et Devoirs) ---
router.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        res.json({ ok: true, imageUrl: req.file.path });
    } else {
        res.status(500).json({ ok: false, error: "Upload échoué" });
    }
});

router.get('/players', async (req, res) => {
    try {
        const players = await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 });
        res.json(players || []);
    } catch (e) { res.status(500).json([]); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.status(500).json([]); }
});

router.get('/homework-all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

module.exports = router;