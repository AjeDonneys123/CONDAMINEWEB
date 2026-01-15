const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🛠️ DOMAINE : ADMINISTRATION (Élèves & Diagnostic)
 */

router.get('/database-dump', async (req, res) => {
    try {
        const dump = {
            players: await mongoose.model('Player').find({}).lean(),
            teachers: await mongoose.model('Teacher').find({}).lean(),
            chapters: await mongoose.model('Chapter').find({}).lean(),
            homework: await mongoose.model('Homework').find({}).lean(),
            games: await mongoose.model('GameLevel').find({}).lean()
        };
        res.json(dump);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } 
    catch (e) { res.status(500).json({ error: "Erreur BDD Players" }); }
});

// Diagnostic Drive pour le voyant Header
router.get('/drive-check', async (req, res) => {
    const status = await DriveService.testConnection();
    res.json(status);
});

// Mise à jour du profil enseignant (Sections/Matières)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className, deletedSection } = req.body;
        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(req.params.id);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // US #9 : Suppression physique si une matière est retirée
        if (deletedSection && className) {
            const { devoirsFolderId } = await DriveService.getSpecificDevoirsFolder(teacherName, className);
            const children = await DriveService.listChildren(devoirsFolderId);
            const target = children.find(c => c.name === DriveService.normalize(deletedSection));
            if (target) await DriveService.deleteEntity(target.id);
        }

        const updated = await Teacher.findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ 
            user: { id: updated._id, firstName: updated.firstName, lastName: updated.lastName, subjectSections: updated.subjectSections, role: 'prof' },
            message: "Profil mis à jour"
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;