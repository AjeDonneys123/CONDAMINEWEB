const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const players = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(players || []);
    } catch (e) { 
        console.error("❌ Error GET /players:", e.message);
        res.status(500).json([]); 
    }
});

router.get('/homework-all', async (req, res) => {
    try { 
        const Homework = mongoose.model('Homework');
        const data = await Homework.find({}).sort({ date: -1 });
        res.json(data || []); 
    } catch (e) { 
        res.status(500).json([]); 
    }
});

router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const list = await Chapter.find({});
        res.json(list || []);
    } catch (e) {
        res.status(500).json([]);
    }
});

module.exports = router;