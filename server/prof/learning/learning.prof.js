const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { LearningModule, Student, VideoSegment, VideoSource, GptInboxMessage, Chapter, Course } = require('../models/prof.models');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ProfAI = require('../core/prof.ai');
const ProfDrive = require('../core/drive.prof');
const { restoreGeneralSheet } = require('./general-sheet.persistence');
const { synchronizeLinkedSheetQuestions } = require('./linked-sheet-questions');

const learningMediaDir = path.join(process.cwd(), 'public', 'uploads', 'learning-media');
fs.mkdirSync(learningMediaDir, { recursive: true });
const learningMediaUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, learningMediaDir),
        filename: (_req, file, cb) => {
            const ext = path.extname(String(file.originalname || '')).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
            cb(null, `media-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
        }
    }),
    limits: { fileSize: 250 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, /^(audio|video)\//.test(String(file.mimetype || '')) || /\.(mp3|wav|m4a|aac|ogg|flac|mp4|webm)$/i.test(String(file.originalname || '')))
});

const inferAcademicLevel = (value = '') => {
    const cleaned = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const match = cleaned.match(/^([1-6])/);
    if (match) return match[1];
    if (/^(T|TERM|TERMINALE)/.test(cleaned)) return 'T';
    return '';
};

const assertLearningChapterMatchesTargets = async (data) => {
    const chapterId = String(data?.chapterId || '').trim();
    if (!chapterId || !mongoose.Types.ObjectId.isValid(chapterId)) {
        throw Object.assign(new Error('Chapitre invalide.'), { status: 400 });
    }
    const chapter = await Chapter.findById(chapterId).lean();
    if (!chapter) throw Object.assign(new Error('Chapitre introuvable.'), { status: 400 });
    const targetClassrooms = [...new Set((data?.targetClassrooms || []).map((value) => String(value || '').trim()).filter(Boolean))];
    const targetLevels = [...new Set(targetClassrooms.map(inferAcademicLevel).filter(Boolean))];
    const chapterLevel = inferAcademicLevel(chapter.sharedLevel || chapter.classroom || '');
    if (chapterLevel && targetLevels.some((level) => level !== chapterLevel)) {
        throw Object.assign(new Error(`Ce chapitre est réservé au niveau ${chapterLevel}e et ne peut pas être publié pour ${targetClassrooms.join(', ')}.`), { status: 400 });
    }
    if (chapter.classroom && targetClassrooms.some((className) => String(className).toUpperCase() !== String(chapter.classroom).toUpperCase())) {
        throw Object.assign(new Error(`Ce chapitre est réservé à la classe ${chapter.classroom}.`), { status: 400 });
    }
    const subject = String(data?.subject || '').trim().toUpperCase();
    const chapterSection = String(chapter.section || '').trim().toUpperCase();
    if (subject && chapterSection && subject !== chapterSection) {
        throw Object.assign(new Error(`Le chapitre choisi appartient à ${chapterSection}, pas à ${subject}.`), { status: 400 });
    }
    return chapter;
};

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

const getStudentGptCode = (student = {}) => {
    const raw = String(student?._id || student?.id || '').replace(/[^a-f0-9]/gi, '').slice(-8);
    if (!raw) return '';
    return String((parseInt(raw, 16) % 900000) + 100000);
};

async function findGptInboxStudent(body = {}) {
    const studentId = String(body.studentId || '').trim();
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        const byId = await Student.findById(studentId).lean();
        if (byId) return byId;
    }
    const studentCode = String(body.studentCode || body.code || body.numero || body.num || '').replace(/\D/g, '').trim();
    if (studentCode) {
        const candidates = await Student.find({}, 'firstName lastName nickname currentClass').lean();
        const matches = candidates.filter((student) => getStudentGptCode(student) === studentCode);
        if (matches.length === 1) return matches[0];
        return null;
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
            active: { $ne: false },
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
    const youtube = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&#?/]+)/i);
    if (youtube?.[1]) return `https://www.youtube.com/watch?v=${String(youtube[1]).trim()}`;
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

const isAudioLearningMedia = (media = {}) => {
    const type = String(media?.type || media?.mimeType || '').toLowerCase();
    const text = `${String(media?.url || '')} ${String(media?.name || media?.title || '')}`.toLowerCase();
    return type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|flac)(?:[?#].*)?$/.test(text);
};

const presentationSequenceFromMedia = (media = {}, index = 0) => {
    const url = String(media?.url || media?.videoUrl || '').trim();
    const audio = isAudioLearningMedia(media);
    const isYoutube = /(?:youtu\.be|youtube\.com)\//i.test(url);
    return {
        id: String(media?.id || `learning_media_${index}_${url}`).slice(0, 180),
        name: String(media?.name || media?.title || (audio ? `Chanson ${index + 1}` : `Vidéo NotebookLM ${index + 1}`)).trim().slice(0, 160),
        url,
        sourceType: audio ? 'audio' : (isYoutube ? 'youtube' : 'mp4'),
        mimeType: String(media?.type || media?.mimeType || (audio ? 'audio/mpeg' : 'video/mp4')).slice(0, 100),
        mergeWithNext: false,
        closeAfterSequence: false,
        startSec: Math.max(0, Number(media?.startSec || 0)),
        endSec: Math.max(0, Number(media?.endSec || 0))
    };
};

const uniquePresentationSequences = (rows = []) => {
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter((row) => {
        const url = String(row?.url || '').trim();
        const key = `${url}|${String(row?.name || '').trim().toLowerCase()}|${Number(row?.startSec || 0)}|${Number(row?.endSec || 0)}`;
        if (!url || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const slideNumbersFromFocus = (value = '') => {
    const results = new Set();
    String(value || '').split(/[,;\s]+/).forEach((part) => {
        const range = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (range) {
            const start = Math.max(1, Number(range[1]));
            const end = Math.max(start, Number(range[2]));
            for (let n = start; n <= Math.min(end, start + 300); n += 1) results.add(n);
            return;
        }
        const number = Number(part);
        if (Number.isInteger(number) && number > 0) results.add(number);
    });
    return [...results].sort((a, b) => a - b);
};

// Publishing an apprentissage makes its media immediately usable in the
// course player. Auto scenes are always appended after teacher-created scenes
// and are replaced on later publications (never duplicated).
const syncLearningMediaToCourse = async (module = {}) => {
    const courseId = String(module?.generalSheetCourseId || '').trim();
    if (!courseId) return { synced: false, reason: 'no-course' };
    const course = await Course.findById(courseId);
    if (!course) return { synced: false, reason: 'course-not-found' };

    const steps = Array.isArray(module?.steps) ? module.steps : [];
    const sheetMedia = steps.flatMap((step, stepIndex) => Array.isArray(step?.sheetMediaItems) && step.sheetMediaItems.length
        ? step.sheetMediaItems
        : (step?.sheetMediaUrl ? [{
            id: `${step?.id || 'sheet'}_${stepIndex}`, url: step.sheetMediaUrl, name: step.sheetMediaName,
            type: step.sheetMediaType, startSec: step.sheetMediaStartSec, endSec: step.sheetMediaEndSec
        }] : []));
    const videoSteps = steps.filter((step) => String(step?.videoUrl || '').trim());
    const notebookBase = [
        ...sheetMedia.filter((media) => !isAudioLearningMedia(media)),
        ...videoSteps.map((step) => ({ id: step.id, url: step.videoUrl, name: step.videoSourceName || step.title, type: step.mimeType, startSec: step.startSec, endSec: step.endSec }))
    ].map(presentationSequenceFromMedia);
    const music = uniquePresentationSequences(sheetMedia.filter(isAudioLearningMedia).map(presentationSequenceFromMedia));

    const teacherId = String(module?.teacherId || '').trim();
    const sourceUrls = [...new Set(videoSteps.map((step) => normalizeVideoUrl(step.videoUrl)).filter(Boolean))];
    const segments = teacherId && sourceUrls.length
        ? await VideoSegment.find({ teacherId, normalizedUrl: { $in: sourceUrls } }).lean()
        : [];
    const cutsByUrl = new Map();
    segments.sort(timelineSegmentCompare).forEach((segment) => {
        const key = String(segment?.normalizedUrl || '');
        if (!cutsByUrl.has(key)) cutsByUrl.set(key, []);
        cutsByUrl.get(key).push(segment);
    });
    const notebook = uniquePresentationSequences(videoSteps.flatMap((step, stepIndex) => {
        const cuts = cutsByUrl.get(normalizeVideoUrl(step.videoUrl)) || [];
        if (!cuts.length) return [presentationSequenceFromMedia({ id: step.id, url: step.videoUrl, name: step.videoSourceName || step.title, type: step.mimeType, startSec: step.startSec, endSec: step.endSec }, stepIndex)];
        return cuts.map((cut, cutIndex) => presentationSequenceFromMedia({
            id: `learning_cut_${cut?._id || `${step.id}_${cutIndex}`}`,
            url: step.videoUrl,
            name: cut?.label || step.videoSourceName || step.title,
            type: step.mimeType,
            startSec: cut.startSec,
            endSec: cut.endSec
        }, cutIndex));
    }).concat(notebookBase.filter((row) => !videoSteps.some((step) => String(step.videoUrl || '').trim() === String(row.url || '').trim()))));

    const requestedSlides = slideNumbersFromFocus(module?.presentationSlidesFocus);
    const targetSlides = requestedSlides.length ? requestedSlides : [1];
    const existing = Array.isArray(course.presentationVideoSlides) ? course.presentationVideoSlides : [];
    const byNumber = new Map(existing.map((slide) => [Number(slide?.slideNumber || 1), slide]));
    const moduleKey = String(module?._id || 'learning');
    targetSlides.forEach((slideNumber) => {
        const current = byNumber.get(slideNumber) || { slideNumber, scenes: [] };
        const manualScenes = (Array.isArray(current.scenes) ? current.scenes : []).filter((scene) => (
            String(scene?.learningModuleId || '') !== moduleKey
            && !['scenenotebooklm', 'scenemusique'].includes(String(scene?.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
        ));
        const autoScenes = [
            { id: `learning_${moduleKey}_notebook_${slideNumber}`, learningModuleId: moduleKey, name: 'Scène NotebookLM', sequences: notebook },
            { id: `learning_${moduleKey}_music_${slideNumber}`, learningModuleId: moduleKey, name: 'Scène Musique', sequences: music }
        ];
        byNumber.set(slideNumber, { ...current, slideNumber, scenes: [...manualScenes, ...autoScenes] });
    });
    const slides = [...byNumber.values()].sort((a, b) => Number(a.slideNumber) - Number(b.slideNumber));
    course.presentationVideoSlides = slides;
    const first = slides.find((slide) => Number(slide.slideNumber) === targetSlides[0]) || slides[0] || { scenes: [] };
    course.presentationVideoScenes = first.scenes || [];
    course.presentationVideoSequences = (first.scenes || []).flatMap((scene) => scene.sequences || []);
    course.markModified('presentationVideoSlides');
    course.markModified('presentationVideoScenes');
    course.markModified('presentationVideoSequences');
    await course.save();
    console.info('[CondaWeb apprentissage → scènes]', { moduleId: moduleKey, courseId, slides: targetSlides, notebook: notebook.length, music: music.length });
    return { synced: true, courseId, slides: targetSlides, notebook: notebook.length, music: music.length };
};

const resequenceVideoSegments = async (teacherId = '', normalizedUrl = '', stepId = '') => {
    if (!teacherId || !normalizedUrl) return;
    const query = { teacherId, normalizedUrl };
    if (String(stepId || '').trim()) query.stepId = String(stepId).trim();
    const rows = await VideoSegment.find(query).sort({ createdAt: 1 });
    rows.sort(timelineSegmentCompare);
    for (let i = 0; i < rows.length; i += 1) {
        const wanted = i + 1;
        const wantedLabel = `Séquence ${i}`;
        if (Number(rows[i].order || 0) === wanted && String(rows[i].label || '') === wantedLabel) continue;
        rows[i].order = wanted;
        rows[i].label = wantedLabel;
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
            if (!['sheet', 'video', 'question', 'quiz'].includes(type)) return null;
            const base = {
                id: String(step?.id || `step_${idx + 1}`),
                title: String(step?.title || '').trim().slice(0, 120),
                type,
                sectionId: String(step?.sectionId || '').trim().slice(0, 120),
                generalSheetGenerated: step?.generalSheetGenerated === true
            };
            if (type === 'quiz') {
                return {
                    ...base,
                    hiddenFromLearning: true,
                    gameQuestionBank: true,
                    quizSourceTitle: String(step?.quizSourceTitle || '').trim().slice(0, 160),
                    quizQuestions: (Array.isArray(step?.quizQuestions) ? step.quizQuestions : [])
                        .map((question, questionIndex) => {
                            const choices = (Array.isArray(question?.choices) ? question.choices : [])
                                .map((choice) => String(choice || '').trim().slice(0, 500))
                                .slice(0, 4);
                            const correctIndex = Math.max(0, Math.min(Math.max(0, choices.length - 1), Number(question?.correctIndex || 0)));
                            return {
                                id: String(question?.id || `quiz_${idx + 1}_${questionIndex + 1}`).slice(0, 120),
                                question: String(question?.question || '').trim().slice(0, 1000),
                                choices,
                                correctIndex
                            };
                        })
                        .filter((question) => question.question && question.choices.filter(Boolean).length >= 2)
                        .slice(0, 100)
                };
            }
            if (type === 'sheet') {
                const sheetText = String(step?.sheetText || '').slice(0, 60000);
                const sheetZoneRanges = sanitizeRanges(step?.sheetZoneRanges);
                return {
                    ...base,
                    sheetUrl: String(step?.sheetUrl || '').trim(),
                    sheetText,
                    sheetTextHtml: String(step?.sheetTextHtml || '').slice(0, 120000),
                    informationalOnly: step?.informationalOnly === true,
                    isGeneralSheetMaster: step?.isGeneralSheetMaster === true,
                    generalSheetParentId: String(step?.generalSheetParentId || '').trim().slice(0, 160),
                    generalSheetPartIndex: Math.max(0, Number(step?.generalSheetPartIndex || 0)),
                    generalSheetDocumentTitle: String(step?.generalSheetDocumentTitle || '').trim().slice(0, 500),
                    generalSheetQuizText: String(step?.generalSheetQuizText || '').slice(0, 60000),
                    generalSheetQuizHtml: String(step?.generalSheetQuizHtml || '').slice(0, 120000),
                    generalSheetSyncVersion: Math.max(0, Number(step?.generalSheetSyncVersion || 0)),
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
                    // Média optionnel associé à la fiche (chanson, audio ou MP4).
                    // Il appartient à la fiche : ce n'est donc pas une étape vidéo à part.
                    sheetMediaUrl: String(step?.sheetMediaUrl || '').trim(),
                    sheetMediaName: String(step?.sheetMediaName || '').trim().slice(0, 180),
                    sheetMediaType: String(step?.sheetMediaType || '').trim().slice(0, 120),
                    sheetMediaStartSec: Math.max(0, Number(step?.sheetMediaStartSec || 0)),
                    sheetMediaEndSec: Number(step?.sheetMediaEndSec || 0) > Number(step?.sheetMediaStartSec || 0)
                        ? Number(step?.sheetMediaEndSec || 0)
                        : 0,
                    sheetMediaInheritedFromGeneral: step?.sheetMediaInheritedFromGeneral === true,
                    sheetMediaItems: (Array.isArray(step?.sheetMediaItems) ? step.sheetMediaItems : [])
                        .map((media) => {
                            const startSec = Math.max(0, Number(media?.startSec || 0));
                            const endRaw = Math.max(0, Number(media?.endSec || 0));
                            return {
                                id: String(media?.id || '').trim().slice(0, 80),
                                url: String(media?.url || '').trim(),
                                name: String(media?.name || '').trim().slice(0, 180),
                                type: String(media?.type || '').trim().slice(0, 120),
                                startSec,
                                endSec: endRaw > startSec ? endRaw : 0
                            };
                        }).filter((media) => media.url).slice(0, 12),
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
                    videoSegmentId: String(step?.videoSegmentId || '').trim().slice(0, 120),
                    segmentSourceStepId: String(step?.segmentSourceStepId || '').trim().slice(0, 120),
                    segmentSourceUrl: String(step?.segmentSourceUrl || '').trim(),
                    generatedFromVideoSegments: step?.generatedFromVideoSegments === true,
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
                questionMode: String(step?.questionMode || '').toLowerCase() === 'hard' ? 'hard' : 'easy',
                autoLinkedSheetId: String(step?.autoLinkedSheetId || '').trim().slice(0, 160),
                autoLinkedSheetMode: String(step?.autoLinkedSheetMode || '').toLowerCase() === 'plan' ? 'plan' : 'full',
                autoRevisionKind: String(step?.autoRevisionKind || '').toLowerCase() === 'plan' ? 'plan' : 'full',
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
                            question: String(pair?.question || '').trim().slice(0, pair?.validationType === 'fill_blanks' ? 60000 : 500),
                            answer: String(pair?.answer || pair?.expectedAnswer || '').trim().slice(0, 500),
                            generatedByAi: pair?.generatedByAi === true,
                            validationType: pair?.validationType === 'fill_blanks' ? 'fill_blanks' : 'open',
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
                                q: String(q?.q || q?.question || '').trim().slice(0, q?.validationType === 'fill_blanks' ? 60000 : 500),
                                question: String(q?.question || q?.q || '').trim().slice(0, q?.validationType === 'fill_blanks' ? 60000 : 500),
                                expectedAnswer: String(q?.expectedAnswer || '').trim().slice(0, 500),
                                generatedByAi: q?.generatedByAi === true,
                                validationType: q?.validationType === 'fill_blanks' ? 'fill_blanks' : 'open',
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
        const presentationUrl = String(req.body?.presentationUrl || req.body?.presentationId || '').trim();
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
        const presentationUrl = String(req.body?.presentationUrl || req.body?.presentationId || '').trim();
        const slideSelection = String(req.body?.slideSelection || '').trim();
        const filterCondition = String(req.body?.filterCondition || '').trim();
        const includeThumbnails = req.body?.includeThumbnails !== false;
        const outlineOnly = req.body?.outlineOnly === true;
        if (!presentationUrl) return res.status(400).json({ error: 'presentationUrl requis' });
        const selectedSlides = parseSlideSelection(slideSelection);
        const preparedSource = outlineOnly
            ? await ProfDrive.ensureNativeGoogleSlides(presentationUrl)
            : null;
        const sourcePresentationUrl = preparedSource?.editUrl || presentationUrl;
        const manifest = outlineOnly
            ? await ProfDrive.getGoogleSlidesOutline(sourcePresentationUrl)
            : await ProfDrive.getGoogleSlidesManifest(presentationUrl, selectedSlides, filterCondition, includeThumbnails);
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
            sourcePresentationUrl,
            convertedFromOffice: preparedSource?.converted === true,
            slides
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/slides/split-chapters', async (req, res) => {
    try {
        const presentationUrl = String(req.body?.presentationUrl || req.body?.presentationId || '').trim();
        if (!presentationUrl) return res.status(400).json({ error: 'presentationUrl requis' });
        const result = await ProfDrive.splitGoogleSlidesByChapter(presentationUrl);
        return res.json({ ok: true, ...result });
    } catch (e) {
        const status = Number(e?.status || e?.response?.status || 500);
        return res.status(status >= 400 && status < 600 ? status : 500).json({ error: String(e?.message || 'Découpage impossible') });
    }
});

router.post('/slides/create-range', async (req, res) => {
    try {
        const presentationUrl = String(req.body?.presentationUrl || '').trim();
        const title = String(req.body?.title || 'Chapitre').trim();
        if (!presentationUrl) return res.status(400).json({ error: 'presentationUrl requis' });
        const result = await ProfDrive.createGoogleSlidesRange(presentationUrl, Number(req.body?.startSlide), Number(req.body?.endSlide), title);
        return res.json({ ok: true, ...result });
    } catch (e) {
        const status = Number(e?.status || e?.response?.status || 500);
        return res.status(status >= 400 && status < 600 ? status : 500).json({ error: String(e?.message || 'Création impossible') });
    }
});

router.post('/general-sheet/google-doc', async (req, res) => {
    try {
        const title = String(req.body?.title || 'Fiche générale').trim().slice(0, 180);
        const text = String(req.body?.text || '').replace(/\r/g, '').trim().slice(0, 60000);
        const boldRanges = (Array.isArray(req.body?.boldRanges) ? req.body.boldRanges : [])
            .map((range) => ({ start: Number(range?.start || 0), end: Number(range?.end || 0) }))
            .filter((range) => Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 && range.end > range.start && range.end <= text.length)
            .slice(0, 500);
        const existingUrl = String(req.body?.existingUrl || '').trim();
        if (!text) return res.status(400).json({ error: 'La fiche générale est vide.' });
        const existingId = (existingUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/i) || [])[1] || '';
        let docId = existingId;
        let editUrl = existingUrl;
        if (!docId) {
            const created = await ProfDrive.createGoogleDoc(`${title} — Source NotebookLM`);
            docId = String(created?.docId || '');
            editUrl = String(created?.editUrl || '');
        }
        if (!docId) throw new Error('Création du Google Docs impossible');
        await ProfDrive.replaceGoogleDocContent(docId, text, boldRanges);
        return res.json({ ok: true, docId, editUrl: editUrl || `https://docs.google.com/document/d/${docId}/edit` });
    } catch (e) {
        return res.status(500).json({ error: String(e?.message || 'Création du Google Docs impossible') });
    }
});

const slideThumbnailCache = new Map();
const THUMBNAIL_CACHE_TTL_MS = 60 * 1000;

router.get('/slides/thumbnail', async (req, res) => {
    try {
        const presentationId = String(req.query.presentationId || '').trim();
        const pageObjectId = String(req.query.pageObjectId || '').trim();
        const slideNumber = Math.max(0, Number(req.query.slideNumber || 0));
        if (!presentationId) return res.status(400).send('Paramètres manquants');
        
        const cacheKey = `${presentationId}_${pageObjectId}_${slideNumber}`;
        const now = Date.now();
        const forceRefresh = req.query.force === '1' || req.query.sync === '1';
        const cached = slideThumbnailCache.get(cacheKey);

        // Si en cache et valide : réponse immédiate (< 1ms)
        if (cached && !forceRefresh && (now - cached.timestamp < 3600000)) {
            res.setHeader('Content-Type', cached.contentType || 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).send(cached.buffer);
        }

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

        // Sauvegarde en cache RAM
        slideThumbnailCache.set(cacheKey, {
            buffer: out.buffer,
            contentType: out.contentType || 'image/png',
            timestamp: now
        });

        res.setHeader('Content-Type', out.contentType || 'image/png');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('X-Cache', 'MISS');
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
        const rows = await LearningModule.find({}).sort({ createdAt: 1, date: 1, _id: 1 }).lean();
        const updates = [];
        let nextReferenceNumber = rows.reduce((max, row) => Math.max(max, Number(row.referenceNumber || 0)), 0) + 1;
        rows.forEach((row) => {
            if (!Number.isInteger(Number(row.referenceNumber)) || Number(row.referenceNumber) < 1) {
                row.referenceNumber = nextReferenceNumber;
                nextReferenceNumber += 1;
                updates.push({ updateOne: { filter: { _id: row._id }, update: { $set: { referenceNumber: row.referenceNumber } } } });
            }
            if (typeof row.active !== 'boolean') {
                row.active = row.isEnabled !== false;
                updates.push({ updateOne: { filter: { _id: row._id }, update: { $set: { active: row.active, isEnabled: row.active } } } });
            }
            const restored = restoreGeneralSheet(row.steps, row.title);
            const synchronized = synchronizeLinkedSheetQuestions(restored.steps);
            if (!restored.changed && !synchronized.changed) return;
            row.steps = synchronized.steps;
            updates.push({ updateOne: { filter: { _id: row._id }, update: { $set: { steps: synchronized.steps } } } });
        });
        if (updates.length > 0) await LearningModule.bulkWrite(updates, { ordered: false });
        res.json(rows.sort((a, b) => Number(b.referenceNumber || 0) - Number(a.referenceNumber || 0)));
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
        res.json(list.map((segment, index) => ({ ...segment, label: `Séquence ${index}` })));
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
        const studentId = String(req.query.studentId || '').trim();
        const studentName = String(req.query.studentName || '').trim();
        const studentClass = String(req.query.studentClass || '').trim();
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
        if (studentId) query.studentId = studentId;
        if (studentName) query.studentName = { $regex: escapeRegex(studentName), $options: 'i' };
        if (studentClass) query.studentClass = { $regex: escapeRegex(studentClass), $options: 'i' };
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

router.get('/game-question-bank', async (req, res) => {
    try {
        const query = {};
        const moduleId = String(req.query.moduleId || '').trim();
        const chapterId = String(req.query.chapterId || '').trim();
        const targetClass = String(req.query.className || req.query.targetClass || '').trim().toUpperCase();
        if (moduleId) query._id = moduleId;
        if (chapterId) query.chapterId = chapterId;
        if (targetClass) query.targetClassrooms = targetClass;
        query.active = { $ne: false };
        query.isEnabled = { $ne: false };
        const modules = await LearningModule.find(query).select('title chapterId sections steps').lean();
        const questions = [];
        modules.forEach((module) => {
            const sectionNames = new Map((Array.isArray(module.sections) ? module.sections : [])
                .map((section) => [String(section?.id || ''), String(section?.name || '')]));
            (Array.isArray(module.steps) ? module.steps : []).forEach((step) => {
                if (String(step?.type || '') !== 'quiz' || step?.gameQuestionBank === false) return;
                (Array.isArray(step?.quizQuestions) ? step.quizQuestions : []).forEach((question) => {
                    if (!String(question?.question || '').trim()) return;
                    questions.push({
                        id: String(question?.id || ''),
                        moduleId: String(module._id || ''),
                        moduleTitle: String(module.title || ''),
                        chapterId: String(module.chapterId || ''),
                        sectionId: String(step.sectionId || ''),
                        sectionName: sectionNames.get(String(step.sectionId || '')) || '',
                        quizTitle: String(step.title || ''),
                        question: String(question.question || ''),
                        choices: Array.isArray(question.choices) ? question.choices : [],
                        correctIndex: Number(question.correctIndex || 0)
                    });
                });
            });
        });
        res.json({ ok: true, count: questions.length, questions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await LearningModule.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: "Apprentissage introuvable" });
        const restored = restoreGeneralSheet(row.steps, row.title);
        const synchronized = synchronizeLinkedSheetQuestions(restored.steps);
        if (restored.changed || synchronized.changed) {
            row.steps = synchronized.steps;
            await LearningModule.updateOne({ _id: row._id }, { $set: { steps: synchronized.steps } });
        }
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const data = { ...req.body };
        if (!data._id || data._id === 'null') delete data._id;
        const active = typeof data.active === 'boolean'
            ? data.active
            : (typeof data.isEnabled === 'boolean' ? data.isEnabled : true);
        data.active = active;
        data.isEnabled = active;
        data.targetClassrooms = [...new Set((data.targetClassrooms || []).map(c => String(c || '').trim().toUpperCase()).filter(Boolean))];
        data.sections = sanitizeSections(data.sections);
        data.steps = synchronizeLinkedSheetQuestions(
            restoreGeneralSheet(sanitizeSteps(data.steps), data.title).steps
        ).steps;
        data.presentationUrl = String(data.presentationUrl || '').trim();
        data.presentationSourceUrl = String(data.presentationSourceUrl || '').trim();
        data.generalSheetDocUrl = String(data.generalSheetDocUrl || '').trim();
        data.presentationSlidesFocus = String(data.presentationSlidesFocus || '').trim().slice(0, 200);
        data.generalSheetCourseId = String(data.generalSheetCourseId || '').trim();
        data.generalSheetCourseTitle = String(data.generalSheetCourseTitle || '').trim().slice(0, 300);
        data.generalSheetCourseDescription = String(data.generalSheetCourseDescription || '').trim().slice(0, 2000);
        data.traceEcriteKeywords = Array.isArray(data.traceEcriteKeywords)
            ? data.traceEcriteKeywords.map(k => String(k || '').trim()).filter(Boolean)
            : (typeof data.traceEcriteKeywords === 'string'
                ? data.traceEcriteKeywords.split(/[,;\n]+/).map(k => k.trim()).filter(Boolean)
                : []);
        if (!data.title) data.title = 'APPRENTISSAGE';
        await assertLearningChapterMatchesTargets(data);

        if (!data._id && (!Number.isInteger(Number(data.referenceNumber)) || Number(data.referenceNumber) < 1)) {
            const latest = await LearningModule.findOne({}).sort({ referenceNumber: -1 }).select('referenceNumber').lean();
            data.referenceNumber = Math.max(0, Number(latest?.referenceNumber || 0)) + 1;
        }

        const saved = data._id
            ? await LearningModule.findByIdAndUpdate(data._id, data, { new: true })
            : await LearningModule.create(data);
        const presentationSync = await syncLearningMediaToCourse(saved);
        res.json({ ...saved.toObject(), presentationSync });
    } catch (e) {
        res.status(Number(e.status || 500)).json({ error: e.message });
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
        let steps = Array.isArray(row.steps) ? [...row.steps] : [];
        let idx = steps.findIndex((s) => String(s?.id || '') === stepId);
        if (idx < 0) {
            const snapshot = req.body?.stepSnapshot && typeof req.body.stepSnapshot === 'object'
                ? { ...req.body.stepSnapshot, id: stepId }
                : null;
            if (!snapshot) return res.status(404).json({ error: 'Étape introuvable' });
            steps = sanitizeSteps([...steps, snapshot]);
            idx = steps.findIndex((s) => String(s?.id || '') === stepId);
            if (idx < 0) return res.status(400).json({ error: "Impossible de recréer l'étape" });
        }
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
        let steps = Array.isArray(row.steps) ? [...row.steps] : [];
        let idx = steps.findIndex((s) => String(s?.id || '') === stepId);
        if (idx < 0) {
            const snapshot = req.body?.stepSnapshot && typeof req.body.stepSnapshot === 'object'
                ? { ...req.body.stepSnapshot, id: stepId }
                : null;
            if (!snapshot) return res.status(404).json({ error: 'Étape introuvable' });
            steps = sanitizeSteps([...steps, snapshot]);
            idx = steps.findIndex((s) => String(s?.id || '') === stepId);
            if (idx < 0) return res.status(400).json({ error: "Impossible de recréer l'étape" });
        }

        const target = { ...(steps[idx] || {}) };
        if (patch.materialText !== undefined) target.materialText = String(patch.materialText || '').slice(0, 60000);
        if (patch.sheetText !== undefined) target.sheetText = String(patch.sheetText || '').slice(0, 60000);
        if (patch.sheetTextHtml !== undefined) target.sheetTextHtml = String(patch.sheetTextHtml || '').slice(0, 120000);
        if (patch.videoTranscript !== undefined) target.videoTranscript = String(patch.videoTranscript || '').slice(0, 60000);
        if (patch.questionMode !== undefined) target.questionMode = String(patch.questionMode || '').toLowerCase() === 'hard' ? 'hard' : 'easy';
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
                    question: String(pair?.question || pair?.q || '').trim().slice(0, pair?.validationType === 'fill_blanks' ? 60000 : 500),
                    answer: String(pair?.answer || pair?.expectedAnswer || '').trim().slice(0, 500),
                    generatedByAi: pair?.generatedByAi === true,
                    validationType: pair?.validationType === 'fill_blanks' ? 'fill_blanks' : 'open',
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

router.patch('/:id/structure', async (req, res) => {
    try {
        const row = await LearningModule.findById(String(req.params.id || '').trim());
        if (!row) return res.status(404).json({ error: 'Apprentissage introuvable' });
        const sections = Array.isArray(req.body?.sections) ? sanitizeSections(req.body.sections) : null;
        const steps = Array.isArray(req.body?.steps) ? sanitizeSteps(req.body.steps) : null;
        if (!sections || !steps) return res.status(400).json({ error: 'Sections et étapes requises' });
        row.sections = sections;
        row.steps = steps;
        await row.save();
        res.json({ ok: true, sections: row.sections, steps: row.steps });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const active = typeof req.body?.active === 'boolean'
            ? req.body.active
            : req.body?.isEnabled;
        if (typeof active !== 'boolean') return res.status(400).json({ error: 'Le statut active doit être un booléen.' });
        const row = await LearningModule.findByIdAndUpdate(
            req.params.id,
            { $set: { active, isEnabled: active } },
            { new: true }
        ).lean();
        if (!row) return res.status(404).json({ error: "Apprentissage introuvable" });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/media/upload', learningMediaUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choisis un MP3 ou un fichier audio.' });
    const mimeType = String(req.file.mimetype || '');
    const displayName = String(req.file.originalname || 'Média').slice(0, 180);
    if (!/^(audio|video)\//.test(mimeType) && !/\.(mp3|wav|m4a|aac|ogg|flac|mp4|webm)$/i.test(displayName)) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return res.status(400).json({ error: 'Seuls les fichiers audio et vidéo sont acceptés.' });
    }
    try {
        // Le disque de Render est éphémère : les médias pédagogiques doivent
        // rester dans Drive, puis être diffusés par le proxy qui gère le Range.
        const folderId = await ProfDrive.getOrCreateFolder('CONDA_LEARNING_MEDIA');
        const driveFile = await ProfDrive.uploadFile(displayName, req.file.path, folderId);
        return res.json({
            url: `/api/proxy/${driveFile.id}`,
            driveFileId: driveFile.id,
            name: driveFile.name || displayName,
            mimeType,
            persistent: true
        });
    } catch (error) {
        console.error('[LEARNING MEDIA] Upload Drive impossible:', error.message);
        return res.status(503).json({
            error: `Stockage durable impossible : ${error.message || 'Drive indisponible'}. Le fichier n’a pas été enregistré.`
        });
    } finally {
        try { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (_) {}
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
