const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');
const getPlayer = () => mongoose.model('Player');

// HELPER : Racine de la classe -> Devoirs et Élèves
const getClassBasePaths = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
    const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
    const devoirsId = await DriveService.getOrCreateFolder("Devoirs", classId);
    const elevesId = await DriveService.getOrCreateFolder("Élèves", classId);
    return { devoirsId, elevesId };
};

// --- ROUTE DE RÉORGANISATION GLOBALE ---
router.get('/init-all-folders', async (req, res) => {
    try {
        const players = await getPlayer().find({});
        const classes = [...new Set(players.map(p => p.classroom))].filter(Boolean);

        for (const cls of classes) {
            const paths = await getClassBasePaths(cls);
            const chapters = await getChapter().find({ classroom: cls });
            for (const chap of chapters) {
                const subjectFolderId = await DriveService.getOrCreateFolder((chap.subject || "AUTRE").toUpperCase(), paths.devoirsId);
                const chapterFolderId = await DriveService.getOrCreateFolder(chap.title || "Sans Titre", subjectFolderId);
                await getChapter().findByIdAndUpdate(chap._id, { driveFolderId: chapterFolderId });
            }
            const classPlayers = players.filter(p => p.classroom === cls);
            for (const p of classPlayers) {
                const studentName = `${p.firstName} ${p.lastName}`.toUpperCase();
                await DriveService.getOrCreateFolder(studentName, paths.elevesId);
            }
        }
        res.json({ ok: true, message: "Drive synchronisé." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

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
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const updated = await getChapter().findByIdAndUpdate(_id, req.body, { new: true });
            return res.json(updated);
        }
        const paths = await getClassBasePaths(classroom);
        const subjectFolderId = await DriveService.getOrCreateFolder(subject.toUpperCase(), paths.devoirsId);
        const driveId = await DriveService.getOrCreateFolder(title, subjectFolderId);
        res.json(await getChapter().create({ ...req.body, driveFolderId: driveId, isArchived: false }));
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
        const sessionDriveId = await DriveService.getOrCreateFolder(title, paths.devoirsId);
        const subjectId = await DriveService.getOrCreateFolder("Sujet", sessionDriveId);
        const copiesId = await DriveService.getOrCreateFolder("Copies", sessionDriveId);
        const final = await getScanSession().findByIdAndUpdate(session._id, {
            driveFolderId: sessionDriveId, subjectFolderId: subjectId, copiesFolderId: copiesId
        }, { new: true });
        res.json(final);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scan-sessions/:id/files/:type', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        const folderId = (req.params.type === 'subject') ? session.subjectFolderId : session.copiesFolderId;
        const files = await DriveService.listFiles(folderId);
        res.json(files);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScanSession().findById(sessionId);
        const targetFolder = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        const driveFile = await DriveService.uploadImage(targetFolder, `${type}_${Date.now()}.jpg`, imageBase64);
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } }, { new: true });
            res.json(updated);
        } else { res.status(500).json({error: "Drive Fail"}); }
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
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;