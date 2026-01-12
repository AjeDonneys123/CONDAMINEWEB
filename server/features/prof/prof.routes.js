const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

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

router.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        res.json({ ok: true, imageUrl: req.file.path });
    } else {
        res.status(500).json({ ok: false, error: "Upload échoué" });
    }
});

router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const players = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(players || []);
    } catch (e) { 
        console.error("❌ Erreur GET /players:", e.message);
        res.status(500).json([]); 
    }
});

router.get('/homework-all', async (req, res) => {
    try { 
        const Homework = mongoose.model('Homework');
        const data = await Homework.find({}).sort({ date: -1 });
        res.json(data || []); 
    } catch (e) { 
        res.status(500).json([]); 
    }
});

module.exports = router;