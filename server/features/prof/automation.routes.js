const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Arborescence Drive
const getCondaPath = async (teacherName, classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const profId = await DriveService.getOrCreateFolder(teacherName, condaRootId);
    let classFolderName = classroom || "Sans_Classe";
    const classId = await DriveService.getOrCreateFolder(classFolderName, profId);
    const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
    const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
    return { classId, worksId, prodId };
};

// --- CHAPITRES ---
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom } = req.body;
        const Chapter = mongoose.model('Chapter');
        const teacherName = "Jean Vuillet";

        if (_id) {
            console.log(`📝 Mise à jour chapitre ${_id}...`);
            const chap = await Chapter.findById(_id);
            if (!chap) return res.status(404).json({ error: "Introuvable" });

            if (chap.driveFolderId && title && title !== chap.title) {
                await DriveService.renameFolder(chap.driveFolderId, title);
            }

            const updateData = { ...req.body };
            delete updateData._id; // SÉCURITÉ : Ne jamais tenter d'updater l'ID

            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }

        console.log(`🆕 Création nouveau chapitre: ${title}`);
        const { worksId } = await getCondaPath(teacherName, classroom);
        const driveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId);
        
        const newChap = await Chapter.create({ ...req.body, driveFolderId: driveId });
        res.json(newChap);
    } catch (e) {
        console.error("❌ Erreur /chapters:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await mongoose.model('Chapter').find({}).sort({ _id: -1 });
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap && chap.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SCAN SESSIONS ---
router.get('/scan-sessions', async (req, res) => {
    try {
        const sessions = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
        res.json(sessions);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').create(req.body);
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;