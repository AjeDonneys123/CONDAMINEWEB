const express = require('express');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const ProfDrive = require('../../prof/core/drive.prof');
const router = express.Router();

function addClassTarget(set, value) {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    if (!normalized) return;
    set.add(normalized);
}

function normalizeTargetKey(value = '') {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function matchesClassTargets(itemTargets, targetKeys) {
    return (itemTargets || []).some((t) => targetKeys.has(normalizeTargetKey(t)));
}
const academicLevel = (value = '') => (normalizeTargetKey(value).match(/^(6|5|4|3|2|1)/) || [])[1] || '';

async function buildStudentClassTargets(student) {
    const Classroom = mongoose.model('Classroom');
    const Enrollment = mongoose.models.Enrollment ? mongoose.model('Enrollment') : null;
    const targets = new Set();

    addClassTarget(targets, student?.currentClass);

    const classId = student?.classId && String(student.classId);
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
        const cls = await Classroom.findById(classId, 'name').lean();
        addClassTarget(targets, cls?.name);
    } else if (classId) {
        addClassTarget(targets, classId);
    }

    const groupRaw = (student?.assignedGroups || [])
        .map((g) => String((g && g._id) ? g._id : g))
        .filter(Boolean);
    const groupIds = groupRaw.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const groupNames = groupRaw.filter((id) => !mongoose.Types.ObjectId.isValid(id));

    if (groupIds.length > 0) {
        const groups = await Classroom.find({ _id: { $in: groupIds } }, 'name').lean();
        groups.forEach((g) => addClassTarget(targets, g?.name));
    }
    groupNames.forEach((name) => addClassTarget(targets, name));

    const studentId = student?._id ? String(student._id) : '';
    if (Enrollment && studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        const enrollments = await Enrollment.find({ studentId }, 'classId').lean();
        const enrollClassIds = enrollments
            .map((e) => String(e?.classId || ''))
            .filter((id) => mongoose.Types.ObjectId.isValid(id));
        if (enrollClassIds.length > 0) {
            const enrollClasses = await Classroom.find({ _id: { $in: enrollClassIds } }, 'name').lean();
            enrollClasses.forEach((c) => addClassTarget(targets, c?.name));
        }
    }
    return [...targets];
}

const extractReadableText = (html = '') => {
    const raw = String(html || '');
    const stripped = raw
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
    return stripped.slice(0, 120000);
};

const countNonEmptyLines = (txt = '') =>
    String(txt || '')
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
        .length;

const buildLectureDraftTitle = ({ student = null, lecture = null }) => {
    const s = student ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : 'Élève';
    const t = String(lecture?.title || 'Lecture').trim();
    return `${t} - Brouillon ${s}`.slice(0, 170);
};

async function ensureLectureDraftDoc({ lecture, studentId, previous = null }) {
    const sid = String(studentId || '').trim();
    if (!lecture || !sid) return previous || {};
    if (previous?.draftDocId) {
        return previous;
    }
    const Student = mongoose.model('Student');
    const student = await Student.findById(sid, 'firstName lastName').lean();
    const folderId = await ProfDrive.getOrCreateFolder('CONDA_LECTURES_DRAFTS');
    const doc = await ProfDrive.createGoogleDoc(buildLectureDraftTitle({ student, lecture }), folderId);
    return {
        ...(previous || {}),
        draftDocId: String(doc?.docId || ''),
        draftDocUrl: String(doc?.editUrl || ''),
        draftDocEmbedUrl: String(doc?.embedUrl || '')
    };
}

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Chapter = mongoose.model('Chapter');
        const Lecture = mongoose.model('Lecture');

        const isVisitor = req.query?.visitor === '1';
        const visitorLevel = academicLevel(req.query?.level);
        const student = isVisitor ? { _id: null, currentClass: req.query?.level || '' } : await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        const rawLectures = await Lecture.find({
            isEnabled: { $ne: false },
            ...(isVisitor ? {} : { $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ] })
        }).sort({ date: -1 }).lean();

        const lectures = rawLectures.filter((x) => {
            if (isVisitor) return (x.targetClassrooms || []).some((target) => academicLevel(target) === visitorLevel);
            const assigned = (x.assignedStudents || []).some((id) => String(id) === String(student._id));
            if (assigned) return true;
            if (!x.isAllClass) return false;
            return matchesClassTargets(x.targetClassrooms, classTargetKeys);
        });

        const chapterIds = [...new Set(lectures.map((x) => String(x.chapterId || '')).filter(Boolean))];
        const chapters = chapterIds.length > 0
            ? await Chapter.find({ _id: { $in: chapterIds } }, '_id title section').lean()
            : [];
        const chapterById = new Map(chapters.map((c) => [String(c._id), c]));

        const rows = lectures
            .filter((x) => x.chapterId && chapterById.has(String(x.chapterId)))
            .map((x) => {
                const chapter = chapterById.get(String(x.chapterId));
                const sub = (x.submissions || []).find((p) => String(p.studentId) === String(student._id)) || null;
                const summary = String(sub?.summary || '');
                const lines = countNonEmptyLines(summary);
                const minLines = Math.max(1, Number(x.requiredSummaryMinLines || 5));
                const maxLines = Math.max(minLines, Number(x.requiredSummaryMaxLines || 10));
                const summaryOk = lines >= minLines && lines <= maxLines;
                const completed = Boolean(sub?.reachedEnd) && summaryOk;
                return {
                    ...x,
                    chapterTitle: chapter?.title || 'CHAPITRE',
                    chapterSection: chapter?.section || 'GÉNÉRAL',
                    studentSubmission: sub,
                    status: completed ? 'done' : 'todo'
                };
            });

        res.json(rows);
    } catch (_) {
        res.status(500).json([]);
    }
});

router.get('/content', async (req, res) => {
    try {
        const url = String(req.query?.url || '').trim();
        if (!url) return res.status(400).json({ error: 'url requis' });
        const upstream = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 CondaWeb Lecture Reader',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
            },
            timeout: 15000
        });
        const html = await upstream.text();
        const text = extractReadableText(html);
        if (!text) return res.status(404).json({ error: 'Texte non lisible sur cette page.' });
        res.json({ ok: true, text });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Lecture URL impossible' });
    }
});

router.post('/save', async (req, res) => {
    try {
        const Lecture = mongoose.model('Lecture');
        const lectureId = String(req.body?.lectureId || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        if (!lectureId || !studentId) return res.status(400).json({ error: 'lectureId et studentId requis' });

        const lecture = await Lecture.findById(lectureId);
        if (!lecture) return res.status(404).json({ error: 'Lecture introuvable' });

        const now = new Date();
        const entries = Array.isArray(lecture.submissions) ? [...lecture.submissions] : [];
        const idx = entries.findIndex((p) => String(p.studentId) === studentId);
        const previous = idx >= 0 ? entries[idx] : null;
        let draftMeta = await ensureLectureDraftDoc({ lecture, studentId, previous });

        const summary = req.body?.summary !== undefined
            ? String(req.body.summary || '').slice(0, 8000)
            : String(previous?.summary || '');
        const lines = countNonEmptyLines(summary);
        const minLines = Math.max(1, Number(lecture.requiredSummaryMinLines || 5));
        const maxLines = Math.max(minLines, Number(lecture.requiredSummaryMaxLines || 10));
        const summaryOk = lines >= minLines && lines <= maxLines;

        const nextEntry = {
            studentId,
            scrollTop: Math.max(0, Number(req.body?.scrollTop ?? previous?.scrollTop ?? 0)),
            maxScrollTop: Math.max(0, Number(req.body?.maxScrollTop ?? previous?.maxScrollTop ?? 0)),
            scrollHeight: Math.max(0, Number(req.body?.scrollHeight ?? previous?.scrollHeight ?? 0)),
            clientHeight: Math.max(0, Number(req.body?.clientHeight ?? previous?.clientHeight ?? 0)),
            reachedEnd: req.body?.reachedEnd !== undefined ? Boolean(req.body.reachedEnd) : Boolean(previous?.reachedEnd),
            rhythmAlerts: Math.max(0, Number(req.body?.rhythmAlerts ?? previous?.rhythmAlerts ?? 0)),
            maxSpeedPxPerSec: Math.max(0, Number(req.body?.maxSpeedPxPerSec ?? previous?.maxSpeedPxPerSec ?? 0)),
            pasteBlockedCount: Math.max(0, Number(req.body?.pasteBlockedCount ?? previous?.pasteBlockedCount ?? 0)),
            readElapsedSec: Math.max(0, Number(req.body?.readElapsedSec ?? previous?.readElapsedSec ?? 0)),
            draftDocId: String(draftMeta?.draftDocId || previous?.draftDocId || ''),
            draftDocUrl: String(draftMeta?.draftDocUrl || previous?.draftDocUrl || ''),
            draftDocEmbedUrl: String(draftMeta?.draftDocEmbedUrl || previous?.draftDocEmbedUrl || ''),
            draftDocRevisionCount: Math.max(0, Number(previous?.draftDocRevisionCount || 0)),
            draftDocRevisionAt: previous?.draftDocRevisionAt || null,
            summary,
            summarySubmittedAt: req.body?.summary !== undefined ? now : (previous?.summarySubmittedAt || null),
            updatedAt: now
        };

        if (nextEntry.reachedEnd && summaryOk) {
            nextEntry.completedAt = now;
        } else {
            nextEntry.completedAt = previous?.completedAt || null;
        }

        if (idx >= 0) entries[idx] = nextEntry;
        else entries.push(nextEntry);

        if (nextEntry.draftDocId) {
            try {
                await ProfDrive.replaceGoogleDocContent(nextEntry.draftDocId, summary || '');
                const stats = await ProfDrive.getGoogleDocStats(nextEntry.draftDocId);
                nextEntry.draftDocRevisionCount = Number(stats?.revisionCount || 0);
                nextEntry.draftDocRevisionAt = stats?.lastRevisionAt || now;
            } catch (_) {}
        }

        lecture.submissions = entries;
        await lecture.save();

        res.json({ ok: true, submission: nextEntry, summaryOk, lines });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
