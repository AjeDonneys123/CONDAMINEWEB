const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA CENTRALISÉ - DEBUG VERSION
 * FORCE LE MODÈLE : gemini-2.0-flash
 */
const AIEngine = {
    sanitizeJSON: (text) => {
        console.log("🔍 [AI-CORE] Début Sanitize JSON...");
        try {
            let clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
            const startArray = clean.indexOf('[');
            const startObj = clean.indexOf('{');
            let startIdx = -1;
            let endIdx = -1;

            if (startArray !== -1 && (startObj === -1 || startArray < startObj)) {
                startIdx = startArray;
                endIdx = clean.lastIndexOf(']') + 1;
            } else if (startObj !== -1) {
                startIdx = startObj;
                endIdx = clean.lastIndexOf('}') + 1;
            }

            if (startIdx === -1) {
                console.error("❌ [AI-CORE] Texte reçu sans JSON :", text);
                throw new Error("Format JSON introuvable");
            }
            
            const result = JSON.parse(clean.substring(startIdx, endIdx));
            console.log("✅ [AI-CORE] JSON parsé avec succès.");
            return result;
        } catch (e) { 
            console.error("🔥 [AI-CORE] Échec parsing. Texte brut :", text);
            throw new Error("L'IA a renvoyé un format illisible."); 
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const targetModel = "gemini-2.0-flash"; // <--- ON FORCE ICI

        if (!apiKey) {
            console.error("❌ [AI-CORE] Erreur : GEMINI_API_KEY est vide dans le .env");
            throw new Error("Clé API manquante");
        }
        
        console.log(`📡 [AI-CORE] Appel Google API | Modèle: ${targetModel} | Prompt: ${prompt.substring(0, 50)}...`);
        
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
                model: targetModel,
                systemInstruction: systemInstruction 
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log("📥 [AI-CORE] Réponse reçue, longueur : " + (text ? text.length : 0));
            if (!text) throw new Error("Réponse Google vide");
            
            return text;
        } catch (e) {
            console.error(`💥 [AI-CORE] CRASH SDK GOOGLE (${targetModel}) :`, e.message);
            throw e;
        }
    }
};

module.exports = AIEngine;