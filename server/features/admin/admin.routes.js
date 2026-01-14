const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🏢 DOMAINE ADMIN : RECOIT LES APPELS /api/...
 */

// PATCH /api/teacher/:id/sections (RÉPARÉ)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        
        // 1. Trouver le prof actuel pour comparer
        const oldTeacher = await Teacher.findById(req.params.id);
        
        // 2. Détection suppression pour le Drive
        const oldNames = oldTeacher.subjectSections.map(s => s.name);
        const newNames = sections.map(s => s.name);
        const removed = oldNames.filter(x => !newNames.includes(x));

        // 3. Action physique sur le Drive (ON ATTEND LA RÉPONSE)
        if (removed.length > 0) {
            const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
            const classId = await DriveService.getOrCreateFolder(className.toUpperCase(), teacherId);
            
            for (const name of removed) {
                const folderId = await DriveService.getOrCreateFolder(name.toUpperCase(), classId);
                if (folderId) await DriveService.deleteFile(folderId);
            }
        }

        // Si ajout, on crée le dossier
        if (newNames.length > oldNames.length) {
            const addedName = newNames.find(x => !oldNames.includes(x));
            await DriveService.syncPath(className, addedName);
        }

        // 4. Mise à jour BDD
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: sections }, 
            { new: true }
        );

        // On renvoie l'objet utilisateur complet pour le Frontend
        res.json({
            user: {
                id: updatedTeacher._id,
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                subjectSections: updatedTeacher.subjectSections,
                role: 'prof'
            },
            message: "Mise à jour réussie."
        });

    } catch (e) {
        console.error("❌ [ADMIN] Erreur route sections:", e.message);
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
        const Chapter = mongoose.model('Chapter');
        
        // On crée l'arborescence complète
        const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
        const classId = await DriveService.getOrCreateFolder(classroom.toUpperCase(), teacherId);
        const subId = await DriveService.getOrCreateFolder(subject.toUpperCase(), classId);
        const driveId = await DriveService.getOrCreateFolder(title.toUpperCase(), subId);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;