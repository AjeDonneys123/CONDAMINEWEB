const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getSuffix = () => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-26`;
};

// --- SUPPRESSION SESSION (DEVOIR COMPLET) ---
router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const ScanSession = mongoose.model('ScanSession');
        const session = await ScanSession.findById(req.params.id);
        
        if (session && session.driveFolderId) {
            // On tente la suppression Drive mais on n'attend pas de succès critique
            await DriveService.deleteFile(session.driveFolderId);
        }
        
        // Suppression BDD systématique
        await ScanSession.findByIdAndDelete(req.params.id);
        console.log(`✅ [BDD] Session ${req.params.id} supprimée.`);
        res.json({ ok: true });
    } catch (e) {
        console.error("❌ Erreur suppression session:", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// --- SUPPRESSION PHOTO INDIVIDUELLE ---
router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        // Extraction ID Drive
        const idMatch = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/);
        if (idMatch) {
            await DriveService.deleteFile(idMatch[1]);
        }

        const field = type === 'quest' ? { questionUrls: url } : { copyUrls: url };
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(
            sessionId, { $pull: field }, { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- LISTE ---
router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch(e) { res.json([]); }
});

// --- CRÉATION ---
router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const dateStr = getSuffix();
        const finalTitle = title ? `${title.trim()}_${dateStr}` : dateStr;
        const root = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
        const rootId = await DriveService.getOrCreateFolder(root);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        const newSession = await mongoose.model('ScanSession').create({ 
            title: finalTitle, classroom, driveFolderId: hwId 
        });
        res.json(newSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RENOMMAGE ---
router.patch('/scan-sessions/:id/rename', async (req, res) => {
    try {
        const { newPrefix } = req.body;
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const suffix = session.title.split('_').pop();
        const newTitle = newPrefix ? `${newPrefix}_${suffix}` : suffix;
        if (session.driveFolderId) await DriveService.renameFolder(session.driveFolderId, newTitle);
        session.title = newTitle; await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- UPLOAD ---
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

// --- CONSIGNES IA ---
router.patch('/scan-sessions/:id/instructions', async (req, res) => {
    try {
        await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { 
            teacherInstruction: req.body.text 
        });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// --- VOIR PRODUCTIONS ÉLÈVE ---
router.get('/player-productions/:playerId', async (req, res) => {
    try {
        const player = await mongoose.model('Player').findById(req.params.playerId);
        const root = (player.classroom === '1D' || player.classroom === '1BFI') ? '1BFI' : player.classroom;
        const rootId = await DriveService.getOrCreateFolder(root);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const stdId = await DriveService.getOrCreateFolder(`${player.firstName} ${player.lastName}`, prodId);
        const files = await DriveService.listFilesInFolder(stdId);
        res.json(files);
    } catch (e) { res.status(500).json([]); }
});

module.exports = router;