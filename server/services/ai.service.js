const { GoogleGenerativeAI } = require("@google/generative-ai");

const AIService = {
    analyzeSubmission: async (userText, instruction, classroom, context) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `${context}\nCONSIGNE: ${instruction}\nCLASSE: ${classroom}\nTEXTE: ${userText}\nFormat JSON pur: { "grade": string, "feedback_fond": string, "corrections": [{ "wrong": string, "correct": string, "rule": string }] }`;
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text().replace(/```json/g, "").replace(/```/g, "").trim());
    },
    generateQuiz: async (topic, numQuestions = 5) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `Génère un quiz JSON sur "${topic}" (${numQuestions} questions). Format: [{ "q": string, "options": [string], "a": number }]`;
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text().replace(/```json/g, "").replace(/```/g, "").trim());
    }
};
module.exports = AIService;