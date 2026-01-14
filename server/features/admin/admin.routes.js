const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: sections }, 
            { new: true }
        );

        // On renvoie un chemin de test pour le bandeau
        const lastSection = sections[sections.length - 1]?.name || "MATIERE";
        const drivePath = `CONDACLASSE / JEAN VUILLET / ${className || '...'} / DEVOIRS / ${lastSection.toUpperCase()}`;

        res.json({
            user: {
                id: updatedTeacher._id,
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                subjectSections: updatedTeacher.subjectSections,
                role: 'prof'
            },
            message: "Matières mises à jour",
            drivePath: drivePath
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id, title, classroom, subject } = req.body;
        
        // SYNC DRIVE
        const hwRootId = await DriveService.getHomeworkRoot(classroom);
        const subId = await DriveService.getOrCreateFolder(normalize(subject), hwRootId);
        const driveId = await DriveService.getOrCreateFolder(normalize(title), subId);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }

        res.json({
            ...result._doc,
            drivePath: `... / Devoirs / ${subject.toUpperCase()} / ${title.toUpperCase()}`,
            message: "Chapitre créé et synchronisé"
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } catch (e) { res.json([]); }
});
router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({}).sort({ _id: -1 })); } catch (e) { res.json([]); }
});

module.exports = router;