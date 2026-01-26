const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA CENTRALISÉ - V7 (CHIRURGIE JSON & CLEANER)
 * Nettoie agressivement la réponse pour extraire le JSON valide.
 */
const AIEngine = {
    sanitizeJSON: (text) => {
        if (!text) throw new Error("Réponse vide de l'IA");

        // 1. Nettoyage des balises Markdown courantes
        let clean = text
            .replace(/```json/gi, "")
            .replace(/```/gi, "")
            .trim();
        
        try {
            // 2. Recherche chirurgicale du bloc JSON
            const firstOpenBrace = clean.indexOf('{');
            const lastCloseBrace = clean.lastIndexOf('}');
            
            // Si on trouve des accolades, on coupe tout ce qu'il y a avant et après
            if (firstOpenBrace !== -1 && lastCloseBrace !== -1) {
                clean = clean.substring(firstOpenBrace, lastCloseBrace + 1);
            } 
            // Si pas d'accolades, c'est peut-être un tableau []
            else {
                const firstOpenBracket = clean.indexOf('[');
                const lastCloseBracket = clean.lastIndexOf(']');
                if (firstOpenBracket !== -1 && lastCloseBracket !== -1) {
                    clean = clean.substring(firstOpenBracket, lastCloseBracket + 1);
                }
            }

            // 3. Tentative de Parsing
            return JSON.parse(clean);

        } catch (e) { 
            console.error("🔥 [AI-CORE] Échec Parsing JSON. Brut reçu :", text.substring(0, 200) + "...");
            // On renvoie l'erreur pour que l'appelant puisse décider (Fallback)
            throw new Error("PARSING_FAILED: " + text); 
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
                // On force la température à 0.4 pour avoir des réponses plus "carrées"
                generationConfig: { temperature: 0.4 }
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