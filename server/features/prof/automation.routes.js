const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Sécurité : On récupère les modèles explicitement
const getModels = () => ({
    Chapter: mongoose.model('Chapter'),
    ScanSession: mongoose.model('ScanSession')
});

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
        console.error("❌ Drive Path Error:", e.message);
        return { classId: null, worksId: null, prodId: null };
    }
};

// --- ROUTES CHAPITRES ---

router.post('/chapters', async (req, res) => {
    try {
        const { Chapter } = getModels();
        const { _id, title, classroom } = req.body;
        const teacherName = "Jean Vuillet"; 

        if (_id) {
            const chap = await Chapter.findById(_id);
            if (!chap) return res.status(404).json({ error: "Chapitre non trouvé" });

            // Update Drive si besoin
            if (chap.driveFolderId && title && title !== chap.title) {
                await DriveService.renameFolder(chap.driveFolderId, title);
            }

            const updateData = { ...req.body };
            delete updateData._id; 
            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }

        const { worksId } = await getCondaPath(teacherName, classroom);
        const driveId = worksId ? await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId) : null;
        
        const newChap = await Chapter.create({ ...req.body, driveFolderId: driveId });
        res.json(newChap);
    } catch (e) { 
        console.error("❌ Error /chapters:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.get('/chapters-all', async (req, res) => {
    try { 
        const { Chapter } = getModels();
        const list = await Chapter.find({}).sort({ _id: -1 });
        res.json(list || []); 
    } catch (e) { 
        console.error("❌ Error GET /chapters-all:", e.message);
        res.status(500).json([]); 
    }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const { Chapter } = getModels();
        const chap = await Chapter.findById(req.params.id);
        if (chap && chap.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SCAN SESSIONS ---

router.get('/scan-sessions', async (req, res) => {
    try { 
        const { ScanSession } = getModels();
        const sessions = await ScanSession.find({}).sort({ createdAt: -1 });
        res.json(sessions || []); 
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { ScanSession } = getModels();
        const session = await ScanSession.create(req.body);
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const { ScanSession, Chapter } = getModels();
        const session = await ScanSession.findById(req.params.id);
        const chapter = await Chapter.findById(req.body.chapterId);
        if (session.driveFolderId && chapter.driveFolderId) {
            await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
        }
        session.chapterId = req.body.chapterId;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;