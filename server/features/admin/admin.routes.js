const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🏢 DOMAINE ADMIN : REPARATION DES ROUTES (404 FIX)
 */

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

// RÉCUPÉRATION ÉLÈVES
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

// RÉCUPÉRATION CHAPITRES
router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const data = await Chapter.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

// CRÉATION / MODIF CHAPITRE
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        const Chapter = mongoose.model('Chapter');

        const driveId = await DriveService.syncPath(classroom, [normalize(subject), normalize(title)]);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// CORRECTIF : ROUTE PATCH POUR LES MATIERES (SÉCTIONS)
// Cette route doit être exactement /teacher/:id/sections
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: sections }, 
            { new: true }
        );

        if (!updatedTeacher) return res.status(404).send("Professeur non trouvé.");

        // Drive Sync en arrière-plan
        if (className) {
            DriveService.syncPath(className, sections.map(s => normalize(s.name))).catch(e => console.error("Drive Sync Fail:", e.message));
        }

        res.json({ 
            user: {
                id: updatedTeacher._id,
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                subjectSections: updatedTeacher.subjectSections,
                role: 'prof'
            },
            message: "Matières mises à jour." 
        });
    } catch (e) {
        console.error("❌ [ADMIN] Erreur Patch Sections:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// SYNC GLOBALE
router.post('/sync-drive-structure', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const teacher = await mongoose.model('Teacher').findById(teacherId);
        const Chapter = mongoose.model('Chapter');
        const sectionsNames = (teacher.subjectSections || []).map(s => s.name);
        const orphaned = await Chapter.find({ classroom: classroom, subject: { $nin: sectionsNames } });
        for (const chap of orphaned) {
            chap.subject = "Autres";
            await chap.save();
        }
        res.json({ ok: true, migrated: orphaned.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;