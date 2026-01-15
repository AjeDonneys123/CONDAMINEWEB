const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections } = req.body;
        const updated = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ ok: true, user: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/players', async (req, res) => {
    try {
        const players = await mongoose.model('Player').find({});
        res.json(players);
    } catch (e) { res.status(500).json([]); }
});

router.get('/database-dump', async (req, res) => {
    try {
        const dump = {
            players: await mongoose.model('Player').find({}),
            chapters: await mongoose.model('Chapter').find({}),
            homeworks: await mongoose.model('Homework').find({}),
            gamelevels: await mongoose.model('GameLevel').find({}),
            teachers: await mongoose.model('Teacher').find({})
        };
        res.json(dump);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;