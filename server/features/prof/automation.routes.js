const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');
const fetch = require('node-fetch');

// Helper Date JJ-MM-26
const getSuffix = () => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-26`;
};

// --- ROUTE DE CORRECTION IA GLOBALE ---
router.post('/process-correction', async (req, res) => {
    try {
        const { sessionId, classroom, questions, copies, iaPrompt } = req.body;
        const ScanSession = mongoose.model('ScanSession');
        const session = await ScanSession.findById(sessionId);
        
        const isCollege = (classroom.startsWith('6') || classroom.startsWith('5'));
        
        console.log(`🤖 [IA] Lancement correction ${isCollege ? 'Collège' : 'Lycée'} pour ${classroom}`);

        // 1. Préparation du Prompt Pédagogique
        const prompt = `
            Tu es un professeur expert au Lycée La Condamine. 
            Analyse les images fournies : le SUJET (énoncé) et les COPIES d'élèves.
            
            ${isCollege ? `
            MODE COLLÈGE (6e/5e) :
            - Pour chaque exercice/élève, identifie 1 à 3 compétences : [Se repérer dans l'espace, Se repérer dans le temps, Analyser un document, Mémoriser un cours, Pratiquer différents langages].
            - Attribue une lettre : A+ (Excellent), A (Acquis), B (En cours), C (Insuffisant).
            - Retranscris la copie et insère des conseils en majuscules entre crochets [CONSEIL: ...].
            ` : `
            MODE LYCÉE :
            - Note sur 20.
            - Appréciation globale détaillée sur la méthode et le fond.
            `}

            CONSIGNES PROFESSEUR : ${iaPrompt || "Pas de consignes spécifiques."}

            RETOUR ATTENDU : Un rapport structuré, clair, prêt pour un fichier .txt.
        `;

        // 2. Appel Gemini 2.0 Flash
        // Note: On envoie les images en base64 à Gemini
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const parts = [{ text: prompt }];
        // Ajout des images à l'analyse
        questions.forEach(img => parts.push({ inline_data: { mime_type: "image/jpeg", data: img.split(',')[1] } }));
        copies.forEach(img => parts.push({ inline_data: { mime_type: "image/jpeg", data: img.split(',')[1] } }));

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] })
        });

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur d'analyse IA";

        // 3. Création du fichier .txt sur Google Drive
        const fileName = `CORRECTION_GENEREE_${getSuffix()}.txt`;
        
        // On utilise DriveService pour uploader le texte (on crée un petit buffer)
        const buffer = Buffer.from(resultText, 'utf-8');
        const media = { mimeType: 'text/plain', body: require('stream').Readable.from(buffer) };
        
        const driveFile = await DriveService.uploadRawFile(session.driveFolderId, fileName, media);

        res.json({ ok: true, driveLink: driveFile.link });
    } catch (e) {
        console.error("❌ Erreur Process:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- AUTRES ROUTES (SESSIONS, RENAME, DELETE) ---
router.get('/scan-sessions', async (req, res) => {
    const data = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
    res.json(data);
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const finalTitle = title ? `${title.trim()}_${getSuffix()}` : getSuffix();
        const root = (classroom === '1BFI' || classroom === '1D') ? '1BFI' : classroom;
        const rootId = await DriveService.getOrCreateFolder(root);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        const newSession = await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId });
        res.json(newSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/rename', async (req, res) => {
    const { newPrefix } = req.body;
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    const suffix = session.title.split('_').pop();
    const newTitle = newPrefix ? `${newPrefix}_${suffix}` : suffix;
    await DriveService.renameFolder(session.driveFolderId, newTitle);
    session.title = newTitle; await session.save();
    res.json(session);
});

router.delete('/scan-sessions/:id', async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    if (session?.driveFolderId) await DriveService.deleteFolder(session.driveFolderId);
    await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

router.post('/scan-upload-photo', async (req, res) => {
    const { sessionId, type, imageBase64 } = req.body;
    const session = await mongoose.model('ScanSession').findById(sessionId);
    const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
    if (result) {
        const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
        res.json(updated);
    } else res.status(500).json({ error: "Drive Error" });
});

router.patch('/scan-sessions/:id/instructions', async (req, res) => {
    await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { teacherInstruction: req.body.text });
    res.json({ ok: true });
});

module.exports = router;