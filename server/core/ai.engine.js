const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V16 (SCRAPER DE NOTE RENFORCÉ)
 * Trouve la note même dans le désordre.
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
            // MODE SECOURS RENFORCÉ
            console.warn("⚠️ [AI-ENGINE] Mode RAW + Scraper.");
            
            let extractedGrade = "?";
            // Regex 1 : Cherche "grade": "A" dans le texte brut (si JSON mal formé)
            let match = text.match(/"grade"\s*:\s*"([A-C]\+?)"/i);
            if (!match) match = text.match(/"note"\s*:\s*"([A-C]\+?)"/i);
            // Regex 2 : Cherche Note : A dans le texte humain
            if (!match) match = text.match(/(?:Note|Grade)\s*[:=]\s*([A-C]\+?)/i);
            
            if (match) extractedGrade = match[1].toUpperCase();

            // Si l'IA a fait du markdown au lieu du HTML, on convertit basiquement pour l'affichage
            let cleanText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

            return {
                studentName: "Format Texte",
                grade: extractedGrade, // On renvoie la note trouvée par regex
                appreciation: "L'IA a répondu en texte libre.",
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
                // On baisse la température pour rendre l'IA moins "créative" et plus "robot"
                generationConfig: { temperature: 0.2 }
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