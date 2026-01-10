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

// --- CRÉATION SESSION (PRODUCTION) ---
router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const finalTitle = title ? `${title.trim()}_${getSuffix()}` : getSuffix();
        
        // Normalisation pour le Drive (1BFI ou 1D -> 1BFI)
        const rootName = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
        
        const rootId = await DriveService.getOrCreateFolder(rootName);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);

        const newSession = await mongoose.model('ScanSession').create({ 
            title: finalTitle, 
            classroom: classroom, // On garde le nom de classe original de l'interface
            driveFolderId: hwId 
        });
        
        console.log(`✅ [PRODUCTION] Créée : ${finalTitle} pour ${classroom}`);
        res.json(newSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- LISTE DES SESSIONS ---
router.get('/scan-sessions', async (req, res) => {
    try {
        const ScanSession = mongoose.model('ScanSession');
        const data = await ScanSession.find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch(e) { res.json([]); }
});

// --- RENOMMAGE ---
router.patch('/scan-sessions/:id/rename', async (req, res) => {
    try {
        const { newPrefix } = req.body;
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const parts = session.title.split('_');
        const suffix = parts[parts.length - 1];
        const newTitle = newPrefix ? `${newPrefix.trim()}_${suffix}` : suffix;
        
        if (session.driveFolderId) await DriveService.renameFolder(session.driveFolderId, newTitle);
        session.title = newTitle;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ASSIGNATION À UN DOSSIER ---
router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(
            req.params.id, 
            { chapterId: req.body.chapterId }, 
            { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUPPRESSION SESSION ---
router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId).catch(() => {});
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// --- UPLOAD / DELETE PHOTO ---
router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        const upload = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (upload) {
            const field = type === 'quest' ? { $push: { questionUrls: upload.id } } : { $push: { copyUrls: upload.id } };
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

// --- AUTO REPAIR & PRODUCTIONS ---
router.post('/auto-repair', async (req, res) => {
    try {
        const { error, stack, context } = req.body;
        const prompt = `ERREUR SUR CONDAMINE : "${error}". Stack : "${stack}". Mission : Explique la cause et donne le code correctif.`;
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const aiRes = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }).then(r => r.json());
        res.json({ ok: true, suggestion: aiRes.candidates?.[0]?.content?.parts?.[0]?.text });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.get('/player-productions/:playerId', async (req, res) => {
    try {
        const player = await mongoose.model('Player').findById(req.params.playerId);
        const rootName = (player.classroom === '1D' || player.classroom === '1BFI') ? '1BFI' : player.classroom;
        const rootId = await DriveService.getOrCreateFolder(rootName);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const stdId = await DriveService.getOrCreateFolder(`${player.firstName} ${player.lastName}`, prodId);
        res.json(await DriveService.listFilesInFolder(stdId));
    } catch (e) { res.status(500).json([]); }
});

module.exports = router;