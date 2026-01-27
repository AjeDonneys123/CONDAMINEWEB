const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V21 (TEMPÉRATURE ZÉRO)
 * Réglage strict pour empêcher l'IA de "délirer" en Anglais ou de changer le format.
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

            // Vérification des champs clés (si l'IA a mis "general_assessment" au lieu de "appreciation")
            const appreciation = norm.appreciation || norm.general_assessment || norm.comment || "Pas d'avis";
            const transcription = norm.transcription || norm.detailed_feedback || norm.text || "Pas de texte";
            
            // Si la transcription est un objet (le bug de tout à l'heure), on le stringify
            let finalTrans = transcription;
            if (typeof transcription === 'object') {
                finalTrans = JSON.stringify(transcription, null, 2);
            }

            return {
                studentname: norm.studentname || "Inconnu",
                grade: norm.grade || norm.overall_grade || norm.note || "?",
                appreciation: appreciation,
                transcription: finalTrans,
                mistakes: norm.mistakes || []
            };

        } catch (e) { 
            console.warn("⚠️ Mode RAW.");
            let htmlText = text
                .replace(/\*\*(.*?)\*\*/g, '<span style="color:#ef4444; font-weight:bold;">$1</span>')
                .replace(/\n/g, '<br/>');

            return {
                studentName: "Mode Texte",
                grade: "?",
                appreciation: "Format IA invalide.",
                transcription: "🔴 CONTENU BRUT :\n\n" + htmlText, 
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
                // TEMPÉRATURE 0.1 : L'IA devient un robot logique, pas un poète.
                // Cela réduit drastiquement le risque qu'elle parle anglais ou change le JSON.
                generationConfig: { temperature: 0.1 }
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