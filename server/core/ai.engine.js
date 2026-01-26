const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA CENTRALISÉ - V5 (JSON ROBUSTE)
 * Capable d'extraire le JSON même si l'IA ajoute du texte autour.
 */
const AIEngine = {
    sanitizeJSON: (text) => {
        // 1. Nettoyage basique Markdown
        let clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
        
        try {
            // 2. Extraction chirurgicale du JSON (Cherche la première { ou [ et la dernière } ou ])
            const firstOpenBrace = clean.indexOf('{');
            const firstOpenBracket = clean.indexOf('[');
            
            let startIndex = -1;
            
            // On détermine si c'est un Objet {} ou un Array [] qui commence en premier
            if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
                startIndex = firstOpenBrace;
            } else if (firstOpenBracket !== -1) {
                startIndex = firstOpenBracket;
            }

            if (startIndex === -1) {
                console.error("🔥 [AI-CORE] Pas de structure JSON détectée dans:", text.substring(0, 100));
                throw new Error("Aucune donnée structurée trouvée dans la réponse IA.");
            }

            // On cherche la fin correspondante
            // Si ça commence par {, on cherche la dernière }
            // Si ça commence par [, on cherche le dernier ]
            let endIndex = -1;
            if (clean[startIndex] === '{') {
                endIndex = clean.lastIndexOf('}');
            } else {
                endIndex = clean.lastIndexOf(']');
            }

            if (endIndex === -1 || endIndex <= startIndex) {
                throw new Error("JSON incomplet ou malformé.");
            }

            // On extrait uniquement la partie JSON valide
            const jsonString = clean.substring(startIndex, endIndex + 1);
            
            return JSON.parse(jsonString);

        } catch (e) { 
            console.error("🔥 [AI-CORE] Échec parsing JSON. Texte reçu complet :\n", text);
            // On renvoie une erreur plus douce pour l'interface
            throw new Error("L'IA a renvoyé un format illisible (Parsing Failed)."); 
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const targetModel = "gemini-2.0-flash"; 

        if (!apiKey || apiKey.includes('VOTRE_CLE')) {
            console.error("❌ [AI-CORE] Clé API manquante ou par défaut.");
            throw new Error("CLÉ API MANQUANTE DANS LE FICHIER .ENV");
        }
        
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
            
            if (e.message.includes('API key expired') || e.message.includes('API_KEY_INVALID') || e.status === 400) {
                throw new Error("⚠️ VOTRE CLÉ API EST PÉRIMÉE. Changez-la dans le fichier .env !");
            }
            
            throw e;
        }
    }
};

module.exports = AIEngine;