const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const AIEngine = require('../../core/ai.engine');
const { Student, LearningModule, GptInboxMessage } = require('../../prof/models/prof.models');

const router = express.Router();

router.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de messages. Attends une minute avant de recommencer.' }
}));

const cleanHistory = (history) => (Array.isArray(history) ? history : [])
    .slice(-12)
    .map((item) => ({
        role: item?.role === 'assistant' ? 'assistant' : 'student',
        text: String(item?.text || '').trim().slice(0, 2000)
    }))
    .filter((item) => item.text);

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeClassKey = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const getStudentGptCode = (student = {}) => {
    const raw = String(student?._id || student?.id || '').replace(/[^a-f0-9]/gi, '').slice(-8);
    if (!raw) return '';
    const num = (parseInt(raw, 16) % 900000) + 100000;
    return String(num);
};

const cleanStringList = (value = [], max = 30) => (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, max);

const compactQuestionForGpt = (row = {}, idx = 0) => ({
    index: idx + 1,
    question: String(row?.question || row?.q || row?.prompt || row?.consigne || '').trim().slice(0, 500),
    keywords: cleanStringList([
        ...cleanStringList(row?.expectedKeywords, 20),
        ...cleanStringList(row?.keywords || row?.motsCles || row?.mots_cles, 20)
    ], 20).join(', ')
});

const extractQuestionRowsForGpt = (step = {}) => {
    const rows = [];
    if (Array.isArray(step.questionRows)) rows.push(...step.questionRows);
    if (Array.isArray(step.questionAnswerPairs)) rows.push(...step.questionAnswerPairs);
    if (step.questionSectionQuestions && typeof step.questionSectionQuestions === 'object') {
        Object.keys(step.questionSectionQuestions)
            .sort((a, b) => Number(a) - Number(b))
            .forEach((key) => {
                if (Array.isArray(step.questionSectionQuestions[key])) rows.push(...step.questionSectionQuestions[key]);
            });
    }
    return rows
        .map(compactQuestionForGpt)
        .filter((row) => row.question || row.keywords)
        .slice(0, 12);
};

const collectStepTextForGpt = (step = {}) => {
    const parts = [
        step.lessonText,
        step.ficheText,
        step.sourceText,
        step.sheetText,
        step.materialText,
        step.videoTranscript,
        step.transcript,
        step.text,
        step.content,
        step.description
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
        .slice(0, 4000);
};

const compactStepForGpt = (step = {}, index = 0) => {
    const lessonText = collectStepTextForGpt(step);
    const questions = extractQuestionRowsForGpt(step);
    const keywords = cleanStringList([
        ...(Array.isArray(step.keywords) ? step.keywords : cleanStringList(step.keywords)),
        ...(Array.isArray(step.sheetKeywords) ? step.sheetKeywords : []),
        ...(Array.isArray(step.videoKeywords) ? step.videoKeywords : []),
        ...(Array.isArray(step.orangeHighlights) ? step.orangeHighlights : []),
        ...(Array.isArray(step.redHighlights) ? step.redHighlights : []),
        ...(Array.isArray(step.zoneHighlights) ? step.zoneHighlights : []),
        ...(Array.isArray(step.pinkHighlights) ? step.pinkHighlights : [])
    ], 40);
    return {
        id: String(step._id || step.id || '').trim(),
        index: index + 1,
        title: String(step.title || step.name || `Étape ${index + 1}`).trim().slice(0, 160),
        type: String(step.type || step.kind || '').trim().slice(0, 80),
        question: String(step.question || step.customQuestion || step.prompt || '').trim().slice(0, 500),
        keywords: keywords.join(', ').slice(0, 800),
        sourceKind: String(step.sourceKind || '').trim().slice(0, 80),
        lessonText,
        questions
    };
};

const summarizeLearningModuleForGpt = (module = {}, studentId = '') => {
    const completion = (module.completions || []).find((item) => String(item?.studentId || '') === String(studentId));
    const steps = (module.steps || []).slice(0, 10).map(compactStepForGpt);
    const currentStep = Number(completion?.currentStep || 0);
    const activeStepIndex = Math.max(0, Math.min(steps.length - 1, Number.isFinite(currentStep) ? currentStep : 0));
    return {
        id: String(module._id || ''),
        title: String(module.title || 'Apprentissage').trim().slice(0, 180),
        subject: String(module.subject || '').trim().slice(0, 80),
        currentStep,
        completedAt: completion?.completedAt || null,
        stepsCount: Array.isArray(module.steps) ? module.steps.length : 0,
        activeStep: steps[activeStepIndex] || null,
        steps
    };
};

async function findStudentForGpt({ studentId = '', studentCode = '', studentName = '', studentClass = '' }) {
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        const byId = await Student.findById(studentId).lean();
        if (byId) return byId;
    }

    const code = String(studentCode || '').replace(/\D/g, '').trim();
    if (code) {
        const candidates = await Student.find({}, 'firstName lastName nickname currentClass').lean();
        const matches = candidates.filter((student) => getStudentGptCode(student) === code);
        if (matches.length === 1) return matches[0];
        return null;
    }

    const name = String(studentName || '').trim();
    const cls = String(studentClass || '').trim();
    if (!name) return null;
    const parts = name.split(/\s+/).filter(Boolean);
    const regexes = parts.map((part) => new RegExp(escapeRegex(part), 'i'));
    const query = {
        $and: regexes.map((rx) => ({
            $or: [{ firstName: rx }, { lastName: rx }, { nickname: rx }]
        }))
    };
    if (!cls) return Student.findOne(query).lean();

    const exact = await Student.findOne({
        ...query,
        currentClass: new RegExp(`^${escapeRegex(cls)}$`, 'i')
    }).lean();
    if (exact) return exact;

    const requestedClassKey = normalizeClassKey(cls);
    const nameMatches = await Student.find(query).limit(5).lean();
    const normalizedClassMatch = nameMatches.find((candidate) => normalizeClassKey(candidate?.currentClass) === requestedClassKey);
    if (normalizedClassMatch) return normalizedClassMatch;

    return nameMatches.length === 1 ? nameMatches[0] : null;
}

function checkStudentGptToken(req) {
    const expected = String(process.env.GPT_STUDENT_TOKEN || process.env.GPT_INBOX_TOKEN || '').trim();
    if (!expected) return true;
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const provided = String(req.body?.token || req.query?.token || '').trim();
    return auth === expected || provided === expected;
}

const normalize = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const requestedSchoolLevel = (message = '') => {
    const text = normalize(message);
    const matches = [...text.matchAll(/\b([1-6])\s*(?:e|eme|ere)\b/g)];
    const levels = matches
        .filter((match) => !/^\s*(?:chapitre|partie|question)\b/.test(text.slice((match.index || 0) + match[0].length)))
        .map((match) => match[1]);
    return levels.at(-1) || '';
};

const chapterMatchesLevel = (chapter, level) => {
    if (!level) return true;
    const shared = normalize(chapter?.sharedLevel).replace(/\D/g, '');
    const classroom = normalize(chapter?.classroom).replace(/[^a-z0-9]/g, '');
    return (!shared && !classroom) || shared === level || classroom.startsWith(level);
};

const isCatalogQuestion = (message = '') => /\b(chapitre|cours|programme|lecon|sequence|onglet|ressource|fiche)\b/.test(normalize(message));

const isExamWritingRequest = (message = '') => {
    const text = normalize(message);
    return /\b(brevet|developpement construit|sujet type|redaction|paragraphe argumente|traite ce sujet|compose|introduction|conclusion)\b/.test(text);
};

const isShortKnowledgeQuestion = (message = '') => {
    const raw = String(message || '').trim();
    const text = normalize(raw);
    if (!raw || raw.length > 160) return false;
    if (isCatalogQuestion(raw) || isExamWritingRequest(raw)) return false;
    return raw.includes('?')
        || /^(qui|que|quoi|quand|ou|comment|combien|pourquoi|quelle?|quels?|quelles?|cite|donne|explique vite|resume vite)\b/.test(text);
};

const needsConversationMemory = (message = '', history = []) => {
    if (!Array.isArray(history) || !history.length) return false;
    const text = normalize(message);
    return /\b(pourquoi|alors|avant|precedent|tu as dit|tu as repondu|t as dit|t as repondu|ta reponse|erreur|corrige|faux|incoherent|mensonge|plus gros que|et l|et le|et la|ca|cela|ceci|il|elle|lui)\b/.test(text);
};

const getInstantAnswer = (message = '', student = {}) => {
    const text = normalize(message).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    const firstName = String(student?.firstName || '').trim();
    if (/^(bonjour|bonsoir|salut|coucou|hello|bjr|slt)( je suis la| tu es la| t es la| es tu la| est tu la)?$/.test(text)
        || /\b(es tu la|est tu la|tu es la|t es la)\b/.test(text)) {
        return `Oui${firstName ? ` ${firstName}` : ''}, je suis là. Pose-moi ta question de cours, et je te réponds clairement.`;
    }
    if (/^(merci|merci beaucoup|ok merci|d accord merci)$/.test(text)) {
        return "Avec plaisir. Si tu veux, envoie une autre question ou un sujet à travailler.";
    }
    return '';
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const openNdjsonStream = (res) => {
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
};

const writeNdjson = (res, payload) => {
    res.write(`${JSON.stringify(payload)}\n`);
    res.flush?.();
};

const buildChapterContext = async (message, student) => {
    const Chapter = mongoose.model('Chapter');
    const explicitLevel = requestedSchoolLevel(message);
    const profileLevel = String(student?.currentClass || '').match(/[1-6]/)?.[0] || '';
    const selectedLevel = explicitLevel || profileLevel;
    const chapters = await Chapter.find({ isArchived: { $ne: true } }, 'title section classroom sharedLevel createdAt').lean();
    const normalizedMessage = normalize(message);
    const subjectWords = ['histoire', 'geographie', 'geo', 'francais', 'math', 'science', 'anglais', 'espagnol', 'philo', 'economie'];
    const requestedSubjects = subjectWords.filter((word) => normalizedMessage.includes(word));
    const levelChapters = chapters.filter((chapter) => chapterMatchesLevel(chapter, selectedLevel));
    const subjectChapters = requestedSubjects.length
        ? levelChapters.filter((chapter) => requestedSubjects.some((word) => normalize(chapter.section).includes(word)))
        : [];
    const relevant = (subjectChapters.length ? subjectChapters : levelChapters)
        .sort((left, right) => String(left.section || '').localeCompare(String(right.section || ''), 'fr')
            || String(left.title || '').localeCompare(String(right.title || ''), 'fr', { numeric: true }))
        .slice(0, 30);
    const catalog = relevant.map((chapter) => {
        const target = String(chapter.classroom || chapter.sharedLevel || 'tous niveaux').trim();
        return `- ${String(chapter.section || 'General').trim()} | ${String(chapter.title || '').trim()} | cible: ${target}`;
    }).join('\n');
    return {
        explicitLevel,
        selectedLevel,
        text: catalog
            ? `Catalogue CondaWeb pour le niveau ${selectedLevel || 'non precise'}:\n${catalog}`
            : `Aucun chapitre CondaWeb trouve pour le niveau ${selectedLevel || 'non precise'}.`
    };
};

const buildChatRequest = async ({ student, message, history }) => {
    const needsCatalog = isCatalogQuestion(message);
    const needsExamStructure = !needsCatalog && isExamWritingRequest(message);
    const isShortQuestion = !needsCatalog && !needsExamStructure && isShortKnowledgeQuestion(message);
    const needsMemory = isShortQuestion && needsConversationMemory(message, history);
    const chapterContext = needsCatalog
        ? await buildChapterContext(message, student)
        : { explicitLevel: requestedSchoolLevel(message), selectedLevel: '', text: '' };
    const transcript = (isShortQuestion && !needsMemory ? [] : history)
        .slice(needsMemory ? -6 : -12)
        .map((item) => `${item.role === 'assistant' ? 'Conda' : 'Eleve'}: ${item.text}`)
        .join('\n');
    const prompt = [
        chapterContext.text,
        transcript ? `Conversation precedente:\n${transcript}` : '',
        `Nouveau message de l'eleve: ${message}`
    ].filter(Boolean).join('\n\n');
    const profileClass = String(student.currentClass || 'classe inconnue');
    const levelRule = !needsCatalog
        ? "La classe du profil n'est pas pertinente pour cette question: ne la mentionne pas."
        : chapterContext.explicitLevel
            ? `La question indique explicitement le niveau ${chapterContext.explicitLevel}e. Utilise ce niveau et ignore toute classe differente dans le profil.`
            : `Le profil indique la classe ${profileClass}.`;
    const system = isShortQuestion
        ? [
            "Tu es Conda, l'assistant scolaire de CondaWeb.",
            "Reponds directement en francais, en une phrase courte.",
            needsMemory ? "Tiens compte de la conversation precedente. Si tu as donne une reponse fausse, reconnais l'erreur clairement et corrige-la." : "",
            "Pour une date, une mesure ou un fait historique simple, donne seulement la reponse generalement admise.",
            "Ne raconte pas l'evenement si ce n'est pas demande.",
            "Pas d'introduction, pas de formule de politesse, pas de renvoi vers une ressource.",
            "Si la question contient une faute de frappe evidente, comprends l'intention probable."
        ].filter(Boolean).join(' ')
        : [
        "Tu es Conda, l'assistant pedagogique bienveillant de CondaWeb.",
        `L'eleve s'appelle ${String(student.firstName || 'eleve')}.`,
        levelRule,
        needsCatalog
            ? "La question porte sur l'organisation des cours. Utilise exclusivement le catalogue CondaWeb fourni et n'invente aucun titre."
            : "La question porte sur des connaissances. Reponds directement avec tes connaissances fiables sans parler du catalogue, du profil ou de la classe.",
        needsCatalog
            ? "Si le catalogue ne permet pas de repondre exactement, dis-le simplement et demande une precision."
            : "Donne d'abord la reponse utile. Ne renvoie pas l'eleve vers une ressource et ne commence pas par une formule de bienvenue.",
        needsExamStructure
            ? [
                "Mode brevet/developpement construit: respecte les attentes scolaires.",
                "Structure obligatoirement la reponse avec les titres: Introduction, Developpement, Conclusion.",
                "Dans l'introduction: presente le sujet, situe rapidement le contexte, puis annonce une problematique simple.",
                "Dans le developpement: fais 2 ou 3 paragraphes courts avec des idees clairement separees, des exemples precis et du vocabulaire historique.",
                "Dans la conclusion: reponds nettement a la problematique et ouvre par une phrase de bilan.",
                "Termine par une courte ligne 'A retenir' avec 2 ou 3 points importants.",
                "Reste concis: l'objectif est une copie de brevet claire, pas un long cours.",
                "Ne dis pas que tu ne peux pas faire le devoir: donne un modele a comprendre et a reformuler."
            ].join(' ')
            : "Reponds en francais en 2 a 5 phrases courtes, precises et sans phrase de remplissage.",
        needsExamStructure
            ? "Pour rester pedagogique, signale implicitement que c'est un modele a apprendre/reformuler, sans sermonner l'eleve."
            : "Aide a comprendre sans faire integralement un devoir note a la place de l'eleve."
    ].join(' ');
    return {
        prompt,
        system,
        streamPreamble: needsExamStructure ? "Modèle type brevet :\n\n" : "",
        aiOptions: needsExamStructure
            ? { numPredict: 520, temperature: 0.25 }
            : isShortQuestion
                ? needsMemory
                    ? { numPredict: 160, temperature: 0.1 }
                    : {
                    model: String(process.env.OLLAMA_API_FAST_MODEL || 'llama3.2:3b').trim(),
                    numPredict: 80,
                    temperature: 0.1
                }
            : { numPredict: 220, temperature: 0.2 }
    };
};

router.get('/diagnostic/stream', async (_req, res) => {
    const startedAt = Date.now();
    openNdjsonStream(res);
    writeNdjson(res, {
        type: 'server',
        label: 'headers_sent',
        text: 'Chunk serveur 1/4: connexion ouverte.',
        elapsedMs: Date.now() - startedAt
    });
    await wait(500);
    writeNdjson(res, {
        type: 'server',
        label: 'after_500ms',
        text: 'Chunk serveur 2/4: +500 ms.',
        elapsedMs: Date.now() - startedAt
    });
    await wait(1000);
    writeNdjson(res, {
        type: 'server',
        label: 'after_1500ms',
        text: 'Chunk serveur 3/4: +1500 ms.',
        elapsedMs: Date.now() - startedAt
    });
    await wait(1000);
    writeNdjson(res, {
        type: 'server',
        label: 'after_2500ms',
        text: 'Chunk serveur 4/4: +2500 ms.',
        elapsedMs: Date.now() - startedAt
    });
    res.end(`${JSON.stringify({ done: true, elapsedMs: Date.now() - startedAt })}\n`);
});

router.post('/diagnostic/ollama-stream', async (_req, res) => {
    const startedAt = Date.now();
    try {
        openNdjsonStream(res);
        writeNdjson(res, {
            type: 'server',
            label: 'ollama_request_start',
            text: 'Demande envoyee a Ollama...',
            elapsedMs: Date.now() - startedAt
        });
        let chunks = 0;
        const answer = await AIEngine.askOllamaServerStream(
            'Reponds exactement en francais: test streaming OK.',
            'Tu es un test de streaming. Reponds tres court, sans introduction.',
            (text) => {
                chunks += 1;
                writeNdjson(res, {
                    type: 'ai',
                    label: 'ollama_chunk',
                    text,
                    chunkIndex: chunks,
                    elapsedMs: Date.now() - startedAt
                });
            },
            { numPredict: 30, temperature: 0 }
        );
        res.end(`${JSON.stringify({
            done: true,
            answerLength: String(answer || '').length,
            chunks,
            elapsedMs: Date.now() - startedAt
        })}\n`);
    } catch (error) {
        console.error('Student chat diagnostic error:', error.message);
        if (!res.headersSent) return res.status(503).json({ error: "Diagnostic streaming indisponible." });
        res.end(`${JSON.stringify({
            error: error.message || 'Diagnostic streaming indisponible.',
            done: true,
            elapsedMs: Date.now() - startedAt
        })}\n`);
    }
});

router.get('/gpt-context', async (req, res) => {
    try {
        if (!checkStudentGptToken(req)) {
            return res.status(401).json({ ok: false, error: 'Token GPT invalide.' });
        }

        const studentId = String(req.query.studentId || '').trim();
        const studentCode = String(req.query.studentCode || req.query.code || req.query.numero || req.query.num || '').trim();
        const studentName = String(req.query.studentName || req.query.name || '').trim();
        const studentClass = String(req.query.studentClass || req.query.className || req.query.classe || '').trim();
        const student = await findStudentForGpt({ studentId, studentCode, studentName, studentClass });
        if (!student) return res.status(404).json({ ok: false, error: 'Utilisateur introuvable.' });

        const classKey = normalizeClassKey(student.currentClass);
        const rawModules = await LearningModule.find({
            isEnabled: { $ne: false },
            $or: [{ assignedStudents: student._id }, { isAllClass: true }]
        }).sort({ date: -1, createdAt: -1 }).limit(40).lean();

        const modules = rawModules
            .filter((module) => {
                const assigned = (module.assignedStudents || []).some((id) => String(id) === String(student._id));
                if (assigned) return true;
                if (!module.isAllClass) return false;
                if (!classKey) return true;
                return (module.targetClassrooms || []).some((target) => normalizeClassKey(target) === classKey);
            })
            .slice(0, 8)
            .map((module) => summarizeLearningModuleForGpt(module, String(student._id)));

        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
        const nameFilters = fullName ? [{ studentName: { $regex: `^${escapeRegex(fullName)}$`, $options: 'i' } }] : [];
        const recentFeedback = await GptInboxMessage.find({
            $or: [{ studentId: String(student._id) }, ...nameFilters]
        }).sort({ receivedAt: -1 }).limit(8).lean();

        const recentLearning = modules[0] || null;
        return res.json({
            ok: true,
            student: {
                id: String(student._id),
                firstName: student.firstName || '',
                lastName: student.lastName || '',
                nickname: student.nickname || '',
                currentClass: student.currentClass || '',
                code: getStudentGptCode(student)
            },
            mission: {
                kind: 'lesson_revision',
                instruction: "Tu es un tuteur de révision CondaWeb. Utilise en priorité recentLearning.activeStep, c'est la fiche ou l'étape récemment proposée dans l'apprentissage. Interroge l'utilisateur progressivement, sans donner les réponses d'abord. Quand la leçon est réellement maîtrisée, valide l'apprentissage par POST."
            },
            recentLearning,
            learningModules: modules,
            recentGptFeedback: recentFeedback.map((entry) => ({
                type: entry.type,
                message: entry.message,
                feedback: entry.feedback,
                weakPoints: entry.weakPoints || [],
                errors: entry.errors || [],
                mastered: !!entry.mastered,
                score: entry.score,
                receivedAt: entry.receivedAt
            })),
            postBack: {
                url: `${req.protocol}://${req.get('host')}/api/learning/gpt-inbox`,
                method: 'POST',
                required: ['teacherEmail', 'teacherName', 'studentName', 'studentClass', 'type', 'message'],
                example: {
                    teacherName: 'JP Vuillet',
                    teacherEmail: 'vuillet.jean@condamine.edu.ec',
                    studentName: fullName,
                    studentClass: student.currentClass || '',
                    moduleId: recentLearning?.id || '',
                    stepId: recentLearning?.activeStep?.id || '',
                    type: 'learning_validated',
                    questionNumber: null,
                    message: 'Apprentissage validé',
                    feedback: "L'utilisateur connaît bien la fiche. À renforcer : les points qui ont demandé plusieurs essais.",
                    weakPoints: ['point à revoir 1', 'point à revoir 2'],
                    errors: [{ question: 'question posée', expected: 'réponse attendue', studentAnswer: 'réponse initiale' }],
                    mastered: true,
                    score: 90
                }
            }
        });
    } catch (error) {
        console.error('Student GPT context error:', error);
        return res.status(500).json({ ok: false, error: 'Contexte GPT indisponible.' });
    }
});

router.get('/gpt-feedback', async (req, res) => {
    try {
        const studentId = String(req.query.studentId || '').trim();
        const studentCode = String(req.query.studentCode || req.query.code || req.query.numero || req.query.num || '').trim();
        const studentName = String(req.query.studentName || req.query.name || '').trim();
        const studentClass = String(req.query.studentClass || req.query.className || req.query.classe || '').trim();
        const student = await findStudentForGpt({ studentId, studentCode, studentName, studentClass });
        if (!student) return res.json({ ok: true, entries: [] });
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
        const filters = [{ studentId: String(student._id) }];
        if (fullName) filters.push({ studentName: { $regex: `^${escapeRegex(fullName)}$`, $options: 'i' } });
        const entries = await GptInboxMessage.find({ $or: filters }).sort({ receivedAt: -1 }).limit(12).lean();
        return res.json({
            ok: true,
            entries: entries.map((entry) => ({
                id: String(entry._id),
                type: entry.type,
                moduleId: entry.moduleId || '',
                stepId: entry.stepId || '',
                questionNumber: entry.questionNumber,
                message: entry.message,
                feedback: entry.feedback,
                summary: entry.summary,
                weakPoints: entry.weakPoints || [],
                errors: entry.errors || [],
                mastered: !!entry.mastered,
                score: entry.score,
                receivedAt: entry.receivedAt
            }))
        });
    } catch (error) {
        console.error('Student GPT feedback list error:', error);
        return res.status(500).json({ ok: false, error: 'Retours GPT indisponibles.' });
    }
});

router.post('/gpt-feedback', async (req, res) => {
    try {
        if (!checkStudentGptToken(req)) {
            return res.status(401).json({ ok: false, error: 'Token GPT invalide.' });
        }
        const studentId = String(req.body?.studentId || '').trim();
        const studentCode = String(req.body?.studentCode || req.body?.code || req.body?.numero || req.body?.num || '').trim();
        const studentName = String(req.body?.studentName || req.body?.name || '').trim();
        const studentClass = String(req.body?.studentClass || req.body?.className || req.body?.classe || '').trim();
        const student = await findStudentForGpt({ studentId, studentCode, studentName, studentClass });
        const fullName = student
            ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
            : studentName;

        const entry = await GptInboxMessage.create({
            teacherName: 'JP Vuillet',
            teacherEmail: 'vuillet.jean@condamine.edu.ec',
            studentId: student ? String(student._id) : studentId,
            studentName: fullName || 'Élève',
            studentClass: student?.currentClass || studentClass || '',
            moduleId: String(req.body?.moduleId || '').trim().slice(0, 120),
            stepId: String(req.body?.stepId || '').trim().slice(0, 120),
            type: String(req.body?.type || 'feedback').trim().slice(0, 80),
            questionNumber: Number.isFinite(Number(req.body?.questionNumber)) ? Number(req.body.questionNumber) : null,
            message: String(req.body?.message || '').trim().slice(0, 1000),
            feedback: String(req.body?.feedback || '').trim().slice(0, 3000),
            summary: String(req.body?.summary || '').trim().slice(0, 2000),
            weakPoints: Array.isArray(req.body?.weakPoints)
                ? req.body.weakPoints.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12)
                : [],
            errors: Array.isArray(req.body?.errors) ? req.body.errors.slice(0, 20) : [],
            mastered: !!req.body?.mastered,
            score: Number.isFinite(Number(req.body?.score)) ? Number(req.body.score) : null,
            source: 'student-custom-gpt',
            raw: JSON.stringify(req.body || {}).slice(0, 8000)
        });
        return res.json({ ok: true, entry: { id: String(entry._id), receivedAt: entry.receivedAt } });
    } catch (error) {
        console.error('Student GPT feedback post error:', error);
        return res.status(500).json({ ok: false, error: 'Enregistrement GPT impossible.' });
    }
});

router.post('/message', async (req, res) => {
    try {
        const studentId = String(req.body?.studentId || '').trim();
        const message = String(req.body?.message || '').trim().slice(0, 2000);
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ error: 'Eleve invalide.' });
        }
        if (!message) return res.status(400).json({ error: 'Message vide.' });

        const Student = mongoose.model('Student');
        const student = await Student.findById(studentId, 'firstName currentClass').lean();
        if (!student) return res.status(404).json({ error: 'Eleve introuvable.' });

        const instantAnswer = getInstantAnswer(message, student);
        if (instantAnswer) return res.json({ ok: true, answer: instantAnswer, provider: 'instant' });

        const history = cleanHistory(req.body?.history);
        const { prompt, system, aiOptions } = await buildChatRequest({ student, message, history });

        const answer = String(await AIEngine.ask(prompt, system, {
            route: '/api/eleve/chat/message',
            feature: 'student-chat',
            ...aiOptions
        }) || '').trim();
        if (!answer || answer === '[]' || answer === 'ERROR_KEY') {
            return res.status(503).json({ error: "L'IA locale est momentanement indisponible." });
        }
        return res.json({ ok: true, answer, provider: String(process.env.AI_PROVIDER || 'gemini').toLowerCase().trim() || 'gemini' });
    } catch (error) {
        console.error('Student chat error:', error.message);
        return res.status(error.status || 500).json({ error: "L'IA locale est momentanement indisponible." });
    }
});

router.get('/status', (_req, res) => {
    const provider = String(process.env.AI_PROVIDER || 'gemini').toLowerCase().trim() || 'gemini';
    const isGemini = provider === 'gemini';
    res.json({
        ok: true,
        provider,
        label: isGemini ? 'Gemini' : 'Ollama',
        model: isGemini
            ? String(process.env.GEMINI_MODEL || 'gemini-flash-latest').trim()
            : String(process.env.OLLAMA_API_MODEL || process.env.OLLAMA_MODEL || '').trim()
    });
});

router.post('/message/stream', async (req, res) => {
    const studentId = String(req.body?.studentId || '').trim();
    const message = String(req.body?.message || '').trim().slice(0, 2000);
    if (!mongoose.Types.ObjectId.isValid(studentId) || !message) {
        return res.status(400).json({ error: 'Message ou eleve invalide.' });
    }

    try {
        const Student = mongoose.model('Student');
        const student = await Student.findById(studentId, 'firstName currentClass').lean();
        if (!student) return res.status(404).json({ error: 'Eleve introuvable.' });

        const instantAnswer = getInstantAnswer(message, student);
        if (instantAnswer) {
            openNdjsonStream(res);
            writeNdjson(res, { text: instantAnswer, elapsedMs: 0, source: 'instant' });
            return res.end(`${JSON.stringify({ done: true, elapsedMs: 0 })}\n`);
        }

        const history = cleanHistory(req.body?.history);
        const { prompt, system, aiOptions, streamPreamble } = await buildChatRequest({ student, message, history });

        const startedAt = Date.now();
        openNdjsonStream(res);
        writeNdjson(res, {
            status: String(process.env.AI_PROVIDER || '').toLowerCase().trim() === 'gemini'
                ? "Connexion a Gemini..."
                : "Connexion au modele local...",
            elapsedMs: Date.now() - startedAt
        });

        if (streamPreamble) res.write(`${JSON.stringify({ text: streamPreamble })}\n`);

        const provider = String(process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
        let answer = '';
        if (provider === 'gemini') {
            const model = String(process.env.GEMINI_MODEL || 'gemini-flash-latest').trim();
            writeNdjson(res, {
                status: `Connexion a Gemini (${model})...`,
                model,
                provider: 'gemini',
                elapsedMs: Date.now() - startedAt
            });
            answer = String(await AIEngine.ask(prompt, system, {
                route: '/api/eleve/chat/message/stream',
                feature: 'student-chat',
                maxOutputTokens: Math.max(300, Number(aiOptions?.numPredict || 700)),
                temperature: Number(aiOptions?.temperature ?? 0.2)
            }) || '').trim();
            if (answer && answer !== '[]' && answer !== 'ERROR_KEY') {
                res.write(`${JSON.stringify({ text: answer, provider: 'gemini', model })}\n`);
            }
        } else {
            answer = await AIEngine.askOllamaServerStream(prompt, system, (text) => {
                res.write(`${JSON.stringify({ text })}\n`);
            }, {
                ...aiOptions,
                onStatus: (status) => writeNdjson(res, {
                    status: status.message || 'Connexion au modele local...',
                    model: status.model,
                    previousModel: status.previousModel,
                    phase: status.phase,
                    elapsedMs: Date.now() - startedAt
                })
            });
        }
        if (!answer && !streamPreamble) throw new Error('EMPTY_AI_RESPONSE');
        res.end(`${JSON.stringify({ done: true })}\n`);
    } catch (error) {
        console.error('Student chat stream error:', error.message);
        if (!res.headersSent) return res.status(503).json({ error: "L'IA locale est momentanement indisponible." });
        res.end(`${JSON.stringify({ error: "L'IA locale est momentanement indisponible.", done: true })}\n`);
    }
});

module.exports = router;
