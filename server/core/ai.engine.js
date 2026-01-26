const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V19 (ROBUSTE + CLEANER)
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
        if (!text) return { grade: "?", appreciation: "Vide.", transcription: "Rien." };

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
            console.warn("⚠️ Mode RAW.");
            
            // Si le JSON échoue, on cherche la note dans le texte pour sauver l'affichage
            let extractedGrade = "?";
            const gradeMatch = text.match(/(?:Note|Grade)\s*[:=]\s*([A-C]\+?|\d{1,2}\/20)/i);
            if (gradeMatch) extractedGrade = gradeMatch[1].toUpperCase();

            // Conversion markdown -> HTML pour les couleurs si l'IA a désobéi
            let htmlText = text
                .replace(/\*\*(.*?)\*\*/g, '<span style="color:#ef4444; font-weight:bold;">$1</span>')
                .replace(/\n/g, '<br/>');

            return {
                studentName: "Mode Texte",
                grade: extractedGrade,
                appreciation: "Format brut.",
                transcription: htmlText, 
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
                ],
                // On laisse un peu de créativité pour que l'analyse soit naturelle, pas robotique
                generationConfig: { temperature: 0.4 }
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