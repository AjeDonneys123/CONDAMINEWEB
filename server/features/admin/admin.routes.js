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

router.delete('/classroom/:name', async (req, res) => {
    try {
        const name = req.params.name;
        await mongoose.model('Player').deleteMany({ classroom: name });
        await mongoose.model('Chapter').deleteMany({ classroom: name });
        await mongoose.model('Homework').deleteMany({ classroom: name });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const updated = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: req.body.sections }, { new: true });
        res.json({ ok: true, user: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;