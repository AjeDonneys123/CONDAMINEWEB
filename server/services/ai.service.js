const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🧠 SERVICE IA CENTRALISÉ (V2 - Gemini 2.0 Flash)
 * Rôle : Génération de contenu et Correction.
 * Étanche : Ne connaît pas la BDD, traite uniquement du texte.
 */

const AIService = {
    // US #10 : Génération de Quiz instantanée
    generateQuiz: async (topic, numQuestions = 5) => {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Clé API Gemini manquante dans le .env");

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            
            const prompt = `Agis en tant que professeur. Génère un quiz éducatif au format JSON pur sur le thème suivant : "${topic}".
            Nombre de questions : ${numQuestions}.
            Format attendu (Strictement ce JSON, pas de texte avant ou après) :
            [
              {
                "q": "La question ici ?",
                "options": ["Choix 1", "Choix 2", "Choix 3", "Choix 4"],
                "a": 0
              }
            ]
            Note : "a" est l'index de la bonne réponse (0 à 3).`;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
            
            return JSON.parse(text);
        } catch (e) {
            console.error("❌ [AI_SERVICE] Erreur génération:", e.message);
            throw e;
        }
    }
};

module.exports = AIService;