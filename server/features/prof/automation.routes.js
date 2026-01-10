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

// --- NOUVEAU MODE : SUGGESTION DE RÉPARATION ---
router.post('/auto-repair', async (req, res) => {
    try {
        const { error, stack, context } = req.body;
        console.log(`🔍 [IA ADVISOR] Analyse d'une erreur pour suggestion...`);

        const prompt = `
            ERREUR DÉTECTÉE SUR LE SITE :
            Message : "${error}"
            Stack : "${stack}"
            Contexte : ${context}

            MISSION : 
            1. Explique simplement la cause.
            2. Donne le bloc de code correctif.
            Réponds de façon concise.
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const aiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }).then(r => r.json());

        const suggestion = aiRes.candidates?.[0]?.content?.parts?.[0]?.text || "Aucune suggestion trouvée.";
        
        // On renvoie juste la réponse à la console du navigateur
        res.json({ ok: true, suggestion });
    } catch (e) {
        res.status(500).json({ ok: false });
    }
});

// --- RESTAURATION DE TOUTES LES ROUTES (FIX 404) ---

router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch(e) { res.json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const finalTitle = title ? `${title.trim()}_${getSuffix()}` : getSuffix();
        const rootId = await DriveService.getOrCreateFolder(classroom === '1D' ? '1BFI' : classroom);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        const newSession = await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId });
        res.json(newSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/rename', async (req, res) => {
    try {
        const { newPrefix } = req.body;
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const parts = session.title.split('_');
        const suffix = parts[parts.length - 1];
        const newTitle = newPrefix ? `${newPrefix.trim()}_${suffix}` : suffix;
        if (session.driveFolderId) await DriveService.renameFolder(session.driveFolderId, newTitle);
        session.title = newTitle; await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId);
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (result && result.id) {
            const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
            const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        res.status(500).json({ error: "Echec Drive" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        const idMatch = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/);
        if (idMatch) await DriveService.deleteFile(idMatch[1]).catch(() => {});
        const field = type === 'quest' ? { questionUrls: url } : { copyUrls: url };
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, { $pull: field }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/instructions', async (req, res) => {
    await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { teacherInstruction: req.body.text });
    res.json({ ok: true });
});

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

module.exports = router;