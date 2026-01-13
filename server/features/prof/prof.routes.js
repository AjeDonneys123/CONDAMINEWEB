const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

router.get('/homework-all', async (req, res) => {
    try { 
        const Homework = mongoose.model('Homework');
        const data = await Homework.find({}).sort({ date: -1 });
        res.json(data || []); 
    } catch (e) { res.json([]); }
});

// Route vitale : Sauvegarde des super-dossiers (sections)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const Teacher = mongoose.model('Teacher');
        const updated = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: req.body.sections }, 
            { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;