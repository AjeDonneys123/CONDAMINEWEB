const express = require('express');
const mongoose = require('mongoose');
const { AssessmentControl, Classroom } = require('../models/prof.models');

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

const pronoteNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const roundGrade = (value) => Math.round(Number(value || 0) * 100) / 100;

async function preparePronoteExport(control, options = {}) {
    const classId = String(options.classId || '').trim();
    if (!mongoose.isValidObjectId(classId)) throw new Error('Classe invalide');
    const classroom = await Classroom.findById(classId).lean();
    if (!classroom) throw new Error('Classe introuvable');

    const className = String(classroom.name || '').trim();
    const targets = (control.targetClassrooms || []).map(value => String(value || '').trim().toUpperCase());
    if (targets.length && !targets.includes(className.toUpperCase())) {
        throw new Error(`Le contrôle n’est pas prévu pour la classe ${className}.`);
    }

    const Student = mongoose.model('Student');
    const students = await Student.find({ classId }, 'firstName lastName').lean();
    const studentById = new Map(students.map(student => [String(student._id), student]));
    const outOf = Math.max(1, Math.min(100, pronoteNumber(options.outOf, 20)));
    const rows = (control.submissions || []).map(copy => {
        const student = studentById.get(String(copy.studentId || ''));
        const total = Math.max(0.01, pronoteNumber(copy.total, 0));
        const score = pronoteNumber(copy.score, 0);
        return {
            studentId: String(copy.studentId || student?._id || copy.id || `anon_${Date.now()}`),
            firstName: String(student?.firstName || copy.firstName || '').trim(),
            lastName: String(student?.lastName || copy.lastName || '').trim(),
            fullName: String(copy.studentName || `${student?.firstName || copy.firstName || ''} ${student?.lastName || copy.lastName || ''}`).trim(),
            score: roundGrade(score),
            total: roundGrade(total),
            grade: roundGrade(score * outOf / total),
            submittedAt: copy.submittedAt || null
        };
    }).filter(row => row.fullName && row.studentId);

    return {
        id: `pronote_${Date.now()}`,
        controlId: String(control._id),
        classId,
        className,
        title: String(options.title || control.title || 'Contrôle').trim().slice(0, 180),
        date: String(options.date || new Date().toISOString().slice(0, 10)),
        coefficient: Math.max(0, Math.min(100, pronoteNumber(options.coefficient, 1))),
        outOf,
        createdAt: new Date().toISOString(),
        rows
    };
}

// Préparation explicite : ce point d'entrée ne touche jamais à Pronote.
// Il construit seulement le lot que l'extension proposera ensuite en aperçu.
router.post('/:id/pronote-export', async (req, res) => {
    try {
        const control = await AssessmentControl.findById(req.params.id);
        if (!control) return res.status(404).json({ error: 'Contrôle introuvable' });
        const payload = await preparePronoteExport(control, req.body || {});
        control.pronoteExport = payload;
        control.markModified('pronoteExport');
        await control.save();
        res.json({ ok: true, export: payload });
    } catch (error) { res.status(400).json({ error: error.message }); }
});

// Liste des lots disponibles pour la classe active de l'extension.
router.get('/pronote/ready', async (req, res) => {
    try {
        const classId = String(req.query.classId || '').trim();
        const controls = await AssessmentControl.find({ 'pronoteExport.classId': classId }, 'title pronoteExport updatedAt').sort({ updatedAt: -1 }).lean();
        res.json((controls || []).map(control => ({
            controlId: String(control._id),
            title: control.title,
            updatedAt: control.updatedAt,
            export: control.pronoteExport
        })).filter(row => row.export?.rows?.length));
    } catch (error) { res.status(500).json({ error: error.message }); }
});

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

// Une réponse libre est une réponse de contenu, pas un exercice d'orthographe.
// NFKD + \p{M} couvre aussi les caractères accentués composés / collés depuis
// un téléphone, contrairement à la seule plage U+0300–U+036F.
const norm = (value = '') => String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Correction conciliante : on ne pénalise ni les accents, ni les apostrophes,
// ni les espaces oubliés, ni les articles français.  La comparaison reste
// volontairement stricte sur les mots réellement porteurs de sens.
const ARTICLE_WORDS = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'l', 'd']);
const ARTICLE_PREFIXES = ['les', 'des', 'une', 'aux', 'le', 'la', 'un', 'du', 'de', 'au', 'l', 'd'];
const relaxedAnswerKeys = (value = '') => {
    const key = norm(value).split(/\s+/).filter(word => word && !ARTICLE_WORDS.has(word)).join('');
    const keys = new Set(key ? [key] : []);
    // Couvre également « lempire » au lieu de « l'empire » / « l empire ».
    ARTICLE_PREFIXES.forEach(prefix => {
        if (key.startsWith(prefix) && key.length > prefix.length) keys.add(key.slice(prefix.length));
    });
    return [...keys];
};

const matchAnswer = (given = '', expected = '') => {
    const givenNorm = norm(given);
    const givenKeys = relaxedAnswerKeys(given);
    if (!givenNorm || !givenKeys.length) return false;
    const variants = String(expected || '').split(/[/|]/).map(v => String(v || '').trim()).filter(Boolean);
    return variants.some(variant => norm(variant) === givenNorm || relaxedAnswerKeys(variant).some(key => givenKeys.includes(key)));
};

const containsAnswer = (given = '', expected = '') => {
    const givenKeys = relaxedAnswerKeys(given);
    const expectedKeys = relaxedAnswerKeys(expected);
    return givenKeys.some(givenKey => expectedKeys.some(expectedKey => expectedKey && givenKey.includes(expectedKey)));
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

        if (item.type === 'qcm' && Number.isInteger(Number(req.body?.correctIndex))) {
            const correctIndex = Number(req.body.correctIndex);
            if (correctIndex < 0 || correctIndex >= (item.choices || []).length) {
                return res.status(400).json({ error: 'Choix correct invalide' });
            }
            item.correctIndex = correctIndex;
        } else if (item.type === 'fill' && Number.isInteger(blankIndex)) {
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
                    ((item.expectedKeywords || []).length > 0 && (item.expectedKeywords || []).every(kw => containsAnswer(val, kw)));
                const maxPts = Number(item.points) || 1;
                answer.correct = isOk;
                answer.awardedPoints = isOk ? maxPts : 0;
                if (isOk && answer.contestStatus === 'pending') answer.contestStatus = 'accepted';
            } else if (item.type === 'qcm') {
                const isOk = Number(answer.value) === Number(item.correctIndex);
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
                        ((item.expectedKeywords || []).length > 0 && (item.expectedKeywords || []).every(kw => containsAnswer(val, kw)));
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

router.get('/live-alerts', async (_req, res) => {
    try {
        // Seuls les contrôles explicitement ouverts (active: true) sont éligibles aux alertes en direct
        const controls = await AssessmentControl.find({ active: true }, 'title alerts updatedAt').lean();
        const unackedAlerts = [];
        const now = Date.now();
        const maxAgeMs = 3 * 60 * 1000; // Uniquement les alertes survenues il y a moins de 3 minutes

        (controls || []).forEach(ctrl => {
            (ctrl.alerts || []).forEach(alert => {
                if (alert && alert.acknowledged !== true) {
                    const alertTime = alert.timestamp ? new Date(alert.timestamp).getTime() : 0;
                    if (now - alertTime < maxAgeMs) {
                        unackedAlerts.push({
                            ...alert,
                            controlId: String(ctrl._id),
                            controlTitle: ctrl.title || 'Contrôle'
                        });
                    }
                }
            });
        });
        unackedAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(unackedAlerts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/toggle-active', async (req, res) => {
    try {
        const control = await AssessmentControl.findById(req.params.id);
        if (!control) return res.status(404).json({ error: 'Contrôle introuvable' });
        if (req.body?.active !== undefined) {
            control.active = Boolean(req.body.active);
        } else {
            control.active = !control.active;
        }
        control.markModified('active');
        await control.save();
        res.json({ ok: true, active: control.active, id: control._id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/clear-alerts', async (req, res) => {
    try {
        const control = await AssessmentControl.findById(req.params.id);
        if (!control) return res.status(404).json({ error: 'Contrôle introuvable' });
        control.alerts = [];
        control.markModified('alerts');
        await control.save();
        res.json({ ok: true, id: control._id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/alerts/:alertId/ack', async (req, res) => {
    try {
        const { alertId } = req.params;
        const controls = await AssessmentControl.find({ 'alerts.id': alertId });
        for (const ctrl of controls) {
            let modified = false;
            ctrl.alerts = (ctrl.alerts || []).map(a => {
                if (String(a.id) === String(alertId)) {
                    modified = true;
                    return { ...a, acknowledged: true };
                }
                return a;
            });
            if (modified) {
                ctrl.markModified('alerts');
                await ctrl.save();
            }
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/alerts/clear-all', async (_req, res) => {
    try {
        const controls = await AssessmentControl.find({ 'alerts.acknowledged': { $ne: true } });
        for (const ctrl of controls) {
            ctrl.alerts = (ctrl.alerts || []).map(a => ({ ...a, acknowledged: true }));
            ctrl.markModified('alerts');
            await ctrl.save();
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
