const { GoogleGenerativeAI } = require("@google/generative-ai");

console.log("------------------------------------------------");
console.log("✅ MOTEUR IA V12 (DEBUG FORCE) CHARGÉ");
console.log("------------------------------------------------");

/**
 * 🤖 MOTEUR IA - V12 (INCASSABLE)
 * Ce fichier ne contient PLUS le message "Parsing Failed".
 * S'il échoue, il renvoie le texte brut.
 */
const AIEngine = {
    sanitizeJSON: (text) => {
        // Sécurité anti-vide
        if (!text) return { 
            studentName: "Erreur Vide", 
            grade: "?", 
            appreciation: "L'IA est restée muette.", 
            transcription: "Aucune réponse reçue de Google.", 
            mistakes: [] 
        };

        console.log("📝 [AI-ENGINE] Texte reçu à nettoyer :", text.substring(0, 50) + "...");

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
                throw new Error("Pas de JSON détectable");
            } catch (e2) {
                // ÉCHEC TOTAL : ON RENVOIE LE TEXTE BRUT
                // C'est ici que l'ancien code plantait. Maintenant, on renvoie un objet valide.
                console.warn("⚠️ [AI-ENGINE] JSON cassé. Mode RAW activé.");
                return {
                    studentName: "IA Confuse",
                    grade: "?/20",
                    appreciation: "L'IA a répondu mais le format est incorrect. Voir Analyse Détaillée.",
                    transcription: "🔴 CONTENU BRUT DE L'IA (V12) :\n\n" + text, 
                    mistakes: ["Erreur Technique JSON"]
                };
            }
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const targetModel = "gemini-2.0-flash"; 

        if (!apiKey) return "ERREUR CRITIQUE : Clé API manquante dans Render.";
        
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
                model: targetModel,
                systemInstruction: systemInstruction
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const finalText = response.text();
            
            console.log("Testing AI response length:", finalText.length);
            return finalText;

        } catch (e) {
            console.error(`💥 CRASH GOOGLE API :`, e.message);
            return `ERREUR FATALE GOOGLE : ${e.message}`;
        }
    }
};

module.exports = AIEngine;