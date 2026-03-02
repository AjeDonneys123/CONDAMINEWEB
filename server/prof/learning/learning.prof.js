const express = require('express');
const router = express.Router();
const { LearningModule } = require('../models/prof.models');

const sanitizeSteps = (steps = []) => {
    if (!Array.isArray(steps)) return [];
    return steps
        .map((step, idx) => {
            const type = String(step?.type || '').toLowerCase();
            if (!['sheet', 'video', 'question'].includes(type)) return null;
            const base = {
                id: String(step?.id || `step_${idx + 1}`),
                title: String(step?.title || '').trim().slice(0, 120),
                type
            };
            if (type === 'sheet') {
                return {
                    ...base,
                    sheetUrl: String(step?.sheetUrl || '').trim(),
                    minReadSeconds: Math.max(5, Math.min(600, Number(step?.minReadSeconds || 20)))
                };
            }
            if (type === 'video') {
                return {
                    ...base,
                    videoUrl: String(step?.videoUrl || '').trim(),
                    thumbnailUrl: String(step?.thumbnailUrl || '').trim(),
                    mustWatchToEnd: step?.mustWatchToEnd !== false
                };
            }
            return {
                ...base,
                difficulty: ['easy', 'medium', 'hard'].includes(String(step?.difficulty || '').toLowerCase())
                    ? String(step.difficulty).toLowerCase()
                    : 'easy',
                customQuestion: String(step?.customQuestion || '').trim(),
                sourceSheetUrl: String(step?.sourceSheetUrl || '').trim(),
                orangeHighlights: Array.isArray(step?.orangeHighlights)
                    ? step.orangeHighlights.map(k => String(k || '').trim()).filter(Boolean).slice(0, 30)
                    : String(step?.orangeHighlights || '')
                        .split(',')
                        .map(k => k.trim())
                        .filter(Boolean)
                        .slice(0, 30),
                pinkHighlights: Array.isArray(step?.pinkHighlights)
                    ? step.pinkHighlights.map(k => String(k || '').trim().toLowerCase()).filter(Boolean).slice(0, 30)
                    : String(step?.pinkHighlights || '')
                        .split(',')
                        .map(k => k.trim().toLowerCase())
                        .filter(Boolean)
                        .slice(0, 30),
                keywords: Array.isArray(step?.keywords)
                    ? step.keywords.map(k => String(k || '').trim().toLowerCase()).filter(Boolean).slice(0, 20)
                    : String(step?.keywords || '')
                        .split(',')
                        .map(k => k.trim().toLowerCase())
                        .filter(Boolean)
                        .slice(0, 20),
                minKeywordMatches: Math.max(1, Math.min(10, Number(step?.minKeywordMatches || 1)))
            };
        })
        .filter(Boolean)
        .map((step) => {
            if (step.type !== 'question') return step;
            // Les surlignages roses deviennent la base de correction élève.
            const mergedKeywords = [...new Set([...(step.keywords || []), ...(step.pinkHighlights || []).map(k => String(k || '').toLowerCase())])];
            return { ...step, keywords: mergedKeywords.slice(0, 30) };
        });
};

router.get('/all', async (_req, res) => {
    try {
        const rows = await LearningModule.find({}).sort({ createdAt: -1 }).lean();
        res.json(rows);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await LearningModule.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: "Apprentissage introuvable" });
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
        data.targetClassrooms = [...new Set((data.targetClassrooms || []).map(c => String(c || '').trim().toUpperCase()).filter(Boolean))];
        data.steps = sanitizeSteps(data.steps);
        if (!data.title) data.title = 'APPRENTISSAGE';

        const saved = data._id
            ? await LearningModule.findByIdAndUpdate(data._id, data, { new: true })
            : await LearningModule.create(data);
        res.json(saved);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const row = await LearningModule.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled } },
            { new: true }
        ).lean();
        if (!row) return res.status(404).json({ error: "Apprentissage introuvable" });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await LearningModule.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
