const { GoogleGenerativeAI } = require("@google/generative-ai");

const AIService = {
    generateQuiz: async (topic, numQuestions = 5) => {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Clé API manquante");

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            
            const prompt = `Génère un quiz JSON de ${numQuestions} questions sur "${topic}". Structure: [{"q":"", "options":["","","",""], "a":0}]. Pas de markdown.`;
            
            const result = await model.generateContent(prompt);
            let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(text);
        } catch (e) { throw e; }
    }
};

module.exports = AIService;