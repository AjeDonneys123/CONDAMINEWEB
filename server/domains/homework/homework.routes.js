// @signatures: DELETE /:id, GET /all, GET /submission/:id, GET /submissions, POST /, POST /analyze-homework, POST /generate-hints, POST /remove-punishment, POST /upload, PUT /submission/:id
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const HomeworkDB = require('./experts/homework.db');
const HomeworkAI = require('./experts/homework.ai');
const DriveEngine = require('../../core/drive.engine'); // V2: Import DriveEngine
const fetch = require('node-fetch');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Config Multer (Stockage temporaire avant envoi Drive)
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// --- NOUVELLE ROUTE : ANNULER UNE PUNITION ---
router.post('/remove-punishment', asyncHandler(async (req, res) => {
    const { homeworkId, studentId } = req.body;
    
    // 1. Retirer l'élève du devoir Punition
    await mongoose.model('Homework').findByIdAndUpdate(homeworkId, {
        $pull: { assignedStudents: studentId }
    });

    // 2. Remettre le statut de l'élève à la normale
    await mongoose.model('Student').findByIdAndUpdate(studentId, {
        punishmentStatus: 'NONE',
        punishmentDueDate: null
    });

    res.json({ ok: true, message: "Punition annulée." });
}));

// --- ROUTE : GÉNÉRER GRILLE DE CORRECTION ---
router.post('/generate-hints', asyncHandler(async (req, res) => {
    const { instruction, assets } = req.body;
    if (!assets || assets.length === 0) return res.status(400).json({ error: "Aucun document chargé." });
    const hints = await HomeworkAI.generateHintsFromAssets(instruction, assets);
    res.json({ hints });
}));

router.post('/', asyncHandler(async (req, res) => {
    const Homework = mongoose.model('Homework');
    const data = req.body;
    let result;
    if (data._id) result = await Homework.findByIdAndUpdate(data._id, data, { new: true });
    else result = await Homework.create(data);
    res.json(result);
}));

router.get('/all', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Homework').find({}).sort({ date: -1 }).lean());
}));

router.get('/submissions', asyncHandler(async (req, res) => {
    const subs = await mongoose.model('Submission').find({}, 'studentId homeworkId grade createdAt').lean();
    res.json(subs);
}));

router.get('/submission/:id', asyncHandler(async (req, res) => {
    const sub = await HomeworkDB.getSubmissionDetails(req.params.id);
    if (!sub) return res.status(404).json({ error: "Copie introuvable" });
    res.json(sub);
}));

router.post('/submission/:id/correction/:provider', asyncHandler(async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!['gemini', 'didakbot'].includes(provider)) return res.status(400).json({ error: 'Correcteur inconnu.' });
    const submission = await mongoose.model('Submission').findById(req.params.id).lean();
    if (!submission) return res.status(404).json({ error: 'Copie introuvable.' });
    const homework = await mongoose.model('Homework').findById(submission.homeworkId).lean();
    if (!homework) return res.status(404).json({ error: 'Devoir introuvable.' });
    const level = homework.levels?.[Number(submission.levelIndex) || 0] || {};
    const answer = String(submission.content || '').trim();
    if (!answer) return res.status(400).json({ error: 'La copie de cet élève est vide.' });

    if (provider === 'gemini') {
        const result = await HomeworkAI.analyze(answer, level.instruction || homework.title || '', level.aiHints || '');
        if (!result || result === 'ERROR_KEY') return res.status(502).json({ error: 'Gemini n’a pas pu corriger cette copie.' });
        return res.json({ provider, result });
    }

    const studentId = String(submission.studentId || '');
    const assignment = (homework.didakbotAssignments || []).find((item) => String(item.studentId) === studentId);
    const bot = (homework.didakbotClassBots || []).find((item) => Number(item.chatbotId) === Number(assignment?.chatbotId))
        || (homework.didakbotClassBots || [])[0];
    const rawUrlValue = String(bot?.url || homework.didakbotUrl || '');
    const rawUrl = rawUrlValue.match(/src=["']([^"']+)/i)?.[1] || rawUrlValue;
    let shareLink = String(bot?.shareLink || '').trim();
    if (!shareLink && rawUrl) {
        try { shareLink = new URL(rawUrl, 'https://novapeda.eu').searchParams.get('bot') || ''; }
        catch (_) { shareLink = ''; }
    }
    if (!shareLink) return res.status(400).json({ error: 'Aucun chatbot Didak’bot n’est associé à ce devoir.' });

    const systemPrompt = [
        'Tu es un correcteur pédagogique pour un devoir scolaire.',
        'Évalue le travail en respectant précisément la consigne et les critères du professeur.',
        'Donne un retour structuré, avec les réussites, les points à améliorer et une appréciation ou note si les critères le permettent.',
        'Ne réécris pas le devoir à la place de l’élève.',
        `Devoir : ${homework.title || ''}`,
        `Consigne : ${level.instruction || homework.promptTopic || homework.title || ''}`,
        `Critères du professeur : ${level.aiHints || 'Aucun critère complémentaire fourni.'}`
    ].join('\n\n');
    const response = await fetch(`https://novapeda.eu/didakbot3.php?bot=${encodeURIComponent(shareLink)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({
            action: 'chat_completion',
            model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
            system_prompt: systemPrompt,
            messages: JSON.stringify([{ role: 'user', content: answer }]),
            user_message: answer
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success !== true || !data?.response) {
        return res.status(502).json({ error: data?.error || 'Didak’bot n’a pas renvoyé de correction.' });
    }
    return res.json({ provider, result: data.response });
}));

router.put('/submission/:id', asyncHandler(async (req, res) => {
    const updated = await HomeworkDB.updateSubmission(req.params.id, req.body);
    res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Homework').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// V2: UPLOAD DRIVE CONNECTED
router.post('/upload', upload.array('files'), asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Fichier manquant" });
    
    const urls = [];
    try {
        // Dossier spécifique pour les assets de devoirs
        const homeworksFolderId = await DriveEngine.getOrCreateFolder("CONDA_HOMEWORK_ASSETS");
        
        for (const file of req.files) {
            // Upload vers Drive
            const driveFile = await DriveEngine.uploadFile(file.originalname, file.path, homeworksFolderId);
            
            // On génère l'URL Proxy pour l'affichage frontend
            const proxyUrl = `/api/structure/proxy/${driveFile.id}`;
            urls.push(proxyUrl);
            
            // Nettoyage immédiat du fichier local
            try { fs.unlinkSync(file.path); } catch(e) { console.error("Cleanup error:", e); }
        }
        res.json({ urls });
    } catch (e) {
        console.error("Drive Upload Error:", e);
        res.status(500).json({ error: "Erreur lors de l'envoi vers le Drive." });
    }
}));

router.post('/analyze-homework', (req, res) => HomeworkDB.processSubmission(req.body, HomeworkAI).then(r => res.json(r)));

module.exports = router;
