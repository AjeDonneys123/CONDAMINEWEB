const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🏢 DOMAINE ADMIN : Point d'entrée pour les listes et structures
 */

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

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

router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id, title, classroom, subject } = req.body;
        
        const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
        const subId = await DriveService.getOrCreateFolder(normalize(subject), classId);
        const driveId = await DriveService.getOrCreateFolder(normalize(title), subId);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- GRAND NETTOYAGE & SYNCHRO DRIVE (US #8) ---
router.post('/sync-drive-structure', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) return res.status(404).send("Prof non trouvé");

        const sections = (teacher.subjectSections || []).map(s => normalize(s.name));
        const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const classFolderId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);

        // 1. Détection des dossiers orphelins sur le Drive
        // On récupère les dossiers physiques actuels sous la classe
        // On compare avec les sections autorisées
        
        // 2. Migration des chapitres BDD
        const orphanedChapters = await Chapter.find({ 
            classroom: classroom,
            subject: { $nin: (teacher.subjectSections || []).map(s => s.name) } 
        });

        if (orphanedChapters.length > 0) {
            console.log(`🧹 Migration de ${orphanedChapters.length} chapitres vers AUTRES...`);
            const autresDriveId = await DriveService.getOrCreateFolder("AUTRES", classFolderId);
            
            for (const chap of orphanedChapters) {
                chap.subject = "Autres";
                // En option : on pourrait déplacer physiquement le dossier chap.driveFolderId vers autresDriveId ici
                await chap.save();
            }
        }

        // 3. Création des dossiers manquants
        for (const s of teacher.subjectSections) {
            await DriveService.getOrCreateFolder(normalize(s.name), classFolderId);
        }

        res.json({ ok: true, migrated: orphanedChapters.length });
    } catch (e) {
        console.error(e);
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