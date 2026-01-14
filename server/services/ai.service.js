const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🧠 SERVICE IA CENTRALISÉ
 * Centralise les appels vers Gemini 1.5 Flash
 */
const AIService = {
    generateQuiz: async (topic, numQuestions = 5) => {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            
            if (!apiKey || apiKey === "TON_API_KEY_ICI") {
                console.error("❌ [AIService] Erreur : La clé GEMINI_API_KEY est manquante dans .env");
                throw new Error("Configuration API Key manquante.");
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const prompt = `
                Tu es un professeur expert au Lycée La Condamine.
                Génère un quiz de ${numQuestions} questions sur le sujet : "${topic}".
                Format de sortie : JSON pur.
                Structure attendue : un tableau d'objets. Chaque objet doit avoir :
                - "q": la question (string)
                - "options": un tableau de 4 chaines (array of strings)
                - "a": l'index de la bonne réponse (0, 1, 2 ou 3)
                
                N'écris rien avant ou après le JSON.
            `;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();
            
            // Nettoyage de sécurité si l'IA renvoie du Markdown
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            
            return JSON.parse(text);
        } catch (e) {
            console.error("❌ [AIService] Erreur lors de la génération :", e.message);
            throw e;
        }
    },

    analyzeCopy: async (imageBuffer, instruction) => {
        return { grade: "A", feedback: "Logique IA Scans en cours de restructuration." };
    }
};

module.exports = AIService;