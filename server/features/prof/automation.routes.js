const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');

// --- ROUTES CHAPITRES ---
router.get('/chapters-all', async (req, res) => {
    try {
        const data = await getChapter().find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, ...body } = req.body;
        if (_id) {
            const updated = await getChapter().findByIdAndUpdate(_id, body, { new: true });
            return res.json(updated);
        }
        const newChap = await getChapter().create({ ...body, isArchived: false });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        await getChapter().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ROUTES SCANS ---
router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await getScanSession().find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { title, classroom } = req.body;
        const session = await getScanSession().create({ title, classroom });
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTE EXPLORATION DRIVE (SUJETS, COPIES, CORRECTIONS)
router.get('/scan-sessions/:id/files/:type', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Session introuvable" });

        const type = req.params.type;
        let folderId = (type === 'subject') ? session.subjectFolderId : (type === 'copies' ? session.copiesFolderId : session.correctionsFolderId);

        // Auto-réparation intelligente des dossiers Drive
        if (!folderId) {
            const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
            const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
            const classId = await DriveService.getOrCreateFolder(session.classroom, teacherId);
            const prodRootId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
            const rootId = await DriveService.getOrCreateFolder(session.title || "Sans Titre", prodRootId);
            
            const subName = (type === 'subject') ? "Sujet" : (type === 'copies' ? "Copies" : "Corrections");
            folderId = await DriveService.getOrCreateFolder(subName, rootId);

            await getScanSession().findByIdAndUpdate(req.params.id, { 
                driveFolderId: rootId,
                [type === 'subject' ? 'subjectFolderId' : (type === 'copies' ? 'copiesFolderId' : 'correctionsFolderId')]: folderId 
            });
        }

        const files = await DriveService.listFiles(folderId);
        res.json(files);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScanSession().findById(sessionId);
        const folderId = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        const driveFile = await DriveService.uploadImage(folderId || session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } }, { new: true });
            res.json(updated);
        } else { res.status(500).send("Erreur upload"); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;