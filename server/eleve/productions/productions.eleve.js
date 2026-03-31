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

const sanitizeKeywords = (value) => {
    const parts = Array.isArray(value) ? value : String(value || '').split(',');
    return parts
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 20);
};

const sanitizeQcmOptions = (options) =>
    (Array.isArray(options) ? options : [])
        .map((item) => String(item || '').trim().slice(0, 120))
        .slice(0, 4);

const countWords = (value = '') =>
    String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Chapter = mongoose.model('Chapter');
        const Production = mongoose.model('Production');
        const GameLevel = mongoose.model('GameLevel');

        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        const rawRows = await Production.find({
            isEnabled: { $ne: false },
            $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ]
        }).sort({ date: -1 }).lean();

        const rows = rawRows.filter((x) => {
            const assigned = (x.assignedStudents || []).some((id) => String(id) === String(student._id));
            if (assigned) return true;
            if (!x.isAllClass) return false;
            return matchesClassTargets(x.targetClassrooms, classTargetKeys);
        });

        const chapterIds = [...new Set(rows.map((x) => String(x.chapterId || '')).filter(Boolean))];
        const gameIds = [...new Set(rows.map((x) => String(x.gameId || '')).filter(Boolean))];
        const [chapters, games] = await Promise.all([
            chapterIds.length > 0 ? Chapter.find({ _id: { $in: chapterIds } }, '_id title section').lean() : [],
            gameIds.length > 0 ? GameLevel.find({ _id: { $in: gameIds } }, '_id title').lean() : []
        ]);
        const chapterById = new Map(chapters.map((c) => [String(c._id), c]));
        const gameById = new Map(games.map((g) => [String(g._id), g]));

        const out = rows.map((x) => {
            const chapter = chapterById.get(String(x.chapterId || ''));
            const sub = (x.submissions || []).find((p) => String(p.studentId) === String(student._id)) || null;
            const done = Boolean(sub?.completedAt);
            return {
                ...x,
                chapterTitle: chapter?.title || 'CHAPITRE',
                chapterSection: chapter?.section || x.subject || 'GÉNÉRAL',
                linkedGameTitle: x.gameId ? (gameById.get(String(x.gameId))?.title || '') : '',
                studentSubmission: sub,
                status: done ? 'done' : 'todo'
            };
        });

        res.json(out);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/save', async (req, res) => {
    try {
        const Production = mongoose.model('Production');
        const productionId = String(req.body?.productionId || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        if (!productionId || !studentId) return res.status(400).json({ error: 'productionId et studentId requis' });

        const row = await Production.findById(productionId);
        if (!row) return res.status(404).json({ error: 'Production introuvable' });

        const type = String(row.productionType || 'fiche');
        const now = new Date();
        const entries = Array.isArray(row.submissions) ? [...row.submissions] : [];
        const idx = entries.findIndex((p) => String(p.studentId) === studentId);
        const previous = idx >= 0 ? entries[idx] : null;

        let nextEntry = {
            studentId,
            contentHtml: '',
            plainText: '',
            imageCount: 0,
            answers: [],
            score: 0,
            teacherValidated: Boolean(previous?.teacherValidated),
            updatedAt: now,
            completedAt: now
        };

        if (type === 'fiche') {
            const html = String(req.body?.contentHtml || '').slice(0, 300000);
            nextEntry.contentHtml = html;
            nextEntry.plainText = stripHtml(html).slice(0, 30000);
            nextEntry.imageCount = (html.match(/<img\b/gi) || []).length;
            nextEntry.completedAt = nextEntry.plainText ? (previous?.completedAt || now) : null;
        } else if (type === 'questionnaire') {
            const answers = (Array.isArray(req.body?.answers) ? req.body.answers : []).map((ans) => ({
                levelTitle: String(ans?.levelTitle || '').trim().slice(0, 120),
                prompt: String(ans?.prompt || '').trim().slice(0, 600),
                answer: String(ans?.answer || '').trim().slice(0, 5000),
                expectedKeywords: sanitizeKeywords(ans?.expectedKeywords),
                options: [],
                selectedIndex: -1,
                correctIndex: -1,
                isCorrect: false
            })).filter((ans) => ans.prompt || ans.answer || ans.expectedKeywords.length > 0 || ans.levelTitle);
            nextEntry.answers = answers;
            nextEntry.completedAt = answers.length > 0 && answers.every((ans) => ans.levelTitle && ans.prompt && ans.answer && ans.expectedKeywords.length > 0) ? (previous?.completedAt || now) : null;
        } else {
            const answers = (Array.isArray(req.body?.answers) ? req.body.answers : []).map((ans) => {
                const levelTitle = String(ans?.levelTitle || '').trim().slice(0, 120);
                const prompt = String(ans?.prompt || '').trim().slice(0, 600);
                const options = sanitizeQcmOptions(ans?.options);
                const correctIndex = Number(ans?.correctIndex);
                const boundedCorrectIndex = Number.isFinite(correctIndex) ? Math.max(0, Math.min(options.length - 1, correctIndex)) : -1;
                const optionLengthsOk = options.every((opt) => {
                    const words = countWords(opt);
                    return words > 0 && words <= 4;
                });
                return {
                    levelTitle,
                    prompt,
                    answer: '',
                    expectedKeywords: [],
                    options,
                    selectedIndex: -1,
                    correctIndex: boundedCorrectIndex,
                    isCorrect: boundedCorrectIndex >= 0 && optionLengthsOk && options.length === 4
                };
            }).filter((ans) => ans.prompt || ans.levelTitle || ans.options.some((opt) => opt) || ans.correctIndex >= 0);
            nextEntry.answers = answers;
            nextEntry.score = answers.filter((ans) => ans.isCorrect).length;
            nextEntry.completedAt = answers.length > 0 && answers.every((ans) => ans.levelTitle && ans.prompt && ans.options.length === 4 && ans.options.every((opt) => countWords(opt) > 0 && countWords(opt) <= 4) && ans.correctIndex >= 0) ? (previous?.completedAt || now) : null;
        }

        if (idx >= 0) entries[idx] = nextEntry;
        else entries.push(nextEntry);

        row.submissions = entries;
        await row.save();

        res.json({ ok: true, submission: nextEntry });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
