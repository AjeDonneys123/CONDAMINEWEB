const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');
const fetch = require('node-fetch');

const getSuffix = () => {
    const now = new Date();
    const jj = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${jj}-${mm}-26`;
};

// --- ROUTE AUTO-REPAIR (COMMANDE SECRÈTE D'AUTO-GUÉRISON) ---
router.post('/auto-repair', async (req, res) => {
    try {
        const { error, stack, context } = req.body;
        console.log(`🧠 [IA DEBUG] Signal d'erreur reçu du site distant...`);

        // Formatage spécial pour ne pas tromper apply.js en local
        const tagStart = "[[[" + " FILE:";
        const tagEnd = " ]]]";

        const prompt = `
            ALERTE ERREUR SYSTÈME SUR CONDAMINE :
            Message : "${error}"
            Stack : "${stack}"
            Contexte : ${context}

            MISSION : 
            1. Analyse la cause de l'erreur.
            2. Génère le correctif complet du fichier concerné.
            3. Réponds uniquement avec le bloc de code au format ${tagStart} chemin ${tagEnd}.
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const aiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }).then(r => r.json());

        const fix = aiRes.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (fix && fix.includes("FILE:")) {
            const fs = require('fs');
            const path = require('path');
            // On injecte le fix dans update.txt pour que apply.js s'en occupe en local
            fs.appendFileSync(path.join(process.cwd(), 'update.txt'), `\n\n${fix}\n`);
            console.log("✅ [IA DEBUG] Pansement injecté automatiquement dans update.txt !");
        }

        res.json({ ok: true, status: "Analyse terminée" });
    } catch (e) {
        res.status(500).json({ ok: false });
    }
});

// --- ROUTES STANDARDS ---
router.get('/player-productions/:playerId', async (req, res) => {
    try {
        const player = await mongoose.model('Player').findById(req.params.playerId);
        const root = (player.classroom === '1D' || player.classroom === '1BFI') ? '1BFI' : player.classroom;
        const rootId = await DriveService.getOrCreateFolder(root);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const stdId = await DriveService.getOrCreateFolder(`${player.firstName} ${player.lastName}`, prodId);
        const files = await DriveService.listFilesInFolder(stdId);
        res.json(files || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        const idMatch = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/);
        if (idMatch) await DriveService.deleteFile(idMatch[1]).catch(() => {});
        const field = type === 'quest' ? { questionUrls: url } : { copyUrls: url };
        await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, { $pull: field });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (result) {
            const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
            const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        res.status(500).json({ error: "Echec Drive" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scan-sessions', async (req, res) => {
    const data = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
    res.json(data);
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const finalTitle = title ? `${title}_${getSuffix()}` : getSuffix();
        const rootId = await DriveService.getOrCreateFolder(classroom === '1D' ? '1BFI' : classroom);
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
    if (session.driveFolderId) await DriveService.renameFolder(session.driveFolderId, newTitle);
    session.title = newTitle; await session.save();
    res.json(session);
});

router.delete('/scan-sessions/:id', async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId);
    await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

router.patch('/scan-sessions/:id/instructions', async (req, res) => {
    await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { teacherInstruction: req.body.text });
    res.json({ ok: true });
});

module.exports = router;