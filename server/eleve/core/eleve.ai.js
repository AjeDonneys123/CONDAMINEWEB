// @signatures: EleveAI, analyze, assessAnswerQuality, evaluateIntegrityResponse, generateIntegrityChallenge, extractSpellingMistakes
const fetch = require('node-fetch');
const AIEngine = require('../../core/ai.engine');

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

    _askJSON: async (prompt, system, fallback, options = {}) => {
        const provider = String(process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
        const model = provider === 'ollama_server'
            ? String(process.env.OLLAMA_API_MODEL || process.env.OLLAMA_MODEL || '').trim()
            : String(process.env.GEMINI_MODEL || 'gemini-flash-latest').trim();
        const startedAt = Date.now();
        const attachDebug = (payload, extra = {}) => ({
            ...payload,
            _ai_debug: {
                provider,
                model,
                inputPreview: String(options?.inputPreview || '').slice(0, 700),
                ...extra
            }
        });
        try {
            const text = await AIEngine.ask(prompt, system, {
                route: 'eleve-homework',
                feature: 'homework-correction',
                temperature: 0.1,
                numPredict: 4096,
                maxOutputTokens: 4096,
                responseMimeType: 'application/json',
                ...options
            });
            const parsed = AIEngine.sanitizeJSON(text);
            if (parsed) {
                return attachDebug(parsed, {
                    parsed: true,
                    retry: false,
                    rawLength: String(text || '').length,
                    ms: Date.now() - startedAt
                });
            }
            if (provider === 'gemini') {
                const retryText = await AIEngine.ask([
                    "La réponse précédente n'était pas un JSON utilisable.",
                    "Recommence la correction en JSON strict très compact.",
                    "Maximum 2 éléments par tableau, phrases courtes.",
                    "",
                    prompt
                ].join('\n'), system, {
                    route: 'eleve-homework',
                    feature: 'homework-correction-retry',
                    temperature: 0,
                    numPredict: 2048,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json'
                });
                const retryParsed = AIEngine.sanitizeJSON(retryText);
                if (retryParsed) {
                    return attachDebug(retryParsed, {
                        parsed: true,
                        retry: true,
                        rawLength: String(retryText || '').length,
                        firstRawLength: String(text || '').length,
                        ms: Date.now() - startedAt
                    });
                }
            }
            return attachDebug(fallback, {
                parsed: false,
                rawLength: String(text || '').length,
                rawPreview: String(text || '').slice(0, 900),
                ms: Date.now() - startedAt
            });
        } catch (e) {
            return attachDebug(fallback, {
                parsed: false,
                error: String(e?.message || e || 'Erreur IA').slice(0, 600),
                ms: Date.now() - startedAt
            });
        }
    },

    _buildTrainingFallback: ({ userText = '', aiHints = '', maxPoints = 20 }) => {
        const raw = String(userText || '').trim();
        const lines = raw
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);
        const answerChunks = lines.length > 0 ? lines : raw
            .split(/(?=\b\d+\s+)/)
            .map((line) => line.trim())
            .filter(Boolean);
        const hasGrid = String(aiHints || '').trim().length > 40;
        return {
            grade: 'B',
            score: null,
            max_score: maxPoints,
            score_label: `À vérifier / ${maxPoints}`,
            bareme: [
                {
                    item: 'Correction automatique',
                    points: 0,
                    max: maxPoints,
                    comment: hasGrid
                        ? "La grille est présente, mais l'IA n'a pas renvoyé une note fiable. Relance ou fais vérifier par le professeur."
                        : "Ajoute une grille de correction dans l'aide IA pour obtenir une note précise."
                }
            ],
            copie_annotee: answerChunks.slice(0, 8).map((chunk) => ({
                extrait_eleve: chunk,
                correction: "Réponse prise en compte. La correction détaillée n'a pas pu être calculée de manière fiable pour cet extrait.",
                conseil: "Compare ta phrase aux documents : ajoute un lieu précis, un acteur précis ou un élément chiffré quand c'est possible.",
                statut: 'partiel'
            })),
            attentes: hasGrid
                ? ["Relire la grille professeur : elle contient les réponses attendues et les formulations acceptées."]
                : ["Identifier précisément les informations demandées dans les documents.", "Répondre question par question."],
            reussites: raw ? ["Tu as rédigé une réponse exploitable pour l'entraînement."] : [],
            manques: ["La note automatique précise n'est pas disponible sur cet essai."],
            conseil: "Améliore ta réponse en reprenant chaque numéro de question et en ajoutant une preuve tirée du document.",
            feedback_fond: "Correction automatique détaillée indisponible : utilise les annotations ci-dessous pour améliorer ta réponse."
        };
    },

    analyze: async (userText, instruction, aiHints, studentClass = '', context = {}) => {
        const level = EleveAI._levelLabel(studentClass);
        const isDnb = String(context?.assessmentKind || '').trim() === 'dnb';
        const section = String(context?.dnbSection || '').trim();
        const subject = String(context?.dnbSubject || '').trim();
        const maxPoints = Number(context?.maxPoints || (isDnb && section === 'docs' ? 20 : 10));
        const prompt = [
            `Niveau élève: ${level}`,
            isDnb ? `Type: entraînement DNB. Partie: ${section || 'non précisée'}. Matière: ${subject || 'non précisée'}.` : 'Type: devoir / entraînement scolaire.',
            `Barème maximal: ${maxPoints} points.`,
            '',
            `Consigne ou question:`,
            String(instruction || '').trim() || '(aucune consigne textuelle)',
            '',
            `Grille / aide IA du professeur à suivre prioritairement:`,
            String(aiHints || '').trim() || '(aucune grille fournie)',
            '',
            `Réponse de l'élève:`,
            `"""${String(userText || '').trim()}"""`,
            '',
            "Corrige pour entraîner l'élève, pas pour sanctionner.",
            "Si une grille professeur existe, utilise-la comme source principale pour répartir les points.",
            "Si la grille ne donne pas de points exacts, propose une répartition logique et explicite.",
            "Donne une note précise, pas seulement A/B/C.",
            "Explique les attentes et ce qui manque avec des mots d'élève de 3e.",
            "Reste concis: maximum 5 éléments par tableau, phrases courtes."
        ].join('\n');
        const system = [
            "Tu es un professeur d'histoire-géographie qui entraîne des élèves au DNB.",
            "Tu corriges avec bienveillance mais précisément.",
            "Tu valorises les idées justes, même formulées simplement.",
            "Tu n'exiges pas de vocabulaire universitaire.",
            "Réponds uniquement en JSON strict, sans markdown.",
            "Format obligatoire:",
            "{",
            "  \"grade\":\"A|B|C\",",
            "  \"score\": number,",
            "  \"max_score\": number,",
            "  \"score_label\":\"ex: 12/20\",",
            "  \"bareme\":[{\"item\":\"...\",\"points\":number,\"max\":number,\"comment\":\"...\"}],",
            "  \"copie_annotee\":[{\"extrait_eleve\":\"...\",\"correction\":\"...\",\"conseil\":\"...\",\"statut\":\"reussi|partiel|a_corriger\"}],",
            "  \"attentes\":[\"...\"],",
            "  \"reussites\":[\"...\"],",
            "  \"manques\":[\"...\"],",
            "  \"conseil\":\"...\",",
            "  \"feedback_fond\":\"Texte court sans HTML: reprend d'abord la réponse de l'élève, puis ajoute les éléments de correction et conseils.\"",
            "}",
            "Interdiction: pas de markdown, pas de HTML, pas de retour à la ligne à l'intérieur des chaînes JSON.",
            "La note doit être cohérente avec le barème. grade: A si très satisfaisant, B si partiel/correct, C si insuffisant.",
            "Dans copie_annotee, cite de courts extraits de la réponse élève et explique dessous ce qui est juste, incomplet ou à corriger. Les conseils doivent permettre de progresser."
        ].join('\n');
        const fallback = EleveAI._buildTrainingFallback({ userText, aiHints, maxPoints });
        const res = await EleveAI._askJSON(prompt, system, fallback, {
            numPredict: 4096,
            maxOutputTokens: 4096,
            inputPreview: String(userText || '').trim()
        });
        const score = Number(res?.score);
        const max = Number(res?.max_score || maxPoints);
        const hasUsefulCorrection = (
            Number.isFinite(score) ||
            (Array.isArray(res?.copie_annotee) && res.copie_annotee.length > 0) ||
            (Array.isArray(res?.bareme) && res.bareme.length > 0 && !String(res?.score_label || '').toLowerCase().includes('correction indisponible'))
        );
        const safe = hasUsefulCorrection ? res : fallback;
        const safeScore = Number(safe?.score);
        const safeMax = Number(safe?.max_score || maxPoints);
        return {
            ...safe,
            grade: String(safe?.grade || (Number.isFinite(safeScore) ? (safeScore >= safeMax * 0.75 ? 'A' : safeScore >= safeMax * 0.4 ? 'B' : 'C') : 'B')).toUpperCase().slice(0, 2),
            max_score: Number.isFinite(safeMax) ? safeMax : maxPoints,
            score: Number.isFinite(safeScore) ? Math.max(0, Math.min(Number.isFinite(safeMax) ? safeMax : maxPoints, safeScore)) : null,
            score_label: safe?.score_label || (Number.isFinite(safeScore) ? `${safeScore}/${Number.isFinite(safeMax) ? safeMax : maxPoints}` : `À vérifier / ${maxPoints}`),
            _ai_debug: res?._ai_debug || safe?._ai_debug || null
        };
    },

    correctDnbSimple: async ({ userText = '', instruction = '', aiHints = '', studentClass = '', context = {} } = {}) => {
        const startedAt = Date.now();
        const provider = String(process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
        const model = provider === 'ollama_server'
            ? String(process.env.OLLAMA_API_MODEL || process.env.OLLAMA_MODEL || '').trim()
            : String(process.env.GEMINI_MODEL || 'gemini-flash-latest').trim();
        const maxPoints = Number(context?.maxPoints || 20);
        const prompt = [
            "Tu corriges un entraînement DNB. Réponds uniquement en JSON strict court.",
            "Ne fais pas de markdown. Ne fais pas de HTML.",
            "La correction doit aider l'élève à progresser.",
            "Si la réponse de l'élève correspond à l'attendu, donne tous les points.",
            "IMPORTANT: reste très concis pour éviter un JSON trop long.",
            "Si la CORRECTION / BARÈME PROF contient une fiche compacte JSON avec total_points et questions[].max, respecte strictement ces points.",
            "Le total score/max_score doit être exactement la somme des questions et ne jamais dépasser le total demandé.",
            "",
            `Classe: ${studentClass || '3e'}`,
            `Partie DNB: ${context?.dnbSection || 'non précisée'}`,
            `Matière: ${context?.dnbSubject || 'non précisée'}`,
            `Note maximale: ${maxPoints}`,
            "",
            "QUESTION / CONSIGNE:",
            String(instruction || '').trim() || "(non fournie)",
            "",
            "CORRECTION / BARÈME PROF:",
            String(aiHints || '').trim() || "(non fourni: corrige avec bon sens scolaire)",
            "",
            "RÉPONSE ÉLÈVE À CORRIGER:",
            String(userText || '').trim() || "(réponse vide)",
            "",
            "JSON attendu exactement:",
            JSON.stringify({
                grade: "A|B|C",
                score: 0,
                max_score: maxPoints,
                score_label: `0/${maxPoints}`,
                feedback_fond: "Appréciation globale en 2 phrases maximum.",
                questions: [
                    {
                        numero: "1",
                        score: 0,
                        max: 3,
                        feedback: "Correction courte de la question.",
                        conseil: "Conseil court."
                    }
                ],
                reussites: ["2 réussites maximum"],
                manques: ["2 améliorations maximum"],
                conseil: "1 conseil prioritaire"
            })
        ].join('\n');
        const system = "Tu es Conda, correcteur DNB bienveillant et précis. Tu réponds uniquement en JSON strict valide.";
        const fallbackError = (message, extra = {}) => ({
            grade: 'B',
            score: null,
            max_score: maxPoints,
            score_label: `Correction indisponible / ${maxPoints}`,
            feedback_fond: `La correction IA n'a pas pu être calculée. ${message || ''}`.trim(),
            copie_annotee: [{
                extrait_eleve: String(userText || '').trim().slice(0, 500) || 'Réponse vide',
                correction: 'Correction non calculée.',
                conseil: 'Réessaie ou demande au professeur de vérifier le devoir.',
                statut: 'partiel'
            }],
            bareme: [],
            attentes: [],
            reussites: [],
            manques: ['Correction automatique indisponible sur cet essai.'],
            conseil: 'Réessaie après avoir vérifié que Gemini est actif.',
            _ai_debug: {
                provider,
                model,
                parsed: false,
                inputPreview: String(userText || '').trim().slice(0, 700),
                ms: Date.now() - startedAt,
                ...extra
            }
        });
        const stringifyItem = (item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                return String(item.critere || item.item || item.commentaire || item.comment || item.text || JSON.stringify(item));
            }
            return String(item || '');
        };
        const normalizeList = (list) => Array.isArray(list) ? list.map(stringifyItem).filter(Boolean) : [];
        const normalizeQuestionFeedback = (list) => Array.isArray(list) ? list.slice(0, 8).map((item, index) => {
            if (!item || typeof item !== 'object') {
                return {
                    numero: String(index + 1),
                    score: null,
                    max: null,
                    feedback: stringifyItem(item),
                    conseil: ''
                };
            }
            const qScore = Number(item.score ?? item.points);
            const qMax = Number(item.max ?? item.max_score ?? item.total);
            return {
                numero: String(item.numero || item.question || index + 1),
                score: Number.isFinite(qScore) ? qScore : null,
                max: Number.isFinite(qMax) ? qMax : null,
                feedback: String(item.feedback || item.correction || item.commentaire || item.comment || '').trim(),
                conseil: String(item.conseil || item.advice || '').trim()
            };
        }).filter((item) => item.feedback || item.conseil || item.score !== null) : [];
        const normalizeCorrection = (parsed, raw, { retry = false } = {}) => {
            const score = Number(parsed.score);
            const max = Number(parsed.max_score || maxPoints);
            const feedback = String(parsed.feedback_fond || '').trim() || 'Correction générée.';
            const reussites = normalizeList(parsed.reussites).slice(0, 3);
            const manques = normalizeList(parsed.manques).slice(0, 3);
            const questions = normalizeQuestionFeedback(parsed.questions);
            const conseil = String(parsed.conseil || '').trim();
            return {
                ...parsed,
                grade: String(parsed.grade || (Number.isFinite(score) ? (score >= max * 0.75 ? 'A' : score >= max * 0.4 ? 'B' : 'C') : 'B')).toUpperCase().slice(0, 2),
                score: Number.isFinite(score) ? Math.max(0, Math.min(max, score)) : null,
                max_score: Number.isFinite(max) ? max : maxPoints,
                score_label: parsed.score_label || (Number.isFinite(score) ? `${score}/${Number.isFinite(max) ? max : maxPoints}` : `À vérifier/${maxPoints}`),
                feedback_fond: feedback,
                questions,
                copie_annotee: Array.isArray(parsed.copie_annotee) && parsed.copie_annotee.length > 0 ? parsed.copie_annotee.slice(0, 3) : [{
                    extrait_eleve: String(userText || '').trim().slice(0, 350) || 'Réponse vide',
                    correction: feedback,
                    conseil: conseil || 'Relis les attentes et complète avec des exemples précis.',
                    statut: Number.isFinite(score) && score >= max * 0.75 ? 'reussi' : 'partiel'
                }],
                bareme: Array.isArray(parsed.bareme) && parsed.bareme.length > 0 ? parsed.bareme.slice(0, 5) : [{
                    item: 'Correction automatique',
                    points: Number.isFinite(score) ? Math.max(0, Math.min(max, score)) : 0,
                    max,
                    comment: feedback
                }],
                attentes: normalizeList(parsed.attentes).slice(0, 3),
                reussites,
                manques,
                conseil,
                _ai_debug: {
                    provider,
                    model,
                    parsed: true,
                    retry,
                    inputPreview: String(userText || '').trim().slice(0, 700),
                    rawLength: String(raw || '').length,
                    ms: Date.now() - startedAt
                }
            };
        };
        try {
            const raw = await AIEngine.ask(prompt, system, {
                route: 'eleve-homework',
                feature: 'dnb-simple-correction',
                temperature: 0,
                maxOutputTokens: 1024,
                numPredict: 1024,
                thinkingBudget: 0
            });
            const parsed = AIEngine.sanitizeJSON(raw);
            if (!parsed) {
                const compactPrompt = [
                    "Corrige cette copie DNB. Réponds uniquement en JSON strict valide, ultra court.",
                    "Aucune phrase hors JSON. Pas de markdown.",
                    `Note maximale: ${maxPoints}`,
                    "Champs obligatoires: grade, score, max_score, score_label, feedback_fond, questions, reussites, manques, conseil.",
                    "questions: une entrée courte par question, avec numero, score, max, feedback, conseil.",
                    "reussites: maximum 2 chaînes. manques: maximum 2 chaînes. feedback_fond: 2 phrases maximum.",
                    "",
                    "CONSIGNE:",
                    String(instruction || '').trim() || "(non fournie)",
                    "",
                    "BARÈME PROF:",
                    String(aiHints || '').trim().slice(0, 2200) || "(non fourni)",
                    "",
                    "COPIE ÉLÈVE:",
                    String(userText || '').trim().slice(0, 2500) || "(réponse vide)",
                    "",
                    "FORMAT:",
                    JSON.stringify({
                        grade: "A",
                        score: 0,
                        max_score: maxPoints,
                        score_label: `0/${maxPoints}`,
                        feedback_fond: "Bilan court.",
                        questions: [{ numero: "1", score: 0, max: 3, feedback: "feedback", conseil: "conseil" }],
                        reussites: ["réussite"],
                        manques: ["manque"],
                        conseil: "priorité"
                    })
                ].join('\n');
                const retryRaw = await AIEngine.ask(compactPrompt, system, {
                    route: 'eleve-homework',
                    feature: 'dnb-simple-correction-retry',
                    temperature: 0,
                    maxOutputTokens: 1024,
                    numPredict: 1024,
                    thinkingBudget: 0
                });
                const retryParsed = AIEngine.sanitizeJSON(retryRaw);
                if (retryParsed) return normalizeCorrection(retryParsed, retryRaw, { retry: true });
                return fallbackError('Réponse Gemini non lisible après relance compacte.', {
                    rawLength: String(raw || '').length,
                    rawPreview: String(raw || '').slice(0, 900),
                    retry: true,
                    retryRawLength: String(retryRaw || '').length,
                    retryRawPreview: String(retryRaw || '').slice(0, 900)
                });
            }
            return normalizeCorrection(parsed, raw);
        } catch (e) {
            return fallbackError(String(e?.message || e || 'Erreur inconnue').slice(0, 500), {
                error: String(e?.message || e || 'Erreur inconnue').slice(0, 500)
            });
        }
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
