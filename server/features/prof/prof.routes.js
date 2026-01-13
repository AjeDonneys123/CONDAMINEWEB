const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const getHomework = () => mongoose.model('Homework');

router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

router.get('/homework-all', async (req, res) => {
    try {
        const data = await getHomework().find({}).sort({ date: -1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

// FIX : Ajout de la route DELETE pour les devoirs (Homework)
router.delete('/homework/:id', async (req, res) => {
    try {
        await getHomework().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/homework', async (req, res) => {
    try {
        const body = req.body;
        if (body._id) {
            const id = body._id;
            delete body._id;
            const updated = await getHomework().findByIdAndUpdate(id, body, { new: true });
            res.json(updated);
        } else {
            const created = await getHomework().create(body);
            res.json(created);
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;