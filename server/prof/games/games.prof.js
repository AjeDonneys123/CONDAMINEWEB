// @signatures: ProfGamesRouter, all, create, delete, generate, generateContent, getTestData, streamToBuffer, uploadAsset
const express = require('express');
const router = express.Router();
const { GameLevel } = require('../models/prof.models');
const ProfAI = require('../core/prof.ai');
const ProfDrive = require('../core/drive.prof'); 
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });

const streamToBuffer = async (stream) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

// --- 1. ROUTES SPÉCIFIQUES (DOIVENT ÊTRE AVANT /:id) ---

// 🔥 RESTAURATION CRITIQUE POUR LE STUDIO ET LE MOTEUR
// Cette route permet au moteur de jeu de charger le "Jeu en cours d'édition" ou le "Jeu Test"
router.get('/test-data', async (req, res) => {
    try {
        // On cherche le dernier jeu marqué comme test, ou le dernier modifié
        const game = await GameLevel.findOne({ isTestGame: true }).sort({ updatedAt: -1 }).lean()
                  || await GameLevel.findOne({}).sort({ updatedAt: -1 }).lean();
        
        if (!game) return res.json(null); // Pas de jeu, pas de crash
        res.json(game);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Route pour la liste des activités
router.get('/all', async (req, res) => {
    try {
        const list = await GameLevel.find({}).lean();
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

router.post('/generate-content', upload.single('file'), async (req, res) => {
    const { topic, count, contextText, sheetUrl } = req.body;
    const system = `Tu es un expert pédagogique créateur de Quiz.
    TA MISSION : Créer un QCM de ${count || 5} questions.
    FORMAT SORTIE : Un tableau JSON [ { "q": "...", "options": ["...",...], "a": 0 } ].`;

    const promptParts = [];
    if (topic) promptParts.push({ text: `Sujet : "${topic}".` });
    if (contextText) promptParts.push({ text: `CONTENU :\n${contextText}` });

    try {
        if (req.file) {
            const fileData = fs.readFileSync(req.file.path).toString('base64');
            promptParts.push({ inlineData: { mimeType: req.file.mimetype, data: fileData } });
        } 
        else if (sheetUrl && sheetUrl.includes('/proxy/')) {
            const fileId = sheetUrl.split('/proxy/')[1];
            const stream = await ProfDrive.getFileStream(fileId);
            const buffer = await streamToBuffer(stream);
            const mime = sheetUrl.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'; 
            promptParts.push({ inlineData: { mimeType: mime, data: buffer.toString('base64') } });
        }

        if (promptParts.length === 0) return res.status(400).json({ error: "Aucun contexte" });

        const raw = await ProfAI.ask(promptParts, system);
        const questions = ProfAI.sanitize(raw);
        res.json(questions);
    } catch (e) { res.status(500).json({ error: "Erreur IA" }); } 
    finally { if (req.file) try { fs.unlinkSync(req.file.path); } catch(e){} }
});

router.post('/upload-asset', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    try {
        const folderId = await ProfDrive.getOrCreateFolder("CONDA_GAMES_ASSETS");
        const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
        const url = `/api/structure/proxy/${driveFile.id}`;
        try { fs.unlinkSync(req.file.path); } catch(e){}
        res.json({ url, name: req.file.originalname });
    } catch (e) { res.status(500).json({ error: "Erreur Drive" }); }
});

// --- 2. ROUTES GÉNÉRIQUES (CRUD) ---

router.post('/', async (req, res) => {
    try {
        const data = req.body;
        // Nettoyage IDs vides
        if (data.levels) {
            data.levels.forEach(l => {
                if(l._id === "") delete l._id;
                if(l.intro && l.intro._id === "") delete l.intro._id;
                if(l.questions) l.questions.forEach(q => { if(q._id === "") delete q._id; });
            });
        }
        if (data._id === "" || data._id === "null") delete data._id;

        let quiz;
        if (data._id) {
            quiz = await GameLevel.findByIdAndUpdate(data._id, { $set: data }, { new: true });
        } else {
            quiz = await GameLevel.create(data);
        }
        res.json(quiz);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await GameLevel.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Route GET unique par ID (Doit être en dernier pour ne pas intercepter "test-data" ou "all")
router.get('/:id', async (req, res) => {
    try {
        const game = await GameLevel.findById(req.params.id).lean();
        if (!game) return res.status(404).json({ error: "Jeu introuvable" });
        res.json(game);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
