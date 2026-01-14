const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

/**
 * 🏢 DOMAINE ADMIN : REPARATION DES ROUTES
 */

// SAUVEGARDE SECTIONS (MATIERES)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        
        // 1. Sauvegarde BDD immédiate pour débloquer le client
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: sections }, 
            { new: true }
        );

        // 2. Drive en tâche de fond (ne bloque pas la réponse)
        if (className) {
            DriveService.getOrCreateFolder("CONDACLASSE", null).then(rootId => {
                DriveService.getOrCreateFolder("JEAN VUILLET", rootId).then(tId => {
                    DriveService.getOrCreateFolder(normalize(className), tId).then(cId => {
                        sections.forEach(s => DriveService.getOrCreateFolder(normalize(s.name), cId));
                    });
                });
            });
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
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// CRÉATION CHAPITRE (REPARÉ)
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        const Chapter = mongoose.model('Chapter');

        // On sync le drive mais on ne bloque pas si ça prend du temps
        const driveId = await DriveService.syncPath(classroom, [normalize(subject), normalize(title)]);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        
        res.json({
            ...result._doc,
            drivePath: `Drive : JEAN VUILLET / ${classroom} / ${subject} / ${title}`,
            message: "Chapitre prêt."
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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