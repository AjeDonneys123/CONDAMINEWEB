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
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
        const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
        const prodRootId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
        
        const sessionDriveId = await DriveService.getOrCreateFolder(title, prodRootId);
        const subjectId = await DriveService.getOrCreateFolder("Sujet", sessionDriveId);
        const copiesId = await DriveService.getOrCreateFolder("Copies", sessionDriveId);
        const correctionsId = await DriveService.getOrCreateFolder("Corrections", sessionDriveId);

        const session = await getScanSession().create({
            title,
            classroom,
            driveFolderId: sessionDriveId,
            subjectFolderId: subjectId,
            copiesFolderId: copiesId,
            correctionsFolderId: correctionsId
        });
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTE EXPLORATEUR DRIVE (INDISPENSABLE POUR LE BOUTON FILES)
router.get('/scan-sessions/:id/files/:type', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Introuvable" });

        const type = req.params.type;
        let folderId = (type === 'subject') ? session.subjectFolderId : (type === 'copies' ? session.copiesFolderId : session.correctionsFolderId);

        // Réparation si dossier non configuré
        if (!folderId && session.driveFolderId) {
            const subName = (type === 'subject') ? "Sujet" : (type === 'copies' ? "Copies" : "Corrections");
            folderId = await DriveService.getOrCreateFolder(subName, session.driveFolderId);
            await getScanSession().findByIdAndUpdate(req.params.id, { 
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
            await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } });
            res.json({ ok: true });
        } else { res.status(500).send("Erreur upload"); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;