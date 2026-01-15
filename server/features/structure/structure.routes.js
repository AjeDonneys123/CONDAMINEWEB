const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StructureService = require('../../services/structure.service');

router.get('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const data = await Chapter.find({}).lean();
        res.json(data || []);
    } catch (e) {
        console.error("❌ GET Chapters Error:", e.message);
        res.status(500).json([]);
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const result = await StructureService.createChapter(req.body);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await StructureService.deleteChapter(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;