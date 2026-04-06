const express = require('express');
const mongoose = require('mongoose');
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

const stripHtml = (html = '') =>
    String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Chapter = mongoose.model('Chapter');
        const Fiche = mongoose.model('Fiche');

        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        const rawFiches = await Fiche.find({
            isEnabled: { $ne: false },
            $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ]
        }).sort({ date: -1 }).lean();

        const fiches = rawFiches.filter((x) => {
            const assigned = (x.assignedStudents || []).some((id) => String(id) === String(student._id));
            if (assigned) return true;
            if (!x.isAllClass) return false;
            return matchesClassTargets(x.targetClassrooms, classTargetKeys);
        });

        const chapterIds = [...new Set(fiches.map((x) => String(x.chapterId || '')).filter(Boolean))];
        const chapters = chapterIds.length > 0
            ? await Chapter.find({ _id: { $in: chapterIds } }, '_id title section').lean()
            : [];
        const chapterById = new Map(chapters.map((c) => [String(c._id), c]));

        const rows = fiches
            .filter((x) => x.chapterId && chapterById.has(String(x.chapterId)))
            .map((x) => {
                const chapter = chapterById.get(String(x.chapterId));
                const sub = (x.submissions || []).find((p) => String(p.studentId) === String(student._id)) || null;
                const done = Boolean(String(sub?.plainText || '').trim());
                return {
                    ...x,
                    chapterTitle: chapter?.title || 'CHAPITRE',
                    chapterSection: chapter?.section || 'GÉNÉRAL',
                    studentSubmission: sub,
                    status: done ? 'done' : 'todo'
                };
            });

        res.json(rows);
    } catch (_) {
        res.status(500).json([]);
    }
});

router.post('/save', async (req, res) => {
    try {
        const Fiche = mongoose.model('Fiche');
        const ficheId = String(req.body?.ficheId || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        if (!ficheId || !studentId) return res.status(400).json({ error: 'ficheId et studentId requis' });

        const fiche = await Fiche.findById(ficheId);
        if (!fiche) return res.status(404).json({ error: 'Fiche introuvable' });

        const html = String(req.body?.contentHtml || '').slice(0, 300000);
        const plainText = stripHtml(html).slice(0, 30000);
        const imageCount = (html.match(/<img\b/gi) || []).length;
        const now = new Date();

        const entries = Array.isArray(fiche.submissions) ? [...fiche.submissions] : [];
        const idx = entries.findIndex((p) => String(p.studentId) === studentId);
        const previous = idx >= 0 ? entries[idx] : null;
        const nextEntry = {
            studentId,
            participantStudentIds: Array.isArray(previous?.participantStudentIds) ? previous.participantStudentIds : [],
            lessonSlot: Math.max(1, Number(previous?.lessonSlot || 1)),
            contentHtml: html,
            plainText,
            imageCount,
            teacherValidated: Boolean(previous?.teacherValidated),
            updatedAt: now,
            completedAt: plainText ? (previous?.completedAt || now) : null
        };

        if (idx >= 0) entries[idx] = nextEntry;
        else entries.push(nextEntry);

        fiche.submissions = entries;
        await fiche.save();

        res.json({ ok: true, submission: nextEntry });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
