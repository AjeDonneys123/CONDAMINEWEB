const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

/**
 * 🏢 DOMAINE ADMIN : STRUCTURES & MATIÈRES
 */

// GET /api/players (Fix 500)
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { 
        console.error("Erreur Players:", e);
        res.status(500).json([]); 
    }
});

// GET /api/chapters-all
router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const data = await Chapter.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

// PATCH /api/teacher/:id/sections (Matières)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        
        const oldTeacher = await Teacher.findById(req.params.id);
        if (!oldTeacher) return res.status(404).send("Prof non trouvé");

        const oldNames = oldTeacher.subjectSections.map(s => s.name);
        const newNames = sections.map(s => s.name);
        const removed = oldNames.filter(x => !newNames.includes(x));

        if (removed.length > 0) {
            const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
            const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", teacherId);

            for (const name of removed) {
                // Transfert vers Autres
                await Chapter.updateMany({ subject: name }, { subject: "Autres" });
                // Nettoyage Drive
                const folderId = await DriveService.getOrCreateFolder(normalize(name), devoirsId);
                if (folderId) await DriveService.deleteFile(folderId);
            }
        }

        const updatedTeacher = await Teacher.findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });

        res.json({ 
            user: {
                id: updatedTeacher._id,
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                subjectSections: updatedTeacher.subjectSections,
                role: 'prof'
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/chapters
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", teacherId);
        const subId = await DriveService.getOrCreateFolder(normalize(subject), devoirsId);
        const driveId = await DriveService.getOrCreateFolder(normalize(title), subId);

        let result;
        if (_id) {
            result = await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/database-dump
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