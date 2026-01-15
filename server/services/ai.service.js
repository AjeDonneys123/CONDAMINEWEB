const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🧠 SERVICE : IA GEMINI 2.0 FLASH
 */
const AIService = {
    sanitizeJSON: (text) => {
        try {
            const start = text.indexOf('{') !== -1 ? text.indexOf('{') : text.indexOf('[');
            const lastBrace = text.lastIndexOf('}');
            const lastBracket = text.lastIndexOf(']');
            const end = Math.max(lastBrace, lastBracket) + 1;
            return JSON.parse(text.substring(start, end));
        } catch (e) { throw new Error("Format IA invalide"); }
    },

    analyzeSubmission: async (userText, instruction, classroom, context) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `${context}\nCONSIGNE: ${instruction}\nCLASSE: ${classroom}\nTEXTE: ${userText}\nFormat JSON: { "grade": string, "feedback_fond": string, "corrections": [] }`;
        const result = await model.generateContent(prompt);
        return AIService.sanitizeJSON(result.response.text());
    },

    generateQuiz: async (topic, numQuestions = 5) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Génère un quiz JSON sur "${topic}" (${numQuestions} questions). Format: [{ "q": string, "options": [string], "a": number }]`;
        const result = await model.generateContent(prompt);
        return AIService.sanitizeJSON(result.response.text());
    }
};

module.exports = AIService;