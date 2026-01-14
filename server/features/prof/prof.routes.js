const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const getModel = (name) => mongoose.model(name);

// RÉCUPÉRER TOUS LES ÉLÈVES
router.get('/players', async (req, res) => {
    try {
        const players = await getModel('Player').find({}).sort({ classroom: 1, lastName: 1 });
        res.json(players || []);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// RÉCUPÉRER TOUS LES DEVOIRS (FIX 404)
router.get('/homework-all', async (req, res) => {
    try { 
        const data = await getModel('Homework').find({}).sort({ date: -1 });
        res.json(data || []); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SAUVEGARDER LES SECTIONS (MATIÈRES)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const updated = await getModel('Teacher').findByIdAndUpdate(
            req.params.id, 
            { subjectSections: req.body.sections }, 
            { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SUPPRIMER UNE CLASSE
router.delete('/classroom/:className', async (req, res) => {
    try {
        const { className } = req.params;
        await getModel('Player').deleteMany({ classroom: className });
        await getModel('Chapter').deleteMany({ classroom: className });
        await getModel('Homework').deleteMany({ classroom: className });
        await getModel('ScanSession').deleteMany({ classroom: className });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;