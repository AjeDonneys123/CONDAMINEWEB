const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🏢 DOMAINE ADMIN : STRUCTURES
 */

const normalize = (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE";

router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { 
        console.error("❌ Erreur Admin /players:", e.message);
        res.status(500).json({ error: "Erreur serveur" }); 
    }
});

router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const data = await Chapter.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id, title, classroom, subject } = req.body;
        
        // Sync Physique Drive
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

router.delete('/classroom/:className', async (req, res) => {
    try {
        const { className } = req.params;
        await mongoose.model('Player').deleteMany({ classroom: className });
        await mongoose.model('Chapter').deleteMany({ classroom: className });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
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