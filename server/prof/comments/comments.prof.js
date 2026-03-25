const express = require('express');
const router = express.Router();
const { CommentActivity } = require('../models/prof.models');

router.get('/all', async (_req, res) => {
    try {
        const rows = await CommentActivity.find({}).sort({ date: -1 }).lean();
        res.json(rows);
    } catch (_) {
        res.status(500).json([]);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await CommentActivity.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Commentaire introuvable' });
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
        data.documentUrls = (Array.isArray(data.documentUrls) ? data.documentUrls : []).map((u) => String(u || '').trim()).filter(Boolean).slice(0, 12);
        data.documentExtractions = (Array.isArray(data.documentExtractions) ? data.documentExtractions : [])
            .map((row) => ({
                url: String(row?.url || '').trim(),
                extraction: String(row?.extraction || '').slice(0, 12000)
            }))
            .filter((row) => row.url)
            .slice(0, 12);
        const missingExtractions = data.documentUrls.some((url) => {
            const row = data.documentExtractions.find((item) => item.url === url);
            return !String(row?.extraction || '').trim();
        });
        if (missingExtractions) {
            return res.status(400).json({ error: 'Une extraction est obligatoire pour chaque document.' });
        }
        data.teacherPrompt = String(data.teacherPrompt || '').slice(0, 10000);
        data.teacherInstructions = String(data.teacherInstructions || '').slice(0, 5000);
        data.promptLevel = String(data.promptLevel || '').slice(0, 120);
        const row = data._id
            ? await CommentActivity.findByIdAndUpdate(data._id, data, { new: true })
            : await CommentActivity.create(data);
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const row = await CommentActivity.findByIdAndUpdate(req.params.id, { $set: { isEnabled } }, { new: true }).lean();
        if (!row) return res.status(404).json({ error: 'Commentaire introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await CommentActivity.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
