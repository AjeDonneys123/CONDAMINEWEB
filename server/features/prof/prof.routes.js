const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Route Players : Toujours renvoyer un tableau JSON
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const players = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        return res.json(players || []);
    } catch (e) {
        console.error("Erreur API /players:", e);
        return res.status(500).json([]);
    }
});

router.get('/chapters-all', async (req, res) => {
    try {
        const chapters = await mongoose.model('Chapter').find({});
        res.json(chapters || []);
    } catch (e) { res.json([]); }
});

router.get('/homework-all', async (req, res) => {
    try {
        const hw = await mongoose.model('Homework').find({}).sort({ date: -1 });
        res.json(hw || []);
    } catch (e) { res.json([]); }
});

module.exports = router;