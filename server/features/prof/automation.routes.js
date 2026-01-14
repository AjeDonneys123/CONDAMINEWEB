const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');
const getPlayer = () => mongoose.model('Player');
const getTeacher = () => mongoose.model('Teacher');

const normalizeFolderName = (name) => {
    return name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").trim();
};

const getClassBasePaths = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
    const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
    const devoirsId = await DriveService.getOrCreateFolder("Devoirs", classId);
    const elevesId = await DriveService.getOrCreateFolder("Élèves", classId);
    return { devoirsId, elevesId };
};

// --- ROUTE DE SYNCHRO STRICTE (US #12) ---
router.get('/init-all-folders', async (req, res) => {
    try {
        const teacher = await getTeacher().findOne({ firstName: "Jean" });
        const validSubjects = (teacher?.subjectSections || []).map(s => s.name);
        const validSubjectsNorm = validSubjects.map(s => normalizeFolderName(s));

        const players = await getPlayer().find({});
        const classes = [...new Set(players.map(p => p.classroom))].filter(Boolean);

        for (const cls of classes) {
            const paths = await getClassBasePaths(cls);
            
            // 1. Aligner les Chapitres
            const chapters = await getChapter().find({ classroom: cls });
            for (const chap of chapters) {
                const subNorm = normalizeFolderName(chap.subject || "AUTRE");
                const subFolderId = await DriveService.getOrCreateFolder(subNorm, paths.devoirsId);
                const chapFolderId = await DriveService.getOrCreateFolder(chap.title || "Sans Titre", subFolderId);
                await getChapter().findByIdAndUpdate(chap._id, { driveFolderId: chapFolderId });
            }

            // 2. Nettoyer les parasites (Dossiers Drive non présents dans Archives)
            const driveFolders = await DriveService.listFiles(paths.devoirsId);
            for (const folder of driveFolders) {
                if (folder.mimeType === 'application/vnd.google-apps.folder') {
                    if (!validSubjectsNorm.includes(normalizeFolderName(folder.name))) {
                        // On ne supprime que si vide pour sécurité
                        const content = await DriveService.listFiles(folder.id);
                        if (content.length === 0) await DriveService.deleteFile(folder.id);
                    }
                }
            }
        }
        res.json({ ok: true, message: "Drive synchronisé avec les Archives." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await getChapter().find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const updated = await getChapter().findByIdAndUpdate(_id, req.body, { new: true });
            return res.json(updated);
        }
        const paths = await getClassBasePaths(classroom);
        const subFolderId = await DriveService.getOrCreateFolder(normalizeFolderName(subject), paths.devoirsId);
        const driveId = await DriveService.getOrCreateFolder(title, subFolderId);
        res.json(await getChapter().create({ ...req.body, driveFolderId: driveId, isArchived: false }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await getScanSession().find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScanSession().findById(sessionId);
        const targetFolder = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        const driveFile = await DriveService.uploadImage(targetFolder || session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } }, { new: true });
            res.json(updated);
        } else { res.status(500).json({error: "Drive Fail"}); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;