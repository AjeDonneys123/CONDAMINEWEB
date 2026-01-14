const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

// PATCH /api/teacher/:id/sections (Matières) - VERSION SUPPRESSION DRIVE
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        
        const oldTeacher = await Teacher.findById(req.params.id);
        if (!oldTeacher) return res.status(404).send("Prof non trouvé");

        // --- DÉTECTION DE LA SUPPRESSION (US #9) ---
        const oldSections = oldTeacher.subjectSections.map(s => s.name);
        const newSections = sections.map(s => s.name);
        const deletedSections = oldSections.filter(x => !newSections.includes(x));

        if (deletedSections.length > 0 && className) {
            console.log(`🗑️ Suppression Drive pour les matières : ${deletedSections.join(', ')}`);
            
            // On récupère le chemin de base
            const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", condaRootId);
            const classFolderId = await DriveService.getOrCreateFolder(normalize(className), teacherId);

            for (const sectionName of deletedSections) {
                // On cherche le dossier physique pour le supprimer
                const folderIdToDelete = await DriveService.getOrCreateFolder(normalize(sectionName), classFolderId);
                if (folderIdToDelete) {
                    await DriveService.deleteFile(folderIdToDelete);
                    console.log(`✅ Dossier Drive effacé : ${sectionName}`);
                }
            }
        }

        // --- MISE À JOUR BDD ---
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: sections }, 
            { new: true }
        );

        // Réponse pour synchroniser le LocalStorage du Frontend
        res.json({ 
            user: {
                id: updatedTeacher._id,
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                subjectSections: updatedTeacher.subjectSections,
                role: 'prof'
            },
            message: "Matières mises à jour et Drive nettoyé." 
        });
    } catch (e) { 
        console.error("❌ Crash Sections:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

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