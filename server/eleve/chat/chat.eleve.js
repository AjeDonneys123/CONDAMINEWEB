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
    const chapterContext = await buildChapterContext(message, student);
    const transcript = history
        .map((item) => `${item.role === 'assistant' ? 'Conda' : 'Eleve'}: ${item.text}`)
        .join('\n');
    const prompt = [
        chapterContext.text,
        transcript ? `Conversation precedente:\n${transcript}` : '',
        `Nouveau message de l'eleve: ${message}`
    ].filter(Boolean).join('\n\n');
    const profileClass = String(student.currentClass || 'classe inconnue');
    const levelRule = chapterContext.explicitLevel
        ? `La question indique explicitement le niveau ${chapterContext.explicitLevel}e. Utilise ce niveau et ignore toute classe differente dans le profil.`
        : `Le profil indique la classe ${profileClass}.`;
    const system = [
        "Tu es Conda, l'assistant pedagogique bienveillant de CondaWeb.",
        `L'eleve s'appelle ${String(student.firstName || 'eleve')}.`,
        levelRule,
        "Pour toute question sur les cours ou chapitres, utilise exclusivement le catalogue CondaWeb fourni.",
        "N'invente jamais un titre, un programme officiel, une classe ou une information absente du catalogue.",
        "Si le catalogue ne permet pas de repondre exactement, dis-le simplement et demande une precision.",
        "Reponds en francais en 2 a 6 phrases courtes, sans phrase de remplissage.",
        "Aide a comprendre sans faire integralement un devoir note a la place de l'eleve."
    ].join(' ');
    return { prompt, system };
};

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

        const history = cleanHistory(req.body?.history);
        const { prompt, system } = await buildChatRequest({ student, message, history });

        const answer = String(await AIEngine.ask(prompt, system, {
            route: '/api/eleve/chat/message',
            feature: 'student-chat'
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
        const history = cleanHistory(req.body?.history);
        const { prompt, system } = await buildChatRequest({ student, message, history });

        res.status(200);
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        const answer = await AIEngine.askOllamaServerStream(prompt, system, (text) => {
            res.write(`${JSON.stringify({ text })}\n`);
        });
        if (!answer) throw new Error('EMPTY_AI_RESPONSE');
        res.end(`${JSON.stringify({ done: true })}\n`);
    } catch (error) {
        console.error('Student chat stream error:', error.message);
        if (!res.headersSent) return res.status(503).json({ error: "L'IA locale est momentanement indisponible." });
        res.end(`${JSON.stringify({ error: "L'IA locale est momentanement indisponible.", done: true })}\n`);
    }
});

module.exports = router;
