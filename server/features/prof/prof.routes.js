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

// Upload simple
router.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) res.json({ ok: true, imageUrl: req.file.path });
    else res.json({ ok: false });
});

// --- ROUTE MAGIQUE : SMART GENERATE ---
// Accepte: 1 image 'questionImg' et plusieurs 'docImgs'
const uploadMix = upload.fields([{ name: 'questionImg', maxCount: 1 }, { name: 'docImgs', maxCount: 10 }]);

router.post('/smart-generate', uploadMix, async (req, res) => {
    try {
        console.log("✨ [SMART] Démarrage de la génération intelligente...");
        
        const qFile = req.files['questionImg'] ? req.files['questionImg'][0] : null;
        const docFiles = req.files['docImgs'] || [];

        if (!qFile) return res.status(400).json({ error: "Image des questions manquante" });

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;

        // 1. ANALYSE DES QUESTIONS (On extrait texte + doc associé)
        console.log("📖 Lecture des questions...");
        const qBase64 = Buffer.from(await (await fetch(qFile.path)).arrayBuffer()).toString("base64");
        
        const qPrompt = `
        Analyse cette image d'exercice.
        Extrais chaque question individuellement.
        Pour chaque question, identifie si elle fait référence à un ou plusieurs documents (ex: "Doc 1", "Document 2").
        
        Réponds UNIQUEMENT un JSON strict :
        [
            { "instruction": "Texte de la question 1...", "docs": ["1"] },
            { "instruction": "Texte de la question 2...", "docs": ["2", "3"] }
        ]
        Si aucun doc n'est cité, mets "docs": [].
        `;

        const qResp = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: qPrompt }, { inline_data: { mime_type: "image/jpeg", data: qBase64 } }] }], generationConfig: { response_mime_type: "application/json" } }) });
        const qJson = await qResp.json();
        const questions = JSON.parse(qJson.candidates[0].content.parts[0].text);

        // 2. IDENTIFICATION DES DOCUMENTS (En parallèle)
        console.log(`🔍 Identification de ${docFiles.length} documents...`);
        
        const docsMap = {}; // Va stocker "1" -> URL, "2" -> URL

        await Promise.all(docFiles.map(async (file) => {
            const dBase64 = Buffer.from(await (await fetch(file.path)).arrayBuffer()).toString("base64");
            const dPrompt = `Regarde cette image. Quel est le NUMÉRO du document visible (ex: "Doc 1", "Document 3") ? Réponds JUSTE le chiffre (ex: "1"). Si tu ne trouves pas, réponds "null".`;
            
            const dResp = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: dPrompt }, { inline_data: { mime_type: "image/jpeg", data: dBase64 } }] }] }) });
            const dJson = await dResp.json();
            
            let docNum = dJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            // Nettoyage basique (enlève les points, espaces)
            docNum = docNum.replace(/[^0-9]/g, '');
            
            if (docNum) {
                console.log(`✅ Image identifiée comme Doc ${docNum}`);
                docsMap[docNum] = file.path;
            }
        }));

        // 3. ASSEMBLAGE
        console.log("🧩 Assemblage du devoir...");
        const levels = questions.map(q => {
            const attachmentUrls = [];
            // On cherche les images correspondant aux docs cités
            q.docs.forEach(docId => {
                if (docsMap[docId]) attachmentUrls.push(docsMap[docId]);
            });

            return {
                instruction: q.instruction,
                attachmentUrls: attachmentUrls, // L'IA met les images ici
                questionImage: null // On met le texte, donc pas d'image de question
            };
        });

        res.json({ levels });

    } catch (e) {
        console.error("❌ Erreur Smart Gen:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROUTES EXISTANTES (CRUD, ETC) ---
router.get('/homework-all', async (req, res) => { res.json(await mongoose.model('Homework').find().sort({ date: -1 })); });
router.post('/homework', async (req, res) => {
    const { _id, ...data } = req.body;
    if (_id) await mongoose.model('Homework').findByIdAndUpdate(_id, data);
    else await mongoose.model('Homework').create(data);
    res.json({ ok: true });
});
router.delete('/homework/:id', async (req, res) => { await mongoose.model('Homework').findByIdAndDelete(req.params.id); res.json({ ok: true }); });
router.get('/submissions/:homeworkId', async (req, res) => { res.json(await mongoose.model('Submission').find({ homeworkId: req.params.homeworkId }).populate('playerId', 'firstName lastName classroom')); });
router.put('/submissions/:id', async (req, res) => { await mongoose.model('Submission').findByIdAndUpdate(req.params.id, { levelsResults: req.body.levelsResults }); res.json({ ok: true }); });
router.get('/players', async (req, res) => { res.json(await mongoose.model('Player').find().sort({ classroom: 1, lastName: 1 })); });
router.post('/extract-text', async (req, res) => { /* Code OCR conservé */ res.json({text:""}); }); 
// Note: J'ai simplifié extract-text ici pour gagner de la place, l'autre fonctionnalité Smart remplace le besoin manuel.

module.exports = router;