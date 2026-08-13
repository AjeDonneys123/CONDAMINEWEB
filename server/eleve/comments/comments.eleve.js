const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

function addClassTarget(set, value) {
    const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized) set.add(normalized);
}
function normalizeTargetKey(value = '') {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function matchesClassTargets(itemTargets, targetKeys) {
    return (itemTargets || []).some((t) => targetKeys.has(normalizeTargetKey(t)));
}
const academicLevel = (value = '') => (normalizeTargetKey(value).match(/^(6|5|4|3|2|1)/) || [])[1] || '';
async function buildStudentClassTargets(student) {
    const Classroom = mongoose.model('Classroom');
    const targets = new Set();
    addClassTarget(targets, student?.currentClass);
    const classId = student?.classId && String(student.classId);
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
        const cls = await Classroom.findById(classId, 'name').lean();
        addClassTarget(targets, cls?.name);
    }
    return [...targets];
}

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Chapter = mongoose.model('Chapter');
        const CommentActivity = mongoose.model('CommentActivity');
        const isVisitor = req.query?.visitor === '1';
        const visitorLevel = academicLevel(req.query?.level);
        const student = isVisitor ? { _id: null, currentClass: req.query?.level || '' } : await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);
        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));
        const rawRows = await CommentActivity.find({
            isEnabled: { $ne: false },
            ...(isVisitor ? {} : { $or: [{ isAllClass: true }, { assignedStudents: student._id }] })
        }).sort({ date: -1 }).lean();
        const rows = rawRows.filter((x) => {
            if (isVisitor) return (x.targetClassrooms || []).some((target) => academicLevel(target) === visitorLevel);
            const assigned = (x.assignedStudents || []).some((id) => String(id) === String(student._id));
            if (assigned) return true;
            if (!x.isAllClass) return false;
            return matchesClassTargets(x.targetClassrooms, classTargetKeys);
        });
        const chapterIds = [...new Set(rows.map((x) => String(x.chapterId || '')).filter(Boolean))];
        const chapters = chapterIds.length ? await Chapter.find({ _id: { $in: chapterIds } }, '_id title section').lean() : [];
        const chapterById = new Map(chapters.map((c) => [String(c._id), c]));
        res.json(rows.map((x) => {
            const chapter = chapterById.get(String(x.chapterId || ''));
            const sub = (x.submissions || []).find((s) => String(s.studentId) === String(student._id)) || null;
            return {
                ...x,
                chapterTitle: chapter?.title || 'CHAPITRE',
                chapterSection: chapter?.section || x.subject || 'GÉNÉRAL',
                studentSubmission: sub,
                status: sub?.completedAt ? 'done' : 'todo'
            };
        }));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/save', async (req, res) => {
    try {
        const CommentActivity = mongoose.model('CommentActivity');
        const commentId = String(req.body?.commentId || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        const row = await CommentActivity.findById(commentId);
        if (!row) return res.status(404).json({ error: 'Commentaire introuvable' });
        const entries = Array.isArray(row.submissions) ? [...row.submissions] : [];
        const idx = entries.findIndex((s) => String(s.studentId) === studentId);
        const previous = idx >= 0 ? entries[idx] : null;
        const rounds = (Array.isArray(req.body?.rounds) ? req.body.rounds : []).map((round) => ({
            draft: String(round?.draft || '').slice(0, 30000),
            aiFeedback: String(round?.aiFeedback || '').slice(0, 30000),
            createdAt: round?.createdAt ? new Date(round.createdAt) : new Date(),
            updatedAt: new Date()
        })).filter((round) => round.draft || round.aiFeedback).slice(0, 12);
        const next = {
            studentId,
            rounds,
            aiValidated: req.body?.aiValidated === true,
            methodologyReflection: String(req.body?.methodologyReflection || '').slice(0, 12000),
            updatedAt: new Date(),
            completedAt: req.body?.aiValidated === true && String(req.body?.methodologyReflection || '').trim()
                ? (previous?.completedAt || new Date())
                : null
        };
        if (idx >= 0) entries[idx] = { ...previous, ...next };
        else entries.push(next);
        row.submissions = entries;
        await row.save();
        res.json({ ok: true, submission: next });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
