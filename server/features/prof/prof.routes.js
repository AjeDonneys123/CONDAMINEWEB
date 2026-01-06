const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const fetch = require('node-fetch');

// Config Cloudinary
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

// --- ÉLÈVES (Route indispensable pour le finder et l'affichage) ---
router.get('/players', async (req, res) => {
    try {
        const players = await mongoose.model('Player').find({});
        res.json(players);
    } catch (e) { 
        console.error("Erreur GET /players:", e);
        res.status(500).json([]); 
    }
});

// --- DOSSIERS ---
router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) await mongoose.model('Chapter').findByIdAndUpdate(_id, data);
        else await mongoose.model('Chapter').create(data);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// --- ACTIVITÉS ---
router.get('/homework-all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

router.get('/game-levels/all', async (req, res) => {
    try { res.json(await mongoose.model('GameLevel').find({})); } catch (e) { res.status(500).json([]); }
});

router.post('/homework', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) await mongoose.model('Homework').findByIdAndUpdate(_id, data);
        else await mongoose.model('Homework').create(data);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

module.exports = router;