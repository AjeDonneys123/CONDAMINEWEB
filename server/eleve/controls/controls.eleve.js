const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('../../prof/models/prof.models');
const EleveAI = require('../core/eleve.ai');
const router = express.Router();

// Même règle que côté professeur : la correction ignore accents, casse,
// apostrophes, ponctuation et espaces parasites, y compris sur les téléphones.
const norm = (value = '') => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ß/g, 'ss').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const classKey = (value = '') => norm(value).replace(/\s/g, '');
const verifyControlStudent = (token = '', expectedStudentId = '') => {
    const secret = String(process.env.CONTROL_AUTH_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const [payload, signature] = String(token || '').split('.');
    if (!secret || !payload || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return data.kind === 'control-student'
            && String(data.studentId || '') === String(expectedStudentId || '')
            && Number(data.exp || 0) > Date.now();
    } catch (_) { return false; }
};

// Les articles, accents, apostrophes et espaces oubliés ne transforment pas
// une bonne réponse en erreur. Les mots importants restent comparés.
const ARTICLE_WORDS = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'l', 'd']);
const ARTICLE_PREFIXES = ['les', 'des', 'une', 'aux', 'le', 'la', 'un', 'du', 'de', 'au', 'l', 'd'];
const relaxedAnswerKeys = (value = '') => {
    const key = norm(value).split(/\s+/).filter(word => word && !ARTICLE_WORDS.has(word)).join('');
    const keys = new Set(key ? [key] : []);
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
        const Student = mongoose.model('Student');
        const row = await Control.findById(req.params.id).lean();
        if (!row || row.active === false) return res.status(404).json({ error: 'Contrôle indisponible' });
        const studentId = String(req.query?.studentId || '').trim();
        const authToken = String(req.query?.authToken || '').trim();
        let student = null;
        if (studentId && mongoose.Types.ObjectId.isValid(studentId) && verifyControlStudent(authToken, studentId)) {
            student = await Student.findById(studentId, 'currentClass').lean();
            if (student && !(row.targetClassrooms || []).some((className) => classKey(className) === classKey(student.currentClass))) {
                return res.status(403).json({ error: 'Ce contrôle n’est pas attribué à ta classe.' });
            }
        }
        const submitted = studentId && mongoose.Types.ObjectId.isValid(studentId)
            ? (row.submissions || []).find((submission) => String(submission?.studentId || '') === studentId) || null
            : null;
        res.json(publicControl({ ...row, submitted }));
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/submit', async (req, res) => {
    try {
        const Control = mongoose.model('AssessmentControl');
        const Student = mongoose.model('Student');
        const row = await Control.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });

        const reqStudentId = String(req.body?.studentId || '').trim();
        const authToken = String(req.body?.authToken || '').trim();
        const firstName = String(req.body?.firstName || '').trim();
        const lastName = String(req.body?.lastName || '').trim();

        if (!mongoose.Types.ObjectId.isValid(reqStudentId) && !firstName && !lastName) {
            return res.status(400).json({ error: 'Prénom et nom requis pour valider le contrôle.' });
        }

        let matchedStudent = null;
        if (mongoose.Types.ObjectId.isValid(reqStudentId) && verifyControlStudent(authToken, reqStudentId)) {
            matchedStudent = await Student.findById(reqStudentId, 'firstName lastName currentClass').lean();
        }
        if (!matchedStudent && (firstName || lastName)) {
            const allStudents = await Student.find({}, 'firstName lastName currentClass').lean();
            const targetClasses = Array.isArray(row.targetClassrooms) && row.targetClassrooms.length > 0
                ? new Set(row.targetClassrooms.map(classKey).filter(Boolean))
                : null;
            const scopedStudents = targetClasses
                ? allStudents.filter((s) => targetClasses.has(classKey(s.currentClass)))
                : allStudents;
            const searchPools = targetClasses && scopedStudents.length > 0 ? [scopedStudents, allStudents] : [allStudents];
            const targetKey1 = norm(`${firstName} ${lastName}`);
            const targetKey2 = norm(`${lastName} ${firstName}`);
            const firstTokens = norm(firstName).split(/\s+/).filter(Boolean);
            const lastTokens = norm(lastName).split(/\s+/).filter(Boolean);

            for (const pool of searchPools) {
                matchedStudent = pool.find((s) => {
                    const k1 = norm(`${s.firstName} ${s.lastName}`);
                    const k2 = norm(`${s.lastName} ${s.firstName}`);
                    return k1 === targetKey1 || k2 === targetKey1 || k1 === targetKey2;
                }) || null;
                if (matchedStudent) break;

                if (firstTokens.length > 0 && lastTokens.length > 0) {
                    const partialMatches = pool.filter((s) => {
                        const sFirst = norm(s.firstName).split(/\s+/).filter(Boolean);
                        const sLast = norm(s.lastName).split(/\s+/).filter(Boolean);
                        const direct = firstTokens.every((t) => sFirst.includes(t)) && lastTokens.every((t) => sLast.includes(t));
                        const swapped = firstTokens.every((t) => sLast.includes(t)) && lastTokens.every((t) => sFirst.includes(t));
                        return direct || swapped;
                    });
                    if (partialMatches.length === 1) {
                        matchedStudent = partialMatches[0];
                        break;
                    }
                }
            }
        }

        const assignedStudentId = matchedStudent ? String(matchedStudent._id) : (mongoose.Types.ObjectId.isValid(reqStudentId) ? reqStudentId : null);
        const assignedStudentName = matchedStudent
            ? `${matchedStudent.firstName} ${matchedStudent.lastName}`.trim()
            : (`${firstName} ${lastName}`.trim() || 'Élève');
        const assignedClass = matchedStudent?.currentClass || '';
        if (assignedClass && Array.isArray(row.targetClassrooms) && row.targetClassrooms.length > 0) {
            if (!row.targetClassrooms.some((className) => classKey(className) === classKey(assignedClass))) {
                return res.status(403).json({ error: 'Ce contrôle n’est pas attribué à ta classe.' });
            }
        }

        const raw = Array.isArray(req.body?.answers) ? req.body.answers : [];
        const items = Array.isArray(row.items) ? row.items : [];
        const total = items.reduce((sum, item) => sum + (Number(item.points) || 1), 0);
        const nonQcmItems = items.filter((item) => item?.type !== 'qcm');

        let aiCorrection = null;
        let aiAvailable = false;
        if (nonQcmItems.length > 0) {
            try {
                aiCorrection = await EleveAI.correctAssessmentControl({
                    title: row.title,
                    subject: row.subject,
                    studentClass: assignedClass,
                    items: nonQcmItems,
                    answers: raw
                });
                aiAvailable = Number.isFinite(Number(aiCorrection?.score)) && aiCorrection?._ai_debug?.parsed !== false;
            } catch (_) {
                aiAvailable = false;
            }
        }

        const aiItems = new Map((aiAvailable && Array.isArray(aiCorrection?.items) ? aiCorrection.items : []).map((item) => [String(item?.itemId || ''), item]));
        const answers = items.map((item) => {
            const given = raw.find((answer) => String(answer?.itemId) === String(item.id)) || {};
            const maxPoints = Number(item.points) || 1;

            // Correction automatique deterministe pour les QCM (sans appel IA)
            if (item.type === 'qcm') {
                const choices = Array.isArray(item.choices) ? item.choices : [];
                const hasSelection = given.value !== '' && given.value !== null && given.value !== undefined && Number.isFinite(Number(given.value));
                const selectedIndex = hasSelection ? Number(given.value) : -1;
                const correctIndex = Number(item.correctIndex);
                const isCorrect = hasSelection && selectedIndex === correctIndex;
                const selectedChoice = hasSelection && choices[selectedIndex] !== undefined
                    ? `${String.fromCharCode(65 + selectedIndex)}. ${choices[selectedIndex]}`
                    : 'Aucune réponse';
                const expectedChoice = Number.isInteger(correctIndex) && choices[correctIndex] !== undefined
                    ? `${String.fromCharCode(65 + correctIndex)}. ${choices[correctIndex]}`
                    : '';
                const awardedPoints = isCorrect ? Math.round(maxPoints * 100) / 100 : 0;
                return {
                    itemId: item.id,
                    values: [],
                    value: hasSelection ? selectedIndex : '',
                    correct: isCorrect,
                    awardedPoints,
                    maxPoints,
                    feedback: isCorrect
                        ? `Bonne réponse (${selectedChoice}).`
                        : `Ta réponse : ${selectedChoice}.${expectedChoice ? ` Bonne réponse : ${expectedChoice}.` : ''}`
                };
            }

            // Questions ouvertes / textes a trous : correction IA si disponible, sinon repli automatique deterministe
            if (aiAvailable && aiItems.has(String(item.id))) {
                const corrected = aiItems.get(String(item.id)) || {};
                const awardedPoints = Math.max(0, Math.min(maxPoints, Number(corrected.awardedPoints) || 0));
                return {
                    itemId: item.id,
                    values: Array.isArray(given.values) ? given.values.map((value) => String(value || '')) : [],
                    value: given.value,
                    correct: corrected.correct === true || awardedPoints >= maxPoints,
                    awardedPoints: Math.round(awardedPoints * 100) / 100,
                    maxPoints,
                    feedback: String(corrected.feedback || '').trim()
                };
            }

            if (item.type === 'fill') {
                const expList = Array.isArray(item.expectedAnswers) ? item.expectedAnswers : [];
                const givenValues = Array.isArray(given.values) ? given.values.map((value) => String(value || '')) : [];
                const blankResults = expList.map((exp, bIdx) => {
                    const val = givenValues[bIdx] || '';
                    return {
                        index: bIdx,
                        value: val,
                        expected: exp,
                        correct: matchAnswer(val, exp)
                    };
                });
                const correctBlanks = blankResults.filter((b) => b.correct).length;
                const awardedPoints = expList.length > 0
                    ? Math.round((maxPoints * correctBlanks / expList.length) * 100) / 100
                    : 0;
                const isCorrect = blankResults.length > 0 && blankResults.every((b) => b.correct);
                return {
                    itemId: item.id,
                    values: givenValues,
                    value: given.value,
                    blankResults,
                    correct: isCorrect,
                    awardedPoints,
                    maxPoints,
                    feedback: isCorrect
                        ? 'Bonne réponse.'
                        : `${correctBlanks}/${expList.length} trou(s) correct(s).`
                };
            }

            const val = String(given.value ?? '');
            const isCorrect = (item.expectedAnswers || []).some((exp) => matchAnswer(val, exp))
                || ((item.expectedKeywords || []).length > 0 && (item.expectedKeywords || []).every((kw) => containsAnswer(val, kw)));
            const awardedPoints = isCorrect ? Math.round(maxPoints * 100) / 100 : 0;
            return {
                itemId: item.id,
                values: [],
                value: given.value,
                correct: isCorrect,
                awardedPoints,
                maxPoints,
                feedback: isCorrect ? 'Bonne réponse.' : 'Réponse incomplète ou incorrecte.'
            };
        });

        const score = answers.reduce((sum, answer) => sum + answer.awardedPoints, 0);
        const correctCount = answers.filter((answer) => answer.correct).length;
        const autoExplanation = nonQcmItems.length === 0
            ? `Correction automatique du QCM : ${correctCount} bonne(s) réponse(s) sur ${items.length}.`
            : `Correction automatique : ${correctCount} bonne(s) réponse(s) sur ${items.length}.`;
        const submission = {
            id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            studentId: assignedStudentId,
            studentName: assignedStudentName,
            firstName: matchedStudent?.firstName || firstName || '',
            lastName: matchedStudent?.lastName || lastName || '',
            currentClass: assignedClass,
            answers,
            score: Math.round(score * 100) / 100,
            total: Math.round(total * 100) / 100,
            submittedAt: new Date(),
            correctionStatus: 'completed',
            explanation: (aiAvailable && String(aiCorrection?.explanation || '').trim()) || autoExplanation,
            correctedBy: aiAvailable ? 'ai' : 'auto',
            reviewClosed: true,
            reviewClosedAt: new Date()
        };

        const submissions = Array.isArray(row.submissions) ? [...row.submissions] : [];
        const existingIndex = submissions.findIndex(s =>
            (assignedStudentId && String(s.studentId) === assignedStudentId) ||
            (assignedStudentName && norm(s.studentName) === norm(assignedStudentName))
        );
        if (existingIndex >= 0 && submissions[existingIndex]?.reviewClosed === true) {
            return res.status(409).json({ error: 'Ce contrôle a déjà été rendu.' });
        }
        if (existingIndex >= 0) {
            submissions[existingIndex] = { ...submissions[existingIndex], ...submission, id: submissions[existingIndex].id || submission.id };
        } else {
            submissions.push(submission);
        }
        row.submissions = submissions;
        row.markModified('submissions');
        await row.save();

        res.json({
            ...submission,
            corrections: answers
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

        if (blank) {
            blank.contestStatus = 'pending';
            // Une contestation est désormais un simple signalement : aucun motif requis.
            delete blank.contestMessage;
        } else {
            answer.contestStatus = 'pending';
            delete answer.contestMessage;
        }

        row.markModified('submissions');
        await row.save();
        res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/finish-review', async (req, res) => {
    try {
        const Control = mongoose.model('AssessmentControl');
        const row = await Control.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });
        const submissionId = String(req.body?.submissionId || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        const submission = (row.submissions || []).find((entry) =>
            (submissionId && String(entry?.id || '') === submissionId)
            || (studentId && String(entry?.studentId || '') === studentId)
        );
        if (!submission) return res.status(404).json({ error: 'Copie introuvable' });
        submission.reviewClosed = true;
        submission.reviewClosedAt = new Date();
        row.markModified('submissions');
        await row.save();
        res.json({ ok: true, reviewClosed: true, reviewClosedAt: submission.reviewClosedAt });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/cheat-alert', async (req, res) => {
    try {
        const Control = mongoose.model('AssessmentControl');
        const Student = mongoose.model('Student');
        const row = await Control.findById(req.params.id);
        if (!row) return res.status(404).json({ error: 'Contrôle introuvable' });

        // Si le contrôle est fermé par le professeur, aucune alerte n'est enregistrée
        if (row.active === false) {
            return res.status(403).json({ error: 'Ce contrôle est fermé par le professeur.' });
        }

        let bodyData = req.body || {};
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch (_) { bodyData = {}; }
        }

        const reqStudentId = String(bodyData?.studentId || '').trim();
        let rawStudentName = String(bodyData?.studentName || '').trim();
        const reason = String(bodyData?.reason || "Sortie de l'écran / Changement d'application sur mobile").trim();

        if (mongoose.Types.ObjectId.isValid(reqStudentId) && verifyControlStudent(bodyData?.authToken, reqStudentId)) {
            const student = await Student.findById(reqStudentId, 'firstName lastName').lean();
            if (student) {
                rawStudentName = `${student.firstName} ${student.lastName}`.trim();
            }
        }

        // Ne pas enregistrer d'alerte si l'élève n'est pas identifié ou n'a pas commencé le contrôle
        if (!rawStudentName || rawStudentName === 'Élève (Nom non renseigné)' || rawStudentName === 'Élève') {
            return res.json({ ok: false, message: 'Élève non identifié ou contrôle non démarré' });
        }

        const alertObj = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            studentName: rawStudentName,
            studentId: mongoose.Types.ObjectId.isValid(reqStudentId) ? reqStudentId : null,
            reason,
            timestamp: new Date(),
            controlId: String(row._id),
            controlTitle: row.title,
            acknowledged: false
        };

        row.alerts = Array.isArray(row.alerts) ? row.alerts : [];
        row.alerts.push(alertObj);
        row.markModified('alerts');
        await row.save();

        res.json({ ok: true, alert: alertObj });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
