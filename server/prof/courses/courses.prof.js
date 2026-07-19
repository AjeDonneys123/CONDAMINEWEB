const express = require('express');
const router = express.Router();
const { Course } = require('../models/prof.models');

const extractPresentationId = (value = '') => {
    const text = String(value || '').trim();
    if (!text) return '';
    const pathMatch = text.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/i);
    if (pathMatch?.[1]) return pathMatch[1];
    const idMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    return idMatch?.[1] || '';
};

const normalizeCourse = (body = {}) => {
    const slidesUrl = String(body.slidesUrl || '').trim();
    const presentationId = extractPresentationId(slidesUrl);
    if (!presentationId) {
        const error = new Error('Lien Google Slides invalide');
        error.statusCode = 400;
        throw error;
    }

    const title = String(body.title || '').trim();
    const targetClassroomId = String(body.targetClassroomId || '').trim();
    if (!title) {
        const error = new Error('Le titre du cours est requis');
        error.statusCode = 400;
        throw error;
    }
    if (!targetClassroomId) {
        const error = new Error('La classe est requise');
        error.statusCode = 400;
        throw error;
    }

    return {
        title,
        description: String(body.description || '').trim(),
        slidesUrl,
        presentationId,
        embedUrl: `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`,
        teacherId: body.teacherId || null,
        targetClassroomId,
        targetClassroomName: String(body.targetClassroomName || '').trim(),
        isEnabled: body.isEnabled !== false,
        publishedUntilSlide: Math.max(0, Math.floor(Number(body.publishedUntilSlide || 0))),
        overlays: Array.isArray(body.overlays) ? body.overlays : []
    };
};

router.get('/', async (req, res) => {
    try {
        const classId = String(req.query.classId || '').trim();
        const query = classId ? { targetClassroomId: classId } : {};
        const rows = await Course.find(query).sort({ date: -1, createdAt: -1 }).lean();
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const row = await Course.create(normalizeCourse(req.body));
        res.status(201).json(row);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const row = await Course.findByIdAndUpdate(
            req.params.id,
            { $set: normalizeCourse(req.body) },
            { new: true, runValidators: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        res.json(row);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const row = await Course.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled: req.body?.isEnabled !== false } },
            { new: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        res.json(row);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id/progress', async (req, res) => {
    try {
        const publishedUntilSlide = Math.max(0, Math.floor(Number(req.body?.publishedUntilSlide || 0)));
        const row = await Course.findByIdAndUpdate(
            req.params.id,
            { $set: { publishedUntilSlide } },
            { new: true, runValidators: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        res.json(row);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const row = await Course.findByIdAndDelete(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
