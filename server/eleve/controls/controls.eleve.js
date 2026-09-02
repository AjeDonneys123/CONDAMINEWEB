const express = require('express');
const mongoose = require('mongoose');
require('../../prof/models/prof.models');
const router = express.Router();

const norm = (value = '') => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const classKey = (value = '') => norm(value).replace(/\s/g, '');
const publicControl = (row) => ({
    _id: row._id, title: row.title, subject: row.subject, chapterId: row.chapterId,
    items: (row.items || []).map(({ expectedAnswers, expectedKeywords, correctIndex, ...item }) => item),
    submitted: row.submitted ? {
        ...row.submitted,
        corrections: (row.submitted.answers || []).map(answer => {
            const item = (row.items || []).find(candidate => String(candidate.id) === String(answer.itemId));
            return { ...answer, expectedAnswers: item?.expectedAnswers || [], expectedKeywords: item?.expectedKeywords || [] };
        })
    } : null
});

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Control = mongoose.model('AssessmentControl');
        const student = await Student.findById(req.params.studentId, 'currentClass').lean();
        if (!student) return res.json([]);
        const key = classKey(student.currentClass);
        const rows = await Control.find({ active: { $ne: false } }).sort({ createdAt: -1 }).lean();
        res.json(rows.filter(row => (row.targetClassrooms || []).some(c => classKey(c) === key)).map(row => publicControl({
            ...row,
            submitted: (row.submissions || []).find(s => String(s.studentId) === String(student._id)) || null
        })));
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const Control = mongoose.model('AssessmentControl');
        const row = await Control.findById(req.params.id).lean();
        if (!row || row.active === false) return res.status(404).json({ error: 'Contrôle indisponible' });
        res.json(publicControl(row));
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/submit', async (req, res) => {
    try {
        const Control = mongoose.model('AssessmentControl');
        const Student = mongoose.model('Student');
        const row = await Control.findById(req.params.id);
        const studentId = String(req.body?.studentId || '');
        if (!row || !mongoose.Types.ObjectId.isValid(studentId)) return res.status(400).json({ error: 'Contrôle ou élève invalide' });
        const student = await Student.findById(studentId, 'currentClass').lean();
        if (!student || !(row.targetClassrooms || []).some(value => classKey(value) === classKey(student.currentClass))) {
            return res.status(403).json({ error: 'Ce contrôle n’est pas destiné à cette classe.' });
        }
        if ((row.submissions || []).some(s => String(s.studentId) === studentId)) return res.status(409).json({ error: 'Contrôle déjà rendu' });
        const raw = Array.isArray(req.body?.answers) ? req.body.answers : [];
        const answers = (row.items || []).map((item) => {
            const given = raw.find(a => String(a.itemId) === String(item.id));
            const values = Array.isArray(given?.values) ? given.values.map(v => String(v || '')) : [String(given?.value ?? '')];
            let correct = false;
            if (item.type === 'qcm') correct = Number(given?.value) === Number(item.correctIndex);
            else if (item.type === 'fill') correct = (item.expectedAnswers || []).every((expected, index) => norm(values[index]) === norm(expected));
            else if ((item.expectedKeywords || []).length) correct = (item.expectedKeywords || []).every(keyword => norm(values[0]).includes(norm(keyword)));
            else correct = (item.expectedAnswers || []).some(expected => norm(values[0]) === norm(expected));
            const blankResults = item.type === 'fill' ? (item.expectedAnswers || []).map((expected, index) => ({ index, correct: norm(values[index]) === norm(expected), contestStatus: '' })) : [];
            const maxPoints = Number(item.points) || 1;
            const awardedPoints = item.type === 'fill'
                ? maxPoints * blankResults.filter(result => result.correct).length / Math.max(1, blankResults.length)
                : item.type === 'target' && (item.expectedKeywords || []).length
                    ? maxPoints * (item.expectedKeywords || []).filter(keyword => norm(values[0]).includes(norm(keyword))).length / item.expectedKeywords.length
                : (correct ? maxPoints : 0);
            return { itemId: item.id, values, value: given?.value, correct, blankResults, contestStatus: '', awardedPoints, maxPoints };
        });
        const score = answers.reduce((sum, answer) => sum + answer.awardedPoints, 0);
        const total = (row.items || []).reduce((sum, item) => sum + (Number(item.points) || 1), 0);
        const submission = { id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, studentId, answers, score: Math.round(score * 100) / 100, total: Math.round(total * 100) / 100, submittedAt: new Date() };
        row.submissions.push(submission);
        await row.save();
        res.json({ ...submission, corrections: answers.map((a, i) => ({ ...a, expectedAnswers: row.items[i]?.expectedAnswers || [], expectedKeywords: row.items[i]?.expectedKeywords || [] })) });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/contest', async (req, res) => {
    try {
        const Control = mongoose.model('AssessmentControl');
        const row = await Control.findById(req.params.id);
        const submission = row?.submissions?.find(s => String(s.studentId) === String(req.body?.studentId));
        const answer = submission?.answers?.find(a => String(a.itemId) === String(req.body?.itemId));
        const blankIndex = Number(req.body?.blankIndex);
        const blank = Number.isInteger(blankIndex) ? answer?.blankResults?.find(result => Number(result.index) === blankIndex) : null;
        if (!answer || answer.correct || (blank && blank.correct)) return res.status(400).json({ error: 'Réponse non contestable' });
        if (blank) { blank.contestStatus = 'pending'; blank.contestMessage = String(req.body?.message || '').trim().slice(0, 500); }
        else { answer.contestStatus = 'pending'; answer.contestMessage = String(req.body?.message || '').trim().slice(0, 500); }
        await row.save(); res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
