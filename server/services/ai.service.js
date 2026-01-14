const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🧠 SERVICE IA CENTRALISÉ
 * Configuré pour GEMINI 2.0 FLASH
 */
const AIService = {
    generateQuiz: async (topic, numQuestions = 5) => {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Clé API GEMINI_API_KEY manquante dans le fichier .env");

            const genAI = new GoogleGenerativeAI(apiKey);
            
            // UTILISATION DE GEMINI 2.0 FLASH
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            
            const prompt = `
                Tu es un professeur expert. Génère un quiz de ${numQuestions} questions sur le sujet : "${topic}".
                Format de sortie : JSON pur uniquement (un tableau d'objets).
                Structure : 
                [
                  {
                    "q": "la question",
                    "options": ["choix 1", "choix 2", "choix 3", "choix 4"],
                    "a": 0
                  }
                ]
                "a" est l'index de la réponse correcte.
                IMPORTANT : Ne renvoie que le JSON. Pas de texte avant, pas de texte après, pas de balises markdown.
            `;
            
            console.log(`📡 [IA 2.0] Requête pour : "${topic}"`);
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text().trim();
            
            // Nettoyage Markdown au cas où
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            
            // Extraction du bloc JSON si l'IA a mis du texte autour
            const startIdx = text.indexOf('[');
            const endIdx = text.lastIndexOf(']');
            if (startIdx !== -1 && endIdx !== -1) {
                text = text.substring(startIdx, endIdx + 1);
            }

            return JSON.parse(text);
        } catch (e) {
            console.error("❌ [AIService] Erreur Gemini 2.0 :", e.message);
            throw e;
        }
    }
};

module.exports = AIService;