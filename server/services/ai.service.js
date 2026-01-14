const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🧠 SERVICE IA (GEMINI)
 * Isolé des routes pour éviter toute porosité.
 * Centralise l'intelligence du système.
 */
const AIService = {
    generateQuiz: async (topic, numQuestions = 5) => {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `Génère un quiz JSON sur "${topic}". Tableau d'objets avec q, options (4), a (index).`;
            
            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(text);
        } catch (e) {
            throw new Error("Échec de la génération IA");
        }
    },

    analyzeCopy: async (imageBuffer, instruction) => {
        // Logique de correction de copie à venir ici
        return { grade: "A", feedback: "Excellent travail." };
    }
};

module.exports = AIService;