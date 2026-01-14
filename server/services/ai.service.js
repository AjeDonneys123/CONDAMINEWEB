const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🧠 SERVICE IA CENTRALISÉ (V2 - ULTRA ROBUSTE)
 */
const AIService = {
    generateQuiz: async (topic, numQuestions = 5) => {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Clé API GEMINI_API_KEY manquante dans le fichier .env");

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const prompt = `
                Tu es un professeur d'histoire-géographie. 
                Génère un quiz JSON de ${numQuestions} questions sur le sujet suivant : "${topic}".
                
                FORMAT DE RÉPONSE STRICTEMENT ATTENDU (JSON PUR) :
                [
                  {
                    "q": "La question ?",
                    "options": ["Choix 1", "Choix 2", "Choix 3", "Choix 4"],
                    "a": 0
                  }
                ]
                Note: "a" est l'index (0 à 3) de la bonne réponse.
                NE METS AUCUN TEXTE avant ou après le JSON. PAS de balises markdown.
            `;
            
            console.log(`🤖 [IA] Génération pour le sujet : ${topic}`);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text().trim();
            
            // Nettoyage de sécurité : on retire d'éventuelles balises markdown ```json
            if (text.includes("```")) {
                text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            }

            // On cherche le début et la fin du tableau au cas où il y aurait du texte parasite
            const startIdx = text.indexOf('[');
            const endIdx = text.lastIndexOf(']');
            if (startIdx === -1 || endIdx === -1) throw new Error("Format JSON non trouvé dans la réponse IA");
            
            const cleanJson = text.substring(startIdx, endIdx + 1);
            return JSON.parse(cleanJson);
            
        } catch (e) {
            console.error("❌ [AIService] Erreur critique :", e.message);
            throw e; // On propage pour que la route renvoie l'erreur détaillée
        }
    },

    analyzeCopy: async (imageBuffer, instruction) => {
        return { grade: "A", feedback: "Non implémenté." };
    }
};

module.exports = AIService;