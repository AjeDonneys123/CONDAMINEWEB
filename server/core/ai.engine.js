const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V9 (MODE TRANSPARENT)
 * Si le JSON échoue, on renvoie le texte brut pour le voir dans l'interface.
 */
const AIEngine = {
    sanitizeJSON: (text) => {
        if (!text) return { grade: "?", appreciation: "IA Muette", transcription: "Vide." };

        console.log("--- 🤖 RÉPONSE BRUTE IA (DÉBUT) ---");
        console.log(text);
        console.log("--- 🤖 RÉPONSE BRUTE IA (FIN) ---");

        let clean = text
            .replace(/```json/gi, "")
            .replace(/```/gi, "")
            .trim();
        
        try {
            // Tentative 1 : Parsing direct
            return JSON.parse(clean);
        } catch (e1) {
            try {
                // Tentative 2 : Recherche des accolades
                const start = clean.indexOf('{');
                const end = clean.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    return JSON.parse(clean.substring(start, end + 1));
                }
                throw new Error("Pas de JSON détecté");
            } catch (e2) {
                // ÉCHEC DU PARSING : ON RENVOIE LE TEXTE BRUT DANS L'INTERFACE
                console.warn("⚠️ JSON invalide. Renvoi du texte brut au client.");
                
                return {
                    studentName: "Nom Inconnu",
                    grade: "?/20",
                    appreciation: "⚠️ L'IA n'a pas respecté le format JSON.",
                    // C'EST ICI QU'ON FORCE L'AFFICHAGE DU RETOUR BRUT
                    transcription: "🔴 RÉPONSE BRUTE DE L'IA (POUR DEBUG) :\n\n" + text, 
                    mistakes: ["Formatage IA incorrect"]
                };
            }
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
                appreciation: "Erreur Connexion Google",
                transcription: e.message
            });
        }
    }
};

module.exports = AIEngine;