const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const getTeacher = () => mongoose.model('Teacher');
const getPlayer = () => mongoose.model('Player');

// Gestion des Super-Dossiers (Sections)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const updated = await getTeacher().findByIdAndUpdate(
            req.params.id, 
            { subjectSections: req.body.sections }, 
            { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Wizard : Création de classe
router.post('/create-class-wizard', async (req, res) => {
    try {
        const { teacherId, className, rawData } = req.body;
        const lines = rawData.split('\n').filter(l => l.trim());
        const players = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            const lastName = parts[0] || "NOM";
            const firstName = parts.slice(1).join(' ') || "Prénom";
            return { firstName, lastName, classroom: className, teacherId };
        });
        await getPlayer().insertMany(players);
        res.json({ ok: true, count: players.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Suppression de classe
router.delete('/classroom/:className', async (req, res) => {
    try {
        const { className } = req.params;
        await getPlayer().deleteMany({ classroom: className });
        await mongoose.model('Chapter').deleteMany({ classroom: className });
        await mongoose.model('Homework').deleteMany({ classroom: className });
        await mongoose.model('ScanSession').deleteMany({ classroom: className });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/players', async (req, res) => {
    try {
        const data = await getPlayer().find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

module.exports = router;