const express = require('express');
const router = express.Router();
const { Production } = require('../models/prof.models');

const sanitizeSlides = (slides = []) => [...new Set(
    (Array.isArray(slides) ? slides : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0)
        .map((x) => Math.floor(x))
)].sort((a, b) => a - b);

const sanitizeQuestions = (rows = [], type = 'fiche') => {
    return (Array.isArray(rows) ? rows : []).map((row) => {
        const prompt = String(row?.prompt || '').trim().slice(0, 600);
        const expectedAnswer = String(row?.expectedAnswer || '').trim().slice(0, 2000);
        const expectedKeywords = (Array.isArray(row?.expectedKeywords) ? row.expectedKeywords : [])
            .map((k) => String(k || '').trim())
            .filter(Boolean)
            .slice(0, 20);
        const options = (Array.isArray(row?.options) ? row.options : [])
            .map((opt) => String(opt || '').trim())
            .filter(Boolean)
            .slice(0, 6);
        return {
            prompt,
            expectedAnswer,
            expectedKeywords,
            oralPreferred: row?.oralPreferred !== false,
            options: type === 'qcm' ? options : [],
            correctIndex: type === 'qcm' ? Math.max(0, Math.min(options.length - 1, Number(row?.correctIndex || 0))) : 0
        };
    }).filter((row) => {
        if (type === 'qcm') return row.prompt && row.options.length >= 2;
        if (type === 'questionnaire') return row.prompt;
        return true;
    });
};

router.get('/all', async (_req, res) => {
    try {
        const rows = await Production.find({}).sort({ date: -1 }).lean();
        res.json(rows);
    } catch (_) {
        res.status(500).json([]);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await Production.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Production introuvable' });
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
        data.productionType = ['fiche', 'questionnaire', 'qcm'].includes(String(data.productionType || ''))
            ? String(data.productionType)
            : 'fiche';
        data.targetClassrooms = [...new Set((data.targetClassrooms || [])
            .map((c) => String(c || '').trim().toUpperCase())
            .filter(Boolean))];
        data.selectedSlides = sanitizeSlides(data.selectedSlides);
        data.teacherInstructions = String(data.teacherInstructions || '').slice(0, 4000);
        data.presentationUrl = String(data.presentationUrl || '').trim();
        data.questions = sanitizeQuestions(data.questions, data.productionType);

        const row = data._id
            ? await Production.findByIdAndUpdate(data._id, data, { new: true })
            : await Production.create(data);
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const row = await Production.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled } },
            { new: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Production introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/submissions/:studentId/validate', async (req, res) => {
    try {
        const row = await Production.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Production introuvable' });
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
        await Production.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
