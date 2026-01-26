const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V14 (ADAPTATEUR DE TABLEAUX)
 * Si l'IA renvoie une liste (Array), on la convertit en Objet standard.
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
            let parsed = null;
            // 1. Détection structure (Objet {} ou Tableau [])
            const startObj = clean.indexOf('{');
            const startArr = clean.indexOf('[');
            
            // Si c'est un tableau qui arrive en premier
            if (startArr !== -1 && (startObj === -1 || startArr < startObj)) {
                const endArr = clean.lastIndexOf(']');
                if (endArr !== -1) {
                    parsed = JSON.parse(clean.substring(startArr, endArr + 1));
                    
                    // --- MAGIE V14 : CONVERSION TABLEAU -> OBJET ---
                    // On transforme la liste de points en un beau texte
                    console.log("⚠️ [AI-ENGINE] Tableau détecté, conversion en Objet...");
                    let formattedText = parsed.map(item => {
                        const pt = item.point || item.question || "•";
                        const corr = item.correction || item.reponse || "";
                        const sugg = item.suggestion || item.conseil || "";
                        return `📌 Point ${pt} :\nCorrection : ${corr}\n💡 Conseil : ${sugg}`;
                    }).join('\n\n');

                    return {
                        studentname: "Non précisé",
                        grade: "?/20",
                        appreciation: "Correction détaillée point par point (voir ci-dessous).",
                        transcription: formattedText,
                        mistakes: []
                    };
                }
            }
            
            // Sinon, traitement standard Objet
            const start = clean.indexOf('{');
            const end = clean.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                parsed = JSON.parse(clean.substring(start, end + 1));
            } else {
                throw new Error("Ni Objet ni Tableau JSON trouvé");
            }

            const normalized = AIEngine.normalizeKeys(parsed);

            return {
                studentname: normalized.studentname || "Inconnu",
                grade: normalized.grade || normalized.note || "?/20",
                appreciation: normalized.appreciation || normalized.avis || "Non renseigné.",
                transcription: normalized.transcription || normalized.analyse || normalized.details || JSON.stringify(parsed, null, 2),
                mistakes: normalized.mistakes || []
            };

        } catch (e) { 
            console.warn("⚠️ [AI-ENGINE] Mode RAW activé.");
            return {
                studentName: "Format Texte",
                grade: "?",
                appreciation: "L'IA a répondu en texte libre.",
                transcription: text, 
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