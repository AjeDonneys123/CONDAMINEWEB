const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getChapter = () => mongoose.model('Chapter');
const getScanSession = () => mongoose.model('ScanSession');

// Helper : Normalisation des noms pour Drive (US #11)
const normalizeFolderName = (name) => {
    return name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").trim();
};

// Helper : Chemins de base (US #10)
const getClassBasePaths = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
    const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
    const devoirsId = await DriveService.getOrCreateFolder("Devoirs", classId);
    const elevesId = await DriveService.getOrCreateFolder("Élèves", classId);
    return { devoirsId, elevesId };
};

// --- ROUTES CHAPITRES (US #2, #7, #8) ---

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await getChapter().find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        const Chapter = getChapter();

        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            // US #7 : Renommage fluide
            const existing = await Chapter.findById(_id);
            if (existing && existing.driveFolderId && title && title !== existing.title) {
                DriveService.renameFolder(existing.driveFolderId, title).catch(() => {});
            }
            const updated = await Chapter.findByIdAndUpdate(_id, req.body, { new: true });
            return res.json(updated);
        }

        // CRÉATION (US #2)
        const paths = await getClassBasePaths(classroom);
        const subNorm = normalizeFolderName(subject);
        const subFolderId = await DriveService.getOrCreateFolder(subNorm, paths.devoirsId);
        const driveId = await DriveService.getOrCreateFolder(title, subFolderId);
        
        const newChap = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await getChapter().findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteFile(chap.driveFolderId).catch(() => {});
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
        const paths = await getClassBasePaths(classroom);
        const driveId = await DriveService.getOrCreateFolder(title, paths.devoirsId);
        
        // Sous-structure auto-gérée (US #2)
        const subjectId = await DriveService.getOrCreateFolder("Sujet", driveId);
        const copiesId = await DriveService.getOrCreateFolder("Copies", driveId);
        const correctionsId = await DriveService.getOrCreateFolder("Corrections", driveId);

        const updated = await getScanSession().findByIdAndUpdate(session._id, {
            driveFolderId: driveId, subjectFolderId: subjectId, copiesFolderId: copiesId, correctionsFolderId: correctionsId
        }, { new: true });

        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;