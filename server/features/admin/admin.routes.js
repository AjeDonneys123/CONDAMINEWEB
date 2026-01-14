const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 🏢 DOMAINE : ADMIN & CLASSES
 * Point d'entrée consolidé pour les données structurelles du site.
 */

// --- ÉLÈVES ---

// GET /api/players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) {
        console.error("Erreur Admin API /players:", e.message);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST /api/create-class-wizard
router.post('/create-class-wizard', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const { teacherId, className, rawData } = req.body;
        const lines = rawData.split('\n').filter(l => l.trim());
        const players = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            const lastName = parts[0] || "NOM";
            const firstName = parts.slice(1).join(' ') || "Prénom";
            return { firstName, lastName, classroom: className, teacherId };
        });
        await Player.insertMany(players);
        res.json({ ok: true, count: players.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/classroom/:className
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

// DELETE /api/chapters/:id
router.delete('/chapters/:id', async (req, res) => {
    try {
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- BUGS & LOGS ---

router.get('/bugs', async (req, res) => {
    try {
        res.json(await mongoose.model('Bug').find({}).sort({ createdAt: -1 }));
    } catch (e) { res.json([]); }
});

router.delete('/bugs/:id', async (req, res) => {
    try {
        await mongoose.model('Bug').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false }); }
});

module.exports = router;