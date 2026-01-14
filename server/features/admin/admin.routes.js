const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 🏢 DOMAINE ADMIN : Point d'entrée pour les listes structurelles
 */

// GET /api/players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

// GET /api/chapters-all
router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const data = await Chapter.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

// POST /api/chapters
router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id } = req.body;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            return res.json(await Chapter.findByIdAndUpdate(_id, req.body, { new: true }));
        }
        res.json(await Chapter.create({ ...req.body, isArchived: false }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;