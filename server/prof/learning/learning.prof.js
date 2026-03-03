const express = require('express');
const router = express.Router();
const { LearningModule, VideoSegment } = require('../models/prof.models');
const fetch = require('node-fetch');
const ProfAI = require('../core/prof.ai');
const ProfDrive = require('../core/drive.prof');

const normalizeVideoUrl = (url = '') => {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const u = new URL(raw);
        ['start', 'end', 't'].forEach((k) => u.searchParams.delete(k));
        return u.toString();
    } catch (_) {
        return raw;
    }
};

const sanitizeRanges = (ranges = [], max = 500) => (Array.isArray(ranges)
    ? ranges
        .map((r) => ({ start: Math.max(0, Number(r?.start || 0)), end: Math.max(0, Number(r?.end || 0)) }))
        .filter((r) => r.end > r.start)
        .slice(0, max)
    : []);

const sanitizeMarkers = (markers = [], textLength = 0, max = 500) => {
    const limit = Math.max(0, Number(textLength || 0));
    return [...new Set((Array.isArray(markers) ? markers : [])
        .map((m) => Math.max(0, Math.floor(Number(m || 0))))
        .filter((m) => Number.isFinite(m) && m > 0 && (!limit || m < limit)))]
        .sort((a, b) => a - b)
        .slice(0, max);
};

const markersFromLegacyRanges = (ranges = [], textLength = 0, max = 500) =>
    sanitizeMarkers(sanitizeRanges(ranges, max).map((r) => r.end), textLength, max);

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
                const sheetText = String(step?.sheetText || '').slice(0, 60000);
                const sheetZoneRanges = sanitizeRanges(step?.sheetZoneRanges);
                return {
                    ...base,
                    sheetUrl: String(step?.sheetUrl || '').trim(),
                    sheetText,
                    sheetPinkRanges: sanitizeRanges(step?.sheetPinkRanges),
                    sheetZoneRanges,
                    sheetZoneMarkers: sanitizeMarkers(step?.sheetZoneMarkers, sheetText.length).length > 0
                        ? sanitizeMarkers(step?.sheetZoneMarkers, sheetText.length)
                        : markersFromLegacyRanges(sheetZoneRanges, sheetText.length),
                    sheetPinkHighlights: Array.isArray(step?.sheetPinkHighlights)
                        ? step.sheetPinkHighlights.map(k => String(k || '').trim().toLowerCase()).filter(Boolean).slice(0, 60)
                        : [],
                    sheetZoneHighlights: Array.isArray(step?.sheetZoneHighlights)
                        ? step.sheetZoneHighlights.map(k => String(k || '').trim()).filter(Boolean).slice(0, 120)
                        : [],
                    sheetKeywords: Array.isArray(step?.sheetKeywords)
                        ? step.sheetKeywords.map(k => String(k || '').trim().toLowerCase()).filter(Boolean).slice(0, 120)
                        : [],
                    minReadSeconds: Math.max(5, Math.min(600, Number(step?.minReadSeconds || 20)))
                };
            }
            if (type === 'video') {
                const startSec = Math.max(0, Number(step?.startSec || step?.videoStartSec || 0));
                const endRaw = Number(step?.endSec || step?.videoEndSec || 0);
                const endSec = endRaw > startSec ? endRaw : 0;
                const videoTranscript = String(step?.videoTranscript || '').slice(0, 25000);
                const videoZoneRanges = sanitizeRanges(step?.videoZoneRanges);
                return {
                    ...base,
                    videoUrl: String(step?.videoUrl || '').trim(),
                    thumbnailUrl: String(step?.thumbnailUrl || '').trim(),
                    videoTranscript,
                    videoPinkRanges: sanitizeRanges(step?.videoPinkRanges),
                    videoZoneRanges,
                    videoZoneMarkers: sanitizeMarkers(step?.videoZoneMarkers, videoTranscript.length).length > 0
                        ? sanitizeMarkers(step?.videoZoneMarkers, videoTranscript.length)
                        : markersFromLegacyRanges(videoZoneRanges, videoTranscript.length),
                    videoPinkHighlights: Array.isArray(step?.videoPinkHighlights)
                        ? step.videoPinkHighlights.map(k => String(k || '').trim().toLowerCase()).filter(Boolean).slice(0, 60)
                        : [],
                    videoZoneHighlights: Array.isArray(step?.videoZoneHighlights)
                        ? step.videoZoneHighlights.map(k => String(k || '').trim()).filter(Boolean).slice(0, 120)
                        : [],
                    videoKeywords: Array.isArray(step?.videoKeywords)
                        ? step.videoKeywords.map(k => String(k || '').trim().toLowerCase()).filter(Boolean).slice(0, 120)
                        : [],
                    startSec,
                    endSec,
                    mustWatchToEnd: step?.mustWatchToEnd !== false
                };
            }
            const materialText = String(step?.materialText || '').slice(0, 60000);
            const questionZoneRanges = sanitizeRanges(step?.questionZoneRanges);
            return {
                ...base,
                difficulty: ['easy', 'medium', 'hard'].includes(String(step?.difficulty || '').toLowerCase())
                    ? String(step.difficulty).toLowerCase()
                    : 'easy',
                customQuestion: String(step?.customQuestion || '').trim(),
                sourceSheetUrl: String(step?.sourceSheetUrl || '').trim(),
                materialSource: String(step?.materialSource || '').trim().slice(0, 80),
                materialText,
                questionPinkRanges: sanitizeRanges(step?.questionPinkRanges),
                questionZoneRanges,
                questionZoneMarkers: sanitizeMarkers(step?.questionZoneMarkers, materialText.length).length > 0
                    ? sanitizeMarkers(step?.questionZoneMarkers, materialText.length)
                    : markersFromLegacyRanges(questionZoneRanges, materialText.length),
                sheetAnnotations: Array.isArray(step?.sheetAnnotations)
                    ? step.sheetAnnotations
                        .map((a) => ({
                            x: Math.max(0, Math.min(100, Number(a?.x || 0))),
                            y: Math.max(0, Math.min(100, Number(a?.y || 0))),
                            w: Math.max(0, Math.min(100, Number(a?.w || 0))),
                            h: Math.max(0, Math.min(100, Number(a?.h || 0))),
                            color: String(a?.color || '').toLowerCase() === 'orange' ? 'orange' : 'red',
                            label: String(a?.label || '').trim().slice(0, 120)
                        }))
                        .filter((a) => a.label && a.w > 0 && a.h > 0)
                        .slice(0, 120)
                    : [],
                orangeHighlights: Array.isArray(step?.orangeHighlights)
                    ? step.orangeHighlights.map(k => String(k || '').trim()).filter(Boolean).slice(0, 30)
                    : String(step?.orangeHighlights || '')
                        .split(',')
                        .map(k => k.trim())
                        .filter(Boolean)
                        .slice(0, 30),
                redHighlights: Array.isArray(step?.redHighlights)
                    ? step.redHighlights.map(k => String(k || '').trim().toLowerCase()).filter(Boolean).slice(0, 30)
                    : String(step?.redHighlights || '')
                        .split(',')
                        .map(k => k.trim().toLowerCase())
                        .filter(Boolean)
                        .slice(0, 30),
                zoneHighlights: Array.isArray(step?.zoneHighlights)
                    ? step.zoneHighlights.map(k => String(k || '').trim()).filter(Boolean).slice(0, 120)
                    : [],
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
            const annOrange = (step.sheetAnnotations || [])
                .filter((a) => a.color === 'orange')
                .map((a) => String(a.label || '').trim())
                .filter(Boolean);
            const annRed = (step.sheetAnnotations || [])
                .filter((a) => a.color === 'red')
                .map((a) => String(a.label || '').trim().toLowerCase())
                .filter(Boolean);
            const mergedOrange = [...new Set([...(step.orangeHighlights || []), ...annOrange])];
            const mergedRed = [...new Set([...(step.redHighlights || []), ...(step.pinkHighlights || []), ...annRed])];
            // Les surlignages roses deviennent la base de correction élève.
            const mergedKeywords = [...new Set([...(step.keywords || []), ...mergedRed])];
            return {
                ...step,
                orangeHighlights: mergedOrange.slice(0, 30),
                redHighlights: mergedRed.slice(0, 30),
                keywords: mergedKeywords.slice(0, 30)
            };
        });
};

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
});

const parseProxyFileId = (url = '') => {
    const raw = String(url || '').trim();
    const m = raw.match(/\/api\/structure\/proxy\/([^/?#]+)/i);
    return m?.[1] ? decodeURIComponent(m[1]) : '';
};

const fetchSheetBinary = async (sheetUrl = '') => {
    const raw = String(sheetUrl || '').trim();
    if (!raw) return { ok: false, error: 'URL vide' };

    const proxyFileId = parseProxyFileId(raw);
    if (proxyFileId) {
        const driveRes = await ProfDrive.getFileResponse(proxyFileId);
        const buff = await streamToBuffer(driveRes.stream);
        const mime = String(driveRes.headers?.['content-type'] || 'application/pdf').split(';')[0].trim();
        return { ok: true, mime, buffer: buff };
    }

    const res = await fetch(raw);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const arr = await res.arrayBuffer();
    const buffer = Buffer.from(arr);
    const mime = String(res.headers.get('content-type') || 'application/pdf').split(';')[0].trim();
    return { ok: true, mime, buffer };
};

router.post('/extract-sheet-text', async (req, res) => {
    try {
        const sheetUrl = String(req.body?.sheetUrl || '').trim();
        if (!sheetUrl) return res.status(400).json({ error: 'sheetUrl requis' });

        const file = await fetchSheetBinary(sheetUrl);
        if (!file.ok) return res.status(400).json({ error: file.error || 'Impossible de lire la fiche' });

        const maxBytes = 12 * 1024 * 1024;
        const payload = file.buffer.length > maxBytes ? file.buffer.slice(0, maxBytes) : file.buffer;

        const promptParts = [
            { text: "Extrait le texte lisible de ce document pédagogique en français. Réponds uniquement avec le texte brut extrait, sans commentaire." },
            { inlineData: { mimeType: file.mime || 'application/pdf', data: payload.toString('base64') } }
        ];
        const raw = await ProfAI.ask(promptParts, "Tu es un extracteur OCR strict. Renvoie uniquement le texte brut du document.");
        const text = String(raw || '').trim();
        if (!text || text.startsWith('ERROR_')) {
            return res.status(500).json({ error: "Échec extraction IA." });
        }
        return res.json({ text: text.slice(0, 60000), mime: file.mime || '' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

const parseJsonArray = (raw = '') => {
    const text = String(raw || '').trim();
    if (!text) return [];
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return [];
    try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        if (!Array.isArray(parsed)) return [];
        return parsed.map((x) => String(x || '').trim()).filter(Boolean);
    } catch (_) {
        return [];
    }
};

router.post('/auto-highlight', async (req, res) => {
    try {
        const text = String(req.body?.text || '').trim();
        const max = Math.max(3, Math.min(20, Number(req.body?.max || 10)));
        if (!text) return res.status(400).json({ error: 'text requis' });
        const clipped = text.slice(0, 20000);
        const prompt = [
            { text: `Extrait ${max} passages clés utiles pour évaluer la compréhension d'un élève. Chaque passage doit être court (3-15 mots), exact, et apparaître mot pour mot dans le texte.` },
            { text: `Texte source:\n${clipped}` },
            { text: `Réponds uniquement en JSON: ["passage 1","passage 2"]` }
        ];
        const raw = await ProfAI.ask(prompt, "Tu sélectionnes des réponses attendues. Format strict JSON array uniquement.");
        const snippets = parseJsonArray(raw).slice(0, max);
        if (!snippets.length) return res.status(500).json({ error: 'Aucun passage généré' });
        res.json({ snippets });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/all', async (_req, res) => {
    try {
        const rows = await LearningModule.find({}).sort({ createdAt: -1 }).lean();
        res.json(rows);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/video-segments', async (req, res) => {
    try {
        const teacherId = String(req.query.teacherId || '').trim();
        const url = String(req.query.url || '').trim();
        const normalizedUrl = normalizeVideoUrl(url);
        if (!teacherId || !normalizedUrl) return res.json([]);
        const list = await VideoSegment.find({ teacherId, normalizedUrl }).sort({ order: 1, createdAt: 1 }).lean();
        res.json(list);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.post('/video-segments', async (req, res) => {
    try {
        const teacherId = String(req.body?.teacherId || '').trim();
        const originalUrl = String(req.body?.url || '').trim();
        const normalizedUrl = normalizeVideoUrl(originalUrl);
        const label = String(req.body?.label || '').trim();
        const transcript = String(req.body?.transcript || '').slice(0, 25000);
        const startSec = Math.max(0, Number(req.body?.startSec || 0));
        const endSecRaw = Math.max(0, Number(req.body?.endSec || 0));
        const endSec = endSecRaw > startSec ? endSecRaw : 0;
        if (!teacherId || !normalizedUrl) return res.status(400).json({ error: 'teacherId/url requis' });
        const order = await VideoSegment.countDocuments({ teacherId, normalizedUrl }) + 1;
        const row = await VideoSegment.create({
            teacherId,
            originalUrl,
            normalizedUrl,
            label,
            transcript,
            startSec,
            endSec,
            order
        });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/video-segments/:id', async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const teacherId = String(req.body?.teacherId || '').trim();
        const patch = {};
        if (req.body?.label !== undefined) patch.label = String(req.body.label || '').trim();
        if (req.body?.transcript !== undefined) patch.transcript = String(req.body.transcript || '').slice(0, 25000);
        if (req.body?.startSec !== undefined) patch.startSec = Math.max(0, Number(req.body.startSec || 0));
        if (req.body?.endSec !== undefined) {
            const endSecRaw = Math.max(0, Number(req.body.endSec || 0));
            const startSec = patch.startSec !== undefined ? patch.startSec : undefined;
            patch.endSec = startSec !== undefined && endSecRaw > 0 && endSecRaw <= startSec ? 0 : endSecRaw;
        }
        const row = await VideoSegment.findOneAndUpdate({ _id: id, teacherId }, { $set: patch }, { new: true }).lean();
        if (!row) return res.status(404).json({ error: 'Segment introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/video-segments/:id', async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const teacherId = String(req.query.teacherId || req.body?.teacherId || '').trim();
        const target = await VideoSegment.findOneAndDelete({ _id: id, teacherId }).lean();
        if (!target) return res.status(404).json({ error: 'Segment introuvable' });
        const list = await VideoSegment.find({ teacherId, normalizedUrl: target.normalizedUrl }).sort({ order: 1, createdAt: 1 });
        for (let i = 0; i < list.length; i += 1) {
            list[i].order = i + 1;
            await list[i].save();
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
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

router.patch('/:id/step-text', async (req, res) => {
    try {
        const moduleId = String(req.params.id || '').trim();
        const stepId = String(req.body?.stepId || '').trim();
        const kind = String(req.body?.kind || 'sheet').trim(); // sheet | video | question
        const text = String(req.body?.text || '').slice(0, 60000);
        if (!moduleId || !stepId) return res.status(400).json({ error: 'moduleId/stepId requis' });
        const row = await LearningModule.findById(moduleId);
        if (!row) return res.status(404).json({ error: 'Apprentissage introuvable' });
        const steps = Array.isArray(row.steps) ? [...row.steps] : [];
        const idx = steps.findIndex((s) => String(s?.id || '') === stepId);
        if (idx < 0) return res.status(404).json({ error: 'Étape introuvable' });
        const target = { ...(steps[idx] || {}) };
        if (kind === 'video') target.videoTranscript = text;
        else if (kind === 'question') target.materialText = text;
        else target.sheetText = text;
        steps[idx] = target;
        row.steps = steps;
        await row.save();
        res.json({ ok: true });
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
