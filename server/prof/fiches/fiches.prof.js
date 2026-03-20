const express = require('express');
const router = express.Router();
const { Fiche } = require('../models/prof.models');

const sanitizeSlides = (slides = []) => [...new Set(
    (Array.isArray(slides) ? slides : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0)
        .map((x) => Math.floor(x))
)].sort((a, b) => a - b);

router.get('/all', async (_req, res) => {
    try {
        const rows = await Fiche.find({}).sort({ date: -1 }).lean();
        res.json(rows);
    } catch (_) {
        res.status(500).json([]);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await Fiche.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Fiche introuvable' });
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
        data.selectedSlides = sanitizeSlides(data.selectedSlides);
        data.teacherInstructions = String(data.teacherInstructions || '').slice(0, 4000);
        data.presentationUrl = String(data.presentationUrl || '').trim();

        const row = data._id
            ? await Fiche.findByIdAndUpdate(data._id, data, { new: true })
            : await Fiche.create(data);
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const row = await Fiche.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled } },
            { new: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Fiche introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/submissions/:studentId/validate', async (req, res) => {
    try {
        const row = await Fiche.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Fiche introuvable' });
        const sid = String(req.params.studentId || '').trim();
        const idx = (row.submissions || []).findIndex((sub) => String(sub?.studentId || '') === sid);
        if (idx < 0) return res.status(404).json({ error: 'Rendu élève introuvable' });
        row.submissions[idx].teacherValidated = req.body?.teacherValidated !== false;
        row.submissions[idx].updatedAt = new Date();
        await row.save();
        res.json({ ok: true, submission: row.submissions[idx] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Fiche.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
