const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V11 (IMPOSSIBLE DE PLANTER)
 * Quoi qu'il arrive, il renvoie un objet JSON valide pour l'interface.
 */
const AIEngine = {
    sanitizeJSON: (text) => {
        // Cas Vide
        if (!text) return { 
            studentName: "Erreur Vide", 
            grade: "?", 
            appreciation: "L'IA n'a rien renvoyé.", 
            transcription: "Réponse vide.", 
            mistakes: [] 
        };

        let clean = text
            .replace(/```json/gi, "")
            .replace(/```/gi, "")
            .trim();
        
        try {
            // Tentative 1 : Parsing direct
            return JSON.parse(clean);
        } catch (e1) {
            try {
                // Tentative 2 : Extraction { ... }
                const start = clean.indexOf('{');
                const end = clean.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    return JSON.parse(clean.substring(start, end + 1));
                }
                throw new Error("Pas de JSON");
            } catch (e2) {
                // ÉCHEC TOTAL : ON RENVOIE LE TEXTE BRUT DANS L'OBJET
                console.warn("⚠️ JSON FAIL. Renvoi brut.");
                return {
                    studentName: "Nom Inconnu",
                    grade: "?/20",
                    appreciation: "⚠️ PROBLÈME FORMAT (Voir détail)",
                    transcription: "🔴 CONTENU BRUT REÇU DE L'IA :\n\n" + text, 
                    mistakes: ["Erreur de lecture"]
                };
            }
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const targetModel = "gemini-2.0-flash"; 

        if (!apiKey) return "ERREUR: CLÉ API MANQUANTE";
        
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
                model: targetModel,
                systemInstruction: systemInstruction
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (e) {
            console.error(`💥 CRASH GOOGLE :`, e.message);
            return `ERREUR GOOGLE API: ${e.message}`;
        }
    }
};

module.exports = AIEngine;