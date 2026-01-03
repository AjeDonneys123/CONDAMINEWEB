const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const fetch = require('node-fetch');

// CONFIG CLOUDINARY
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const storage = new CloudinaryStorage({ cloudinary: cloudinary, params: { folder: 'condamine-assets', allowed_formats: ['jpg', 'png', 'pdf'] } });
const upload = multer({ storage: storage });

router.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) res.json({ ok: true, imageUrl: req.file.path });
    else res.json({ ok: false });
});

// --- GESTION DES NIVEAUX DE JEU ---
router.get('/game-levels/all', async (req, res) => {
    try { res.json(await mongoose.model('GameLevel').find({}).sort({ createdAt: -1 })); } catch (e) { res.status(500).json([]); }
});
router.post('/game-levels', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) await mongoose.model('GameLevel').findByIdAndUpdate(_id, data);
        else await mongoose.model('GameLevel').create(data);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});
router.delete('/game-levels/:id', async (req, res) => {
    await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

// --- GESTION DEVOIRS ---
router.get('/homework-all', async (req, res) => { res.json(await mongoose.model('Homework').find().sort({ date: -1 })); });
router.post('/homework', async (req, res) => {
    const { _id, ...data } = req.body;
    if (_id) await mongoose.model('Homework').findByIdAndUpdate(_id, data);
    else await mongoose.model('Homework').create(data);
    res.json({ ok: true });
});
router.delete('/homework/:id', async (req, res) => { await mongoose.model('Homework').findByIdAndDelete(req.params.id); res.json({ ok: true }); });

// --- EXTRACTION TEXTE (GEMINI 2.0 FLASH) ---
router.post('/extract-text', async (req, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "Pas d'image" });

    try {
        console.log("🚀 [OCR] Démarrage Gemini 2.0 sur :", imageUrl);

        const imgResp = await fetch(imageUrl);
        const buffer = await imgResp.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");

        // URL SPÉCIFIQUE GEMINI 2.0 FLASH
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const payload = {
            contents: [{ parts: [
                { text: "Transcris tout le texte visible sur cette image. Donne uniquement le texte brut, sans mise en forme markdown." },
                { inline_data: { mime_type: "image/jpeg", data: base64Data } }
            ]}]
        };

        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await r.json();
        
        // GESTION ERREUR PRÉCISE
        if (data.error) {
            console.error("❌ ERREUR GOOGLE :", JSON.stringify(data.error, null, 2));
            return res.status(500).json({ error: `Erreur Google: ${data.error.message}` });
        }

        if (data.candidates && data.candidates[0].content) {
            const txt = data.candidates[0].content.parts[0].text.trim();
            console.log("✅ [OCR] Succès, longueur :", txt.length);
            res.json({ text: txt });
        } else {
            console.log("⚠️ [OCR] Réponse vide de l'IA");
            res.json({ text: "" });
        }

    } catch (e) {
        console.error("❌ [OCR] Crash Serveur :", e);
        res.status(500).json({ error: "Erreur technique serveur" });
    }
});

// --- SUBMISSIONS ---
router.get('/submissions/:homeworkId', async (req, res) => {
    res.json(await mongoose.model('Submission').find({ homeworkId: req.params.homeworkId }).populate('playerId', 'firstName lastName classroom'));
});
router.put('/submissions/:id', async (req, res) => {
    await mongoose.model('Submission').findByIdAndUpdate(req.params.id, { levelsResults: req.body.levelsResults });
    res.json({ ok: true });
});

router.get('/players', async (req, res) => { res.json(await mongoose.model('Player').find().sort({ classroom: 1, lastName: 1 })); });
router.post('/generate-game-content', async (req, res) => { res.json([]); });

module.exports = router;