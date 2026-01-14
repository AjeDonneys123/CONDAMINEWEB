const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🧠 SERVICE IA CENTRALISÉ
 */
const AIService = {
    generateQuiz: async (topic, numQuestions = 5) => {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            
            // Vérification de sécurité pour le développeur
            if (!apiKey || apiKey === "TON_API_KEY_ICI" || apiKey.length < 10) {
                console.error("❌ [IA Error] GEMINI_API_KEY est manquante ou invalide dans le fichier .env");
                throw new Error("Configuration API Key manquante.");
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const prompt = `
                Tu es un professeur expert. Génère un quiz de ${numQuestions} questions sur le sujet : "${topic}".
                Format de sortie : JSON pur.
                Structure : un tableau d'objets avec "q" (la question), "options" (4 choix), "a" (index 0-3 de la bonne réponse).
                Pas de texte superflu, juste le JSON.
            `;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();
            
            // Nettoyage des balises markdown si l'IA en ajoute
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            
            return JSON.parse(text);
        } catch (e) {
            console.error("❌ [AIService] Erreur lors de la génération du quiz :", e.message);
            throw e;
        }
    },

    analyzeCopy: async (imageBuffer, instruction) => {
        return { grade: "A", feedback: "Logique IA Scans en attente de migration." };
    }
};

module.exports = AIService;