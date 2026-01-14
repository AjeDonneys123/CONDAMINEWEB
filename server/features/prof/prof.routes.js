const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper pour accéder aux modèles de manière sécurisée
const getPlayer = () => mongoose.model('Player');
const getTeacher = () => mongoose.model('Teacher');
const getHomework = () => mongoose.model('Homework');

router.get('/players', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) throw new Error("BDD non prête");
        const data = await getPlayer().find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) {
        console.error("❌ Erreur /api/players:", e.message);
        res.status(500).json({ error: "Erreur lors de la récupération des élèves" });
    }
});

router.get('/homework-all', async (req, res) => {
    try {
        const data = await getHomework().find({}).sort({ date: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const updated = await getTeacher().findByIdAndUpdate(
            req.params.id, 
            { subjectSections: req.body.sections }, 
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: "Prof non trouvé" });
        res.json(updated);
    } catch (e) {
        console.error("❌ Erreur /api/teacher/sections:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/classroom/:className', async (req, res) => {
    try {
        const { className } = req.params;
        await getPlayer().deleteMany({ classroom: className });
        await mongoose.model('Chapter').deleteMany({ classroom: className });
        await getHomework().deleteMany({ classroom: className });
        await mongoose.model('ScanSession').deleteMany({ classroom: className });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;