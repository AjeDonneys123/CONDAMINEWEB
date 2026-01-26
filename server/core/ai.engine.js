const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V10 (ROBUSTESSE ULTIME)
 * Ne crashe JAMAIS. Retourne toujours un objet exploitable.
 */
const AIEngine = {
    sanitizeJSON: (text) => {
        if (!text) return { grade: "?", appreciation: "IA Muette", transcription: "Réponse vide." };

        let clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
        
        try {
            // Tentative parsing propre
            const firstBrace = clean.indexOf('{');
            const lastBrace = clean.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
            }
            throw new Error("Pas de JSON");
        } catch (e) {
            console.warn("⚠️ JSON Invalide. Retour du texte brut.");
            // C'EST ICI LA CLÉ : ON RETOURNE L'ERREUR DANS LE TEXTE AFFICHÉ
            return {
                studentName: "Nom Inconnu",
                grade: "?/20",
                appreciation: "Format IA incorrect (Voir détail).",
                transcription: "🔴 CONTENU BRUT DE L'IA :\n\n" + text, 
                mistakes: ["Erreur Technique"]
            };
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const targetModel = "gemini-2.0-flash"; 

        if (!apiKey) throw new Error("CLÉ API MANQUANTE");
        
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
            return JSON.stringify({
                grade: "0",
                appreciation: "Erreur Google API",
                transcription: e.message
            });
        }
    }
};

module.exports = AIEngine;