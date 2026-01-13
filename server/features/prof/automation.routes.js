const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');

// HELPER : Racine de la classe -> Devoirs et Élèves (NOMENCLATURE VALIDÉE)
const getClassBasePaths = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
    const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
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

        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const existing = await Chapter.findById(_id);
            if (existing && existing.driveFolderId && title && title !== existing.title) {
                DriveService.renameFolder(existing.driveFolderId, title).catch(() => {});
            }
            const updated = await Chapter.findByIdAndUpdate(_id, req.body, { new: true });
            return res.json(updated);
        }

        const paths = await getClassBasePaths(classroom);
        const subjectFolderId = await DriveService.getOrCreateFolder(subject.toUpperCase(), paths.devoirsId);
        const chapterDriveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", subjectFolderId);
        
        const newChap = await Chapter.create({ ...req.body, driveFolderId: chapterDriveId, isArchived: false });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await getChapter().findById(req.params.id);
        if (chap?.driveFolderId) DriveService.deleteFile(chap.driveFolderId).catch(() => {});
        await getChapter().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ROUTES SCANS (SESSIONS) ---

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
        
        // Création structure Drive Sujet/Copies/Corrections
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
        const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
        const prodId = await DriveService.getOrCreateFolder("Devoirs", classId); // On range les scans dans Devoirs
        
        const sessionDriveId = await DriveService.getOrCreateFolder(title, prodId);
        const subjectId = await DriveService.getOrCreateFolder("Sujet", sessionDriveId);
        const copiesId = await DriveService.getOrCreateFolder("Copies", sessionDriveId);
        const correctionsId = await DriveService.getOrCreateFolder("Corrections", sessionDriveId);

        const finalSession = await getScanSession().findByIdAndUpdate(session._id, {
            driveFolderId: sessionDriveId,
            subjectFolderId: subjectId,
            copiesFolderId: copiesId,
            correctionsFolderId: correctionsId
        }, { new: true });

        res.json(finalSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTE : Lister les fichiers d'un dossier de scan (Sujet ou Copies)
router.get('/scan-sessions/:id/files/:type', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Session non trouvée" });

        const type = req.params.type;
        let folderId = (type === 'subject') ? session.subjectFolderId : (type === 'copies' ? session.copiesFolderId : session.correctionsFolderId);

        if (!folderId) return res.json([]); // Pas encore de dossier créé

        const files = await DriveService.listFiles(folderId);
        res.json(files);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTE : Upload Photo Scan (RESTAURÉE)
router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScanSession().findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });

        const targetFolder = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        const driveFile = await DriveService.uploadImage(targetFolder || session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } }, { new: true });
            res.json(updated);
        } else {
            res.status(500).json({ error: "Échec upload Drive" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        if (session?.driveFolderId) DriveService.deleteFile(session.driveFolderId).catch(() => {});
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const updated = await getScanSession().findByIdAndUpdate(req.params.id, { chapterId: req.body.chapterId }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;