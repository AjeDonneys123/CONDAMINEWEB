const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 🏢 DOMAINE : ADMIN & STRUCTURES
 * Gère les données de base : ÉLÈVES, CHAPITRES, SECTIONS.
 */

// --- ÉLÈVES ---

// GET /api/players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) {
        console.error("Erreur Admin API [/players]:", e.message);
        res.status(500).json({ error: "Erreur serveur lors de la récupération des élèves" });
    }
});

// --- CHAPITRES (DOSSIERS) ---

// GET /api/chapters-all
router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const data = await Chapter.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) {
        res.status(500).json([]);
    }
});

// POST /api/chapters
router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id } = req.body;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const updated = await Chapter.findByIdAndUpdate(_id, req.body, { new: true });
            return res.json(updated);
        }
        const created = await Chapter.create({ ...req.body, isArchived: false });
        res.json(created);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- CONFIGURATION PROF ---

// PATCH /api/teacher/:id/sections
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const Teacher = mongoose.model('Teacher');
        const updated = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: req.body.sections }, 
            { new: true }
        );
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// BUGS
router.get('/bugs', async (req, res) => {
    try {
        res.json(await mongoose.model('Bug').find({}).sort({ createdAt: -1 }));
    } catch (e) { res.json([]); }
});

module.exports = router;