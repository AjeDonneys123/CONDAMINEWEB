const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 🏢 DOMAINE : ADMIN & CLASSES
 * Gère les structures (élèves, dossiers, configuration prof).
 */

// GET /api/players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) {
        console.error("Admin API Error [/players]:", e.message);
        res.status(500).json({ error: "Échec récupération élèves" });
    }
});

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

// DELETE /api/classroom/:className (US #15)
router.delete('/classroom/:className', async (req, res) => {
    try {
        const { className } = req.params;
        await mongoose.model('Player').deleteMany({ classroom: className });
        await mongoose.model('Chapter').deleteMany({ classroom: className });
        await mongoose.model('Homework').deleteMany({ classroom: className });
        await mongoose.model('ScanSession').deleteMany({ classroom: className });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PATCH /api/teacher/:id/sections (Super-dossiers)
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

module.exports = router;