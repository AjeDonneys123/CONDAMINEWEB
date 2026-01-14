const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

/**
 * 🏢 DOMAINE ADMIN : GESTION STRUCTURELLE (MATIERES & CHAPITRES)
 */

// PATCH /api/teacher/:id/sections (Matières)
// Gère la création et la suppression physique avec transfert vers "Autres"
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        
        const oldTeacher = await Teacher.findById(req.params.id);
        if (!oldTeacher) return res.status(404).send("Prof non trouvé");

        // 1. Détection des suppressions pour nettoyage Drive
        const oldNames = oldTeacher.subjectSections.map(s => s.name);
        const newNames = sections.map(s => s.name);
        const removed = oldNames.filter(x => !newNames.includes(x));

        if (removed.length > 0) {
            const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
            const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", teacherId);

            for (const name of removed) {
                // Transfert BDD des chapitres vers "Autres"
                await Chapter.updateMany({ subject: name }, { subject: "Autres" });
                
                // Suppression physique du dossier matière sur Drive
                const folderId = await DriveService.getOrCreateFolder(normalize(name), devoirsId);
                if (folderId) await DriveService.deleteFile(folderId);
                console.log(`🗑️ Drive Nettoyé : Matière ${name} supprimée.`);
            }
        }

        // 2. Mise à jour BDD Prof
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
            message: removed.length > 0 ? "Nettoyage Drive effectué." : "Matières mises à jour."
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/chapters (Création dans JEAN VUILLET / DEVOIRS / MATIERE)
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, subject } = req.body;
        const Chapter = mongoose.model('Chapter');

        // Reconstruction du chemin immuable
        const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", teacherId);
        const subId = await DriveService.getOrCreateFolder(normalize(subject), devoirsId);
        const driveId = await DriveService.getOrCreateFolder(normalize(title), subId);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        
        res.json({
            ...result._doc,
            drivePath: `JEAN VUILLET / DEVOIRS / ${subject.toUpperCase()} / ${title.toUpperCase()}`,
            message: "Dossier Chapitre synchronisé."
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