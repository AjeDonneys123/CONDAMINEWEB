const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');

// Helper pour garantir la structure d'une session sur Drive
const ensureFolders = async (session) => {
    let rootId = session.driveFolderId;
    // 1. Création racine si absente
    if (!rootId) {
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
        const classId = await DriveService.getOrCreateFolder(session.classroom, teacherId);
        const prodRootId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
        rootId = await DriveService.getOrCreateFolder(session.title || "Sans Titre", prodRootId);
    }

    // 2. Création/Récupération des 3 sous-dossiers
    const subjectId = await DriveService.getOrCreateFolder("Sujet", rootId);
    const copiesId = await DriveService.getOrCreateFolder("Copies", rootId);
    const correctionsId = await DriveService.getOrCreateFolder("Corrections", rootId);

    // 3. Mise à jour synchrone en BDD
    const updated = await mongoose.model('ScanSession').findByIdAndUpdate(session._id, {
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
        // On crée la structure Drive immédiatement
        const finalSession = await ensureFolders(session);
        res.json(finalSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROUTE EXPLORATEUR : Avec réparation automatique
router.get('/scan-sessions/:id/files/:type', async (req, res) => {
    try {
        let session = await getScanSession().findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Session introuvable" });

        const type = req.params.type;
        let folderId = (type === 'subject') ? session.subjectFolderId : (type === 'copies' ? session.copiesFolderId : session.correctionsFolderId);

        // Si ID manquant, on répare la session entière
        if (!folderId) {
            session = await ensureFolders(session);
            folderId = (type === 'subject') ? session.subjectFolderId : (type === 'copies' ? session.copiesFolderId : session.correctionsFolderId);
        }

        const files = await DriveService.listFiles(folderId);
        res.json(files);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        let session = await getScanSession().findById(sessionId);
        
        let folderId = (type === 'subject') ? session.subjectFolderId : session.copiesFolderId;
        
        // Sécurité : si on tente d'uploader mais que les dossiers n'existent pas
        if (!folderId) {
            session = await ensureFolders(session);
            folderId = (type === 'subject') ? session.subjectFolderId : session.copiesFolderId;
        }

        const driveFile = await DriveService.uploadImage(folderId, `${type}_${Date.now()}.jpg`, imageBase64);
        
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } });
            res.json({ ok: true });
        } else { res.status(500).send("Erreur Drive"); }
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

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const updated = await getScanSession().findByIdAndUpdate(req.params.id, { chapterId: req.body.chapterId }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;