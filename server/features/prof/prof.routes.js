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

// ROUTES DEVOIRS & UPLOAD
router.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) res.json({ ok: true, imageUrl: req.file.path });
    else res.json({ ok: false });
});

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

router.delete('/homework/:id', async (req, res) => {
    await mongoose.model('Homework').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

// --- NOUVELLES ROUTES : GESTION DES COPIES (SUBMISSIONS) ---

// Voir tous les élèves ayant rendu un devoir précis
router.get('/submissions/:hwId', async (req, res) => {
    const Submission = mongoose.model('Submission');
    try {
        const subs = await Submission.find({ homeworkId: req.params.hwId }).populate('playerId');
        res.json(subs);
    } catch (e) { res.status(500).json([]); }
});

// Mettre à jour la correction du prof (Le prof a le dernier mot)
router.put('/submissions/:subId', async (req, res) => {
    const Submission = mongoose.model('Submission');
    try {
        await Submission.findByIdAndUpdate(req.params.subId, { 
            levelsResults: req.body.levelsResults 
        });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.get('/players', async (req, res) => {
    res.json(await mongoose.model('Player').find().sort({ classroom: 1, lastName: 1 }));
});

router.post('/reset-player', async (req, res) => {
    await mongoose.model('Player').findByIdAndUpdate(req.body.playerId, { spellingMistakes: [] });
    res.json({ ok: true });
});

module.exports = router;