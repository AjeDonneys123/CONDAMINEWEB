const express = require('express');
const router = express.Router();
const { RevisionActivity } = require('../models/prof.models');

const sanitizeSlides = (slides = []) => [...new Set(
    (Array.isArray(slides) ? slides : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0)
        .map((x) => Math.floor(x))
)].sort((a, b) => a - b);

const sanitizeQuestions = (rows = []) =>
    (Array.isArray(rows) ? rows : [])
        .map((row) => ({
            question: String(row?.question || '').trim().slice(0, 500),
            expectedAnswer: String(row?.expectedAnswer || '').trim().slice(0, 500),
            expectedKeywords: (Array.isArray(row?.expectedKeywords) ? row.expectedKeywords : String(row?.expectedKeywords || '').split(','))
                .map((x) => String(x || '').trim())
                .filter(Boolean)
                .slice(0, 20)
        }))
        .filter((row) => row.question || row.expectedAnswer || row.expectedKeywords.length > 0)
        .slice(0, 30);

router.get('/all', async (_req, res) => {
    try {
        const rows = await RevisionActivity.find({}).sort({ date: -1 }).lean();
        res.json(rows);
    } catch (_) {
        res.status(500).json([]);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await RevisionActivity.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Révision introuvable' });
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
        data.targetClassrooms = [...new Set((data.targetClassrooms || []).map((c) => String(c || '').trim().toUpperCase()).filter(Boolean))];
        data.selectedSlides = sanitizeSlides(data.selectedSlides);
        data.teacherInstructions = String(data.teacherInstructions || '').slice(0, 4000);
        data.presentationUrl = String(data.presentationUrl || '').trim();
        data.submissions = Array.isArray(data.submissions) ? data.submissions.map((sub) => ({
            ...sub,
            questions: sanitizeQuestions(sub?.questions)
        })) : [];

        const row = data._id
            ? await RevisionActivity.findByIdAndUpdate(data._id, data, { new: true })
            : await RevisionActivity.create(data);
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const row = await RevisionActivity.findByIdAndUpdate(req.params.id, { $set: { isEnabled } }, { new: true }).lean();
        if (!row) return res.status(404).json({ error: 'Révision introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await RevisionActivity.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
