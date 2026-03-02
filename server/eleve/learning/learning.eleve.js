const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

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
    return (itemTargets || []).some(t => targetKeys.has(normalizeTargetKey(t)));
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
        .map(g => String((g && g._id) ? g._id : g))
        .filter(Boolean);
    const groupIds = groupRaw.filter(id => mongoose.Types.ObjectId.isValid(id));
    const groupNames = groupRaw.filter(id => !mongoose.Types.ObjectId.isValid(id));

    if (groupIds.length > 0) {
        const groups = await Classroom.find({ _id: { $in: groupIds } }, 'name').lean();
        groups.forEach(g => addClassTarget(targets, g?.name));
    }
    groupNames.forEach(name => addClassTarget(targets, name));

    const studentId = student?._id ? String(student._id) : '';
    if (Enrollment && studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        const enrollments = await Enrollment.find({ studentId }, 'classId').lean();
        const enrollClassIds = enrollments
            .map(e => String(e?.classId || ''))
            .filter(id => mongoose.Types.ObjectId.isValid(id));
        if (enrollClassIds.length > 0) {
            const enrollClasses = await Classroom.find({ _id: { $in: enrollClassIds } }, 'name').lean();
            enrollClasses.forEach(c => addClassTarget(targets, c?.name));
        }
    }

    return [...targets];
}

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Chapter = mongoose.model('Chapter');
        const LearningModule = mongoose.model('LearningModule');

        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        const rawModules = await LearningModule.find({
            isEnabled: { $ne: false },
            $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ]
        }).sort({ createdAt: -1 }).lean();

        const modules = rawModules.filter(m => {
            const assigned = (m.assignedStudents || []).some(id => String(id) === String(student._id));
            if (assigned) return true;
            if (!m.isAllClass) return false;
            return matchesClassTargets(m.targetClassrooms, classTargetKeys);
        });

        const chapterIds = [...new Set(modules.map(m => String(m.chapterId || '')).filter(Boolean))];
        const chapters = chapterIds.length > 0
            ? await Chapter.find({ _id: { $in: chapterIds } }, '_id title section').lean()
            : [];
        const chapterById = new Map(chapters.map(ch => [String(ch._id), ch]));

        const withChapter = modules
            .filter(m => m.chapterId && chapterById.has(String(m.chapterId)))
            .map(m => {
                const chapter = chapterById.get(String(m.chapterId));
                const completion = (m.completions || []).find(c => String(c.studentId) === String(student._id));
                return {
                    ...m,
                    chapterTitle: chapter?.title || 'CHAPITRE',
                    chapterSection: chapter?.section || 'GÉNÉRAL',
                    completion: completion || null
                };
            });

        res.json(withChapter);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.post('/progress', async (req, res) => {
    try {
        const LearningModule = mongoose.model('LearningModule');
        const { moduleId, studentId, currentStep = 0, completed = false } = req.body || {};
        if (!moduleId || !studentId) return res.status(400).json({ error: 'moduleId et studentId requis' });

        const row = await LearningModule.findById(moduleId);
        if (!row) return res.status(404).json({ error: 'Apprentissage introuvable' });

        const sid = String(studentId);
        const now = new Date();
        const next = Array.isArray(row.completions) ? [...row.completions] : [];
        const idx = next.findIndex(c => String(c.studentId) === sid);
        const patch = {
            studentId: studentId,
            currentStep: Number(currentStep || 0),
            lastUpdateAt: now
        };
        if (completed) patch.completedAt = now;

        if (idx >= 0) {
            const base = typeof next[idx]?.toObject === 'function' ? next[idx].toObject() : next[idx];
            next[idx] = { ...base, ...patch };
        }
        else next.push(patch);

        row.completions = next;
        await row.save();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
