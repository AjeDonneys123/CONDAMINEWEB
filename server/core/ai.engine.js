const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA CENTRALISÉ - V8 (ZERO CRASH STRATEGY)
 * Si le JSON casse, on retourne un objet valide contenant le texte brut.
 */
const AIEngine = {
    sanitizeJSON: (text) => {
        if (!text) return { grade: "?", appreciation: "IA Muette.", transcription: "Aucune réponse générée." };

        let clean = text
            .replace(/```json/gi, "")
            .replace(/```/gi, "")
            .trim();
        
        try {
            // 1. Tentative chirurgicale standard
            const firstOpenBrace = clean.indexOf('{');
            const lastCloseBrace = clean.lastIndexOf('}');
            
            if (firstOpenBrace !== -1 && lastCloseBrace !== -1) {
                clean = clean.substring(firstOpenBrace, lastCloseBrace + 1);
            } else {
                // Fallback tableaux
                const firstOpenBracket = clean.indexOf('[');
                const lastCloseBracket = clean.lastIndexOf(']');
                if (firstOpenBracket !== -1 && lastCloseBracket !== -1) {
                    clean = clean.substring(firstOpenBracket, lastCloseBracket + 1);
                }
            }

            return JSON.parse(clean);

        } catch (e) { 
            console.warn("⚠️ [AI-CORE] JSON Invalide. Passage en mode TEXTE BRUT.");
            
            // C'EST ICI LA RÉPARATION :
            // Au lieu de planter (throw), on retourne un objet de secours valide
            // On met tout le texte de l'IA dans "transcription" pour que tu puisses le lire.
            return {
                studentName: "Nom à vérifier",
                grade: "?/20",
                appreciation: "⚠️ Le formatage automatique a échoué, mais voici le contenu brut ci-dessous :",
                transcription: text, // <--- ON SAUVE LE TEXTE ICI
                mistakes: ["Erreur de formatage JSON"]
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
                systemInstruction: systemInstruction,
                generationConfig: { temperature: 0.4 }
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (e) {
            console.error(`💥 [AI-CORE] CRASH GOOGLE :`, e.message);
            // Même en cas de crash Google, on renvoie du texte pour ne pas casser l'UI
            return JSON.stringify({
                studentName: "Erreur Google",
                grade: "0",
                appreciation: "L'API Google ne répond pas.",
                transcription: e.message,
                mistakes: []
            });
        }
    }
};

module.exports = AIEngine;