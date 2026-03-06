const express = require('express');
const router = express.Router();
const { Expose } = require('../models/prof.models');

router.get('/all', async (req, res) => {
    try {
        const rows = await Expose.find({}).sort({ date: -1 }).lean();
        res.json(rows);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await Expose.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });
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
        const row = data._id
            ? await Expose.findByIdAndUpdate(data._id, data, { new: true })
            : await Expose.create(data);
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const row = await Expose.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled } },
            { new: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Expose.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id/presentation-group', async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        const title = String(req.query?.title || '').trim();
        if (!exposeId) return res.status(400).json({ error: 'id requis' });
        if (!title) return res.status(400).json({ error: 'title requis' });

        const row = await Expose.findById(exposeId);
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });

        const before = Array.isArray(row.presentations) ? row.presentations.length : 0;
        row.presentations = (row.presentations || []).filter((p) => String(p?.presentationTitle || '').trim() !== title);
        const after = Array.isArray(row.presentations) ? row.presentations.length : 0;
        await row.save();

        res.json({ ok: true, removed: Math.max(0, before - after) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
