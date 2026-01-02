const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Config Cloudinary
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const storage = new CloudinaryStorage({ cloudinary: cloudinary, params: { folder: 'condamine-assets', allowed_formats: ['jpg', 'png', 'pdf'] } });
const upload = multer({ storage: storage });

// UPLOAD
router.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) res.json({ ok: true, imageUrl: req.file.path });
    else res.json({ ok: false });
});

// ELEVES
router.get('/players', async (req, res) => {
    const Player = mongoose.model('Player');
    res.json(await Player.find().sort({ classroom: 1, lastName: 1 }));
});

router.post('/reset-player', async (req, res) => {
    const Player = mongoose.model('Player');
    await Player.findByIdAndUpdate(req.body.playerId, { spellingMistakes: [] });
    res.json({ ok: true });
});

// DEVOIRS (ADMIN)
router.get('/homework-all', async (req, res) => {
    const Homework = mongoose.model('Homework');
    res.json(await Homework.find().sort({ date: -1 }));
});

router.post('/homework', async (req, res) => {
    const Homework = mongoose.model('Homework');
    const { _id, ...data } = req.body;
    if (_id) await Homework.findByIdAndUpdate(_id, data);
    else await new Homework(data).save();
    res.json({ ok: true });
});

module.exports = router;