const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🏢 DOMAINE ADMIN : STRUCTURES & NOTIFICATIONS CHEMIN
 */

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

const getSubjectLabel = (s) => {
    const sub = s.toUpperCase();
    if (sub === 'H' || sub === 'HISTOIRE') return 'HISTOIRE';
    if (sub === 'G' || sub === 'GEOGRAPHIE') return 'GEOGRAPHIE';
    if (sub === 'E' || sub === 'EMC') return 'EMC';
    return normalize(s);
};

// --- GESTION DES CHAPITRES (CRÉER / MODIFIER) ---
router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id, title, classroom, subject } = req.body;
        
        const subFolder = getSubjectLabel(subject);
        const drivePath = `CONDACLASSE / ${classroom.toUpperCase()} / ${subFolder} / ${title.toUpperCase()}`;

        // Sync Physique Drive
        const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
        const subId = await DriveService.getOrCreateFolder(subFolder, classId);
        const driveId = await DriveService.getOrCreateFolder(normalize(title), subId);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }

        res.json({ 
            ...result._doc, 
            drivePath, 
            message: _id ? "Dossier mis à jour" : "Nouveau dossier créé" 
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUPPRESSION (US #9) ---
router.delete('/chapters/:id', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(req.params.id);
        if (!chap) return res.status(404).send("Introuvable");

        const drivePath = `CONDACLASSE / ${chap.classroom} / ${chap.subject} / ${chap.title}`;
        
        if (chap.driveFolderId) {
            await DriveService.deleteFile(chap.driveFolderId).catch(() => {});
        }
        await Chapter.findByIdAndDelete(req.params.id);

        res.json({ ok: true, drivePath, message: "Dossier supprimé du Drive et de la BDD" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- GESTION MATIÈRES (SUPER-DOSSIERS) ---
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const Teacher = mongoose.model('Teacher');
        const updated = await Teacher.findByIdAndUpdate(req.params.id, { subjectSections: req.body.sections }, { new: true });
        res.json({ 
            ...updated._doc, 
            message: "Configuration des matières mise à jour",
            drivePath: "RACINE / CONDACLASSE / MATIÈRES"
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Récupération classique
router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } catch (e) { res.json([]); }
});
router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({}).sort({ _id: -1 })); } catch (e) { res.json([]); }
});

module.exports = router;