// @signatures: EleveAI, analyze, assessAnswerQuality, evaluateIntegrityResponse, generateIntegrityChallenge, extractSpellingMistakes
const fetch = require('node-fetch');

/**
 * 🤖 MOTEUR IA RÉSERVÉ À L'ÉLÈVE (CORRECTION)
 */
const EleveAI = {
    _levelLabel: (studentClass = '') => {
        const cls = String(studentClass || '').toUpperCase().replace(/\s+/g, '');
        if (/^6/.test(cls)) return "6e collège";
        if (/^5/.test(cls)) return "5e collège";
        if (/^4/.test(cls)) return "4e collège";
        if (/^3/.test(cls)) return "3e collège";
        if (/^2/.test(cls)) return "2nde lycée";
        if (/^1/.test(cls)) return "1ère lycée";
        if (/^T/.test(cls)) return "Terminale lycée";
        return "niveau scolaire inconnu";
    },

    _askJSON: async (prompt, system, fallback) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    systemInstruction: { parts: [{ text: system }] }
                })
            });
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const clean = text.replace(/```json|```/g, '').trim();
            return JSON.parse(clean);
        } catch (e) {
            return fallback;
        }
    },

    analyze: async (userText, instruction, aiHints, studentClass = '') => {
        const level = EleveAI._levelLabel(studentClass);
        const prompt = `Niveau élève: ${level}. Consigne: ${instruction}. Aide: ${aiHints}. Réponse: "${userText}"`;
        const system = "Tu es un correcteur scolaire. Adapte ton exigence au niveau indiqué. Réponds en JSON strict: {grade: 'A|B|C', feedback_fond: '...'}";
        return EleveAI._askJSON(prompt, system, { grade: 'B', feedback_fond: "Analyse indisponible." });
    },

    assessAnswerQuality: async ({ userText, instruction, studentClass = '' }) => {
        const level = EleveAI._levelLabel(studentClass);
        const prompt = [
            `Niveau élève: ${level}`,
            `Consigne: ${instruction || ''}`,
            `Réponse élève: """${String(userText || '').slice(0, 2200)}"""`,
            "Évalue la qualité intrinsèque de la réponse pour savoir si une question de sécurité est pertinente."
        ].join('\n');
        const system = "Réponds en JSON strict: {quality_score:number, level_fit:number, should_ask_security:boolean, reason:string}. quality_score et level_fit entre 0 et 1.";
        return EleveAI._askJSON(prompt, system, { quality_score: 0.4, level_fit: 0.4, should_ask_security: false, reason: "Qualité insuffisante pour une vérification supplémentaire." });
    },

    generateIntegrityChallenge: async (instruction, userText, studentClass = '') => {
        const level = EleveAI._levelLabel(studentClass);
        const shortText = String(userText || '').slice(0, 2200);
        const prompt = [
            `Niveau élève: ${level}`,
            `Réponse élève: """${shortText}"""`,
            "Interdiction d'utiliser la consigne.",
            "Génère UNE question très simple basée uniquement sur une idée ou un mot réellement présents dans la réponse élève.",
            "La question doit être courte et vérifiable."
        ].join('\n');
        const system = "Réponds en JSON strict: {question:string, expected_keywords:string[], reference_excerpt:string}. Les expected_keywords doivent apparaître mot pour mot dans la réponse élève.";
        const fallback = {
            question: "Quel est le mot-clé principal que tu as utilisé dans ta réponse ?",
            expected_keywords: [],
            reference_excerpt: shortText.slice(0, 120)
        };
        return EleveAI._askJSON(prompt, system, fallback);
    },

    evaluateIntegrityResponse: async ({ question, expectedKeywords, referenceExcerpt, studentResponse, studentClass = '' }) => {
        const level = EleveAI._levelLabel(studentClass);
        const prompt = [
            `Niveau élève: ${level}`,
            `Question de vérification: ${question || ''}`,
            `Mots-clés attendus: ${(expectedKeywords || []).join(', ')}`,
            `Extrait de référence: ${referenceExcerpt || ''}`,
            `Réponse élève: ${studentResponse || ''}`,
            "Évalue si la réponse montre que l'élève comprend bien ce qu'il a lui-même écrit."
        ].join('\n');
        const system = "Réponds en JSON strict: {ok:boolean, confidence:number, feedback:string}. confidence entre 0 et 1.";
        return EleveAI._askJSON(prompt, system, { ok: false, confidence: 0.3, feedback: "Vérification indisponible." });
    },

    extractSpellingMistakes: async ({ userText = '', instruction = '', studentClass = '' }) => {
        const level = EleveAI._levelLabel(studentClass);
        const prompt = [
            `Niveau élève: ${level}`,
            `Consigne: ${instruction || ''}`,
            `Texte élève: """${String(userText || '').slice(0, 5000)}"""`,
            "Trouve seulement les fautes d'orthographe explicites (pas la reformulation de style)."
        ].join('\n');
        const system = "Réponds en JSON strict: {spellingMistakes:[{wrong:string,correct:string,context:string}]}.";
        const fallback = { spellingMistakes: [] };
        const res = await EleveAI._askJSON(prompt, system, fallback);
        const rows = Array.isArray(res?.spellingMistakes) ? res.spellingMistakes : [];
        return rows
            .map((m) => ({
                wrong: String(m?.wrong || '').trim(),
                correct: String(m?.correct || '').trim(),
                context: String(m?.context || '').trim()
            }))
            .filter((m) => m.wrong && m.correct && m.wrong.toLowerCase() !== m.correct.toLowerCase())
            .slice(0, 80);
    }
};
module.exports = EleveAI;
