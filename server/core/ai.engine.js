const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA CENTRALISÉ - V6 (ROBUSTESSE MAXIMALE)
 * Cherche le JSON partout, même si l'IA bavarde.
 */
const AIEngine = {
    sanitizeJSON: (text) => {
        let clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
        
        try {
            // Recherche du bloc JSON le plus large possible
            const firstOpenBrace = clean.indexOf('{');
            const lastCloseBrace = clean.lastIndexOf('}');
            const firstOpenBracket = clean.indexOf('[');
            const lastCloseBracket = clean.lastIndexOf(']');

            let start = -1;
            let end = -1;

            // Détection Objet vs Array
            if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
                start = firstOpenBrace;
                end = lastCloseBrace;
            } else if (firstOpenBracket !== -1) {
                start = firstOpenBracket;
                end = lastCloseBracket;
            }

            if (start !== -1 && end !== -1 && end > start) {
                clean = clean.substring(start, end + 1);
            } else {
                throw new Error("Aucune structure JSON trouvée.");
            }

            return JSON.parse(clean);
        } catch (e) { 
            console.error("🔥 [AI-CORE] Échec parsing JSON. Texte reçu :\n", text);
            throw new Error("L'IA a renvoyé un format illisible (Parsing Failed)."); 
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
            console.error(`💥 [AI-CORE] CRASH GOOGLE :`, e.message);
            throw e;
        }
    }
};

module.exports = AIEngine;