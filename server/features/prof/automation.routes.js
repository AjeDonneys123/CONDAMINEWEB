const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');

// Helper pour trouver le dossier "PRODUCTIONS" d'une classe
const getProductionsPath = async (classroom) => {
    try {
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
        const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
        return await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
    } catch (e) { return null; }
};

router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = getChapter();
        const data = await Chapter.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await getScanSession().find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { title, classroom } = req.body;
        const prodRootId = await getProductionsPath(classroom);
        
        // 1. Dossier Racine Session
        const sessionDriveId = await DriveService.getOrCreateFolder(title, prodRootId);
        
        // 2. Sous-dossiers structurels
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

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; // type: 'subject' ou 'copy'
        const session = await getScanSession().findById(sessionId);
        if (!session) return res.status(404).send("Session non trouvée");

        const targetFolder = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        const fileName = `${type}_${Date.now()}.jpg`;

        const driveFile = await DriveService.uploadImage(targetFolder, fileName, imageBase64);
        
        if (driveFile) {
            const updateField = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(
                sessionId, 
                { $push: { [updateField]: driveFile.id } }, 
                { new: true }
            );
            res.json(updated);
        } else {
            res.status(500).send("Erreur Drive");
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTE : Classer une production dans un dossier de cours
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

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        if (session && session.driveFolderId) await DriveService.deleteFile(session.driveFolderId);
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;