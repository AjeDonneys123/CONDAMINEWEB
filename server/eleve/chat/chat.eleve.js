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
        const transcript = history
            .map((item) => `${item.role === 'assistant' ? 'Conda' : 'Eleve'}: ${item.text}`)
            .join('\n');
        const prompt = [
            transcript ? `Conversation precedente:\n${transcript}` : '',
            `Nouveau message de l'eleve: ${message}`
        ].filter(Boolean).join('\n\n');
        const system = [
            "Tu es Conda, l'assistant pedagogique bienveillant de CondaWeb.",
            `L'eleve s'appelle ${String(student.firstName || 'eleve')} et est en ${String(student.currentClass || 'classe inconnue')}.`,
            "Reponds en francais, clairement et avec un vocabulaire adapte a son niveau.",
            "Aide l'eleve a comprendre par des explications, des indices et de petites questions.",
            "Ne fais pas integralement un devoir note a sa place et n'invente jamais de faits.",
            "Reste concis sauf si l'eleve demande davantage de details."
        ].join(' ');

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

module.exports = router;
