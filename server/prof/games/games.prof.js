// @signatures: ProfGamesRouter, all, create, generate, generateContent, streamToBuffer, uploadAsset
const express = require('express');
const router = express.Router();
const { GameLevel } = require('../models/prof.models');
const ProfAI = require('../core/prof.ai');
const ProfDrive = require('../core/drive.prof'); 
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });

// Utilitaire pour convertir le stream Drive en Buffer pour l'IA
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
    try {
        const quiz = await GameLevel.create(req.body);
        res.json(quiz);
    } catch (e) { res.status(500).json({ error: "Erreur sauvegarde" }); }
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
        console.error("Upload Error:", e);
        res.status(500).json({ error: "Erreur Drive" });
    }
});

// ROUTE INTELLIGENTE : Gère Texte, Upload Fichier, OU Fiche existante (URL)
router.post('/generate-content', upload.single('file'), async (req, res) => {
    const { topic, count, contextText, sheetUrl } = req.body;
    console.log(`🎮 [GAMES] Génération IA (Mode Trous). Topic: "${topic}".`);

    // --- NOUVEAU PROMPT SYSTÈME "TEXTE À TROUS" ---
    const system = `Tu es un expert pédagogique créateur de Quiz.
    
    TA MISSION : Créer un QCM de ${count || 5} questions basé sur le document ou le sujet fourni.
    
    RÈGLES DE REDACTION STRICTES (FORMAT "TEXTE À TROUS") :
    1. QUESTION : Prends une phrase factuelle du cours, et remplace le mot-clé le plus important par des pointillés "...".
       Exemple : "Le ... mesure l'ensemble des richesses produites." (au lieu de "Qu'est-ce que le PIB ?")
    2. RÉPONSES : Doivent être des MOTS-CLÉS courts (1 à 3 mots max). Pas de phrases.
    3. DISTRACTEURS : Les mauvaises réponses doivent être crédibles mais fausses.

    FORMAT DE SORTIE (JSON UNIQUEMENT) :
    [
      { 
        "q": "La phrase avec les ... au milieu.", 
        "options": ["Bon Mot", "Mauvais 1", "Mauvais 2", "Mauvais 3"], 
        "a": 0  // L'index de la bonne réponse est toujours 0 ici (mon code mélangera après)
      }
    ]
    
    Réponds uniquement le tableau JSON.`;

    const promptParts = [];
    if (topic) promptParts.push({ text: `Thème/Consigne : "${topic}".` });
    if (contextText) promptParts.push({ text: `CONTENU SOURCE :\n${contextText}` });

    try {
        // CAS 1 : Fichier uploadé
        if (req.file) {
            const fileData = fs.readFileSync(req.file.path).toString('base64');
            promptParts.push({ inlineData: { mimeType: req.file.mimetype, data: fileData } });
        } 
        // CAS 2 : Fiche existante (Proxy)
        else if (sheetUrl && sheetUrl.includes('/proxy/')) {
            const fileId = sheetUrl.split('/proxy/')[1];
            console.log(`📥 Lecture Fiche Drive ID: ${fileId}`);
            const stream = await ProfDrive.getFileStream(fileId);
            const buffer = await streamToBuffer(stream);
            const mime = sheetUrl.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'; 
            promptParts.push({ inlineData: { mimeType: mime, data: buffer.toString('base64') } });
        }

        if (promptParts.length === 0) return res.status(400).json({ error: "Aucun contexte fourni" });

        const raw = await ProfAI.ask(promptParts, system);
        const questions = ProfAI.sanitize(raw);
        
        // Mélange des options
        const shuffledQuestions = questions.map(q => {
            const correctAnswer = q.options[q.a];
            const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
            const newIndex = shuffledOptions.indexOf(correctAnswer);
            return { ...q, options: shuffledOptions, a: newIndex };
        });

        res.json(shuffledQuestions);

    } catch (e) {
        console.error("❌ [GAMES] Erreur IA:", e);
        res.status(500).json({ error: "Erreur génération IA" });
    } finally {
        if (req.file) { try { fs.unlinkSync(req.file.path); } catch(e){} }
    }
});

module.exports = router;
