const { GoogleGenerativeAI } = require("@google/generative-ai");

const AIService = {
    analyzeSubmission: async (userText, instruction, classroom, context) => {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `${context}\n\nCONSIGNE DU DEVOIR : "${instruction}"\nCLASSE DE L'ÉLÈVE : "${classroom}"\nTRAVAIL À CORRIGER : "${userText}"\n\nFormat de réponse attendu (JSON PUR) :\n{\n  "grade": "Note ou Compétence",\n  "feedback_fond": "Commentaire HTML (<b>, <br>)",\n  "corrections": [\n    { "wrong": "faute", "correct": "correction", "rule": "Règle" }\n  ]\n}`;
            const result = await model.generateContent(prompt);
            return JSON.parse(result.response.text().replace(/```json/g, "").replace(/```/g, "").trim());
        } catch (e) {
            console.error("❌ [AI_SERVICE] Erreur Analyse:", e.message);
            throw e;
        }
    },
    generateQuiz: async (topic, numQuestions = 5) => {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `Génère un quiz éducatif JSON sur "${topic}" (${numQuestions} questions).\nFormat: [{ "q": "Question", "options": ["A", "B", "C", "D"], "a": 0 }]`;
            const result = await model.generateContent(prompt);
            return JSON.parse(result.response.text().replace(/```json/g, "").replace(/```/g, "").trim());
        } catch (e) {
            console.error("❌ [AI_SERVICE] Erreur Quiz:", e.message);
            throw e;
        }
    }
};
module.exports = AIService;