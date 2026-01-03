const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// --- CONFIG UPLOAD ---
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const storage = new CloudinaryStorage({ cloudinary: cloudinary, params: { folder: 'condamine-assets', allowed_formats: ['jpg', 'png', 'pdf'] } });
const upload = multer({ storage: storage });

router.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) res.json({ ok: true, imageUrl: req.file.path });
    else res.json({ ok: false });
});

// --- GESTION DES NIVEAUX DE JEU ---
router.get('/game-levels/all', async (req, res) => {
    try {
        const GameLevel = mongoose.model('GameLevel');
        const list = await GameLevel.find({}).sort({ createdAt: -1 });
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

router.post('/game-levels', async (req, res) => {
    try {
        const GameLevel = mongoose.model('GameLevel');
        const { _id, ...data } = req.body;
        if (_id) await GameLevel.findByIdAndUpdate(_id, data);
        else await new GameLevel(data).save();
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.delete('/game-levels/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// --- IA : GÉNÉRATION DE QUIZ (GEMINI 2.0 DIRECT) ---
router.post('/generate-game-content', async (req, res) => {
    const { topic, numQuestions } = req.body;
    const count = numQuestions || 5;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const prompt = `Tu es un professeur. Génère un quiz de ${count} questions QCM sur : ${topic}.
    Réponds UNIQUEMENT un JSON : [{"q":"Question","options":["A","B","C","D"],"a":0}]`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });
        const result = await response.json();
        const text = result.candidates[0].content.parts[0].text;
        res.json(JSON.parse(text));
    } catch (e) {
        res.status(500).json({ error: "Erreur IA" });
    }
});

// Autres routes (Players, Homework-all)
router.get('/players', async (req, res) => { res.json(await mongoose.model('Player').find().sort({ classroom: 1, lastName: 1 })); });
router.get('/homework-all', async (req, res) => { res.json(await mongoose.model('Homework').find().sort({ date: -1 })); });

module.exports = router;