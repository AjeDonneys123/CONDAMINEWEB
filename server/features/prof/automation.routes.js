const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getChapter = () => mongoose.model('Chapter');
const getScanSession = () => mongoose.model('ScanSession');

const getCondaPath = async (teacherName, classroom) => {
    try {
        const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
        const teacherId = await DriveService.getOrCreateFolder(teacherName, condaRootId);
        const classId = await DriveService.getOrCreateFolder(classroom || "Sans_Classe", teacherId);
        const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
        return { worksId, prodId };
    } catch (e) { return { worksId: null, prodId: null }; }
};

// --- ROUTES CHAPITRES ---

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await getChapter().find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const Chapter = getChapter();
        const { _id, title, classroom, subject, teacherId } = req.body;

        // CAS MISE À JOUR (Renommage ou Archivage)
        if (_id) {
            const chap = await Chapter.findById(_id);
            if (!chap) return res.status(404).json({ error: "Introuvable" });

            // Mise à jour Drive si le titre change
            if (chap.driveFolderId && title && title !== chap.title) {
                try {
                    await DriveService.renameFolder(chap.driveFolderId, title);
                } catch(e) { console.warn("Echec Drive rename silencieux"); }
            }

            const updateData = { ...req.body };
            delete updateData._id; 
            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }

        // CAS CRÉATION
        const conda = await getCondaPath("Jean Vuillet", classroom);
        const driveId = conda.worksId ? await DriveService.getOrCreateFolder(title || "Nouveau Dossier", conda.worksId) : null;
        
        const newChap = await Chapter.create({ 
            title, classroom, subject, teacherId, driveFolderId: driveId, isArchived: false
        });
        res.json(newChap);
    } catch (e) { 
        console.error("Erreur /chapters:", e.message);
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

// --- SCAN SESSIONS (PRODUCTIONS) ---

router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await getScanSession().find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const session = await getScanSession().create(req.body);
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Permet de classer un scan dans un dossier
router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const { chapterId } = req.body;
        const session = await getScanSession().findByIdAndUpdate(req.params.id, { chapterId }, { new: true });
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;