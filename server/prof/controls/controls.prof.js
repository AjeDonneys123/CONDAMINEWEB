const express = require('express');
const mongoose = require('mongoose');
const { AssessmentControl } = require('../models/prof.models');

const router = express.Router();
const cleanItems = (items = []) => (Array.isArray(items) ? items : []).map((item, index) => ({
    id: String(item?.id || `control_item_${index + 1}`).slice(0, 120),
    groupId: String(item?.groupId || item?.id || `control_group_${index + 1}`).slice(0, 120),
    groupPoints: Math.max(0, Math.min(100, Number(item?.groupPoints) || Number(item?.points) || 1)),
    type: ['fill', 'target', 'qcm'].includes(item?.type) ? item.type : 'target',
    lessonTitle: String(item?.lessonTitle || '').trim().slice(0, 180),
    prompt: String(item?.prompt || '').trim().slice(0, 60000),
    expectedAnswers: (Array.isArray(item?.expectedAnswers) ? item.expectedAnswers : []).map(v => String(v || '').trim()).filter(Boolean).slice(0, 80),
    expectedKeywords: (Array.isArray(item?.expectedKeywords) ? item.expectedKeywords : []).map(v => String(v || '').trim()).filter(Boolean).slice(0, 80),
    choices: (Array.isArray(item?.choices) ? item.choices : []).map(v => String(v || '').trim()).filter(Boolean).slice(0, 8),
    correctIndex: Math.max(0, Number(item?.correctIndex || 0)),
    points: Math.max(0.01, Math.min(100, Number(item?.points) || 1))
})).filter(item => item.prompt && (item.type !== 'qcm' || item.choices.length >= 2)).slice(0, 100);

router.get('/all', async (_req, res) => {
    try { res.json(await AssessmentControl.find({}).sort({ updatedAt: -1 }).lean()); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id/results', async (req, res) => {
    try {
        const row = await AssessmentControl.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });
        const Student = mongoose.model('Student');
        const ids = (row.submissions || []).map(s => s.studentId).filter(Boolean);
        const students = await Student.find({ _id: { $in: ids } }, 'firstName lastName currentClass').lean();
        const byId = new Map(students.map(s => [String(s._id), s]));
        res.json({ ...row, submissions: (row.submissions || []).map(s => ({ ...s, student: byId.get(String(s.studentId)) || null })) });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/', async (req, res) => {
    try {
        const data = req.body || {};
        const payload = {
            title: String(data.title || 'CONTRÔLE').trim().slice(0, 180),
            subject: String(data.subject || 'GÉNÉRAL').trim().slice(0, 100),
            chapterId: data.chapterId || null,
            learningModuleId: data.learningModuleId || null,
            teacherId: data.teacherId || null,
            targetClassrooms: [...new Set((data.targetClassrooms || []).map(v => String(v || '').trim().toUpperCase()).filter(Boolean))],
            active: data.active !== false,
            items: cleanItems(data.items)
        };
        if (!payload.chapterId || !payload.items.length) return res.status(400).json({ error: 'Chapitre et questions requis.' });
        const row = data._id
            ? await AssessmentControl.findByIdAndUpdate(data._id, { $set: payload }, { new: true })
            : await AssessmentControl.create(payload);
        res.json(row);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id/submissions/:submissionId', async (req, res) => {
    try {
        const row = await AssessmentControl.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });
        const submissions = Array.isArray(row.submissions) ? row.submissions.map(s => ({ ...s })) : [];
        const index = submissions.findIndex(s => String(s.id) === String(req.params.submissionId));
        if (index >= 0) {
            const current = submissions[index];
            const newScore = req.body?.score !== undefined ? Number(req.body.score) : current.score;
            submissions[index] = {
                ...current,
                score: Math.round(Number(newScore) * 100) / 100,
                teacherNote: req.body?.teacherNote !== undefined ? String(req.body.teacherNote) : (current.teacherNote || ''),
                answers: Array.isArray(req.body?.answers) ? req.body.answers : current.answers
            };
            row.submissions = submissions;
            row.markModified('submissions');
            await row.save();
            return res.json(submissions[index]);
        }
        res.status(404).json({ error: 'Copie introuvable' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/:id/contest/:submissionId/:itemId', async (req, res) => {
    try {
        const row = await AssessmentControl.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });
        const submissions = Array.isArray(row.submissions) ? row.submissions.map(s => ({ ...s })) : [];
        const submission = submissions.find(s => String(s.id) === String(req.params.submissionId));
        const answer = submission?.answers?.find(a => String(a.itemId) === String(req.params.itemId));
        const item = (row.items || []).find(candidate => String(candidate.id) === String(req.params.itemId));
        if (!answer) return res.status(404).json({ error: 'Réponse introuvable' });
        const blankIndex = Number(req.body?.blankIndex);
        const blank = Number.isInteger(blankIndex) ? answer.blankResults?.find(result => Number(result.index) === blankIndex) : null;
        if (blank) {
            blank.contestStatus = req.body?.accepted === true ? 'accepted' : 'rejected';
            if (req.body?.accepted === true) blank.correct = true;
            answer.correct = answer.blankResults.every(result => result.correct);
            const correctBlanks = answer.blankResults.filter(result => result.correct).length;
            answer.awardedPoints = (Number(item?.points) || 1) * correctBlanks / Math.max(1, answer.blankResults.length);
        } else {
            answer.contestStatus = req.body?.accepted === true ? 'accepted' : 'rejected';
            if (req.body?.accepted === true) answer.correct = true;
            answer.awardedPoints = answer.correct ? (Number(item?.points) || 1) : 0;
        }
        submission.score = Math.round(submission.answers.reduce((sum, candidate) => sum + (Number(candidate.awardedPoints) || 0), 0) * 100) / 100;
        row.submissions = submissions;
        row.markModified('submissions');
        await row.save();
        res.json(submission);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

const norm = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const matchAnswer = (given = '', expected = '') => {
    const givenNorm = norm(given);
    if (!givenNorm) return false;
    const variants = String(expected || '').split(/[/|]/).map(v => norm(v)).filter(Boolean);
    if (variants.length === 0) return givenNorm === norm(expected);
    return variants.some(v => v === givenNorm);
};

router.put('/:id/items/:itemId/expected', async (req, res) => {
    try {
        const row = await AssessmentControl.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });

        const items = Array.isArray(row.items) ? [...row.items] : [];
        const itemIndex = items.findIndex(candidate => String(candidate.id) === String(req.params.itemId));
        if (itemIndex < 0) return res.status(404).json({ error: 'Question introuvable' });

        const item = { ...items[itemIndex] };
        const expected = String(req.body?.expected || '').trim();
        const blankIndex = Number(req.body?.blankIndex);

        if (item.type === 'fill' && Number.isInteger(blankIndex)) {
            const expList = Array.isArray(item.expectedAnswers) ? [...item.expectedAnswers] : [];
            expList[blankIndex] = expected;
            item.expectedAnswers = expList;

            // Mettre a jour le prompt du controle en remplacant les guillemets correspondants
            let quoteCounter = 0;
            item.prompt = String(item.prompt || '').replace(/["“«]([^"”»]+)["”»]/g, (match, inner) => {
                if (quoteCounter === blankIndex) {
                    quoteCounter++;
                    return `"${expected.replace(/["“«"”»]/g, '').trim()}"`;
                }
                quoteCounter++;
                return match;
            });
        } else {
            // Target / Question ouverte
            item.expectedAnswers = expected.split(/[/|\n]/).map(s => s.trim()).filter(Boolean);
        }

        items[itemIndex] = item;
        row.items = items;

        // RECORRIGER AUTOMATIQUEMENT TOUTES LES COPIES
        const submissions = Array.isArray(row.submissions) ? row.submissions.map(s => ({ ...s })) : [];
        submissions.forEach((sub) => {
            const answers = Array.isArray(sub.answers) ? [...sub.answers] : [];
            const ansIdx = answers.findIndex(a => String(a.itemId) === String(item.id));
            if (ansIdx < 0) return;

            const answer = { ...answers[ansIdx] };
            if (item.type === 'fill') {
                const expList = item.expectedAnswers || [];
                const prevBlanks = Array.isArray(answer.blankResults) ? answer.blankResults : [];
                answer.blankResults = expList.map((exp, bIdx) => {
                    const prev = prevBlanks[bIdx] || {};
                    const val = prev.value !== undefined ? prev.value : ((answer.values || [])[bIdx] || '');
                    const isOk = matchAnswer(val, exp);
                    const contestResolved = isOk && prev.contestStatus === 'pending' ? 'accepted' : (prev.contestStatus || '');
                    return {
                        ...prev,
                        index: bIdx,
                        value: val,
                        expected: exp,
                        correct: isOk,
                        contestStatus: contestResolved
                    };
                });

                const correctCount = answer.blankResults.filter(b => b.correct).length;
                const maxPts = Number(item.points) || 1;
                answer.awardedPoints = Math.round((maxPts * correctCount / Math.max(1, answer.blankResults.length)) * 100) / 100;
                answer.correct = answer.blankResults.every(b => b.correct);
                if (answer.correct && answer.contestStatus === 'pending') answer.contestStatus = 'accepted';
            } else if (item.type === 'target') {
                const val = String(answer.value || '');
                const isOk = (item.expectedAnswers || []).some(exp => matchAnswer(val, exp)) ||
                    ((item.expectedKeywords || []).length > 0 && (item.expectedKeywords || []).every(kw => norm(val).includes(norm(kw))));
                const maxPts = Number(item.points) || 1;
                answer.correct = isOk;
                answer.awardedPoints = isOk ? maxPts : 0;
                if (isOk && answer.contestStatus === 'pending') answer.contestStatus = 'accepted';
            }

            answers[ansIdx] = answer;
            sub.answers = answers;
            sub.score = Math.round(answers.reduce((sum, a) => sum + (Number(a.awardedPoints) || 0), 0) * 100) / 100;
        });

        row.submissions = submissions;
        row.markModified('items');
        row.markModified('submissions');
        await row.save();

        res.json({ ok: true, control: row, updatedCount: submissions.length });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id/update-and-regrade', async (req, res) => {
    try {
        const row = await AssessmentControl.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });

        const prompts = req.body?.prompts || {};
        const items = Array.isArray(row.items) ? [...row.items] : [];

        items.forEach((item, idx) => {
            if (prompts[item.id] !== undefined) {
                const newPrompt = String(prompts[item.id] || '').trim();
                item.prompt = newPrompt;
                if (item.type === 'fill') {
                    const quoted = (newPrompt.match(/["“«]([^"”»]+)["”»]/g) || [])
                        .map(s => s.replace(/["“«"”»]/g, '').trim())
                        .filter(Boolean);
                    item.expectedAnswers = quoted;
                }
                items[idx] = item;
            }
        });
        row.items = items;

        // RECALCUL DE TOUTES LES COPIES AVEC LES NOUVEAUX ÉNONCÉS / ATTENDUS
        const submissions = Array.isArray(row.submissions) ? row.submissions.map(s => ({ ...s })) : [];
        submissions.forEach((sub) => {
            const answers = Array.isArray(sub.answers) ? [...sub.answers] : [];
            answers.forEach((answer, aIdx) => {
                const item = items.find(candidate => String(candidate.id) === String(answer.itemId));
                if (!item) return;

                if (item.type === 'fill') {
                    const expList = item.expectedAnswers || [];
                    const prevBlanks = Array.isArray(answer.blankResults) ? answer.blankResults : [];
                    answer.blankResults = expList.map((exp, bIdx) => {
                        const prev = prevBlanks[bIdx] || {};
                        const val = prev.value !== undefined ? prev.value : ((answer.values || [])[bIdx] || '');
                        const isOk = matchAnswer(val, exp);
                        const contestResolved = isOk && prev.contestStatus === 'pending' ? 'accepted' : (prev.contestStatus || '');
                        return {
                            ...prev,
                            index: bIdx,
                            value: val,
                            expected: exp,
                            correct: isOk,
                            contestStatus: contestResolved
                        };
                    });

                    const correctCount = answer.blankResults.filter(b => b.correct).length;
                    const maxPts = Number(item.points) || 1;
                    answer.awardedPoints = Math.round((maxPts * correctCount / Math.max(1, answer.blankResults.length)) * 100) / 100;
                    answer.correct = answer.blankResults.every(b => b.correct);
                    if (answer.correct && answer.contestStatus === 'pending') answer.contestStatus = 'accepted';
                } else if (item.type === 'target') {
                    const val = String(answer.value || '');
                    const isOk = (item.expectedAnswers || []).some(exp => matchAnswer(val, exp)) ||
                        ((item.expectedKeywords || []).length > 0 && (item.expectedKeywords || []).every(kw => norm(val).includes(norm(kw))));
                    const maxPts = Number(item.points) || 1;
                    answer.correct = isOk;
                    answer.awardedPoints = isOk ? maxPts : 0;
                    if (isOk && answer.contestStatus === 'pending') answer.contestStatus = 'accepted';
                } else if (item.type === 'qcm') {
                    const isOk = Number(answer.value) === Number(item.correctIndex);
                    const maxPts = Number(item.points) || 1;
                    answer.correct = isOk;
                    answer.awardedPoints = isOk ? maxPts : 0;
                }

                answers[aIdx] = answer;
            });
            sub.answers = answers;
            sub.score = Math.round(answers.reduce((sum, a) => sum + (Number(a.awardedPoints) || 0), 0) * 100) / 100;
        });

        row.submissions = submissions;
        row.markModified('items');
        row.markModified('submissions');
        await row.save();

        res.json({ ok: true, control: row, updatedCount: submissions.length });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req, res) => {
    try { await AssessmentControl.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
