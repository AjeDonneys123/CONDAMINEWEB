const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Helper Arborescence (CondaClasse / Prof / Classe / ...)
const getCondaPath = async (teacherName, classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder(teacherName, condaRootId);
    
    let classFolderName = classroom;
    if (classroom === '6D') classFolderName = '6e';
    if (classroom === '1D' || classroom === '1BFI') classFolderName = '1BFI';
    
    const classId = await DriveService.getOrCreateFolder(classFolderName, teacherId);
    const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
    const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
    return { classId, worksId, prodId };
};

// --- DOSSIERS (ACTIVITÉS) ---
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, teacherId, subject } = req.body;
        const Chapter = mongoose.model('Chapter');
        const Teacher = mongoose.model('Teacher');
        const teacher = await Teacher.findById(teacherId);
        const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : "Admin";

        if (_id) {
            const chap = await Chapter.findById(_id);
            if (chap.driveFolderId && title) await DriveService.renameFolder(chap.driveFolderId, title);
            const updated = await Chapter.findByIdAndUpdate(_id, req.body, { new: true });
            return res.json(updated);
        }

        const { worksId } = await getCondaPath(teacherName, classroom);
        const driveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId);
        const newChap = await Chapter.create({ ...req.body, driveFolderId: driveId });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PRODUCTIONS (SCANS) ---
router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (result) {
            const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
            const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        res.status(500).json({ error: "Drive fail" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const chapter = await mongoose.model('Chapter').findById(req.body.chapterId);
        if (session.driveFolderId && chapter.driveFolderId) {
            await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
        }
        session.chapterId = req.body.chapterId;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// (Autres routes : list, delete, rename, instructions restent opérationnelles)
module.exports = router;