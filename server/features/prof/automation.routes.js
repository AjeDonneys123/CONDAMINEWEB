const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');

const getClassBasePaths = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
    const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
    const devoirsId = await DriveService.getOrCreateFolder("Devoirs", classId);
    const elevesId = await DriveService.getOrCreateFolder("Élèves", classId);
    return { devoirsId, elevesId };
};

const ensureSessionFolders = async (session) => {
    let rootId = session.driveFolderId;
    if (!rootId) {
        const paths = await getClassBasePaths(session.classroom);
        rootId = await DriveService.getOrCreateFolder(session.title || "Sans Titre", paths.devoirsId);
    }
    const subjectId = await DriveService.getOrCreateFolder("Sujet", rootId);
    const copiesId = await DriveService.getOrCreateFolder("Copies", rootId);
    const correctionsId = await DriveService.getOrCreateFolder("Corrections", rootId);
    const updated = await getScanSession().findByIdAndUpdate(session._id, {
        driveFolderId: rootId,
        subjectFolderId: subjectId,
        copiesFolderId: copiesId,
        correctionsFolderId: correctionsId
    }, { new: true });
    return updated;
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
        const { _id, title, classroom, subject } = req.body;
        const Chapter = getChapter();
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const existing = await Chapter.findById(_id);
            if (existing && existing.driveFolderId && title && title !== existing.title) {
                await DriveService.renameFolder(existing.driveFolderId, title);
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

// US #10 : Suppression dossier + Drive
router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await getChapter().findById(req.params.id);
        if (chap && chap.driveFolderId) {
            console.log(`🗑️ US#10: Deleting Chapter Folder from Drive: ${chap.title}`);
            await DriveService.deleteFile(chap.driveFolderId);
        }
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
        const session = await getScanSession().create(req.body);
        const finalSession = await ensureSessionFolders(session);
        res.json(finalSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #10 : Suppression Production + Drive
router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        if (session && session.driveFolderId) {
            console.log(`🗑️ US#10: Deleting Scan Folder from Drive: ${session.title}`);
            await DriveService.deleteFile(session.driveFolderId);
        }
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
            folderId = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        }
        const driveFile = await DriveService.uploadImage(folderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } });
            res.json({ ok: true });
        } else { res.status(500).send("Erreur Drive"); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const { chapterId } = req.body;
        const session = await getScanSession().findById(req.params.id);
        const chapter = await getChapter().findById(chapterId);
        if (session && chapter && session.driveFolderId && chapter.driveFolderId) {
            await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
        }
        const updated = await getScanSession().findByIdAndUpdate(req.params.id, { chapterId }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;