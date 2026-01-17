const express = require('express');
const router = express.Router();
const StructureExpert = require('./experts/structure.expert');

// Route sécurisée : Si ça plante, on renvoie un tableau vide [] au lieu de 500
router.get('/chapters', async (req, res) => {
    try {
        const chapters = await StructureExpert.getChapters();
        res.json(chapters || []);
    } catch (e) {
        console.error("Route Crash /chapters:", e);
        res.json([]); // Fallback de sécurité
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const chapter = await StructureExpert.createChapter(req.body);
        res.json(chapter);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        await StructureExpert.deleteChapter(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;