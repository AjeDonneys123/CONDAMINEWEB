// @signatures: ProfGamesRouter, all, save, uploadAsset, generateContent
const express = require('express');
const router = express.Router();
const { GameLevel, Chapter } = require('../models/prof.models');
const ProfAI = require('../core/prof.ai');
const ProfDrive = require('../core/drive.prof'); 
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const streamToBuffer = async (stream) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

router.get('/all', asyncHandler(async (req, res) => {
    res.json(await GameLevel.find({}).lean());
}));

router.post('/', asyncHandler(async (req, res) => {
    const data = { ...req.body };
    const teacherId = data.teacherId;

    if (!data._id || data._id === "" || data._id === "null") delete data._id;

    // --- SÉCURITÉ CHAPITRE : FALLBACK AGRESSIF ---
    if (!data.chapterId || !mongoose.Types.ObjectId.isValid(data.chapterId)) {
        console.log("🛠️ [SAVE-JEU] Recalcul du dossier de secours...");
        let fallback = await Chapter.findOne({ teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
        if (!fallback && teacherId) {
            fallback = await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId });
        }
        if (fallback) data.chapterId = fallback._id;
        else return res.status(400).json({ error: "Dossier de secours introuvable." });
    }

    if (Array.isArray(data.assignedStudents)) {
        data.assignedStudents = data.assignedStudents.filter(id => id && mongoose.Types.ObjectId.isValid(id));
    }

    try {
        let result;
        if (data._id) {
            result = await GameLevel.findByIdAndUpdate(data._id, { $set: data }, { new: true });
        } else {
            result = await GameLevel.create(data);
        }
        res.json(result);
    } catch (e) {
        console.error("❌ DB SAVE FAIL (QUIZ):", e.message);
        res.status(500).json({ error: "Erreur BDD", details: e.message });
    }
}));

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

router.post('/generate-content', upload.single('file'), async (req, res) => {
    const { topic, count, contextText, sheetUrl } = req.body;
    const system = `Tu es un expert pédagogique créateur de Quiz. Format Sortie JSON [ { "q": "...", "options": ["...",...], "a": 0 } ]`;
    const promptParts = [];
    if (topic) promptParts.push({ text: `Sujet : "${topic}".` });
    try {
        if (req.file) {
            const fileData = fs.readFileSync(req.file.path).toString('base64');
            promptParts.push({ inlineData: { mimeType: req.file.mimetype, data: fileData } });
        } else if (sheetUrl && sheetUrl.includes('/proxy/')) {
            const fileId = sheetUrl.split('/proxy/')[1];
            const stream = await ProfDrive.getFileStream(fileId);
            const buffer = await streamToBuffer(stream);
            promptParts.push({ inlineData: { mimeType: 'image/jpeg', data: buffer.toString('base64') } });
        }
        const raw = await ProfAI.ask(promptParts, system);
        res.json(ProfAI.sanitize(raw));
    } catch (e) { res.status(500).json({ error: "Erreur IA" }); }
});

module.exports = router;
