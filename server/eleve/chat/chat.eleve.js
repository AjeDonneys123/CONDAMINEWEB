const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const AIEngine = require('../../core/ai.engine');

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
    const chapterContext = needsCatalog
        ? await buildChapterContext(message, student)
        : { explicitLevel: requestedSchoolLevel(message), selectedLevel: '', text: '' };
    const transcript = isShortQuestion ? '' : history
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
            "Pour une date, une mesure ou un fait historique simple, donne seulement la reponse generalement admise.",
            "Ne raconte pas l'evenement si ce n'est pas demande.",
            "Pas d'introduction, pas de formule de politesse, pas de renvoi vers une ressource.",
            "Si la question contient une faute de frappe evidente, comprends l'intention probable."
        ].join(' ')
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
                ? {
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
        return res.json({ ok: true, answer, provider: 'ollama' });
    } catch (error) {
        console.error('Student chat error:', error.message);
        return res.status(error.status || 500).json({ error: "L'IA locale est momentanement indisponible." });
    }
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
            status: "Connexion au modele local...",
            elapsedMs: Date.now() - startedAt
        });

        if (streamPreamble) res.write(`${JSON.stringify({ text: streamPreamble })}\n`);

        const answer = await AIEngine.askOllamaServerStream(prompt, system, (text) => {
            res.write(`${JSON.stringify({ text })}\n`);
        }, aiOptions);
        if (!answer && !streamPreamble) throw new Error('EMPTY_AI_RESPONSE');
        res.end(`${JSON.stringify({ done: true })}\n`);
    } catch (error) {
        console.error('Student chat stream error:', error.message);
        if (!res.headersSent) return res.status(503).json({ error: "L'IA locale est momentanement indisponible." });
        res.end(`${JSON.stringify({ error: "L'IA locale est momentanement indisponible.", done: true })}\n`);
    }
});

module.exports = router;
