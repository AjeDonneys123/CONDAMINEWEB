const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');

// HELPER : Racine de la classe -> Devoirs et Élèves
const getClassBasePaths = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
    const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
    
    // NOMS CLAIRS VALIDÉS
    const devoirsId = await DriveService.getOrCreateFolder("Devoirs", classId);
    const elevesId = await DriveService.getOrCreateFolder("Élèves", classId);
    
    return { devoirsId, elevesId };
};

// --- ROUTES CHAPITRES ---

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await getChapter().find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const Chapter = getChapter();

        if (_id) {
            const existing = await Chapter.findById(_id);
            if (existing.driveFolderId && title && title !== existing.title) {
                DriveService.renameFolder(existing.driveFolderId, title).catch(() => {});
            }
            const updated = await Chapter.findByIdAndUpdate(_id, req.body, { new: true });
            return res.json(updated);
        }

        // Migration : Utilisation du dossier "Devoirs"
        const paths = await getClassBasePaths(classroom);
        const subjectFolderId = await DriveService.getOrCreateFolder(subject.toUpperCase(), paths.devoirsId);
        const chapterDriveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", subjectFolderId);
        
        res.json(await Chapter.create({ 
            ...req.body, 
            driveFolderId: chapterDriveId,
            isArchived: false 
        }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ROUTES ÉLÈVES (PORTFOLIOS DRIVE) ---

router.get('/player-productions/:playerId', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const student = await Player.findById(req.params.playerId);
        if (!student) return res.status(404).json({ error: "Élève non trouvé" });

        const paths = await getClassBasePaths(student.classroom);
        // On crée/récupère le dossier au nom de l'élève dans "Élèves"
        const studentFolderName = `${student.firstName} ${student.lastName}`.toUpperCase();
        const studentFolderId = await DriveService.getOrCreateFolder(studentFolderName, paths.elevesId);

        const files = await DriveService.listFiles(studentFolderId);
        res.json(files);
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
        const session = await getScanSession().create(req.body);
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;