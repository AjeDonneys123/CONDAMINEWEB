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
    const devoirsId = await DriveService.getOrCreateFolder("Devoirs", classId);
    const elevesId = await DriveService.getOrCreateFolder("Élèves", classId);
    return { devoirsId, elevesId };
};

// HELPER : Auto-Réparation / Création de la structure initiale d'un scan
const ensureSessionFolders = async (session) => {
    let rootId = session.driveFolderId;
    if (!rootId) {
        const paths = await getClassBasePaths(session.classroom);
        // Par défaut, un nouveau scan est créé à la racine de "Devoirs"
        rootId = await DriveService.getOrCreateFolder(session.title || "Sans Titre", paths.devoirsId);
    }
    const subjectId = await DriveService.getOrCreateFolder("Sujet", rootId);
    const copiesId = await DriveService.getOrCreateFolder("Copies", rootId);
    const correctionsId = await DriveService.getOrCreateFolder("Corrections", rootId);
    
    return await getScanSession().findByIdAndUpdate(session._id, {
        driveFolderId: rootId,
        subjectFolderId: subjectId,
        copiesFolderId: copiesId,
        correctionsFolderId: correctionsId
    }, { new: true });
};

// --- ROUTES SCANS ---

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const { chapterId } = req.body;
        const session = await getScanSession().findById(req.params.id);
        const chapter = await getChapter().findById(chapterId);

        if (!session || !chapter) return res.status(404).json({ error: "Session ou Dossier introuvable" });

        // US #9 : DÉPLACEMENT PHYSIQUE SUR DRIVE
        // On déplace le dossier racine du scan à l'intérieur du dossier du chapitre
        if (session.driveFolderId && chapter.driveFolderId) {
            console.log(`🚚 US#9: Déplacement Drive [${session.title}] -> Dossier [${chapter.title}]`);
            await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
        }

        const updated = await getScanSession().findByIdAndUpdate(req.params.id, { chapterId }, { new: true });
        res.json(updated);
    } catch (e) { 
        console.error("Erreur classement scan:", e.message);
        res.status(500).json({ error: e.message }); 
    }
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
        const finalSession = await ensureSessionFolders(session);
        res.json(finalSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId).catch(() => {});
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scan-sessions/:id/files/:type', async (req, res) => {
    try {
        let session = await getScanSession().findById(req.params.id);
        const type = req.params.type;
        let folderId = (type === 'subject') ? session.subjectFolderId : (type === 'copies' ? session.copiesFolderId : session.correctionsFolderId);
        if (!folderId) {
            session = await ensureSessionFolders(session);
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
        let folderId = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        if (!folderId) {
            session = await ensureSessionFolders(session);
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

module.exports = router;