const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const AIEngine = require('../../core/ai.engine');
const ProfDrive = require('../../prof/core/drive.prof');

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
            ? String(targetStep?.videoTranscript || '').trim()
            : String(targetStep?.sheetText || '').trim();
        if (!sourceText && sourceType === 'sheet') {
            const sheetUrl = String(targetStep?.sheetUrl || '').trim();
            if (sheetUrl) {
                try {
                    sourceText = String(await extractSheetTextFromUrl(sheetUrl) || '').trim();
                } catch (_) {}
            }
        }
        if (!sourceText) {
            return res.status(400).json({
                error: sourceType === 'video'
                    ? 'Transcription vidéo manquante pour cette étape.'
                    : 'Fiche sans texte exploitable.'
            });
        }

        const safeMode = String(mode || 'deep').toLowerCase() === 'strict' ? 'strict' : 'deep';
        const contextText = sourceText.slice(0, 18000);
        const systemInstruction = safeMode === 'strict'
            ? "Tu es un assistant pédagogique. Réponds uniquement avec les informations du cours fourni. Si une information n'est pas dans le cours, dis clairement que le cours ne le précise pas."
            : "Tu es un assistant pédagogique pour élèves de lycée. Utilise d'abord le cours fourni, puis élargis intelligemment avec culture générale claire, simple et rigoureuse. Reste concret, structuré, sans jargon inutile.";

        const prompt = [
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
        ].join('\n');

        const answer = await AIEngine.ask(prompt, systemInstruction);
        const clean = String(answer || '').trim();
        if (!clean || clean === 'ERROR_KEY' || clean === '[]') {
            return res.status(500).json({ error: "IA indisponible pour le moment." });
        }

        const sid = String(student._id);
        const now = new Date();
        const rows = Array.isArray(module.completions) ? [...module.completions] : [];
        const idx = rows.findIndex((c) => String(c?.studentId || '') === sid);
        const previous = idx >= 0 ? (typeof rows[idx]?.toObject === 'function' ? rows[idx].toObject() : rows[idx]) : null;
        let chatMeta = await ensureLearningChatDoc({ moduleDoc: module, student, previous });
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
        return res.status(500).json({ error: e.message });
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
