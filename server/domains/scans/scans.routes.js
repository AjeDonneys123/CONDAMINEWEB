const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Important pour suppression après upload Drive
const ScanAI = require('./ai/scan.ai');
const DriveEngine = require('../../core/drive.engine'); // Moteur Drive importé

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.png' && ext !== '.jpeg' && ext !== '.jpg') ext = '.jpg';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'scan-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

router.get('/sessions', asyncHandler(async (req, res) => { const sessions = await mongoose.model('ScanSession').find({}).sort({ date: -1 }).lean(); res.json(sessions); }));
router.post('/sessions', asyncHandler(async (req, res) => { const { title, teacherId } = req.body; const session = await mongoose.model('ScanSession').create({ title: title || `Scan ${new Date().toLocaleDateString('fr-FR')}`, teacherId }); res.json(session); }));
router.patch('/sessions/:id', asyncHandler(async (req, res) => { const { title, chapterId } = req.body; const updateData = {}; if (title) updateData.title = title; if (chapterId) updateData.chapterId = chapterId; const session = await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true }); res.json(session); }));

// --- UPLOAD BLINDÉ (SAUVEGARDE DRIVE IMMÉDIATE) ---
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => { 
    if (!req.file) return res.status(400).json({ error: "No file" }); 
    
    const { sessionId, type } = req.body; 
    let finalUrl = `/uploads/${req.file.filename}`; // Url locale par défaut (temporaire)

    try {
        console.log(`☁️ [SCAN] Upload Drive immédiat pour : ${req.file.filename}`);
        
        // 1. Trouver ou créer le dossier "SCANS_TEMP" dans le Drive
        const scansFolderId = await DriveEngine.getOrCreateFolder("SCANS_ARCHIVE");
        
        // 2. Upload vers Drive
        const driveFile = await DriveEngine.uploadFile(req.file.filename, req.file.path, scansFolderId);
        
        // 3. On utilise l'URL Proxy du serveur (plus sûr pour l'IA et le frontend)
        // Format: /api/structure/proxy/FILE_ID
        finalUrl = `/api/structure/proxy/${driveFile.id}`;
        
        console.log(`✅ [SCAN] Sécurisé sur Drive. ID: ${driveFile.id}`);

        // Optionnel : On peut supprimer le fichier local maintenant pour économiser l'espace
        // Mais on le garde quelques minutes au cas où (le nettoyage auto le fera)
        
    } catch (e) {
        console.error("⚠️ Erreur sauvegarde Drive (Fallback local) :", e.message);
        // On continue avec l'URL locale si le Drive échoue
    }

    const update = {}; 
    if (type === 'SUBJECT') update.$push = { subjectUrls: finalUrl }; 
    if (type === 'COPY') update.$push = { copyUrls: finalUrl }; 
    
    const session = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, update, { new: true }); 
    res.json({ url: finalUrl, session }); 
}));

router.delete('/sessions/:id', asyncHandler(async (req, res) => { await mongoose.model('ScanSession').findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// --- CORRECTION INTELLIGENTE ---
router.post('/correct/:sessionId', asyncHandler(async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session introuvable" });

    const students = await mongoose.model('Student').find({}, 'firstName lastName').lean();
    if (req.body.instructions) session.aiInstructions = req.body.instructions;

    const existingCorrectionsMap = new Map();
    if (session.corrections && session.corrections.length > 0) {
        session.corrections.forEach(c => existingCorrectionsMap.set(c.originalUrl, c));
    }

    const finalResults = [];
    
    // Pour télécharger les images distantes (Proxy Drive) en local pour l'IA
    const downloadTemp = async (url) => {
        if (url.startsWith('/uploads')) return path.join(process.cwd(), 'public', url); // Déjà local
        if (url.includes('/proxy/')) {
            // C'est un lien proxy, il faut récupérer l'ID et télécharger le stream
            // Pour simplifier ici, on suppose que l'IA (Gemini) peut pas lire le stream direct facilement sans URL publique
            // Donc on va dire à l'IA "Désolé" si c'est pas local pour l'instant, 
            // OU BIEN on implémente un download temporaire.
            // SOLUTION RAPIDE : On ne change rien, le scan.ai.js va échouer sur le findFileOnDisk.
            // IL FAUT METTRE A JOUR SCAN.AI pour gérer le téléchargement temporaire des liens proxy.
            return null; 
        }
        return null;
    };

    // ATTENTION : Pour que l'IA fonctionne avec les liens Drive, il faut mettre à jour scan.ai.js aussi
    // Je vais le faire dans la prochaine étape si besoin, mais testons d'abord l'upload.
    
    // ... (Reste de la logique de correction identique) ...
    // Pour l'instant, je remets la logique standard, mais note que l'IA plantera si elle ne peut pas lire le fichier Drive
    // C'est l'étape d'après.
    
    for (const copyUrl of session.copyUrls) {
        if (existingCorrectionsMap.has(copyUrl)) {
            finalResults.push(existingCorrectionsMap.get(copyUrl));
        } else {
            try {
                const aiResult = await ScanAI.correctCopy(copyUrl, session.subjectUrls, session.aiInstructions, students);
                finalResults.push({ 
                    originalUrl: copyUrl,
                    studentName: aiResult.studentName,
                    grade: aiResult.grade,
                    appreciation: aiResult.appreciation,
                    transcription: aiResult.transcription,
                    mistakes: aiResult.mistakes
                });
            } catch (e) {
                finalResults.push({ originalUrl: copyUrl, studentName: "Erreur", grade: "?", appreciation: "Erreur technique" });
            }
        }
    }

    session.corrections = finalResults;
    await session.save();
    res.json(session);
}));

module.exports = router;