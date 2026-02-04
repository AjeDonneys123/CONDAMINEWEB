// @signatures: ProfGamesRouter, all, create, generate, generateContent, streamToBuffer, uploadAsset
const express = require('express');
const router = express.Router();
// On require le modèle ici pour être sûr qu'il est chargé
const GameLevel = require('../../models/GameLevel'); 
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

router.get('/all', async (req, res) => {
    try {
        const list = await GameLevel.find({}).lean();
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

router.post('/', async (req, res) => {
    console.log("💾 [GAMES] Sauvegarde...");
    console.log("   DATA REÇUE:", JSON.stringify(req.body).substring(0, 200) + "...");
    
    if (req.body.levels) {
        console.log(`   ✅ LEVELS PRÉSENTS: ${req.body.levels.length}`);
    } else {
        console.error("   ❌ LEVELS MANQUANTS DANS LE PAYLOAD !");
    }

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

        let quiz;
        if (data._id) {
            // On force l'update avec le nouveau contenu
            quiz = await GameLevel.findByIdAndUpdate(data._id, { $set: data }, { new: true });
        } else {
            quiz = await GameLevel.create(data);
        }
        
        console.log("   ✅ Sauvegardé ID:", quiz._id);
        res.json(quiz);
    } catch (e) { 
        console.error("   ❌ ERREUR:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.post('/upload-asset', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    try {
        const folderId = await ProfDrive.getOrCreateFolder("CONDA_GAMES_ASSETS");
        const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
        const url = `/api/structure/proxy/${driveFile.id}`;
        try { fs.unlinkSync(req.file.path); } catch(e){}
        res.json({ url, name: req.file.originalname });
    } catch (e) {
        res.status(500).json({ error: "Erreur Drive" });
    }
});

router.post('/generate-content', upload.single('file'), async (req, res) => {
    const { topic, count, contextText, sheetUrl } = req.body;
    console.log(`🎮 [GAMES] Génération IA. Topic: "${topic}"`);

    const system = `Tu es un expert pédagogique créateur de Quiz.
    TA MISSION : Créer un QCM de ${count || 5} questions.
    RÈGLE DE REDACTION : Format "Texte à trous" si possible.
    FORMAT SORTIE : Un tableau JSON [ { "q": "...", "options": ["...",...], "a": 0 } ].`;

    const promptParts = [];
    if (topic) promptParts.push({ text: `Sujet/Consigne : "${topic}".` });
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
        
        const shuffled = questions.map(q => {
            const corr = q.options[q.a];
            const opts = [...q.options].sort(() => Math.random() - 0.5);
            return { ...q, options: opts, a: opts.indexOf(corr) };
        });

        res.json(shuffled);
    } catch (e) {
        console.error("❌ [GAMES] Erreur IA:", e);
        res.status(500).json({ error: "Erreur IA" });
    } finally {
        if (req.file) { try { fs.unlinkSync(req.file.path); } catch(e){} }
    }
});

module.exports = router;
