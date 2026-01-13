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
        res.json(await getChapter().create({ ...body, isArchived: false }));
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

// ROUTE : Classer une production dans un dossier
router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const updated = await getScanSession().findByIdAndUpdate(
            req.params.id, 
            { chapterId: req.body.chapterId }, 
            { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTE : Upload Photo Instantane
router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScanSession().findById(sessionId);
        if(!session) return res.status(404).json({error:"Session introuvable"});

        const targetFolder = type === 'subject' ? (session.subjectFolderId || session.driveFolderId) : (session.copiesFolderId || session.driveFolderId);
        const driveFile = await DriveService.uploadImage(targetFolder, `${type}_${Date.now()}.jpg`, imageBase64);
        
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } }, { new: true });
            res.json(updated);
        } else {
            res.status(500).json({error:"Erreur Drive"});
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;