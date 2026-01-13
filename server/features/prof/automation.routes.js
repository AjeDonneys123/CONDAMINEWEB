const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');

// HELPER : Racine de la classe -> Devoirs et Élèves (LOCKED Story #10)
const getClassBasePaths = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
    const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
    const devoirsId = await DriveService.getOrCreateFolder("Devoirs", classId);
    const elevesId = await DriveService.getOrCreateFolder("Élèves", classId);
    return { devoirsId, elevesId };
};

// HELPER : Auto-Réparation de la structure d'une session (LOCKED Story #2)
const ensureSessionFolders = async (session) => {
    let rootId = session.driveFolderId;
    
    // 1. Si pas de racine, on la crée dans "Devoirs"
    if (!rootId) {
        const paths = await getClassBasePaths(session.classroom);
        rootId = await DriveService.getOrCreateFolder(session.title || "Sans Titre", paths.devoirsId);
    }

    // 2. Création/Vérification des 3 sous-dossiers
    const subjectId = await DriveService.getOrCreateFolder("Sujet", rootId);
    const copiesId = await DriveService.getOrCreateFolder("Copies", rootId);
    const correctionsId = await DriveService.getOrCreateFolder("Corrections", rootId);

    // 3. Synchro BDD
    const updated = await getScanSession().findByIdAndUpdate(session._id, {
        driveFolderId: rootId,
        subjectFolderId: subjectId,
        copiesFolderId: copiesId,
        correctionsFolderId: correctionsId
    }, { new: true });

    return updated;
};

// --- ROUTES ---

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
        // Création immédiate de la structure Drive
        const finalSession = await ensureSessionFolders(session);
        res.json(finalSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scan-sessions/:id/files/:type', async (req, res) => {
    try {
        let session = await getScanSession().findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Session non trouvée" });

        const type = req.params.type;
        let folderId = (type === 'subject') ? session.subjectFolderId : (type === 'copies' ? session.copiesFolderId : session.correctionsFolderId);

        // Réparation si dossier Drive manquant (Story #2)
        if (!folderId) {
            session = await ensureSessionFolders(session);
            folderId = (type === 'subject') ? session.subjectFolderId : (type === 'copies' ? session.copiesFolderId : session.correctionsFolderId);
        }

        const files = await DriveService.listFiles(folderId);
        res.json(files);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTE : Upload Photo Scan (ULTRA-ROBUSTE)
router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        let session = await getScanSession().findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });

        let folderId = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        
        // AUTO-RÉPARATION : Si on tente d'uploader sans dossier configuré
        if (!folderId) {
            console.log("🔧 Auto-réparation des dossiers Drive avant upload...");
            session = await ensureSessionFolders(session);
            folderId = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        }

        const driveFile = await DriveService.uploadImage(folderId, `${type}_${Date.now()}.jpg`, imageBase64);
        
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } }, { new: true });
            res.json(updated);
        } else {
            res.status(500).json({ error: "Échec Drive Service" });
        }
    } catch (e) { 
        console.error("🔥 Crash upload:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId).catch(() => {});
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