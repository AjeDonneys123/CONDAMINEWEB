const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// --- RÉCUPÉRATION DES ÉLÈVES (Indispensable pour localhost) ---
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const players = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        console.log(`👥 [DB] ${players.length} élèves récupérés.`);
        res.json(players || []);
    } catch (e) {
        console.error("❌ [DB ERR] Impossible de charger les élèves:", e.message);
        res.status(500).json([]);
    }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) await mongoose.model('Chapter').findByIdAndUpdate(_id, data);
        else await mongoose.model('Chapter').create(data);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.get('/homework-all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

module.exports = router;