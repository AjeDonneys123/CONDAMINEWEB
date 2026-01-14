const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🏢 DOMAINE ADMIN : STRUCTURES & DUMP BDD
 */

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

// --- EXPORT GLOBAL FORMAT EXCEL/JSON ---
router.get('/database-dump', async (req, res) => {
    try {
        const models = {
            players: mongoose.model('Player'),
            chapters: mongoose.model('Chapter'),
            homework: mongoose.model('Homework'),
            games: mongoose.model('GameLevel'),
            scans: mongoose.model('ScanSession')
        };

        const dump = {};
        for (const [key, model] of Object.entries(models)) {
            dump[key] = await model.find({}).lean();
        }

        res.json(dump);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- ÉLÈVES ---
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await mongoose.model('Chapter').find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const Teacher = mongoose.model('Teacher');
        const updated = await Teacher.findByIdAndUpdate(req.params.id, { subjectSections: req.body.sections }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id, title, classroom, subject } = req.body;
        const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
        const subId = await DriveService.getOrCreateFolder(normalize(subject), classId);
        const driveId = await DriveService.getOrCreateFolder(normalize(title), subId);
        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sync-drive-structure', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const teacher = await mongoose.model('Teacher').findById(teacherId);
        const Chapter = mongoose.model('Chapter');
        const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const classFolderId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
        const sectionsNames = (teacher.subjectSections || []).map(s => s.name);
        const orphaned = await Chapter.find({ classroom: classroom, subject: { $nin: sectionsNames } });
        for (const chap of orphaned) {
            chap.subject = "Autres";
            await chap.save();
        }
        for (const s of teacher.subjectSections) { await DriveService.getOrCreateFolder(normalize(s.name), classFolderId); }
        res.json({ ok: true, migrated: orphaned.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/bugs', async (req, res) => {
    try { res.json(await mongoose.model('Bug').find({}).sort({ createdAt: -1 })); } catch (e) { res.json([]); }
});

router.delete('/bugs/:id', async (req, res) => {
    try {
        await mongoose.model('Bug').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false }); }
});

module.exports = router;