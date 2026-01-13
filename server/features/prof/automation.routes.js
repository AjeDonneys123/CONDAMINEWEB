const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await getChapter().find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await getScanSession().find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { title, classroom } = req.body;
        
        // Création simplifiée des dossiers (si Drive échoue, on continue en BDD)
        let sessionDriveId, subjectId, copiesId, correctionsId;
        try {
            const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
            const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
            const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
            const prodRootId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
            
            sessionDriveId = await DriveService.getOrCreateFolder(title, prodRootId);
            subjectId = await DriveService.getOrCreateFolder("Sujet", sessionDriveId);
            copiesId = await DriveService.getOrCreateFolder("Copies", sessionDriveId);
            correctionsId = await DriveService.getOrCreateFolder("Corrections", sessionDriveId);
        } catch (errDrive) {
            console.warn("⚠️ Drive Error lors de la création session");
        }

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
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScanSession().findById(sessionId);
        if (!session) return res.status(404).json({error: "Session morte"});

        // Protection contre données polluées (si les dossiers Drive n'existent pas encore)
        let targetFolder = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        if (!targetFolder) {
            targetFolder = await DriveService.getOrCreateFolder(type === 'subject' ? "Sujet" : "Copies", session.driveFolderId);
            await getScanSession().findByIdAndUpdate(sessionId, { [type === 'subject' ? 'subjectFolderId' : 'copiesFolderId']: targetFolder });
        }

        const driveFile = await DriveService.uploadImage(targetFolder, `${type}_${Date.now()}.jpg`, imageBase64);
        
        if (driveFile) {
            const updateField = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(
                sessionId, { $push: { [updateField]: driveFile.id } }, { new: true }
            );
            res.json(updated);
        } else {
            res.status(500).json({error: "Echec Drive Upload"});
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const updated = await getScanSession().findByIdAndUpdate(req.params.id, { chapterId: req.body.chapterId }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId);
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;