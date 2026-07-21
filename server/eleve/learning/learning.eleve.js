const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const multer = require('multer');
const AIEngine = require('../../core/ai.engine');
const ProfDrive = require('../../prof/core/drive.prof');

const learningAudioUpload = multer({
    dest: path.join(process.cwd(), 'public', 'uploads', 'temp'),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const getTutorSessionSecret = () => String(
    process.env.TUTOR_SESSION_SECRET
    || process.env.GPT_INBOX_TOKEN
    || process.env.JWT_SECRET
    || process.env.SESSION_SECRET
    || 'condaweb-local-tutor-session-secret'
).trim();

const base64UrlJson = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

const signTutorPayload = (payload) => {
    const encoded = base64UrlJson(payload);
    const sig = crypto.createHmac('sha256', getTutorSessionSecret()).update(encoded).digest('base64url');
    return `${encoded}.${sig}`;
};

const verifyTutorToken = (token = '') => {
    const raw = String(token || '').trim();
    const [encoded, sig] = raw.split('.');
    if (!encoded || !sig) throw new Error('Token session invalide');
    const expected = crypto.createHmac('sha256', getTutorSessionSecret()).update(encoded).digest('base64url');
    if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) throw new Error('Signature session invalide');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('Signature session invalide');
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (Number(payload?.exp || 0) < Date.now()) throw new Error('Session expiree');
    return payload;
};

const buildPublicBaseUrl = (req) => {
    const envBase = String(process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || '').trim().replace(/\/+$/, '');
    if (envBase) return envBase;
    return `${req.protocol}://${req.get('host')}`;
};

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

const compactRealtimeStepText = (step = {}) => {
    const parts = [
        step.sheetText,
        step.materialText,
        step.videoTranscript,
        step.lessonText,
        step.sourceText,
        step.text,
        step.content
    ];
    ['sheetSlideTextMap', 'questionSlideTextMap'].forEach((key) => {
        if (!step[key] || typeof step[key] !== 'object') return;
        Object.keys(step[key])
            .sort((a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true }))
            .slice(0, 12)
            .forEach((slideKey) => parts.push(step[key][slideKey]));
    });
    return parts
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 7000);
};

const extractRealtimeQuestions = (step = {}) => {
    const rows = [];
    if (Array.isArray(step.questionAnswerPairs)) rows.push(...step.questionAnswerPairs);
    if (step.questionSectionQuestions && typeof step.questionSectionQuestions === 'object') {
        Object.keys(step.questionSectionQuestions)
            .sort((a, b) => Number(a) - Number(b))
            .forEach((key) => {
                if (Array.isArray(step.questionSectionQuestions[key])) rows.push(...step.questionSectionQuestions[key]);
            });
    }
    return rows
        .map((row, idx) => ({
            index: idx + 1,
            question: String(row?.question || row?.q || row?.prompt || '').trim().slice(0, 500)
        }))
        .filter((row) => row.question)
        .slice(0, 12);
};

const findSourceTextForQuestionStep = (steps = [], currentIndex = 0, questionStep = {}) => {
    const ownText = compactRealtimeStepText(questionStep);
    if (ownText) return ownText;
    const sourceSheetRef = String(questionStep?.sourceSheetUrl || '').trim();
    const sourceVideoRef = String(questionStep?.sourceVideoRef || '').trim();
    const refId = (sourceSheetRef || sourceVideoRef).split(':')[1] || '';
    if (refId) {
        const refStep = steps.find((candidate) => String(candidate?.id || '') === refId);
        const refText = compactRealtimeStepText(refStep);
        if (refText) return refText;
    }
    for (let i = Number(currentIndex || 0) - 1; i >= 0; i -= 1) {
        const candidate = steps[i];
        if (!candidate || !['sheet', 'video', 'question'].includes(String(candidate.type || ''))) continue;
        const text = compactRealtimeStepText(candidate);
        if (text) return text;
    }
    return '';
};

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

const buildLearningChatTitle = ({ student = null, module = null }) => {
    const s = student ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : 'Élève';
    const t = String(module?.title || 'Apprentissage').trim();
    return `${t} - Chat IA ${s}`.slice(0, 170);
};

async function ensureLearningChatDoc({ moduleDoc, student, previous = null }) {
    if (previous?.chatDocId) return previous;
    const folderId = await ProfDrive.getOrCreateFolder('CONDA_LEARNING_CHATLOGS');
    const doc = await ProfDrive.createGoogleDoc(buildLearningChatTitle({ student, module: moduleDoc }), folderId);
    return {
        ...(previous || {}),
        chatDocId: String(doc?.docId || ''),
        chatDocUrl: String(doc?.editUrl || ''),
        chatDocEmbedUrl: String(doc?.embedUrl || '')
    };
}

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
});

const parseProxyFileId = (url = '') => {
    const raw = String(url || '').trim();
    const m = raw.match(/\/api\/structure\/proxy\/([^/?#]+)/i);
    return m?.[1] ? decodeURIComponent(m[1]) : '';
};

const fetchSheetBinary = async (sheetUrl = '') => {
    const raw = String(sheetUrl || '').trim();
    if (!raw) return { ok: false, error: 'URL vide' };
    const proxyFileId = parseProxyFileId(raw);
    if (proxyFileId) {
        const driveRes = await ProfDrive.getFileResponse(proxyFileId);
        const buff = await streamToBuffer(driveRes.stream);
        const mime = String(driveRes.headers?.['content-type'] || 'application/pdf').split(';')[0].trim();
        return { ok: true, mime, buffer: buff };
    }
    const res = await fetch(raw);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const arr = await res.arrayBuffer();
    const buffer = Buffer.from(arr);
    const mime = String(res.headers.get('content-type') || 'application/pdf').split(';')[0].trim();
    return { ok: true, mime, buffer };
};

const extractSheetTextFromUrl = async (sheetUrl = '') => {
    const file = await fetchSheetBinary(sheetUrl);
    if (!file.ok) throw new Error(file.error || 'Impossible de lire la fiche');
    const mime = String(file.mime || 'application/pdf').toLowerCase();
    if (mime.startsWith('text/')) {
        const text = file.buffer.toString('utf8').trim();
        return text.slice(0, 60000);
    }
    const promptParts = [
        { text: "Extrait le texte lisible de ce document pédagogique en français. Réponds uniquement avec le texte brut extrait, sans commentaire." },
        { inlineData: { mimeType: file.mime || 'application/pdf', data: file.buffer.toString('base64') } }
    ];
    const extracted = String(await AIEngine.ask(promptParts, "Tu es un extracteur OCR strict. Renvoie uniquement le texte brut du document.") || '').trim();
    return extracted.slice(0, 60000);
};

const parseAiSynonymDecision = (raw = '') => {
    const text = String(raw || '').trim();
    if (!text) return { accept: false, reason: 'Réponse IA vide' };
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        try {
            const obj = JSON.parse(text.slice(start, end + 1));
            return {
                accept: Boolean(obj?.accept === true || obj?.accepted === true),
                reason: String(obj?.reason || obj?.comment || '').trim()
            };
        } catch (_) {}
    }
    const low = text.toLowerCase();
    if (/(^|\b)(oui|yes|accept|valide|équivalent|equivalent)(\b|$)/.test(low)) {
        return { accept: true, reason: text.slice(0, 300) };
    }
    return { accept: false, reason: text.slice(0, 300) };
};

const buildOfflineTutorAnswer = (question = '') => {
    const q = String(question || '').toLowerCase();
    if (q.includes('pays en developpement') || q.includes('pays en développement')) {
        return "Oui, ils sont nombreux. On parle de pays en développement pour des pays qui ont encore un niveau de vie plus faible et des inégalités fortes, même si leur situation progresse parfois rapidement. Il existe aussi des écarts importants entre ces pays: certains avancent vite (pays émergents), d'autres restent en grande difficulté.";
    }
    return "Bonne question. En géographie, la réponse dépend souvent du contexte, de l'échelle (monde, région, pays) et des indicateurs utilisés. Donne-moi un mot-clé ou une partie du cours et je te réponds de façon plus précise.";
};

const isInvalidCourseText = (value = '') => {
    const txt = String(value || '').trim();
    if (!txt) return true;
    const low = txt.toLowerCase();
    return low === '[]' || low === '{}' || low === 'null' || low === 'undefined';
};

const collectSheetSourceText = (step = {}) => {
    const direct = [
        step?.sheetText,
        step?.materialText,
        step?.extractedSheetText,
        step?.transcription,
        step?.text
    ]
        .map((v) => String(v || '').trim())
        .filter((v) => !isInvalidCourseText(v));
    if (direct.length > 0) return direct.join('\n').trim();

    const map = step?.sheetSlideTextMap;
    if (map && typeof map === 'object') {
        const merged = Object.values(map)
            .map((v) => String(v || '').trim())
            .filter((v) => !isInvalidCourseText(v));
        if (merged.length > 0) return merged.join('\n\n').trim();
    }
    return '';
};

const getStudentGptCode = (student = {}) => {
    const raw = String(student?._id || student?.id || '').replace(/[^a-f0-9]/gi, '').slice(-8);
    if (!raw) return '';
    return String((parseInt(raw, 16) % 900000) + 100000);
};

const findStudentByTutorCode = async (code = '') => {
    const Student = mongoose.model('Student');
    const clean = String(code || '').replace(/\D/g, '').trim();
    if (!clean) return null;
    const candidates = await Student.find({}, 'firstName lastName nickname currentClass activeTutorSession').lean();
    const matches = candidates.filter((student) => getStudentGptCode(student) === clean);
    return matches.length === 1 ? matches[0] : null;
};

const ensureLearningAccess = async ({ studentId = '', moduleId = '' }) => {
    const LearningModule = mongoose.model('LearningModule');
    const Student = mongoose.model('Student');
    if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(moduleId)) {
        const err = new Error('studentId/moduleId invalides');
        err.status = 400;
        throw err;
    }
    const [student, moduleDoc] = await Promise.all([
        Student.findById(studentId).lean(),
        LearningModule.findById(moduleId).lean()
    ]);
    if (!student || !moduleDoc || moduleDoc.isEnabled === false) {
        const err = new Error('Session CondaWeb introuvable');
        err.status = 404;
        throw err;
    }
    const classTargets = await buildStudentClassTargets(student);
    const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));
    const assigned = (moduleDoc.assignedStudents || []).some((id) => String(id) === String(student._id));
    const allowed = assigned || (moduleDoc.isAllClass && matchesClassTargets(moduleDoc.targetClassrooms || [], classTargetKeys));
    if (!allowed) {
        const err = new Error('Acces refuse a cet apprentissage');
        err.status = 403;
        throw err;
    }
    return { student, moduleDoc };
};

const findTutorStep = (moduleDoc = {}, stepId = '', stepIndex = 0) => {
    const steps = Array.isArray(moduleDoc.steps) ? moduleDoc.steps : [];
    return steps.find((step) => String(step?.id || '') === String(stepId || '')) || steps[Math.max(0, Number(stepIndex || 0))] || {};
};

const collectTutorLessonText = (steps = [], currentStep = {}, stepIndex = 0) => {
    return findSourceTextForQuestionStep(steps, Number(stepIndex || 0), currentStep)
        || collectSheetSourceText(currentStep)
        || steps.map(collectSheetSourceText).filter(Boolean).join('\n\n');
};

const buildTutorSessionContextText = ({ req, token, student, moduleDoc, stepId = '', stepIndex = 0 }) => {
    const steps = Array.isArray(moduleDoc.steps) ? moduleDoc.steps : [];
    const currentStep = findTutorStep(moduleDoc, stepId, stepIndex);
    const questions = extractRealtimeQuestions(currentStep);
    const lessonText = collectTutorLessonText(steps, currentStep, stepIndex);
    const baseUrl = buildPublicBaseUrl(req);
    const validationUrl = `${baseUrl}/api/eleve/learning/tutor-session/${encodeURIComponent(token)}/validate`;
    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.nickname || 'utilisateur';
    const moduleTitle = String(moduleDoc.title || moduleDoc.chapterTitle || 'Apprentissage').trim();
    const questionList = questions.length
        ? questions.map((q) => `${q.index}. ${q.question}`).join('\n')
        : 'Aucune question professeur. Cree tes propres questions a partir de la fiche, une par une.';
    return [
        'SOURCE CONDAWEB POUR CONDATUTEUR',
        '',
        'IMPORTANT',
        '- Cette source remplace toute identification par nom/classe.',
        '- Tu dois utiliser exclusivement les informations ci-dessous.',
        '- Au debut, prouve que tu as lu cette source en citant le titre exact de la lecon et une notion precise de la fiche.',
        '- Ne donne le lien de validation qu apres une vraie maitrise.',
        '',
        'SESSION',
        `studentName: ${fullName}`,
        `studentClass: ${student.currentClass || ''}`,
        `studentCode: ${getStudentGptCode(student)}`,
        `moduleId: ${moduleDoc._id}`,
        `stepId: ${String(currentStep?.id || stepId || '')}`,
        `lessonTitle: ${moduleTitle}`,
        '',
        'URL DE VALIDATION FINALE',
        validationUrl,
        '',
        'CONSIGNE DE VALIDATION',
        'Quand la fiche est reellement maitrisee, dis: "Bravo, apprentissage valide."',
        'Puis donne le lien de validation finale ci-dessus et demande a l utilisateur de cliquer dessus pour confirmer dans CondaWeb.',
        'Ne donne pas ce lien avant la fin de l entrainement.',
        '',
        'QUESTIONS PROFESSEUR FACULTATIVES',
        questionList,
        '',
        'FICHE DE REVISION / SOURCE DE CORRECTION',
        String(lessonText || 'Aucune fiche textuelle disponible. Interroge seulement sur le titre et demande au professeur de verifier la fiche.').trim().slice(0, 25000)
    ].join('\n');
};

const buildTutorInstructionDocTitle = (student = {}) => {
    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.nickname || 'utilisateur';
    return `CondaTuteur - ${fullName} - ${getStudentGptCode(student)}`.slice(0, 170);
};

const updateTutorInstructionDoc = async ({ student, text }) => {
    const previous = student?.activeTutorSession || {};
    let instructionDocId = String(previous.instructionDocId || '').trim();
    let instructionDocUrl = String(previous.instructionDocUrl || '').trim();
    if (!instructionDocId) {
        const folderId = await ProfDrive.getOrCreateFolder('CONDA_TUTEUR_INSTRUCTIONS');
        const doc = await ProfDrive.createGoogleDoc(buildTutorInstructionDocTitle(student), folderId);
        instructionDocId = String(doc?.docId || '');
        instructionDocUrl = String(doc?.editUrl || '');
    }
    await ProfDrive.replaceGoogleDocContent(instructionDocId, String(text || ''));
    const instructionDocTextUrl = instructionDocId
        ? `https://docs.google.com/document/d/${encodeURIComponent(instructionDocId)}/export?format=txt`
        : '';
    return { instructionDocId, instructionDocUrl, instructionDocTextUrl };
};

const markLearningCompletedByTutorToken = async ({ studentId = '', moduleId = '' }) => {
    const LearningModule = mongoose.model('LearningModule');
    const moduleDoc = await LearningModule.findById(moduleId);
    if (!moduleDoc) return false;
    const now = new Date();
    const sid = String(studentId);
    const stepsLength = Array.isArray(moduleDoc.steps) ? moduleDoc.steps.length : 0;
    const completions = Array.isArray(moduleDoc.completions) ? [...moduleDoc.completions] : [];
    const idx = completions.findIndex((entry) => String(entry?.studentId || '') === sid);
    if (idx >= 0) {
        const base = typeof completions[idx]?.toObject === 'function' ? completions[idx].toObject() : completions[idx];
        completions[idx] = { ...base, currentStep: stepsLength, completedAt: base?.completedAt || now, lastUpdateAt: now };
    } else {
        completions.push({ studentId, currentStep: stepsLength, completedAt: now, lastUpdateAt: now });
    }
    moduleDoc.completions = completions;
    await moduleDoc.save();
    return true;
};

router.post('/tutor-session', async (req, res) => {
    try {
        const studentId = String(req.body?.studentId || '').trim();
        const moduleId = String(req.body?.moduleId || '').trim();
        const stepId = String(req.body?.stepId || '').trim();
        const stepIndex = Math.max(0, Number(req.body?.stepIndex || 0));
        const { student, moduleDoc } = await ensureLearningAccess({ studentId, moduleId });
        const exp = Date.now() + (24 * 60 * 60 * 1000);
        const token = signTutorPayload({ studentId, moduleId, stepId, stepIndex, exp, kind: 'learning_tutor' });
        const baseUrl = buildPublicBaseUrl(req);
        const sourceUrl = `${baseUrl}/api/eleve/learning/tutor-session/${encodeURIComponent(token)}/context`;
        const validationUrl = `${baseUrl}/api/eleve/learning/tutor-session/${encodeURIComponent(token)}/validate`;
        const preview = buildTutorSessionContextText({ req, token, student, moduleDoc, stepId, stepIndex });
        let docInfo = {
            instructionDocId: String(student?.activeTutorSession?.instructionDocId || ''),
            instructionDocUrl: String(student?.activeTutorSession?.instructionDocUrl || ''),
            instructionDocTextUrl: ''
        };
        if (docInfo.instructionDocId) {
            docInfo.instructionDocTextUrl = `https://docs.google.com/document/d/${encodeURIComponent(docInfo.instructionDocId)}/export?format=txt`;
        }
        try {
            docInfo = await updateTutorInstructionDoc({ student, text: preview });
        } catch (docError) {
            console.error('[tutor-session][instruction-doc]', docError?.message || docError);
        }
        const Student = mongoose.model('Student');
        await Student.updateOne(
            { _id: studentId },
            {
                $set: {
                    activeTutorSession: {
                        moduleId,
                        stepId,
                        stepIndex,
                        token,
                        sourceUrl,
                        validationUrl,
                        instructionDocId: docInfo.instructionDocId,
                        instructionDocUrl: docInfo.instructionDocUrl,
                        expiresAt: new Date(exp),
                        updatedAt: new Date()
                    }
                }
            }
        );
        return res.json({
            ok: true,
            token,
            sourceUrl,
            validationUrl,
            instructionDocUrl: docInfo.instructionDocUrl,
            instructionDocTextUrl: docInfo.instructionDocTextUrl,
            expiresAt: new Date(exp).toISOString(),
            preview
        });
    } catch (e) {
        return res.status(e.status || 500).json({ ok: false, error: String(e?.message || 'Session tuteur impossible') });
    }
});

router.get('/tutor-code/:code/context', async (req, res) => {
    try {
        const student = await findStudentByTutorCode(req.params.code);
        if (!student) return res.status(404).type('text/plain').send('Code CondaWeb introuvable.');
        const active = student.activeTutorSession || {};
        const token = String(active.token || '').trim();
        if (!token) {
            return res.status(404).type('text/plain').send("Aucune session CondaWeb active. Ouvre d'abord l'apprentissage sur CondaWeb puis clique sur Ouvrir GPT externe.");
        }
        const payload = verifyTutorToken(token);
        if (payload.kind !== 'learning_tutor') throw new Error('Type de session invalide');
        if (String(payload.studentId) !== String(student._id)) throw new Error('Session non associee a ce code');
        const access = await ensureLearningAccess({ studentId: payload.studentId, moduleId: payload.moduleId });
        const text = buildTutorSessionContextText({
            req,
            token,
            student: access.student,
            moduleDoc: access.moduleDoc,
            stepId: payload.stepId,
            stepIndex: payload.stepIndex
        });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(text);
    } catch (e) {
        return res.status(e.status || 400).type('text/plain').send(`Session CondaWeb indisponible: ${String(e?.message || e)}`);
    }
});

router.get('/tutor-session/:token/context', async (req, res) => {
    try {
        const token = String(req.params.token || '').trim();
        const payload = verifyTutorToken(token);
        if (payload.kind !== 'learning_tutor') throw new Error('Type de session invalide');
        const { student, moduleDoc } = await ensureLearningAccess({ studentId: payload.studentId, moduleId: payload.moduleId });
        const text = buildTutorSessionContextText({ req, token, student, moduleDoc, stepId: payload.stepId, stepIndex: payload.stepIndex });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(text);
    } catch (e) {
        return res.status(e.status || 400).type('text/plain').send(`Session CondaWeb indisponible: ${String(e?.message || e)}`);
    }
});

router.get('/tutor-session/:token/validate', async (req, res) => {
    try {
        const GptInboxMessage = mongoose.model('GptInboxMessage');
        const token = String(req.params.token || '').trim();
        const payload = verifyTutorToken(token);
        if (payload.kind !== 'learning_tutor') throw new Error('Type de session invalide');
        const { student, moduleDoc } = await ensureLearningAccess({ studentId: payload.studentId, moduleId: payload.moduleId });
        await markLearningCompletedByTutorToken({ studentId: payload.studentId, moduleId: payload.moduleId });
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.nickname || 'utilisateur';
        await GptInboxMessage.create({
            receivedAt: new Date(),
            teacherName: 'JP Vuillet',
            teacherEmail: 'vuillet.jean@condamine.edu.ec',
            moduleId: String(moduleDoc._id),
            stepId: String(payload.stepId || ''),
            studentId: String(student._id),
            studentName: fullName,
            studentClass: String(student.currentClass || ''),
            type: 'learning_validated',
            message: 'Apprentissage valide',
            feedback: 'Validation confirmee par lien CondaTuteur.',
            mastered: true,
            source: 'tutor_validation_link',
            raw: JSON.stringify({ tokenKind: payload.kind, stepIndex: payload.stepIndex }).slice(0, 5000)
        });
        const title = String(moduleDoc.title || 'Apprentissage').trim();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CondaWeb - fiche apprise</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fdf2f8;font-family:Arial,sans-serif;color:#111827}
    main{width:min(720px,calc(100vw - 32px));background:#fff;border:3px solid #bbf7d0;border-radius:24px;padding:32px;box-shadow:0 22px 60px rgba(15,23,42,.16)}
    h1{margin:0 0 12px;font-size:34px;color:#166534}
    p{font-size:18px;font-weight:800;line-height:1.5}
    .muted{color:#64748b;font-size:14px}
  </style>
</head>
<body>
  <main>
    <h1>Fiche apprise</h1>
    <p>${fullName} - ${title}</p>
    <p>Validation recue par CondaWeb.</p>
    <p class="muted">Tu peux revenir sur ton onglet CondaWeb et cliquer sur "Verifier la validation" si la page d'apprentissage est encore ouverte.</p>
  </main>
</body>
</html>`);
    } catch (e) {
        return res.status(e.status || 400).type('text/plain').send(`Validation impossible: ${String(e?.message || e)}`);
    }
});

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
        const { moduleId, studentId, currentStep = 0, completed = false, sheetTimesMs = {} } = req.body || {};
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
            lastUpdateAt: now,
            sheetTimesMs: {}
        };
        if (sheetTimesMs && typeof sheetTimesMs === 'object') {
            Object.keys(sheetTimesMs).forEach((k) => {
                const key = String(k || '').trim();
                if (!key) return;
                patch.sheetTimesMs[key] = Math.max(0, Number(sheetTimesMs[k] || 0));
            });
        }
        if (completed) patch.completedAt = now;

        if (idx >= 0) {
            const base = typeof next[idx]?.toObject === 'function' ? next[idx].toObject() : next[idx];
            const prevTimes = base?.sheetTimesMs && typeof base.sheetTimesMs === 'object' ? base.sheetTimesMs : {};
            const mergedTimes = { ...prevTimes };
            Object.keys(patch.sheetTimesMs || {}).forEach((k) => {
                mergedTimes[k] = Math.max(Number(prevTimes[k] || 0), Number(patch.sheetTimesMs[k] || 0));
            });
            patch.sheetTimesMs = mergedTimes;
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

router.post('/realtime-session', express.text({ type: ['application/sdp', 'text/plain'], limit: '1mb' }), async (req, res) => {
    try {
        const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
        if (!apiKey) return res.status(503).send('OPENAI_API_KEY manquant côté serveur.');

        const sdp = String(req.body || '').trim();
        if (!sdp) return res.status(400).send('SDP WebRTC manquant.');

        const LearningModule = mongoose.model('LearningModule');
        const Student = mongoose.model('Student');
        const moduleId = String(req.query.moduleId || '').trim();
        const studentId = String(req.query.studentId || '').trim();
        const stepId = String(req.query.stepId || '').trim();
        const stepIndex = Math.max(0, Number(req.query.stepIndex || 0));

        if (!mongoose.Types.ObjectId.isValid(moduleId) || !mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).send('moduleId/studentId invalides.');
        }

        const [moduleDoc, student] = await Promise.all([
            LearningModule.findById(moduleId).lean(),
            Student.findById(studentId).lean()
        ]);
        if (!moduleDoc || !student) return res.status(404).send('Apprentissage ou utilisateur introuvable.');

        const steps = Array.isArray(moduleDoc.steps) ? moduleDoc.steps : [];
        const currentStep = steps.find((candidate) => String(candidate?.id || '') === stepId) || steps[stepIndex] || {};
        const questions = extractRealtimeQuestions(currentStep);
        const lessonText = findSourceTextForQuestionStep(steps, stepIndex, currentStep);
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'utilisateur';
        const moduleTitle = String(moduleDoc.title || 'apprentissage').trim();
        const questionList = questions.length
            ? questions.map((q) => `${q.index}. ${q.question}`).join('\n')
            : 'Aucune question professeur. Crée tes propres questions à partir de la fiche.';

        const instructions = [
            `Tu es CondaTuteur, un tuteur vocal de révision intégré à CondaWeb pour JP Vuillet.`,
            `Tu travailles avec ${fullName}, classe ${student.currentClass || 'inconnue'}.`,
            `Leçon: ${moduleTitle}.`,
            `Règles: pose une seule question à la fois, attends la réponse, corrige brièvement, puis continue.`,
            `Utilise exclusivement la fiche ci-dessous pour vérifier les réponses. Si les questions professeur existent, utilise-les en priorité.`,
            `Ne valide pas après une seule bonne réponse si plusieurs connaissances sont nécessaires.`,
            `Quand la fiche est réellement maîtrisée, dis exactement: "Fiche apprise." puis ajoute sur une nouvelle ligne le marqueur CONDA_LEARNING_VALIDATED.`,
            ``,
            `Questions professeur facultatives:`,
            questionList,
            ``,
            `Fiche de révision:`,
            lessonText || 'Aucune fiche textuelle disponible. Pose quelques questions simples sur le titre de la leçon.'
        ].join('\n');

        const fd = new FormData();
        fd.append('sdp', sdp);
        fd.append('session', JSON.stringify({
            type: 'realtime',
            model: String(process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1').trim(),
            instructions,
            audio: {
                input: {
                    turn_detection: { type: 'server_vad' }
                },
                output: {
                    voice: String(process.env.OPENAI_REALTIME_VOICE || 'marin').trim()
                }
            }
        }));

        const response = await fetch('https://api.openai.com/v1/realtime/calls', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'OpenAI-Safety-Identifier': String(student._id),
                ...fd.getHeaders()
            },
            body: fd
        });

        const answerSdp = await response.text();
        if (!response.ok) return res.status(response.status).send(answerSdp || `Realtime OpenAI HTTP ${response.status}`);
        res.setHeader('Content-Type', 'application/sdp');
        return res.send(answerSdp);
    } catch (e) {
        console.error('[learning realtime-session]', e);
        return res.status(500).send(e.message || 'Session vocale impossible.');
    }
});

router.post('/transcribe-audio', learningAudioUpload.single('audio'), async (req, res) => {
    const tempPath = req.file?.path || '';
    try {
        const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
        if (!apiKey) return res.status(400).json({ ok: false, error: 'OPENAI_API_KEY absente' });
        if (!req.file || !tempPath) return res.status(400).json({ ok: false, error: 'Audio manquant' });

        const durationMs = Math.max(0, Number(req.body?.durationMs || 0));
        if (durationMs > 47000) {
            return res.status(400).json({ ok: false, error: 'Audio trop long. Maximum 45 secondes.' });
        }

        const stat = fs.statSync(tempPath);
        if (!stat.size || stat.size < 800) return res.status(400).json({ ok: false, error: 'Audio trop court ou vide' });

        const model = String(process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe').trim();
        const form = new FormData();
        form.append('model', model);
        form.append('language', 'fr');
        form.append('response_format', 'json');
        const uploadedMime = String(req.file.mimetype || 'audio/webm').split(';')[0] || 'audio/webm';
        form.append('file', fs.createReadStream(tempPath), {
            filename: req.file.originalname || `learning-answer-${Date.now()}.webm`,
            contentType: uploadedMime
        });

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                ...form.getHeaders()
            },
            body: form
        });
        const body = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
        if (!response.ok) {
            return res.status(response.status).json({
                ok: false,
                error: String(body?.error?.message || body?.raw || `OpenAI HTTP ${response.status}`).slice(0, 500)
            });
        }

        const text = String(body?.text || '').replace(/\s+/g, ' ').trim();
        return res.json({
            ok: true,
            text: text.slice(0, 4000),
            model,
            durationMs,
            bytes: stat.size
        });
    } catch (e) {
        return res.status(500).json({ ok: false, error: String(e?.message || 'Transcription impossible') });
    } finally {
        if (tempPath) {
            try { fs.unlinkSync(tempPath); } catch (_) {}
        }
    }
});

router.post('/sheet-chat', async (req, res) => {
    try {
        const LearningModule = mongoose.model('LearningModule');
        const Student = mongoose.model('Student');
        const {
            moduleId,
            studentId,
            stepId = '',
            stepIndex = null,
            question = '',
            mode = 'deep'
        } = req.body || {};

        const userQuestion = String(question || '').trim();
        if (!moduleId || !studentId) return res.status(400).json({ error: 'moduleId et studentId requis' });
        if (!userQuestion) return res.status(400).json({ error: 'Question vide' });

        const student = await Student.findById(studentId).lean();
        if (!student) return res.status(404).json({ error: 'Élève introuvable' });

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        const module = await LearningModule.findById(moduleId);
        if (!module || module.isEnabled === false) return res.status(404).json({ error: 'Module introuvable' });

        const assigned = (module.assignedStudents || []).some(id => String(id) === String(student._id));
        const allowed = assigned || (module.isAllClass && matchesClassTargets(module.targetClassrooms || [], classTargetKeys));
        if (!allowed) return res.status(403).json({ error: "Accès refusé à ce module" });

        const steps = Array.isArray(module.steps) ? module.steps : [];
        let targetStep = null;
        if (stepId) {
            targetStep = steps.find((s) => {
                const type = String(s?.type || '');
                return String(s?.id || '') === String(stepId) && (type === 'sheet' || type === 'video');
            }) || null;
        }
        if (!targetStep && Number.isInteger(Number(stepIndex))) {
            const idx = Math.max(0, Number(stepIndex));
            const byIndex = steps[idx];
            if (byIndex && ['sheet', 'video'].includes(String(byIndex?.type || ''))) targetStep = byIndex;
        }
        if (!targetStep) {
            const completion = (module.completions || []).find(c => String(c?.studentId || '') === String(student._id));
            const idx = Math.max(0, Number(completion?.currentStep || 0));
            const byCurrent = steps[idx];
            if (byCurrent && ['sheet', 'video'].includes(String(byCurrent?.type || ''))) targetStep = byCurrent;
        }
        if (!targetStep) return res.status(400).json({ error: 'Aucune ressource active trouvée.' });

        const sourceType = String(targetStep?.type || '');
        let sourceText = sourceType === 'video'
            ? String(targetStep?.videoTranscript || targetStep?.materialText || '').trim()
            : collectSheetSourceText(targetStep);
        if (isInvalidCourseText(sourceText)) sourceText = '';
        if (!sourceText && sourceType === 'sheet') {
            const sheetUrl = String(targetStep?.sheetUrl || '').trim();
            if (sheetUrl) {
                try {
                    sourceText = String(await extractSheetTextFromUrl(sheetUrl) || '').trim();
                } catch (_) {}
            }
        }
        if (isInvalidCourseText(sourceText)) sourceText = '';
        const safeMode = String(mode || 'deep').toLowerCase() === 'strict' ? 'strict' : 'deep';
        const hasCourseContext = !isInvalidCourseText(sourceText);
        const contextText = hasCourseContext ? sourceText.slice(0, 18000) : '';
        const systemInstruction = hasCourseContext
            ? (safeMode === 'strict'
                ? "Tu es un assistant pédagogique. Réponds uniquement avec les informations du cours fourni. Si une information n'est pas dans le cours, dis clairement que le cours ne le précise pas."
                : "Tu es un assistant pédagogique pour élèves de lycée. Utilise d'abord le cours fourni, puis élargis intelligemment avec culture générale claire, simple et rigoureuse. Reste concret, structuré, sans jargon inutile.")
            : "Tu es un professeur d'histoire-géographie pour collège et lycée. Réponds à la question de l'élève clairement, avec pédagogie, en français simple, sans inventer des chiffres précis non sûrs.";

        const prompt = hasCourseContext
            ? [
                `Titre module: ${String(module.title || '').trim() || 'Apprentissage'}`,
                `Étape source: ${String(targetStep.title || '').trim() || (sourceType === 'video' ? 'Vidéo' : 'Fiche')}`,
                'Cours (source principale):',
                contextText,
                '',
                `Question élève: ${userQuestion}`,
                '',
                safeMode === 'strict'
                    ? "Consignes réponse: 4-8 lignes, en français simple, citer brièvement la partie du cours utilisée."
                    : "Consignes réponse: 6-10 lignes, en français simple, 1) réponse directe, 2) explication, 3) exemple concret, 4) lien avec le cours."
            ].join('\n')
            : [
                `Titre module: ${String(module.title || '').trim() || 'Apprentissage'}`,
                `Étape source: ${String(targetStep.title || '').trim() || (sourceType === 'video' ? 'Vidéo' : 'Fiche')}`,
                "Contexte: la fiche liée est une image/photo sans texte exploitable automatiquement.",
                `Question élève: ${userQuestion}`,
                '',
                "Consignes réponse: réponds comme un professeur d'histoire-géographie de collège/lycée, en 5 à 8 lignes, avec une réponse directe puis une explication simple."
            ].join('\n');

        let answer = '';
        try {
            answer = await AIEngine.ask(prompt, systemInstruction);
        } catch (_) {
            answer = '';
        }
        let clean = String(answer || '').trim();
        if (!clean || clean === 'ERROR_KEY' || clean === '[]') {
            const fallbackLines = contextText
                .split('\n')
                .map((l) => String(l || '').trim())
                .filter((l) => l && !isInvalidCourseText(l))
                .slice(0, 3);
            const fallback = fallbackLines.join(' ').trim();
            clean = fallback
                ? `Rappel du cours: ${fallback.slice(0, 900)}`
                : buildOfflineTutorAnswer(userQuestion);
        }

        const sid = String(student._id);
        const now = new Date();
        const rows = Array.isArray(module.completions) ? [...module.completions] : [];
        const idx = rows.findIndex((c) => String(c?.studentId || '') === sid);
        const previous = idx >= 0 ? (typeof rows[idx]?.toObject === 'function' ? rows[idx].toObject() : rows[idx]) : null;
        let chatMeta = previous || {};
        try {
            chatMeta = await ensureLearningChatDoc({ moduleDoc: module, student, previous });
        } catch (_) {
            chatMeta = previous || {};
        }
        const oldLog = String(chatMeta?.chatLogText || previous?.chatLogText || '').trim();
        const lineHeader = `[${now.toISOString()}] ${sourceType === 'video' ? 'VIDÉO' : 'FICHE'} - ${String(targetStep?.title || '').trim() || 'Source'}`;
        const block = [
            lineHeader,
            `Élève: ${userQuestion}`,
            `IA: ${clean}`,
            ''
        ].join('\n');
        const nextLog = `${oldLog}${oldLog ? '\n' : ''}${block}`.slice(-120000);

        const patch = {
            ...(previous || {}),
            studentId: student._id,
            currentStep: Number(previous?.currentStep ?? 0),
            lastUpdateAt: now,
            chatDocId: String(chatMeta?.chatDocId || ''),
            chatDocUrl: String(chatMeta?.chatDocUrl || ''),
            chatDocEmbedUrl: String(chatMeta?.chatDocEmbedUrl || ''),
            chatDocRevisionCount: Math.max(0, Number(previous?.chatDocRevisionCount || 0)),
            chatDocRevisionAt: previous?.chatDocRevisionAt || null,
            chatLogText: nextLog
        };

        if (patch.chatDocId) {
            try {
                const header = [
                    `Journal chat IA - ${String(module.title || 'Apprentissage')}`,
                    `Élève: ${String(student.firstName || '').trim()} ${String(student.lastName || '').trim()}`.trim(),
                    `Classe: ${String(student.currentClass || '').trim() || '-'}`,
                    '',
                    '---',
                    ''
                ].join('\n');
                await ProfDrive.replaceGoogleDocContent(patch.chatDocId, `${header}${nextLog}`.trim());
                const stats = await ProfDrive.getGoogleDocStats(patch.chatDocId);
                patch.chatDocRevisionCount = Number(stats?.revisionCount || 0);
                patch.chatDocRevisionAt = stats?.lastRevisionAt || now;
            } catch (_) {}
        }

        if (idx >= 0) rows[idx] = patch;
        else rows.push(patch);
        module.completions = rows;
        await module.save();

        return res.json({
            ok: true,
            mode: safeMode,
            answer: clean,
            sourceTitle: String(targetStep?.title || (sourceType === 'video' ? 'Vidéo' : 'Fiche')).trim(),
            sourceType,
            chatDocUrl: String(patch?.chatDocUrl || ''),
            chatDocId: String(patch?.chatDocId || '')
        });
    } catch (e) {
        return res.status(200).json({
            ok: false,
            answer: buildOfflineTutorAnswer(req?.body?.question || ''),
            error: String(e?.message || 'Erreur interne')
        });
    }
});

router.post('/validate-synonym', async (req, res) => {
    try {
        const LearningModule = mongoose.model('LearningModule');
        const Student = mongoose.model('Student');
        const {
            moduleId,
            studentId,
            question = '',
            expectedAnswer = '',
            studentAnswer = '',
            missingWords = []
        } = req.body || {};

        const q = String(question || '').trim();
        const expected = String(expectedAnswer || '').trim();
        const answer = String(studentAnswer || '').trim();
        const miss = Array.isArray(missingWords) ? missingWords.map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (!moduleId || !studentId) return res.status(400).json({ error: 'moduleId et studentId requis' });
        if (!q || !expected || !answer) return res.status(400).json({ error: 'question, expectedAnswer et studentAnswer requis' });

        const student = await Student.findById(studentId).lean();
        if (!student) return res.status(404).json({ error: 'Élève introuvable' });

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));
        const module = await LearningModule.findById(moduleId).lean();
        if (!module || module.isEnabled === false) return res.status(404).json({ error: 'Module introuvable' });
        const assigned = (module.assignedStudents || []).some((id) => String(id) === String(student._id));
        const allowed = assigned || (module.isAllClass && matchesClassTargets(module.targetClassrooms || [], classTargetKeys));
        if (!allowed) return res.status(403).json({ error: "Accès refusé à ce module" });

        const prompt = [
            "Tu vérifies une réponse d'élève.",
            `Question: ${q}`,
            `Réponse attendue (prof): ${expected}`,
            `Réponse élève: ${answer}`,
            miss.length ? `Mots-clés manquants détectés automatiquement: ${miss.join(', ')}` : '',
            "",
            "Décide si la réponse élève est sémantiquement correcte (synonyme, reformulation, paraphrase acceptable).",
            "Réponds en JSON strict: {\"accept\": true|false, \"reason\": \"courte justification\"}"
        ].filter(Boolean).join('\n');

        const raw = await AIEngine.ask(prompt, "Tu es un correcteur pédagogique strict mais juste.");
        const decision = parseAiSynonymDecision(raw);
        return res.json({
            ok: true,
            accept: Boolean(decision.accept),
            reason: String(decision.reason || '')
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

module.exports = router;
