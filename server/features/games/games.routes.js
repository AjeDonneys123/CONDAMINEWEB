const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/all', async (req, res) => {
    try {
        const Game = mongoose.model('GameLevel');
        const data = await Game.find({});
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: "Erreur lecture jeux", details: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const Game = mongoose.model('GameLevel');
        const { _id, ...data } = req.body;
        const result = _id ? await Game.findByIdAndUpdate(_id, data, { new: true }) : await Game.create(data);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: "Sauvegarde jeu impossible" });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Suppression jeu impossible" });
    }
});

module.exports = router;