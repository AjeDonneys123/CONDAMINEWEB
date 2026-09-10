const express = require('express');
const multer = require('multer');
const TrainingConfig = require('../models/TrainingConfig');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 20 }
});
const CONFIG_KEY = 'fifth-grade-map-attributes-v1';
const SCALE_CONFIG_KEY = 'fifth-grade-geographic-scales-v1';
const CURVE_CONFIG_KEY = 'fifth-grade-demographic-curves-v1';
const RQP_OFF_TOPIC_CONFIG_KEY = 'rqp-off-topic-v1';

const imageUrlMap = (document, route) => Object.fromEntries(
    (document?.images || []).map((image) => [image.id, `/api/training-config/${route}/image/${encodeURIComponent(image.id)}`])
);

router.get('/fifth-grade-map', async (_req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: CONFIG_KEY }).select('model images.id images.name updatedAt').lean();
        if (!document) return res.json({ model: null, imageUrls: {}, updatedAt: null });
        const imageUrls = Object.fromEntries((document.images || []).map((image) => [image.id, `/api/training-config/fifth-grade-map/image/${encodeURIComponent(image.id)}`]));
        return res.json({ model: document.model || null, imageUrls, updatedAt: document.updatedAt || null });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-map/image/:id', async (req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: CONFIG_KEY }).select('images').lean();
        const image = (document?.images || []).find((entry) => entry.id === req.params.id);
        if (!image) return res.status(404).end();
        res.setHeader('Content-Type', image.contentType || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data?.buffer || image.data || []);
        return res.send(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/fifth-grade-map', upload.array('images', 20), async (req, res) => {
    try {
        const model = JSON.parse(String(req.body?.model || '{}'));
        if (!Array.isArray(model.questions)) return res.status(400).json({ error: 'Modèle de cartes invalide.' });
        const images = (req.files || []).map((file) => {
            const separator = file.originalname.indexOf('__');
            const id = separator >= 0 ? file.originalname.slice(0, separator) : file.originalname;
            const name = separator >= 0 ? file.originalname.slice(separator + 2) : file.originalname;
            return { id, name, contentType: file.mimetype || 'image/png', data: file.buffer };
        });
        const document = await TrainingConfig.findOneAndUpdate(
            { key: CONFIG_KEY },
            { $set: { model, images } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ ok: true, updatedAt: document.updatedAt, questions: model.questions.length, images: images.length });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-scales', async (_req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: SCALE_CONFIG_KEY }).select('model images.id images.name updatedAt').lean();
        if (!document) return res.json({ model: null, imageUrls: {}, updatedAt: null });
        return res.json({ model: document.model || null, imageUrls: imageUrlMap(document, 'fifth-grade-scales'), updatedAt: document.updatedAt || null });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-scales/image/:id', async (req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: SCALE_CONFIG_KEY }).select('images').lean();
        const image = (document?.images || []).find((entry) => entry.id === req.params.id);
        if (!image) return res.status(404).end();
        res.setHeader('Content-Type', image.contentType || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data?.buffer || image.data || []);
        return res.send(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/fifth-grade-scales', upload.array('images', 50), async (req, res) => {
    try {
        const model = JSON.parse(String(req.body?.model || '{}'));
        if (!Array.isArray(model.questions)) return res.status(400).json({ error: "Modèle d'échelles invalide." });
        const images = (req.files || []).map((file) => {
            const separator = file.originalname.indexOf('__');
            const id = separator >= 0 ? file.originalname.slice(0, separator) : file.originalname;
            const name = separator >= 0 ? file.originalname.slice(separator + 2) : file.originalname;
            return { id, name, contentType: file.mimetype || 'image/png', data: file.buffer };
        });
        const document = await TrainingConfig.findOneAndUpdate(
            { key: SCALE_CONFIG_KEY },
            { $set: { model, images } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ ok: true, updatedAt: document.updatedAt, questions: model.questions.length, images: images.length });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-curves', async (_req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: CURVE_CONFIG_KEY }).select('model images.id images.name updatedAt').lean();
        if (!document) return res.json({ model: null, imageUrls: {}, updatedAt: null });
        return res.json({ model: document.model || null, imageUrls: imageUrlMap(document, 'fifth-grade-curves'), updatedAt: document.updatedAt || null });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-curves/image/:id', async (req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: CURVE_CONFIG_KEY }).select('images').lean();
        const image = (document?.images || []).find((entry) => entry.id === req.params.id);
        if (!image) return res.status(404).end();
        res.setHeader('Content-Type', image.contentType || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data?.buffer || image.data || []);
        return res.send(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/fifth-grade-curves', upload.array('images', 50), async (req, res) => {
    try {
        const model = JSON.parse(String(req.body?.model || '{}'));
        if (!Array.isArray(model.questions)) return res.status(400).json({ error: 'Modèle de courbes invalide.' });
        const images = (req.files || []).map((file) => {
            const separator = file.originalname.indexOf('__');
            const id = separator >= 0 ? file.originalname.slice(0, separator) : file.originalname;
            const name = separator >= 0 ? file.originalname.slice(separator + 2) : file.originalname;
            return { id, name, contentType: file.mimetype || 'image/png', data: file.buffer };
        });
        const document = await TrainingConfig.findOneAndUpdate(
            { key: CURVE_CONFIG_KEY },
            { $set: { model, images } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ ok: true, updatedAt: document.updatedAt, questions: model.questions.length, images: images.length });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// The RQP "hors-sujet" calibration used to live only in the teacher's
// localStorage.  Keeping it here makes the exercises available to every
// student account, independently of the browser used by the teacher.
const cleanOffTopicParagraphs = (paragraphs) => {
    if (!Array.isArray(paragraphs) || paragraphs.length === 0) return null;
    return paragraphs.slice(0, 12).map((entry, index) => ({
        id: String(entry?.id || `paragraph-${index + 1}`).slice(0, 100),
        subject: String(entry?.subject || '').trim().slice(0, 2000),
        sourceText: String(entry?.sourceText ?? entry?.text ?? '').slice(0, 12000),
        explanation: String(entry?.explanation || '').trim().slice(0, 4000)
    }));
};

router.get('/rqp-off-topic', async (_req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: RQP_OFF_TOPIC_CONFIG_KEY }).select('model updatedAt').lean();
        return res.json({ model: document?.model || null, updatedAt: document?.updatedAt || null });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/rqp-off-topic', async (req, res) => {
    try {
        const paragraphs = cleanOffTopicParagraphs(req.body?.model?.paragraphs ?? req.body?.paragraphs);
        if (!paragraphs) return res.status(400).json({ error: 'Calibrage hors-sujet invalide.' });
        const model = { paragraphs };
        const document = await TrainingConfig.findOneAndUpdate(
            { key: RQP_OFF_TOPIC_CONFIG_KEY },
            { $set: { model } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ ok: true, model, updatedAt: document.updatedAt, paragraphs: paragraphs.length });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
