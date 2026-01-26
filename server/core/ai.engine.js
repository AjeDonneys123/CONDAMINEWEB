const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V17 (SAFETY OFF)
 * Désactivation explicite des filtres de sécurité pour autoriser la lecture de copies.
 */
const AIEngine = {
    normalizeKeys: (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        if (Array.isArray(obj)) return obj.map(AIEngine.normalizeKeys);
        return Object.keys(obj).reduce((acc, key) => {
            acc[key.toLowerCase().trim()] = AIEngine.normalizeKeys(obj[key]);
            return acc;
        }, {});
    },

    sanitizeJSON: (text) => {
        if (!text) return { grade: "?", appreciation: "IA Muette.", transcription: "Rien." };

        let clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
        
        try {
            const start = clean.indexOf('{');
            const end = clean.lastIndexOf('}');
            let parsed = null;
            if (start !== -1 && end !== -1) {
                parsed = JSON.parse(clean.substring(start, end + 1));
            } else {
                throw new Error("No JSON");
            }
            const norm = AIEngine.normalizeKeys(parsed);
            return {
                studentname: norm.studentname || "Inconnu",
                grade: norm.grade || norm.note || "?",
                appreciation: norm.appreciation || "Pas d'avis.",
                transcription: norm.transcription || norm.analyse || "Pas de détail.",
                mistakes: norm.mistakes || []
            };
        } catch (e) { 
            // MODE SECOURS
            let extractedGrade = "?";
            let match = text.match(/(?:Note|Grade)\s*[:=]\s*([A-C]\+?)/i);
            if (match) extractedGrade = match[1].toUpperCase();

            let cleanText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

            return {
                studentName: "Format Texte",
                grade: extractedGrade,
                appreciation: "Mode Texte Brut (Fallback)",
                transcription: cleanText, 
                mistakes: []
            };
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const targetModel = "gemini-2.0-flash"; 

        if (!apiKey) return "ERREUR CLÉ";
        
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
                model: targetModel,
                systemInstruction: systemInstruction,
                // --- DÉSACTIVATION DES FILTRES DE SÉCURITÉ ---
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (e) {
            console.error(`💥 CRASH GOOGLE :`, e.message);
            // Si l'IA refuse pour "Safety", on renvoie un message clair
            if (e.message.includes("SAFETY")) return "REFUS SÉCURITÉ GOOGLE : L'image est considérée comme sensible.";
            return `ERREUR: ${e.message}`;
        }
    }
};

module.exports = AIEngine;