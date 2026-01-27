const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V20 (TRANSPARENCE TOTALE)
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
        if (!text) return { grade: "?", appreciation: "IA Muette (Retour vide).", transcription: "L'IA n'a rien renvoyé." };

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

            // Vérification vitale
            const trans = norm.transcription || norm.analyse || norm.details || norm.text;
            if (!trans) throw new Error("JSON Valide mais sans transcription");

            return {
                studentname: norm.studentname || "Inconnu",
                grade: norm.grade || norm.note || "?",
                appreciation: norm.appreciation || "Pas d'avis.",
                transcription: trans,
                mistakes: norm.mistakes || []
            };

        } catch (e) { 
            console.warn("⚠️ Mode RAW Fallback.");
            
            let extractedGrade = "?";
            const gradeMatch = text.match(/(?:Note|Grade|Score)\s*[:=]\s*([A-C]\+?|\d{1,2}\/20)/i);
            if (gradeMatch) extractedGrade = gradeMatch[1].toUpperCase();

            let htmlText = text
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\n/g, '<br/>');

            return {
                studentName: "Mode Texte",
                grade: extractedGrade,
                appreciation: "⚠️ Format IA non respecté (Voir détail).",
                transcription: "🔴 CONTENU BRUT REÇU :\n\n" + htmlText, 
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
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
            });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (e) {
            console.error(`💥 CRASH GOOGLE :`, e.message);
            return `ERREUR GOOGLE: ${e.message}`;
        }
    }
};

module.exports = AIEngine;