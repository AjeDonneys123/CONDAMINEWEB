const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

/**
 * 🛠️ ADMINISTRATION & DOSSIERS
 */

// Mise à jour des sections (matières) du prof + synchro Drive
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: sections }, 
            { new: true }
        );

        // Synchro Drive optionnelle en tâche de fond
        if (className && sections.length > 0) {
            const hwRootId = await DriveService.getHomeworkRoot(className);
            const lastAdded = sections[sections.length - 1];
            await DriveService.getOrCreateFolder(normalize(lastAdded.name), hwRootId);
        }

        res.json({
            user: {
                id: updatedTeacher._id,
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                subjectSections: updatedTeacher.subjectSections,
                role: 'prof'
            },
            message: "Matières synchronisées."
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Création / Mise à jour de chapitre (Dossier)
router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id, title, classroom, subject } = req.body;
        
        let driveId = req.body.driveFolderId;

        // US #4 & #5 : Structure Auto-gérée & Normalisation
        if (title && subject && classroom) {
            const hwRootId = await DriveService.getHomeworkRoot(classroom);
            const subId = await DriveService.getOrCreateFolder(normalize(subject), hwRootId);
            driveId = await DriveService.getOrCreateFolder(normalize(title), subId);
        }

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            // US #6 : Synchro du nom / matière
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } catch (e) { res.json([]); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({}).sort({ _id: -1 })); } catch (e) { res.json([]); }
});

// US #9 : Nettoyage intégral
router.delete('/chapters/:id', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(req.params.id);
        if (chap && chap.driveFolderId) {
            await DriveService.deleteFile(chap.driveFolderId);
        }
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true, message: "Dossier supprimé physiquement sur Drive" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;