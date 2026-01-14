const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

/**
 * 🏢 DOMAINE ADMIN : ALIGNEMENT PHYSIQUE TOTAL
 */

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        
        const oldTeacher = await Teacher.findById(req.params.id);
        if (!oldTeacher) return res.status(404).send("Prof non trouvé");

        const oldNames = oldTeacher.subjectSections.map(s => s.name);
        const newNames = sections.map(s => s.name);
        const deletedNames = oldNames.filter(x => !newNames.includes(x));

        // 1. ACTION PHYSIQUE SUR DRIVE (BLOQUANTE POUR SÉCURITÉ)
        if (deletedNames.length > 0 && className) {
            const hwRootId = await DriveService.getHomeworkRoot(className);
            for (const name of deletedNames) {
                // Suppression du dossier correspondant à la matière (normalisé)
                await DriveService.deleteFolderByName(normalize(name), hwRootId);
                
                // BDD : On sauve les chapitres orphelins
                await Chapter.updateMany(
                    { subject: name, classroom: className },
                    { subject: "Autres" }
                );
            }
        }

        // Si c'est un ajout, on crée le dossier immédiatement
        if (newNames.length > oldNames.length && className) {
            const addedName = newNames.find(x => !oldNames.includes(x));
            const hwRootId = await DriveService.getHomeworkRoot(className);
            await DriveService.getOrCreateFolder(normalize(addedName), hwRootId);
        }

        // 2. MISE À JOUR BDD
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: sections }, 
            { new: true }
        );

        res.json({
            user: {
                id: updatedTeacher._id,
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                subjectSections: updatedTeacher.subjectSections,
                role: 'prof'
            },
            message: "BDD & Drive synchronisés avec succès."
        });

    } catch (e) {
        console.error("❌ Crash Patch Sections:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } catch (e) { res.json([]); }
});
router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({}).sort({ _id: -1 })); } catch (e) { res.json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        const hwRootId = await DriveService.getHomeworkRoot(classroom);
        const subId = await DriveService.getOrCreateFolder(normalize(subject), hwRootId);
        const driveId = await DriveService.getOrCreateFolder(normalize(title), subId);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;