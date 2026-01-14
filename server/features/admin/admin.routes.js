const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const getModel = (n) => mongoose.model(n);

// Gestion des classes et élèves
router.get('/players', async (req, res) => {
    try {
        const data = await getModel('Player').find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

router.post('/create-class-wizard', async (req, res) => {
    try {
        const { teacherId, className, rawData } = req.body;
        const lines = rawData.split('\n').filter(l => l.trim());
        const players = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return { firstName: parts.slice(1).join(' '), lastName: parts[0], classroom: className, teacherId };
        });
        await getModel('Player').insertMany(players);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Gestion des Super-Dossiers (Archives)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const updated = await getModel('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: req.body.sections }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Chapitres (Dossiers de cours)
router.get('/chapters-all', async (req, res) => {
    try {
        res.json(await getModel('Chapter').find({}).sort({ _id: -1 }));
    } catch (e) { res.json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id } = req.body;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            return res.json(await getModel('Chapter').findByIdAndUpdate(_id, req.body, { new: true }));
        }
        res.json(await getModel('Chapter').create({ ...req.body, isArchived: false }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;