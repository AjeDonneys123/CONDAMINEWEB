const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { LearningModule, Student, VideoSegment, VideoSource, GptInboxMessage } = require('../models/prof.models');
const fetch = require('node-fetch');
const ProfAI = require('../core/prof.ai');
const ProfDrive = require('../core/drive.prof');

const sanitizeGptInboxImages = (images = []) => {
    if (!Array.isArray(images)) return [];
    return images.slice(0, 8).map((img, idx) => {
        if (typeof img === 'string') {
            const raw = img.trim();
            return raw ? { url: raw.slice(0, 250000), name: `image_${idx + 1}` } : null;
        }
        if (!img || typeof img !== 'object') return null;
        const url = String(img.url || img.dataUrl || img.src || '').trim();
        const caption = String(img.caption || img.description || '').trim().slice(0, 500);
        const name = String(img.name || img.filename || `image_${idx + 1}`).trim().slice(0, 120);
        if (!url) return null;
        return { url: url.slice(0, 250000), caption, name };
    }).filter(Boolean);
};

const sanitizeGptStringList = (value = [], max = 12) => {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    return source
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, max);
};

const sanitizeGptErrors = (value = [], max = 20) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            return {
                question: String(item.question || item.prompt || '').trim().slice(0, 500),
                expected: String(item.expected || item.expectedAnswer || '').trim().slice(0, 500),
                studentAnswer: String(item.studentAnswer || item.answer || item.response || '').trim().slice(0, 500)
            };
        })
        .filter((item) => item && (item.question || item.expected || item.studentAnswer))
        .slice(0, max);
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeClassKey = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

async function findGptInboxStudent(body = {}) {
    const studentId = String(body.studentId || '').trim();
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        const byId = await Student.findById(studentId).lean();
        if (byId) return byId;
    }
    const name = String(body.studentName || body.eleve || body.name || '').trim();
    if (!name) return null;
    const parts = name.split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    const query = {
        $and: parts.map((part) => {
            const rx = new RegExp(escapeRegex(part), 'i');
            return { $or: [{ firstName: rx }, { lastName: rx }, { nickname: rx }] };
        })
    };
    const cls = String(body.studentClass || body.classe || body.className || '').trim();
    const matches = await Student.find(query).limit(5).lean();
    if (!matches.length) return null;
    const classKey = normalizeClassKey(cls);
    if (classKey) {
        const classMatch = matches.find((student) => normalizeClassKey(student?.currentClass) === classKey);
        if (classMatch) return classMatch;
    }
    return matches.length === 1 ? matches[0] : null;
}

async function markLearningValidatedFromGpt({ moduleId = '', student = null }) {
    if (!student) return false;
    let module = null;
    if (moduleId && mongoose.Types.ObjectId.isValid(moduleId)) {
        module = await LearningModule.findById(moduleId);
    }
    if (!module) {
        const classKey = normalizeClassKey(student.currentClass);
        const candidates = await LearningModule.find({
            isEnabled: { $ne: false },
            $or: [{ assignedStudents: student._id }, { isAllClass: true }]
        }).sort({ date: -1, createdAt: -1 }).limit(20);
        module = candidates.find((candidate) => {
            const assigned = (candidate.assignedStudents || []).some((id) => String(id) === String(student._id));
            if (assigned) return true;
            if (!candidate.isAllClass) return false;
            if (!classKey) return true;
            return (candidate.targetClassrooms || []).some((target) => normalizeClassKey(target) === classKey);
        }) || null;
    }
    if (!module) return false;
    const now = new Date();
    const sid = String(student._id);
    const completions = Array.isArray(module.completions) ? module.completions : [];
    const idx = completions.findIndex((entry) => String(entry?.studentId || '') === sid);
    if (idx >= 0) {
        module.completions[idx].completedAt = module.completions[idx].completedAt || now;
        module.completions[idx].currentStep = Array.isArray(module.steps) ? module.steps.length : Number(module.completions[idx].currentStep || 0);
        module.completions[idx].lastUpdateAt = now;
    } else {
        module.completions.push({
            studentId: student._id,
            completedAt: now,
            currentStep: Array.isArray(module.steps) ? module.steps.length : 0,
            lastUpdateAt: now
        });
    }
    await module.save();
    return true;
}

const checkGptInboxToken = (req) => {
    const expected = String(process.env.GPT_INBOX_TOKEN || '').trim();
    if (!expected) return true;
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const bodyToken = String(req.body?.token || req.query?.token || '').trim();
    return auth === expected || bodyToken === expected;
};

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

const timelineSegmentCompare = (a, b) => {
    const as = Math.max(0, Number(a?.startSec || 0));
    const bs = Math.max(0, Number(b?.startSec || 0));
    if (as !== bs) return as - bs;
    const aeRaw = Math.max(0, Number(a?.endSec || 0));
    const beRaw = Math.max(0, Number(b?.endSec || 0));
    const ae = aeRaw > 0 ? aeRaw : Number.MAX_SAFE_INTEGER;
    const be = beRaw > 0 ? beRaw : Number.MAX_SAFE_INTEGER;
    if (ae !== be) return ae - be;
    return String(a?._id || '').localeCompare(String(b?._id || ''));
};

const resequenceVideoSegments = async (teacherId = '', normalizedUrl = '', stepId = '') => {
    if (!teacherId || !normalizedUrl) return;
    const query = { teacherId, normalizedUrl };
    if (String(stepId || '').trim()) query.stepId = String(stepId).trim();
    const rows = await VideoSegment.find(query).sort({ createdAt: 1 });
    rows.sort(timelineSegmentCompare);
    for (let i = 0; i < rows.length; i += 1) {
        const wanted = i + 1;
        if (Number(rows[i].order || 0) === wanted) continue;
        rows[i].order = wanted;
        await rows[i].save();
    }
};

const pickBestSegmentSource = async (teacherId = '', excludeNormalizedUrl = '') => {
    if (!teacherId) return null;
    const rows = await VideoSegment.find({ teacherId }).lean();
    if (!rows.length) return null;
    const byUrl = new Map();
    rows.forEach((r) => {
        const key = String(r.normalizedUrl || '').trim();
        if (!key || key === excludeNormalizedUrl) return;
        if (!byUrl.has(key)) byUrl.set(key, []);
        byUrl.get(key).push(r);
    });
    let best = null;
    for (const [url, list] of byUrl.entries()) {
        const count = list.length;
        const latestTs = Math.max(...list.map((x) => new Date(x.updatedAt || x.createdAt || 0).getTime()));
        if (!best || count > best.count || (count === best.count && latestTs > best.latestTs)) {
            best = { url, list, count, latestTs };
        }
    }
    return best;
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

const sanitizeSections = (sections = []) => {
    if (!Array.isArray(sections)) return [{ id: 'sec_1', name: 'Section 1', order: 0, visible: true }];
    const used = new Set();
    const out = [];
    sections.forEach((s, idx) => {
        const baseId = String(s?.id || `sec_${idx + 1}`).trim() || `sec_${idx + 1}`;
        let id = baseId;
        let n = 2;
        while (used.has(id)) {
            id = `${baseId}_${n}`;
            n += 1;
        }
        used.add(id);
        const name = String(s?.name || `Section ${idx + 1}`).trim().slice(0, 120) || `Section ${idx + 1}`;
        out.push({ id, name, order: idx, visible: s?.visible !== false });
    });
    return out.length ? out : [{ id: 'sec_1', name: 'Section 1', order: 0, visible: true }];
};

const sanitizeSteps = (steps = []) => {
    if (!Array.isArray(steps)) return [];
    const sanitized = steps
        .map((step, idx) => {
            const type = String(step?.type || '').toLowerCase();
            if (!['sheet', 'video', 'question'].includes(type)) return null;
            const base = {
                id: String(step?.id || `step_${idx + 1}`),
                title: String(step?.title || '').trim().slice(0, 120),
                type,
                sectionId: String(step?.sectionId || '').trim().slice(0, 120)
            };
            if (type === 'sheet') {
                const sheetText = String(step?.sheetText || '').slice(0, 60000);
                const sheetZoneRanges = sanitizeRanges(step?.sheetZoneRanges);
                return {
                    ...base,
                    sheetUrl: String(step?.sheetUrl || '').trim(),
                    sheetText,
                    sheetSlidesCondition: String(step?.sheetSlidesCondition || '').trim().slice(0, 200),
                    sheetSlideSectionMap: (() => {
                        const raw = step?.sheetSlideSectionMap && typeof step.sheetSlideSectionMap === 'object'
                            ? step.sheetSlideSectionMap
                            : {};
                        const out = {};
                        Object.keys(raw).slice(0, 300).forEach((k) => {
                            const slideId = String(k || '').trim().slice(0, 120);
                            const sectionId = String(raw[k] || '').trim().slice(0, 120);
                            if (!slideId || !sectionId) return;
                            out[slideId] = sectionId;
                        });
                        return out;
                    })(),
                    sheetSlideTextMap: (() => {
                        const raw = step?.sheetSlideTextMap && typeof step.sheetSlideTextMap === 'object'
                            ? step.sheetSlideTextMap
                            : {};
                        const out = {};
                        Object.keys(raw).slice(0, 300).forEach((k) => {
                            const slideId = String(k || '').trim().slice(0, 120);
                            if (!slideId) return;
                            out[slideId] = String(raw[k] || '').replace(/\r/g, '').slice(0, 60000);
                        });
                        return out;
                    })(),
                    sheetDocFilterCondition: String(step?.sheetDocFilterCondition || '').trim().slice(0, 200),
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
                    questionCount: Math.max(1, Math.min(20, Number(step?.questionCount || 3))),
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
                    videoSourceName: String(step?.videoSourceName || '').trim().slice(0, 120),
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
                    questionCount: Math.max(1, Math.min(20, Number(step?.questionCount || 3))),
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
                sourceKind: ['sheet', 'video', 'slides'].includes(String(step?.sourceKind || '').toLowerCase())
                    ? String(step.sourceKind).toLowerCase()
                    : 'sheet',
                sourceSheetUrl: String(step?.sourceSheetUrl || '').trim(),
                sourceVideoRef: String(step?.sourceVideoRef || '').trim(),
                sourceSlidesUrl: String(step?.sourceSlidesUrl || '').trim(),
                materialSource: String(step?.materialSource || '').trim().slice(0, 80),
                materialText,
                questionSlideTextMap: (() => {
                    const raw = step?.questionSlideTextMap && typeof step.questionSlideTextMap === 'object'
                        ? step.questionSlideTextMap
                        : {};
                    const out = {};
                    Object.keys(raw).slice(0, 300).forEach((k) => {
                        const slideId = String(k || '').trim().slice(0, 120);
                        if (!slideId) return;
                        out[slideId] = String(raw[k] || '').replace(/\r/g, '').slice(0, 60000);
                    });
                    return out;
                })(),
                questionCount: Math.max(1, Math.min(20, Number(step?.questionCount || 3))),
                questionAnswerPairs: Array.isArray(step?.questionAnswerPairs)
                    ? step.questionAnswerPairs
                        .map((pair) => ({
                            question: String(pair?.question || '').trim().slice(0, 500),
                            answer: String(pair?.answer || pair?.expectedAnswer || '').trim().slice(0, 500),
                            generatedByAi: pair?.generatedByAi === true,
                            expectedKeywords: Array.isArray(pair?.expectedKeywords)
                                ? pair.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20)
                                : []
                        }))
                        .filter((pair) => pair.question || pair.answer || (pair.expectedKeywords || []).length > 0)
                        .slice(0, 20)
                    : [],
                questionSectionQuestions: (() => {
                    const raw = step?.questionSectionQuestions && typeof step.questionSectionQuestions === 'object'
                        ? step.questionSectionQuestions
                        : {};
                    const clean = {};
                    Object.keys(raw).forEach((k) => {
                        const sectionIdx = Number(k);
                        if (!Number.isFinite(sectionIdx) || sectionIdx < 0) return;
                        const rows = Array.isArray(raw[k]) ? raw[k] : [];
                        const mapped = rows
                            .map((q) => ({
                                q: String(q?.q || q?.question || '').trim().slice(0, 500),
                                question: String(q?.question || q?.q || '').trim().slice(0, 500),
                                expectedAnswer: String(q?.expectedAnswer || '').trim().slice(0, 500),
                                generatedByAi: q?.generatedByAi === true,
                                expectedKeywords: Array.isArray(q?.expectedKeywords)
                                    ? q.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30)
                                    : []
                            }))
                            .filter((q) => q.q || q.question || q.expectedAnswer || (q.expectedKeywords || []).length > 0)
                            .slice(0, 30);
                        if (mapped.length > 0) clean[String(sectionIdx)] = mapped;
                    });
                    return clean;
                })(),
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
    const usedIds = new Set();
    const ordered = sanitized.map((step, idx) => {
        const rawId = String(step?.id || `step_${idx + 1}`).trim() || `step_${idx + 1}`;
        let nextId = rawId;
        let suffix = 2;
        while (usedIds.has(nextId)) {
            nextId = `${rawId}_${suffix}`;
            suffix += 1;
        }
        usedIds.add(nextId);
        return {
            ...step,
            id: nextId,
            order: idx
        };
    });
    return ordered.map((step, idx) => {
        if (step.type !== 'question') return step;
        let previous = null;
        for (let i = idx - 1; i >= 0; i -= 1) {
            const candidate = ordered[i];
            if (!candidate) continue;
            if (candidate.type === 'sheet' || candidate.type === 'video') {
                previous = candidate;
                break;
            }
        }
        if (!previous) return step;
        if (previous.type === 'video') {
            return {
                ...step,
                sourceKind: 'video',
                sourceVideoRef: `video:${previous.id}`,
                sourceSheetUrl: '',
                sourceSlidesUrl: ''
            };
        }
        return {
            ...step,
            sourceKind: 'sheet',
            sourceSheetUrl: `sheet:${previous.id}`,
            sourceVideoRef: '',
            sourceSlidesUrl: ''
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
        const teacherId = String(req.body?.teacherId || '').trim();
        if (!sheetUrl) return res.status(400).json({ error: 'sheetUrl requis' });

        const file = await fetchSheetBinary(sheetUrl);
        if (!file.ok) return res.status(400).json({ error: file.error || 'Impossible de lire la fiche' });

        const maxBytes = 12 * 1024 * 1024;
        if (file.buffer.length > maxBytes) {
            return res.status(413).json({ error: `Fiche trop volumineuse (${Math.ceil(file.buffer.length / (1024 * 1024))} MB). Limite: 12 MB.` });
        }
        const payload = file.buffer;

        const mime = String(file.mime || 'application/pdf').toLowerCase();
        if (mime.startsWith('text/')) {
            const text = payload.toString('utf8').trim();
            if (!text) return res.status(422).json({ error: 'Fiche texte vide.' });
            return res.json({ text: text.slice(0, 60000), mime });
        }

        const promptParts = [
            { text: "Extrait le texte lisible de ce document pédagogique en français. Réponds uniquement avec le texte brut extrait, sans commentaire." },
            { inlineData: { mimeType: file.mime || 'application/pdf', data: payload.toString('base64') } }
        ];
        const raw = await ProfAI.ask(promptParts, "Tu es un extracteur OCR strict. Renvoie uniquement le texte brut du document.", { teacherId });
        const text = String(raw || '').trim();
        if (!text) {
            return res.status(500).json({ error: "Extraction vide." });
        }
        if (text.startsWith('ERROR_KEY')) {
            return res.status(500).json({ error: "Clé IA manquante côté serveur (GEMINI_API_KEY)." });
        }
        if (text.startsWith('ERROR_API')) {
            return res.status(502).json({ error: "Erreur API IA pendant l'extraction." });
        }
        if (text.startsWith('ERROR_AI_REACH')) {
            return res.status(504).json({ error: "IA injoignable (timeout réseau)." });
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
const parseJsonObjects = (raw = '') => {
    const text = String(raw || '').trim();
    if (!text) return [];
    const first = text.indexOf('[');
    const last = text.lastIndexOf(']');
    if (first === -1 || last === -1 || last <= first) return [];
    try {
        const parsed = JSON.parse(text.slice(first, last + 1));
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
};

const shortenExpectedAnswer = (value = '') => {
    const words = String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map((word) => word.trim())
        .filter(Boolean);
    return words.slice(0, 3).join(' ').trim();
};

const parseSlideSelection = (raw = '') => {
    const text = String(raw || '').trim();
    if (!text) return [];
    const out = new Set();
    text.split(',').map((x) => x.trim()).filter(Boolean).forEach((part) => {
        const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
        if (m) {
            const a = Number(m[1]);
            const b = Number(m[2]);
            const start = Math.max(1, Math.min(a, b));
            const end = Math.max(1, Math.max(a, b));
            for (let i = start; i <= end && out.size < 300; i += 1) out.add(i);
            return;
        }
        const n = Number(part);
        if (Number.isInteger(n) && n > 0 && out.size < 300) out.add(n);
    });
    return [...out].sort((a, b) => a - b);
};

router.post('/auto-highlight', async (req, res) => {
    try {
        const text = String(req.body?.text || '').trim();
        const teacherId = String(req.body?.teacherId || '').trim();
        const max = Math.max(3, Math.min(20, Number(req.body?.max || 10)));
        if (!text) return res.status(400).json({ error: 'text requis' });
        const clipped = text.slice(0, 20000);
        const prompt = [
            { text: `Extrait ${max} passages clés utiles pour évaluer la compréhension d'un élève. Chaque passage doit être court (3-15 mots), exact, et apparaître mot pour mot dans le texte.` },
            { text: `Texte source:\n${clipped}` },
            { text: `Réponds uniquement en JSON: ["passage 1","passage 2"]` }
        ];
        const raw = await ProfAI.ask(prompt, "Tu sélectionnes des réponses attendues. Format strict JSON array uniquement.", { teacherId });
        const snippets = parseJsonArray(raw).slice(0, max);
        if (!snippets.length) return res.status(500).json({ error: 'Aucun passage généré' });
        res.json({ snippets });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/generate-question-answers', async (req, res) => {
    try {
        const sourceText = String(req.body?.sourceText || '').trim();
        const teacherId = String(req.body?.teacherId || '').trim();
        const count = Math.max(1, Math.min(20, Number(req.body?.count || 3)));
        if (!sourceText) return res.status(400).json({ error: 'sourceText requis' });
        const clipped = sourceText.slice(0, 20000);
        const prompt = [
            { text: `Génère exactement ${count} questions de compréhension et leur réponse attendue.` },
            { text: "Chaque réponse attendue doit être très courte: 2 à 3 mots maximum, facile à taper par un élève, et strictement présente dans le texte source (mot pour mot si possible)." },
            { text: "Interdiction d'écrire une phrase longue. Préfère un groupe nominal très court." },
            { text: `Texte source:\n${clipped}` },
            { text: 'Format JSON strict uniquement: [{"question":"...","answer":"..."}]' }
        ];
        const raw = await ProfAI.ask(prompt, "Tu es un générateur pédagogique strict. Réponds uniquement avec un JSON valide.", { teacherId });
        const rows = parseJsonObjects(raw)
            .map((r) => ({
                question: String(r?.question || r?.q || '').trim(),
                answer: shortenExpectedAnswer(String(r?.answer || r?.expectedAnswer || '').trim())
            }))
            .filter((r) => r.question && r.answer)
            .slice(0, count);
        if (!rows.length) return res.status(500).json({ error: 'Aucune question générée' });
        return res.json({ pairs: rows });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.post('/generate-section-questions', async (req, res) => {
    try {
        const sectionText = String(req.body?.sectionText || '').trim();
        const teacherId = String(req.body?.teacherId || '').trim();
        const sourceAnswers = Array.isArray(req.body?.sourceAnswers)
            ? req.body.sourceAnswers.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const count = Math.max(1, Math.min(20, Number(req.body?.count || 3)));
        if (!sectionText) return res.status(400).json({ error: 'sectionText requis' });

        const prompt = [
            { text: `Génère exactement ${count} questions de compréhension sur cette section.` },
            { text: 'Pour chaque question, renvoie aussi une réponse attendue très courte (2 à 3 mots maximum) ET une liste expectedKeywords (1 à 6 mots-clés).' },
            { text: "La réponse attendue doit être facile à taper par un élève. Interdiction d'écrire une phrase longue." },
            { text: 'Chaque mot-clé doit exister textuellement dans la section fournie.' },
            { text: sourceAnswers.length ? `Réponses cibles (optionnel): ${sourceAnswers.join(' | ')}` : 'Réponses cibles: libre.' },
            { text: `Section source:\n${sectionText.slice(0, 15000)}` },
            { text: 'Format JSON strict: [{"question":"...","expectedAnswer":"...","expectedKeywords":["mot1","mot2"]}]' }
        ];
        const raw = await ProfAI.ask(prompt, "Tu es un générateur pédagogique strict. Réponds uniquement avec un JSON valide.", { teacherId });
        const sourceLower = sectionText.toLowerCase();
        const rows = parseJsonObjects(raw)
            .map((r) => {
                const question = String(r?.question || r?.q || '').trim();
                const expectedAnswer = shortenExpectedAnswer(String(r?.expectedAnswer || r?.answer || '').trim());
                const rawKeywords = Array.isArray(r?.expectedKeywords)
                    ? r.expectedKeywords
                    : Array.isArray(r?.keywords) ? r.keywords : [];
                const expectedKeywords = rawKeywords
                    .map((k) => String(k || '').trim())
                    .filter(Boolean)
                    .filter((k) => sourceLower.includes(k.toLowerCase()))
                    .slice(0, 6);
                return { question, expectedAnswer, expectedKeywords };
            })
            .filter((r) => r.question)
            .map((r) => {
                if (r.expectedKeywords.length > 0) return r;
                const fallback = String(r.expectedAnswer || '')
                    .split(/[^a-z0-9àâäéèêëîïôöùûüÿçœæ'-]+/i)
                    .map((w) => w.trim())
                    .filter((w) => w.length >= 3)
                    .filter((w) => sourceLower.includes(w.toLowerCase()));
                return { ...r, expectedKeywords: [...new Set(fallback)].slice(0, 6) };
            })
            .slice(0, count);
        if (!rows.length) return res.status(500).json({ error: 'Aucune question générée' });
        return res.json({ rows });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.post('/slides/extract-text', async (req, res) => {
    try {
        const presentationUrl = String(req.body?.presentationUrl || '').trim();
        const slideSelection = String(req.body?.slideSelection || '').trim();
        if (!presentationUrl) return res.status(400).json({ error: 'presentationUrl requis' });
        const selectedSlides = parseSlideSelection(slideSelection);
        const extracted = await ProfDrive.getGoogleSlidesText(presentationUrl, selectedSlides);
        if (!extracted?.combinedText) {
            return res.status(404).json({ error: 'Aucun texte lisible trouvé sur les slides ciblés.' });
        }
        res.json({
            ok: true,
            presentationId: extracted.presentationId,
            title: extracted.title,
            slides: extracted.slides,
            combinedText: String(extracted.combinedText || '').slice(0, 60000)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/slides/manifest', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        const presentationUrl = String(req.body?.presentationUrl || '').trim();
        const slideSelection = String(req.body?.slideSelection || '').trim();
        const filterCondition = String(req.body?.filterCondition || '').trim();
        const includeThumbnails = req.body?.includeThumbnails !== false;
        if (!presentationUrl) return res.status(400).json({ error: 'presentationUrl requis' });
        const selectedSlides = parseSlideSelection(slideSelection);
        const manifest = await ProfDrive.getGoogleSlidesManifest(presentationUrl, selectedSlides, filterCondition, includeThumbnails);
        const presentationId = String(manifest.presentationId || '');
        const slides = (Array.isArray(manifest.slides) ? manifest.slides : []).map((s) => ({
            ...s,
            thumbnailUrl: String(s?.thumbnailUrl || '').trim(),
            thumbnailProxyUrl: `/api/learning/slides/thumbnail?presentationId=${encodeURIComponent(presentationId)}&pageObjectId=${encodeURIComponent(String(s?.objectId || ''))}&slideNumber=${encodeURIComponent(String(s?.slideNumber || ''))}`,
            thumbnailPublicUrl: `https://docs.google.com/presentation/d/${encodeURIComponent(presentationId)}/export/png?pageid=${encodeURIComponent(String(s?.objectId || ''))}`
        }));
        res.json({
            ok: true,
            presentationId,
            title: manifest.title,
            slides
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/slides/thumbnail', async (req, res) => {
    try {
        const presentationId = String(req.query.presentationId || '').trim();
        const pageObjectId = String(req.query.pageObjectId || '').trim();
        const slideNumber = Math.max(0, Number(req.query.slideNumber || 0));
        if (!presentationId) return res.status(400).send('Paramètres manquants');
        let out = null;
        try {
            out = await ProfDrive.getGoogleSlideThumbnailBinary(presentationId, pageObjectId, slideNumber);
        } catch (inner) {
            const canonicalPageId = slideNumber > 0 ? `p${slideNumber}` : '';
            if (canonicalPageId && canonicalPageId !== pageObjectId) {
                out = await ProfDrive.getGoogleSlideThumbnailBinary(presentationId, canonicalPageId, slideNumber);
            } else {
                throw inner;
            }
        }
        res.setHeader('Content-Type', out.contentType || 'image/png');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.status(200).send(out.buffer);
    } catch (e) {
        const presentationId = String(req.query.presentationId || '').trim();
        const pageObjectId = String(req.query.pageObjectId || '').trim();
        const slideNumber = Math.max(0, Number(req.query.slideNumber || 0));
        const status = Number(e?.response?.status || e?.status || 0);
        const msg = String(e?.message || '');
        if (presentationId && (pageObjectId || slideNumber > 0)) {
            const fallbackPageId = pageObjectId || `p${slideNumber}`;
            const publicCandidates = [
                `https://docs.google.com/presentation/d/${encodeURIComponent(presentationId)}/export/png?pageid=${encodeURIComponent(fallbackPageId)}`,
                `https://docs.google.com/presentation/d/${encodeURIComponent(presentationId)}/export/png?id=${encodeURIComponent(presentationId)}&pageid=${encodeURIComponent(fallbackPageId)}`
            ];
            for (const publicUrl of publicCandidates) {
                try {
                    const r = await fetch(publicUrl);
                    if (!r.ok) continue;
                    const buf = await r.buffer();
                    const ct = String(r.headers.get('content-type') || '').toLowerCase();
                    if (!ct.startsWith('image/')) continue;
                    res.setHeader('Content-Type', ct || 'image/png');
                    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                    return res.status(200).send(buf);
                } catch (_) {}
            }
        }
        if (
            status === 404
            || /introuvable|not found|miniature indisponible|pageobjectid requis/i.test(msg)
        ) {
            return res.status(404).send('Miniature indisponible');
        }
        if (/drive non connecte|drive non connecté|credentials manquants|oauth|getaccesstoken/i.test(msg.toLowerCase())) {
            return res.status(503).send('Service Google Slides indisponible');
        }
        console.error('[learning.prof][slides/thumbnail] unexpected error:', msg);
        return res.status(500).send('Erreur serveur miniature');
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
        const stepId = String(req.query.stepId || '').trim();
        const strictStepId = String(req.query.strictStepId || '').trim().toLowerCase() === 'true';
        const normalizedUrl = normalizeVideoUrl(url);
        if (!teacherId || !normalizedUrl) return res.json([]);
        const query = { teacherId, normalizedUrl };
        if (strictStepId && stepId) query.stepId = stepId;
        const list = await VideoSegment.find(query).lean();
        list.sort(timelineSegmentCompare);
        res.json(list);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/video-sources', async (req, res) => {
    try {
        const teacherId = String(req.query.teacherId || '').trim();
        const chapterId = String(req.query.chapterId || '').trim();
        if (!teacherId) return res.json([]);
        const query = { teacherId };
        if (chapterId) query.chapterId = chapterId;
        const list = await VideoSource.find(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
        const unique = [];
        const seen = new Set();
        list.forEach((row) => {
            const key = String(row.normalizedUrl || '').trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            unique.push(row);
        });
        res.json(unique);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.post('/video-sources', async (req, res) => {
    try {
        const teacherId = String(req.body?.teacherId || '').trim();
        const chapterId = String(req.body?.chapterId || '').trim();
        const originalUrl = String(req.body?.url || '').trim();
        const normalizedUrl = normalizeVideoUrl(originalUrl);
        const name = String(req.body?.name || '').trim().slice(0, 120);
        if (!teacherId || !chapterId || !normalizedUrl) {
            return res.status(400).json({ error: 'teacherId/chapterId/url requis' });
        }
        const row = await VideoSource.findOneAndUpdate(
            { teacherId, chapterId, normalizedUrl },
            { $set: { originalUrl, name } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/video-segments', async (req, res) => {
    try {
        const teacherId = String(req.body?.teacherId || '').trim();
        const stepId = String(req.body?.stepId || '').trim();
        const originalUrl = String(req.body?.url || '').trim();
        const normalizedUrl = normalizeVideoUrl(originalUrl);
        const label = String(req.body?.label || '').trim();
        const transcript = String(req.body?.transcript || '').slice(0, 25000);
        const startSec = Math.max(0, Number(req.body?.startSec || 0));
        const endSecRaw = Math.max(0, Number(req.body?.endSec || 0));
        const endSec = endSecRaw > startSec ? endSecRaw : 0;
        if (!teacherId || !normalizedUrl) return res.status(400).json({ error: 'teacherId/url requis' });
        const scope = { teacherId, normalizedUrl };
        if (stepId) scope.stepId = stepId;
        const order = await VideoSegment.countDocuments(scope) + 1;
        const row = await VideoSegment.create({
            teacherId,
            stepId,
            originalUrl,
            normalizedUrl,
            label,
            transcript,
            startSec,
            endSec,
            order
        });
        await resequenceVideoSegments(teacherId, normalizedUrl, stepId);
        const updated = await VideoSegment.findById(row._id).lean();
        res.json(updated || row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/video-segments/clone', async (req, res) => {
    try {
        const teacherId = String(req.body?.teacherId || '').trim();
        const fromUrl = String(req.body?.fromUrl || '').trim();
        const toUrl = String(req.body?.toUrl || '').trim();
        const fromNorm = normalizeVideoUrl(fromUrl);
        const toNorm = normalizeVideoUrl(toUrl);
        if (!teacherId || !fromNorm || !toNorm) {
            return res.status(400).json({ error: 'teacherId/fromUrl/toUrl requis' });
        }
        if (fromNorm === toNorm) return res.json({ ok: true, copied: 0 });

        const sourceRows = await VideoSegment.find({ teacherId, normalizedUrl: fromNorm }).lean();
        if (!sourceRows.length) return res.json({ ok: true, copied: 0 });

        const targetRows = await VideoSegment.find({ teacherId, normalizedUrl: toNorm }).lean();
        const targetKeys = new Set(targetRows.map((r) => `${Number(r.startSec || 0)}|${Number(r.endSec || 0)}|${String(r.label || '').trim()}`));

        let copied = 0;
        for (const src of sourceRows.sort(timelineSegmentCompare)) {
            const key = `${Number(src.startSec || 0)}|${Number(src.endSec || 0)}|${String(src.label || '').trim()}`;
            if (targetKeys.has(key)) continue;
            await VideoSegment.create({
                teacherId,
                originalUrl: toUrl,
                normalizedUrl: toNorm,
                label: String(src.label || '').trim(),
                transcript: String(src.transcript || '').slice(0, 25000),
                startSec: Math.max(0, Number(src.startSec || 0)),
                endSec: Math.max(0, Number(src.endSec || 0)),
                order: 999999
            });
            targetKeys.add(key);
            copied += 1;
        }

        await resequenceVideoSegments(teacherId, toNorm);
        return res.json({ ok: true, copied });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.post('/video-segments/recover', async (req, res) => {
    try {
        const teacherId = String(req.body?.teacherId || '').trim();
        const toUrl = String(req.body?.toUrl || '').trim();
        const toNorm = normalizeVideoUrl(toUrl);
        if (!teacherId || !toNorm) return res.status(400).json({ error: 'teacherId/toUrl requis' });

        const existing = await VideoSegment.find({ teacherId, normalizedUrl: toNorm }).lean();
        if (existing.length > 0) {
            const list = [...existing].sort(timelineSegmentCompare);
            return res.json({ ok: true, recovered: 0, fromUrl: null, list });
        }

        const best = await pickBestSegmentSource(teacherId, toNorm);
        if (!best || !Array.isArray(best.list) || best.list.length === 0) {
            return res.json({ ok: true, recovered: 0, fromUrl: null, list: [] });
        }

        for (const src of best.list.sort(timelineSegmentCompare)) {
            await VideoSegment.create({
                teacherId,
                originalUrl: toUrl,
                normalizedUrl: toNorm,
                label: String(src.label || '').trim(),
                transcript: String(src.transcript || '').slice(0, 25000),
                startSec: Math.max(0, Number(src.startSec || 0)),
                endSec: Math.max(0, Number(src.endSec || 0)),
                order: 999999
            });
        }
        await resequenceVideoSegments(teacherId, toNorm);
        const restored = await VideoSegment.find({ teacherId, normalizedUrl: toNorm }).lean();
        const list = [...restored].sort(timelineSegmentCompare);
        return res.json({ ok: true, recovered: list.length, fromUrl: best.url, list });
    } catch (e) {
        return res.status(500).json({ error: e.message });
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
        await resequenceVideoSegments(teacherId, String(row.normalizedUrl || '').trim(), String(row.stepId || '').trim());
        const updated = await VideoSegment.findById(id).lean();
        res.json(updated || row);
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
        await resequenceVideoSegments(teacherId, String(target.normalizedUrl || '').trim(), String(target.stepId || '').trim());
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/video-segments-by-url', async (req, res) => {
    try {
        const teacherId = String(req.query.teacherId || req.body?.teacherId || '').trim();
        const url = String(req.query.url || req.body?.url || '').trim();
        const stepId = String(req.query.stepId || req.body?.stepId || '').trim();
        const normalizedUrl = normalizeVideoUrl(url);
        if (!teacherId || !normalizedUrl) {
            return res.status(400).json({ error: 'teacherId/url requis' });
        }
        const query = { teacherId, normalizedUrl };
        if (stepId) query.stepId = stepId;
        const out = await VideoSegment.deleteMany(query);
        return res.json({ ok: true, deleted: Number(out?.deletedCount || 0) });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.get('/gpt-inbox', async (req, res) => {
    try {
        const teacherId = String(req.query.teacherId || '').trim();
        const teacherEmail = String(req.query.teacherEmail || '').trim().toLowerCase();
        const teacherName = String(req.query.teacherName || '').trim().toLowerCase();
        const moduleId = String(req.query.moduleId || '').trim();
        const limit = Math.min(60, Math.max(1, Number(req.query.limit || 20)));
        const query = {};
        const teacherFilters = [];
        if (teacherId || teacherEmail || teacherName) {
            if (teacherId) teacherFilters.push({ teacherId });
            if (teacherEmail) teacherFilters.push({ teacherEmail });
            if (teacherName) teacherFilters.push({ teacherName: { $regex: teacherName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } });
        }
        if (teacherFilters.length) query.$or = teacherFilters;
        if (moduleId) query.moduleId = moduleId;
        const entries = await GptInboxMessage.find(query).sort({ receivedAt: -1, createdAt: -1 }).limit(limit).lean();
        return res.json({ ok: true, entries });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.post('/gpt-inbox', async (req, res) => {
    try {
        if (!checkGptInboxToken(req)) {
            return res.status(401).json({ ok: false, error: 'Token GPT invalide' });
        }
        const body = req.body || {};
        const questionNumberRaw = body.questionNumber ?? body.question ?? body.numeroQuestion ?? body.numero;
        const questionNumber = Number.isFinite(Number(questionNumberRaw)) ? Number(questionNumberRaw) : null;
        const fallbackMessage = questionNumber ? `Question ${questionNumber} validée` : 'Message GPT reçu';
        const message = String(body.message || body.status || body.result || fallbackMessage).trim().slice(0, 2500);
        const feedback = String(body.feedback || body.commentaire || body.correction || '').trim().slice(0, 5000);
        const summary = String(body.summary || body.resume || '').trim().slice(0, 2500);
        const mastered = body.mastered === true || body.mastered === 'true' || body.type === 'learning_validated';
        const score = Number.isFinite(Number(body.score)) ? Number(body.score) : null;
        const student = await findGptInboxStudent(body);
        if (!message && !feedback && !summary && !sanitizeGptInboxImages(body.images).length) {
            return res.status(400).json({ ok: false, error: 'message, feedback, summary ou images requis' });
        }
        const entryPayload = {
            receivedAt: new Date(),
            teacherId: String(body.teacherId || '').trim().slice(0, 120),
            teacherName: String(body.teacherName || 'JP Vuillet').trim().slice(0, 160),
            teacherEmail: String(body.teacherEmail || '').trim().toLowerCase().slice(0, 220),
            moduleId: String(body.moduleId || body.learningId || '').trim().slice(0, 120),
            stepId: String(body.stepId || '').trim().slice(0, 120),
            studentId: student ? String(student._id) : String(body.studentId || '').trim().slice(0, 120),
            studentName: student
                ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                : String(body.studentName || body.eleve || '').trim().slice(0, 160),
            studentClass: String(student?.currentClass || body.studentClass || body.classe || '').trim().slice(0, 80),
            type: String(body.type || 'feedback').trim().slice(0, 80),
            questionNumber,
            message,
            feedback,
            summary,
            weakPoints: sanitizeGptStringList(body.weakPoints || body.pointsFaibles || body.notionsARevoir),
            errors: sanitizeGptErrors(body.errors || body.erreurs),
            mastered,
            score,
            images: sanitizeGptInboxImages(body.images || body.imageUrls || []),
            source: String(body.source || 'chatgpt').trim().slice(0, 80),
            raw: body.raw ? (typeof body.raw === 'string' ? body.raw : JSON.stringify(body.raw)).slice(0, 5000) : ''
        };
        const entry = await GptInboxMessage.create(entryPayload);
        const learningMarked = mastered
            ? await markLearningValidatedFromGpt({ moduleId: entryPayload.moduleId, student })
            : false;
        return res.json({ ok: true, entry, learningMarked });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
});

router.delete('/gpt-inbox', async (req, res) => {
    try {
        if (!checkGptInboxToken(req)) {
            return res.status(401).json({ ok: false, error: 'Token GPT invalide' });
        }
        const teacherId = String(req.query.teacherId || req.body?.teacherId || '').trim();
        const teacherEmail = String(req.query.teacherEmail || req.body?.teacherEmail || '').trim().toLowerCase();
        const moduleId = String(req.query.moduleId || req.body?.moduleId || '').trim();
        const query = {};
        const teacherFilters = [];
        if (teacherId) teacherFilters.push({ teacherId });
        if (teacherEmail) teacherFilters.push({ teacherEmail });
        if (teacherFilters.length) query.$or = teacherFilters;
        if (moduleId) query.moduleId = moduleId;
        if (!Object.keys(query).length) {
            return res.status(400).json({ ok: false, error: 'teacherId, teacherEmail ou moduleId requis pour vider la boîte' });
        }
        const out = await GptInboxMessage.deleteMany(query);
        return res.json({ ok: true, deleted: Number(out?.deletedCount || 0) });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
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
        data.sections = sanitizeSections(data.sections);
        data.steps = sanitizeSteps(data.steps);
        data.presentationUrl = String(data.presentationUrl || '').trim();
        data.presentationSlidesFocus = String(data.presentationSlidesFocus || '').trim().slice(0, 200);
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

router.patch('/:id/step-data', async (req, res) => {
    try {
        const moduleId = String(req.params.id || '').trim();
        const stepId = String(req.body?.stepId || '').trim();
        const patch = req.body?.patch && typeof req.body.patch === 'object' ? req.body.patch : {};
        if (!moduleId || !stepId) return res.status(400).json({ error: 'moduleId/stepId requis' });

        const row = await LearningModule.findById(moduleId);
        if (!row) return res.status(404).json({ error: 'Apprentissage introuvable' });
        const steps = Array.isArray(row.steps) ? [...row.steps] : [];
        const idx = steps.findIndex((s) => String(s?.id || '') === stepId);
        if (idx < 0) return res.status(404).json({ error: 'Étape introuvable' });

        const target = { ...(steps[idx] || {}) };
        if (patch.materialText !== undefined) target.materialText = String(patch.materialText || '').slice(0, 60000);
        if (patch.sheetText !== undefined) target.sheetText = String(patch.sheetText || '').slice(0, 60000);
        if (patch.videoTranscript !== undefined) target.videoTranscript = String(patch.videoTranscript || '').slice(0, 60000);
        if (patch.startSec !== undefined) {
            target.startSec = Math.max(0, Number(patch.startSec || 0));
        }
        if (patch.endSec !== undefined) {
            const endSecRaw = Math.max(0, Number(patch.endSec || 0));
            const startSec = Math.max(0, Number(target.startSec || 0));
            target.endSec = endSecRaw > 0 && endSecRaw <= startSec ? 0 : endSecRaw;
        }
        if (Array.isArray(patch.questionAnswerPairs)) {
            target.questionAnswerPairs = patch.questionAnswerPairs
                .slice(0, 20)
                .map((pair) => ({
                    question: String(pair?.question || pair?.q || '').trim().slice(0, 500),
                    answer: String(pair?.answer || pair?.expectedAnswer || '').trim().slice(0, 500),
                    generatedByAi: pair?.generatedByAi === true,
                    expectedKeywords: Array.isArray(pair?.expectedKeywords)
                        ? pair.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20)
                        : []
                }))
                .filter((pair) => pair.question || pair.answer || (pair.expectedKeywords || []).length > 0);
        }
        if (patch.questionSectionQuestions && typeof patch.questionSectionQuestions === 'object') {
            const cleanMap = {};
            Object.keys(patch.questionSectionQuestions).forEach((k) => {
                const rows = Array.isArray(patch.questionSectionQuestions[k]) ? patch.questionSectionQuestions[k] : [];
                cleanMap[String(k)] = rows.slice(0, 30).map((q) => ({
                    q: String(q?.q || q?.question || '').trim().slice(0, 500),
                    question: String(q?.question || q?.q || '').trim().slice(0, 500),
                    expectedAnswer: String(q?.expectedAnswer || '').trim().slice(0, 500),
                    generatedByAi: q?.generatedByAi === true,
                    expectedKeywords: Array.isArray(q?.expectedKeywords)
                        ? q.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20)
                        : []
                }));
            });
            target.questionSectionQuestions = cleanMap;
        }
        if (patch.questionSlideTextMap && typeof patch.questionSlideTextMap === 'object') {
            const raw = patch.questionSlideTextMap;
            const clean = {};
            Object.keys(raw).slice(0, 300).forEach((k) => {
                const slideId = String(k || '').trim().slice(0, 120);
                if (!slideId) return;
                clean[slideId] = String(raw[k] || '').replace(/\r/g, '').slice(0, 60000);
            });
            target.questionSlideTextMap = clean;
        }
        if (patch.sheetSlideSectionMap && typeof patch.sheetSlideSectionMap === 'object') {
            const raw = patch.sheetSlideSectionMap;
            const clean = {};
            Object.keys(raw).slice(0, 300).forEach((k) => {
                const slideId = String(k || '').trim().slice(0, 120);
                const sectionId = String(raw[k] || '').trim().slice(0, 120);
                if (!slideId || !sectionId) return;
                clean[slideId] = sectionId;
            });
            target.sheetSlideSectionMap = clean;
        }
        if (patch.sheetSlideTextMap && typeof patch.sheetSlideTextMap === 'object') {
            const raw = patch.sheetSlideTextMap;
            const clean = {};
            Object.keys(raw).slice(0, 300).forEach((k) => {
                const slideId = String(k || '').trim().slice(0, 120);
                if (!slideId) return;
                clean[slideId] = String(raw[k] || '').replace(/\r/g, '').slice(0, 60000);
            });
            target.sheetSlideTextMap = clean;
        }

        steps[idx] = target;
        if (Array.isArray(req.body?.sections)) {
            row.sections = sanitizeSections(req.body.sections);
        }
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
