const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// On récupère les modèles de façon sûre
const Chapter = mongoose.model('Chapter');
const ScanSession = mongoose.model('ScanSession');

const getCondaPath = async (teacherName, classroom) => {
    try {
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teacherFolderId = await DriveService.getOrCreateFolder(teacherName, condaRootId);
        let classFolderName = classroom || "Sans_Classe";
        const classId = await DriveService.getOrCreateFolder(classFolderName, teacherFolderId);
        const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
        return { classId, worksId, prodId };
    } catch (e) {
        console.error("❌ Drive path failure:", e.message);
        return { classId: null, worksId: null, prodId: null };
    }
};

// --- ROUTES CHAPITRES (DOSSIERS) ---

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom } = req.body;
        const teacherName = "Jean Vuillet"; 

        if (_id) {
            const chap = await Chapter.findById(_id);
            if (!chap) return res.status(404).json({ error: "Introuvable" });

            if (chap.driveFolderId && title && title !== chap.title) {
                await DriveService.renameFolder(chap.driveFolderId, title);
            }

            const updateData = { ...req.body };
            delete updateData._id; // Protege l'ID immuable
            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }

        const { worksId } = await getCondaPath(teacherName, classroom);
        const driveId = worksId ? await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId) : null;
        
        const newChap = await Chapter.create({ ...req.body, driveFolderId: driveId });
        res.json(newChap);
    } catch (e) { 
        console.error("❌ Erreur POST /chapters:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.get('/chapters-all', async (req, res) => {
    try { 
        console.log("🔍 Fetching all chapters...");
        const list = await Chapter.find({}).sort({ _id: -1 });
        res.json(list || []); 
    } catch (e) { 
        console.error("❌ Erreur GET /chapters-all:", e.message);
        res.status(500).json([]); 
    }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await Chapter.findById(req.params.id);
        if (chap && chap.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SCAN SESSIONS ---

router.get('/scan-sessions', async (req, res) => {
    try { 
        const sessions = await ScanSession.find({}).sort({ createdAt: -1 });
        res.json(sessions || []); 
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const session = await ScanSession.create(req.body);
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;