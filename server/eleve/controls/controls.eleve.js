const express = require('express');
const mongoose = require('mongoose');
require('../../prof/models/prof.models');
const router = express.Router();

const norm = (value = '') => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const classKey = (value = '') => norm(value).replace(/\s/g, '');
const publicControl = (row) => ({
    _id: row._id, title: row.title, subject: row.subject, chapterId: row.chapterId,
    items: (row.items || []).map(({ expectedAnswers, expectedKeywords, correctIndex, prompt, ...item }) => ({
        ...item,
        // Mask quoted answers in prompt for fill items so answers are not exposed in network payloads
        prompt: item.type === 'fill' ? String(prompt || '').replace(/["“«][^"”»]+["”»]/g, '__________') : prompt
    })),
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
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });

        const reqStudentId = String(req.body?.studentId || '').trim();
        const firstName = String(req.body?.firstName || '').trim();
        const lastName = String(req.body?.lastName || '').trim();

        if (!mongoose.Types.ObjectId.isValid(reqStudentId) && !firstName && !lastName) {
            return res.status(400).json({ error: 'Prénom et nom requis pour rendre le contrôle.' });
        }

        let matchedStudent = null;
        if (mongoose.Types.ObjectId.isValid(reqStudentId)) {
            matchedStudent = await Student.findById(reqStudentId, 'firstName lastName currentClass').lean();
        } else if (firstName || lastName) {
            const allStudents = await Student.find({}, 'firstName lastName currentClass').lean();
            const targetKey1 = norm(`${firstName} ${lastName}`);
            const targetKey2 = norm(`${lastName} ${firstName}`);
            matchedStudent = allStudents.find(s => {
                const k1 = norm(`${s.firstName} ${s.lastName}`);
                const k2 = norm(`${s.lastName} ${s.firstName}`);
                return k1 === targetKey1 || k2 === targetKey1 || k1 === targetKey2;
            });
        }

        const assignedStudentId = matchedStudent ? String(matchedStudent._id) : null;
        const assignedStudentName = matchedStudent
            ? `${matchedStudent.firstName} ${matchedStudent.lastName}`
            : (`${firstName} ${lastName}`.trim() || 'Élève');
        const assignedClass = matchedStudent?.currentClass || '';

        const raw = Array.isArray(req.body?.answers) ? req.body.answers : [];
        const answers = (row.items || []).map((item) => {
            const given = raw.find(a => String(a.itemId) === String(item.id));
            const values = Array.isArray(given?.values) ? given.values.map(v => String(v || '')) : [String(given?.value ?? '')];
            let correct = false;
            if (item.type === 'qcm') correct = Number(given?.value) === Number(item.correctIndex);
            else if (item.type === 'fill') correct = (item.expectedAnswers || []).every((expected, index) => norm(values[index]) === norm(expected));
            else if ((item.expectedKeywords || []).length) correct = (item.expectedKeywords || []).every(keyword => norm(values[0]).includes(norm(keyword)));
            else correct = (item.expectedAnswers || []).some(expected => norm(values[0]) === norm(expected));

            const blankResults = item.type === 'fill' ? (item.expectedAnswers || []).map((expected, index) => ({
                index,
                value: String(values[index] || ''),
                expected: String(expected || ''),
                correct: norm(values[index]) === norm(expected),
                contestStatus: ''
            })) : [];

            const maxPoints = Number(item.points) || 1;
            const awardedPoints = item.type === 'fill'
                ? maxPoints * blankResults.filter(result => result.correct).length / Math.max(1, blankResults.length)
                : item.type === 'target' && (item.expectedKeywords || []).length
                    ? maxPoints * (item.expectedKeywords || []).filter(keyword => norm(values[0]).includes(norm(keyword))).length / item.expectedKeywords.length
                : (correct ? maxPoints : 0);

            return {
                itemId: item.id,
                values,
                value: given?.value,
                correct,
                blankResults,
                contestStatus: '',
                awardedPoints: Math.round(awardedPoints * 100) / 100,
                maxPoints
            };
        });

        const score = answers.reduce((sum, answer) => sum + answer.awardedPoints, 0);
        const total = (row.items || []).reduce((sum, item) => sum + (Number(item.points) || 1), 0);
        const submission = {
            id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            studentId: assignedStudentId,
            studentName: assignedStudentName,
            firstName: firstName || matchedStudent?.firstName || '',
            lastName: lastName || matchedStudent?.lastName || '',
            currentClass: assignedClass,
            answers,
            score: Math.round(score * 100) / 100,
            total: Math.round(total * 100) / 100,
            submittedAt: new Date()
        };

        const submissions = Array.isArray(row.submissions) ? [...row.submissions] : [];
        const existingIndex = submissions.findIndex(s =>
            (assignedStudentId && String(s.studentId) === assignedStudentId) ||
            (assignedStudentName && norm(s.studentName) === norm(assignedStudentName))
        );
        if (existingIndex >= 0) {
            submissions[existingIndex] = { ...submissions[existingIndex], ...submission, id: submissions[existingIndex].id || submission.id };
        } else {
            submissions.push(submission);
        }
        row.submissions = submissions;
        await row.save();

        res.json({
            ...submission,
            corrections: answers.map((a, i) => ({
                ...a,
                expectedAnswers: row.items[i]?.expectedAnswers || [],
                expectedKeywords: row.items[i]?.expectedKeywords || []
            }))
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/contest', async (req, res) => {
    try {
        const Control = mongoose.model('AssessmentControl');
        const row = await Control.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });

        const submissionId = String(req.body?.submissionId || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        const studentName = String(req.body?.studentName || '').trim();

        const submissions = Array.isArray(row.submissions) ? row.submissions : [];
        const submission = submissions.find(s =>
            (submissionId && String(s.id) === submissionId) ||
            (studentId && String(s.studentId) === studentId) ||
            (studentName && norm(s.studentName) === norm(studentName))
        );

        if (!submission) return res.status(404).json({ error: 'Copie introuvable' });

        const answer = submission.answers?.find(a => String(a.itemId) === String(req.body?.itemId));
        const blankIndex = Number(req.body?.blankIndex);
        const blank = Number.isInteger(blankIndex) ? answer?.blankResults?.find(result => Number(result.index) === blankIndex) : null;

        if (!answer || answer.correct || (blank && blank.correct)) {
            return res.status(400).json({ error: 'Réponse déjà correcte ou introuvable' });
        }

        const message = String(req.body?.message || '').trim().slice(0, 500);
        if (blank) {
            blank.contestStatus = 'pending';
            blank.contestMessage = message;
        } else {
            answer.contestStatus = 'pending';
            answer.contestMessage = message;
        }

        row.markModified('submissions');
        await row.save();
        res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
