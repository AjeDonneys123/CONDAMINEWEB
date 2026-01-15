const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/database-dump', async (req, res) => {
    try {
        res.json({
            players: await mongoose.model('Player').find({}).lean(),
            chapters: await mongoose.model('Chapter').find({}).lean(),
            homeworks: await mongoose.model('Homework').find({}).lean(),
            gamelevels: await mongoose.model('GameLevel').find({}).lean(),
            teachers: await mongoose.model('Teacher').find({}).lean(),
            submissions: await mongoose.model('Submission').find({}).lean()
        });
    } catch (e) { res.status(500).json({ error: "Dump Error" }); }
});

router.get('/players', async (req, res) => {
    try {
        res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 }));
    } catch (e) { res.status(500).json([]); }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections } = req.body;
        const updated = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ ok: true, user: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;