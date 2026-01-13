const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getChapter = () => mongoose.model('Chapter');
const getScanSession = () => mongoose.model('ScanSession');

const getWorksPath = async (classroom) => {
    try {
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
        const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
        return await DriveService.getOrCreateFolder("1Travaux", classId);
    } catch (e) { return null; }
};

// --- ROUTES CHAPITRES (LOCKED LOGIC - Story #2 & #7) ---

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
            // MISE À JOUR : Renommage (User Story #7)
            const existing = await Chapter.findById(_id);
            if (!existing) return res.status(404).json({ error: "Dossier non trouvé" });

            // US #7 : Synchro Drive sécurisée
            if (existing.driveFolderId && title && title !== existing.title) {
                try {
                    await DriveService.renameFolder(existing.driveFolderId, title);
                } catch (driveErr) {
                    console.error("US#7 Drive Sync Fail (Non-blocking):", driveErr.message);
                }
            }
            
            // On retire l'ID du body pour ne pas tenter de le modifier dans Mongo
            const updateData = { ...req.body };
            delete updateData._id;

            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }

        // CRÉATION (User Story #2)
        const worksParentId = await getWorksPath(classroom);
        const driveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksParentId);
        
        const newChap = await Chapter.create({ 
            title: title || "Nouveau Dossier", 
            classroom, 
            subject, 
            teacherId, 
            driveFolderId: driveId,
            isArchived: false 
        });
        res.json(newChap);
    } catch (e) { 
        console.error("Erreur 500 /chapters:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await getChapter().findById(req.params.id);
        if (chap && chap.driveFolderId) {
            try { await DriveService.deleteFile(chap.driveFolderId); } catch(e) {}
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

router.get('/scan-sessions/:id/files/:type', async (req, res) => {
    try {
        const session = await getScanSession().findById(req.params.id);
        const type = req.params.type;
        let folderId = (type === 'subject') ? session.subjectFolderId : (type === 'copies' ? session.copiesFolderId : session.correctionsFolderId);
        
        if (!folderId && session.driveFolderId) {
            const subName = (type === 'subject') ? "Sujet" : (type === 'copies' ? "Copies" : "Corrections");
            folderId = await DriveService.getOrCreateFolder(subName, session.driveFolderId);
            await getScanSession().findByIdAndUpdate(req.params.id, { 
                [type === 'subject' ? 'subjectFolderId' : (type === 'copies' ? 'copiesFolderId' : 'correctionsFolderId')]: folderId 
            });
        }

        const files = await DriveService.listFiles(folderId);
        res.json(files);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScanSession().findById(sessionId);
        const targetFolder = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        const driveFile = await DriveService.uploadImage(targetFolder || session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } });
            res.json({ ok: true });
        } else { res.status(500).send("Erreur Drive"); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
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