const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

/**
 * 🏢 DOMAINE ADMIN : EXORCISME DES FANTÔMES & ALIGNEMENT DRIVE
 */

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        
        // 1. Récupérer l'ancien état pour identifier les suppressions
        const oldTeacher = await Teacher.findById(req.params.id);
        if (!oldTeacher) return res.status(404).send("Prof non trouvé");

        const oldNames = oldTeacher.subjectSections.map(s => s.name);
        const newNames = sections.map(s => s.name);
        const deletedNames = oldNames.filter(x => !newNames.includes(x));

        // 2. Si des matières ont été supprimées
        if (deletedNames.length > 0) {
            console.log(`🧹 Nettoyage BDD & Drive pour : ${deletedNames.join(', ')}`);
            
            // BDD : On bascule les chapitres orphelins vers "Autres"
            await Chapter.updateMany(
                { subject: { $in: deletedNames }, classroom: className },
                { subject: "Autres" }
            );

            // DRIVE : On supprime les dossiers physiques
            if (className) {
                const hwRootId = await DriveService.getHomeworkRoot(className);
                for (const name of deletedNames) {
                    const folderId = await DriveService.getOrCreateFolder(normalize(name), hwRootId);
                    if (folderId) await DriveService.deleteFile(folderId);
                }
            }
        }

        // 3. Mise à jour de la liste des matières
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
            message: "Nettoyage réussi."
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } catch (e) { res.status(500).json([]); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({}).sort({ _id: -1 })); } catch (e) { res.status(500).json([]); }
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
            result = await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;