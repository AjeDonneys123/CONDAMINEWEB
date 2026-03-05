const express = require('express');
const router = express.Router();
const { Lecture } = require('../models/prof.models');

router.get('/all', async (_req, res) => {
    try {
        const rows = await Lecture.find({}).sort({ date: -1 }).lean();
        res.json(rows);
    } catch (_) {
        res.status(500).json([]);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await Lecture.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Lecture introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const data = { ...req.body };
        if (!data._id || data._id === 'null') delete data._id;
        if (typeof data.isEnabled !== 'boolean') data.isEnabled = true;
        data.targetClassrooms = [...new Set((data.targetClassrooms || [])
            .map((c) => String(c || '').trim().toUpperCase())
            .filter(Boolean))];

        data.maxScrollSpeed = Math.max(600, Math.min(8000, Number(data.maxScrollSpeed || 2600)));
        data.readingWpm = Math.max(120, Math.min(500, Number(data.readingWpm || 300)));
        data.requiredSummaryMinLines = Math.max(1, Math.min(20, Number(data.requiredSummaryMinLines || 5)));
        data.requiredSummaryMaxLines = Math.max(data.requiredSummaryMinLines, Math.min(30, Number(data.requiredSummaryMaxLines || 10)));

        const row = data._id
            ? await Lecture.findByIdAndUpdate(data._id, data, { new: true })
            : await Lecture.create(data);
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const row = await Lecture.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled } },
            { new: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Lecture introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Lecture.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
