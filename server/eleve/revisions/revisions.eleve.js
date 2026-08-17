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
    const groupRaw = (student?.assignedGroups || []).map((g) => String((g && g._id) ? g._id : g)).filter(Boolean);
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
        const enrollClassIds = enrollments.map((e) => String(e?.classId || '')).filter((id) => mongoose.Types.ObjectId.isValid(id));
        if (enrollClassIds.length > 0) {
            const enrollClasses = await Classroom.find({ _id: { $in: enrollClassIds } }, 'name').lean();
            enrollClasses.forEach((c) => addClassTarget(targets, c?.name));
        }
    }
    return [...targets];
}

const sanitizeQuestions = (rows = []) =>
    (Array.isArray(rows) ? rows : [])
        .map((row) => ({
            question: String(row?.question || '').trim().slice(0, 500),
            expectedAnswer: String(row?.expectedAnswer || '').trim().slice(0, 500),
            expectedKeywords: (Array.isArray(row?.expectedKeywords) ? row.expectedKeywords : String(row?.expectedKeywords || '').split(','))
                .map((x) => String(x || '').trim())
                .filter(Boolean)
                .slice(0, 20)
        }))
        .filter((row) => row.question || row.expectedAnswer || row.expectedKeywords.length > 0)
        .slice(0, 30);

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Chapter = mongoose.model('Chapter');
        const RevisionActivity = mongoose.model('RevisionActivity');

        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);
        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        const rawRows = await RevisionActivity.find({
            isEnabled: { $ne: false },
            $or: [{ isAllClass: true }, { assignedStudents: student._id }]
        }).sort({ date: -1 }).lean();

        const revisions = rawRows.filter((x) => {
            const assigned = (x.assignedStudents || []).some((id) => String(id) === String(student._id));
            if (assigned) return true;
            if (!x.isAllClass) return false;
            return matchesClassTargets(x.targetClassrooms, classTargetKeys);
        });

        const chapterIds = [...new Set(revisions.map((x) => String(x.chapterId || '')).filter(Boolean))];
        const chapters = chapterIds.length > 0 ? await Chapter.find({ _id: { $in: chapterIds }, active: { $ne: false }, isArchived: { $ne: true } }, '_id title section active').lean() : [];
        const chapterById = new Map(chapters.map((c) => [String(c._id), c]));

        const rows = revisions
            .filter((x) => x.chapterId && chapterById.has(String(x.chapterId)))
            .map((x) => {
                const chapter = chapterById.get(String(x.chapterId));
                const sub = (x.submissions || []).find((p) => String(p.studentId) === String(student._id)) || null;
                const done = Array.isArray(sub?.questions) && sub.questions.length > 0 && sub?.completedAt;
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
        const RevisionActivity = mongoose.model('RevisionActivity');
        const revisionId = String(req.body?.revisionId || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        if (!revisionId || !studentId) return res.status(400).json({ error: 'revisionId et studentId requis' });
        const row = await RevisionActivity.findById(revisionId);
        if (!row) return res.status(404).json({ error: 'Révision introuvable' });
        const questions = sanitizeQuestions(req.body?.questions);
        const markCompleted = req.body?.markCompleted === true;
        const now = new Date();
        const entries = Array.isArray(row.submissions) ? [...row.submissions] : [];
        const idx = entries.findIndex((p) => String(p.studentId) === studentId);
        const previous = idx >= 0 ? entries[idx] : null;
        const nextEntry = {
            studentId,
            questions,
            questionCount: questions.length,
            updatedAt: now,
            completedAt: markCompleted && questions.length > 0 ? (previous?.completedAt || now) : (previous?.completedAt || null)
        };
        if (idx >= 0) entries[idx] = { ...entries[idx], ...nextEntry };
        else entries.push(nextEntry);
        row.submissions = entries;
        await row.save();
        res.json({ ok: true, submission: nextEntry });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
