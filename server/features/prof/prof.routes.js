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

// 1. GESTION DES BUGS (C'était le manquant !)
router.get('/bugs', async (req, res) => {
    try { res.json(await mongoose.model('Bug').find({}).sort({ date: -1 })); } catch (e) { res.json([]); }
});
router.delete('/bugs/:id', async (req, res) => {
    try { await mongoose.model('Bug').findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false }); }
});

// 2. GESTION DES ÉLÈVES (Dashboard)
router.get('/players', async (req, res) => { res.json(await mongoose.model('Player').find().sort({ classroom: 1, lastName: 1 })); });
router.post('/reset-player', async (req, res) => {
    await mongoose.model('Player').findByIdAndUpdate(req.body.playerId, { validatedQuestions: [], validatedLevels: [], spellingMistakes: [] });
    res.json({ ok: true });
});

// 3. GESTION DEVOIRS & UPLOAD
router.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) res.json({ ok: true, imageUrl: req.file.path }); else res.json({ ok: false });
});

router.get('/homework-all', async (req, res) => { res.json(await mongoose.model('Homework').find().sort({ date: -1 })); });
router.post('/homework', async (req, res) => {
    const { _id, ...data } = req.body;
    if (_id) await mongoose.model('Homework').findByIdAndUpdate(_id, data);
    else await mongoose.model('Homework').create(data);
    res.json({ ok: true });
});
router.delete('/homework/:id', async (req, res) => { await mongoose.model('Homework').findByIdAndDelete(req.params.id); res.json({ ok: true }); });

// 4. SMART GENERATE (WIZARD IA)
const uploadMix = upload.fields([{ name: 'questionImg', maxCount: 1 }, { name: 'docImgs', maxCount: 10 }]);
router.post('/smart-generate', uploadMix, async (req, res) => {
    try {
        const qFile = req.files['questionImg'] ? req.files['questionImg'][0] : null;
        const docFiles = req.files['docImgs'] || [];
        if (!qFile) return res.status(400).json({ error: "Image questions manquante" });

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        // Analyse Questions
        const qBase64 = Buffer.from(await (await fetch(qFile.path)).arrayBuffer()).toString("base64");
        const qResp = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: "Extrais les questions et les numéros de documents associés (ex: Doc 1). JSON: [{instruction:'...', docs:['1']}]" }, { inline_data: { mime_type: "image/jpeg", data: qBase64 } }] }], generationConfig: { response_mime_type: "application/json" } }) });
        const qJson = await qResp.json();
        const questions = JSON.parse(qJson.candidates[0].content.parts[0].text);

        // Identification Docs
        const docsMap = {};
        await Promise.all(docFiles.map(async (file) => {
            const dBase64 = Buffer.from(await (await fetch(file.path)).arrayBuffer()).toString("base64");
            const dResp = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: "Quel est le numéro du document visible ? Réponds juste le chiffre." }, { inline_data: { mime_type: "image/jpeg", data: dBase64 } }] }] }) });
            const dJson = await dResp.json();
            let num = dJson.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/[^0-9]/g, '');
            if(num) docsMap[num] = file.path;
        }));

        const levels = questions.map(q => ({
            instruction: q.instruction,
            attachmentUrls: q.docs.map(d => docsMap[d]).filter(Boolean),
            questionImage: null
        }));
        res.json({ levels });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. SUBMISSIONS
router.get('/submissions/:homeworkId', async (req, res) => { res.json(await mongoose.model('Submission').find({ homeworkId: req.params.homeworkId }).populate('playerId', 'firstName lastName classroom')); });
router.put('/submissions/:id', async (req, res) => { await mongoose.model('Submission').findByIdAndUpdate(req.params.id, { levelsResults: req.body.levelsResults }); res.json({ ok: true }); });

// 6. EXTRACTION TEXTE (OCR)
router.post('/extract-text', async (req, res) => {
    const { imageUrl } = req.body;
    try {
        const imgResp = await fetch(imageUrl);
        const buffer = await imgResp.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: "OCR stricte." }, { inline_data: { mime_type: "image/jpeg", data: base64Data } }] }] }) });
        const data = await r.json();
        res.json({ text: data.candidates[0].content.parts[0].text.trim() });
    } catch (e) { res.status(500).json({ error: "Echec extraction" }); }
});

module.exports = router;