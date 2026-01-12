const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const Chapter = mongoose.model('Chapter');
const ScanSession = mongoose.model('ScanSession');

// Helper Arborescence Drive
const getCondaPath = async (teacherName, classroom) => {
    try {
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const profId = await DriveService.getOrCreateFolder(teacherName, condaRootId);
        const classId = await DriveService.getOrCreateFolder(classroom || "Sans_Classe", profId);
        const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
        return { worksId, prodId };
    } catch (e) {
        console.error("❌ Drive Error:", e.message);
        return { worksId: null, prodId: null };
    }
};

// --- ROUTES CHAPITRES ---

router.get('/chapters-all', async (req, res) => {
    try {
        const list = await Chapter.find({}).sort({ _id: -1 });
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        if (_id) {
            const updateData = { ...req.body };
            delete updateData._id;
            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }
        // Création physique sur Drive
        const { worksId } = await getCondaPath("Jean Vuillet", classroom);
        const driveId = worksId ? await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId) : null;
        const newChap = await Chapter.create({ ...req.body, driveFolderId: driveId });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await Chapter.findById(req.params.id);
        if (chap && chap.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ROUTES SCAN SESSIONS (LES ROUTES MANQUANTES) ---

router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await ScanSession.find({}).sort({ createdAt: -1 });
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const session = await ScanSession.create(req.body);
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/rename', async (req, res) => {
    try {
        const session = await ScanSession.findById(req.params.id);
        const datePart = session.title.includes('_') ? session.title.split('_').pop() : new Date().toLocaleDateString();
        session.title = req.body.newPrefix + "_" + datePart;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await ScanSession.findById(sessionId);
        if (!session.driveFolderId) {
            const { prodId } = await getCondaPath("Jean Vuillet", session.classroom);
            session.driveFolderId = await DriveService.getOrCreateFolder(session.title || "Session", prodId);
            await session.save();
        }
        const result = await DriveService.uploadImage(session.driveFolderId, type + "_" + Date.now() + ".jpg", imageBase64);
        if (result) {
            const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
            const updated = await ScanSession.findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        throw new Error("Upload Drive échoué");
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        await DriveService.deleteFile(url);
        const field = type === 'quest' ? { $pull: { questionUrls: url } } : { $pull: { copyUrls: url } };
        await ScanSession.findByIdAndUpdate(sessionId, field);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
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