const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

// PATCH /api/teacher/:id/sections (Matières) - VERSION ROBUSTE
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        
        // 1. Mise à jour de la BDD
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: sections }, 
            { new: true } // Renvoie l'objet après modification
        );

        if (!updatedTeacher) return res.status(404).send("Prof non trouvé");

        // 2. Synchro Drive (seulement si une nouvelle section a été ajoutée)
        let drivePath = "SYNC BDD UNIQUEMENT";
        let driveError = false;

        if (className && sections.length > 0) {
            const lastSection = sections[sections.length - 1];
            const driveId = await DriveService.syncPath(className, [normalize(lastSection.name)]);
            const exists = await DriveService.verifyId(driveId);
            driveError = !exists;
            drivePath = `CONDACLASSE / JEAN VUILLET / ${className.toUpperCase()} / ${normalize(lastSection.name)}`;
        }

        // 3. Réponse avec l'utilisateur COMPLET pour mettre à jour le Frontend
        res.json({ 
            user: {
                id: updatedTeacher._id,
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                subjectSections: updatedTeacher.subjectSections,
                role: 'prof'
            },
            drivePath, 
            driveError,
            message: "Matières synchronisées (BDD + Drive)" 
        });
    } catch (e) { 
        console.error("❌ Erreur Sections:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

// POST /api/chapters
router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id, title, classroom, subject } = req.body;
        
        const driveId = await DriveService.syncPath(classroom, [normalize(subject), normalize(title)]);
        const drivePath = `CONDACLASSE / JEAN VUILLET / ${classroom.toUpperCase()} / ${normalize(subject)} / ${normalize(title)}`;
        const exists = await DriveService.verifyId(driveId);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json({ ...result._doc, drivePath, driveError: !exists, message: exists ? "Chapitre synchronisé" : "ERREUR DRIVE" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } catch (e) { res.json([]); }
});
router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({}).sort({ _id: -1 })); } catch (e) { res.json([]); }
});
router.get('/database-dump', async (req, res) => {
    try {
        const dump = {
            players: await mongoose.model('Player').find({}).lean(),
            chapters: await mongoose.model('Chapter').find({}).lean(),
            homework: await mongoose.model('Homework').find({}).lean(),
            games: await mongoose.model('GameLevel').find({}).lean(),
            scans: await mongoose.model('ScanSession').find({}).lean()
        };
        res.json(dump);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;