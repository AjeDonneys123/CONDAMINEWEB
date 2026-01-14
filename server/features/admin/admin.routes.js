const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🏢 DOMAINE ADMIN : Point d'entrée pour les listes et structures
 */

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").trim() : "SANS_TITRE";

router.get('/players', async (req, res) => {
    try {
        const data = await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await mongoose.model('Chapter').find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

// US #2 & #4 : Création de Chapitres avec Suture Drive
router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id, title, classroom, subject } = req.body;
        
        // --- LOGIQUE DRIVE (SUTURE) ---
        const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
        const subName = subject === 'H' ? 'HISTOIRE' : subject === 'G' ? 'GEOGRAPHIE' : subject === 'E' ? 'EMC' : normalize(subject);
        const subFolderId = await DriveService.getOrCreateFolder(subName, classId);
        const driveId = await DriveService.getOrCreateFolder(normalize(title), subFolderId);

        let updatedChapter;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            updatedChapter = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            updatedChapter = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        
        res.json(updatedChapter);
    } catch (e) { 
        console.error("❌ [ADMIN] Erreur Chapitre/Drive:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.delete('/classroom/:className', async (req, res) => {
    try {
        const { className } = req.params;
        await mongoose.model('Player').deleteMany({ classroom: className });
        await mongoose.model('Chapter').deleteMany({ classroom: className });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;