const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🧠 SERVICE : INTELLIGENCE ARTIFICIELLE
 * Fichier CRITIQUE : Seul point de contact avec Gemini.
 */
const AIService = {
    // Nettoyeur pour garantir un JSON valide même si Gemini bafouille
    sanitizeJSON: (text) => {
        try {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}') + 1;
            if (start === -1 || end === 0) throw new Error("Aucun JSON trouvé dans la réponse IA");
            return JSON.parse(text.substring(start, end));
        } catch (e) {
            console.error("❌ Erreur Parsing IA:", text);
            throw new Error("L'IA a renvoyé un format invalide.");
        }
    },

    analyzeSubmission: async (userText, instruction, classroom, context) => {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `${context}\nCONSIGNE: ${instruction}\nCLASSE: ${classroom}\nTEXTE: ${userText}\nFormat JSON pur: { "grade": string, "feedback_fond": string, "corrections": [] }`;
            const result = await model.generateContent(prompt);
            return AIService.sanitizeJSON(result.response.text());
        } catch (e) { throw e; }
    },

    generateQuiz: async (topic, numQuestions = 5) => {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `Génère un quiz JSON sur "${topic}" (${numQuestions} questions). Format: [{ "q": string, "options": [string], "a": number }]`;
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            // Utilise un traitement spécifique pour les tableaux JSON
            const start = text.indexOf('[');
            const end = text.lastIndexOf(']') + 1;
            return JSON.parse(text.substring(start, end));
        } catch (e) { throw e; }
    }
};

module.exports = AIService;