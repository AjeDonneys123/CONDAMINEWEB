const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V15 (EXTRACTION NOTE INTELLIGENTE)
 * Si le JSON échoue, on cherche la note dans le texte brut.
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
        if (!text) return { grade: "?", appreciation: "Silence IA.", transcription: "Rien." };

        let clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
        
        try {
            // Tentative standard
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
                grade: norm.grade || norm.note || "?", // L'IA doit mettre A, B...
                appreciation: norm.appreciation || "Pas d'avis.",
                transcription: norm.transcription || norm.analyse || "Pas de détail.",
                mistakes: norm.mistakes || []
            };

        } catch (e) { 
            // MODE SECOURS : ON CHERCHE LA NOTE DANS LE TEXTE
            // Ex: "Note: B" ou "Grade: A+"
            let extractedGrade = "?";
            const gradeMatch = text.match(/(?:Note|Grade)\s*:\s*([A-C]\+?)/i);
            if (gradeMatch) extractedGrade = gradeMatch[1].toUpperCase();

            console.warn("⚠️ [AI-ENGINE] Mode RAW + Extraction Note.");
            return {
                studentName: "Format Texte",
                grade: extractedGrade,
                appreciation: "L'IA a répondu en texte libre.",
                transcription: text, // On renvoie tout le texte brut
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
                systemInstruction: systemInstruction
            });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (e) {
            console.error(`💥 CRASH GOOGLE :`, e.message);
            return `ERREUR: ${e.message}`;
        }
    }
};

module.exports = AIEngine;