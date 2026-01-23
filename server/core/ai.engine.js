const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA CENTRALISÉ - V3 (GEMINI 2.0 FLASH + FIX LOGS)
 * Supporte le mode Multimodal (Texte + Image) sans crasher.
 */
const AIEngine = {
    sanitizeJSON: (text) => {
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

            if (startIdx === -1) throw new Error("Format JSON introuvable");
            return JSON.parse(clean.substring(startIdx, endIdx));
        } catch (e) { 
            console.error("🔥 [AI-CORE] Échec parsing JSON. Brut :", text.substring(0, 100) + "...");
            throw new Error("L'IA a renvoyé un format illisible."); 
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const targetModel = "gemini-2.0-flash"; // ✅ ON RESTE SUR LE 2.0 FLASH

        if (!apiKey) {
            console.error("❌ [AI-CORE] Erreur : GEMINI_API_KEY manquante.");
            throw new Error("Clé API manquante");
        }
        
        // ✅ FIX CRASH : On vérifie si le prompt est une String ou un Array (Multimodal)
        let logPrompt = "";
        if (typeof prompt === 'string') {
            logPrompt = prompt.substring(0, 50);
        } else if (Array.isArray(prompt)) {
            logPrompt = "MULTIMODAL (Image + Texte)";
        } else {
            logPrompt = "Objet complexe";
        }

        console.log(`📡 [AI-CORE] Appel Google | Modèle: ${targetModel} | Prompt: ${logPrompt}...`);
        
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
                model: targetModel,
                systemInstruction: systemInstruction 
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            if (!text) throw new Error("Réponse Google vide");
            return text;
        } catch (e) {
            console.error(`💥 [AI-CORE] CRASH GOOGLE :`, e.message);
            throw e;
        }
    }
};

module.exports = AIEngine;