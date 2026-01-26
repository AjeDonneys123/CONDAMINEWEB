const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * 🤖 MOTEUR IA - V13 (NORMALISATEUR DE CLÉS)
 * Répare les problèmes de majuscules/minuscules dans le JSON de l'IA.
 */
const AIEngine = {
    // Fonction utilitaire pour tout mettre en minuscule
    normalizeKeys: (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        if (Array.isArray(obj)) return obj.map(AIEngine.normalizeKeys);
        
        return Object.keys(obj).reduce((acc, key) => {
            // On transforme "StudentName" ou "studentname" en "studentname"
            const cleanKey = key.toLowerCase().trim();
            // On garde le contenu tel quel
            acc[cleanKey] = AIEngine.normalizeKeys(obj[key]);
            return acc;
        }, {});
    },

    sanitizeJSON: (text) => {
        if (!text) return { grade: "?", appreciation: "IA Muette", transcription: "Rien." };

        let clean = text
            .replace(/```json/gi, "")
            .replace(/```/gi, "")
            .trim();
        
        try {
            let parsed = null;
            // 1. Parsing
            const start = clean.indexOf('{');
            const end = clean.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                parsed = JSON.parse(clean.substring(start, end + 1));
            } else {
                throw new Error("Pas de JSON");
            }

            // 2. NORMALISATION (C'est la nouveauté V13)
            // Si l'IA renvoie { "Grade": "12" }, on transforme en { "grade": "12" }
            const normalized = AIEngine.normalizeKeys(parsed);

            // 3. Vérification des champs vitaux (Fallback si manquant)
            return {
                studentname: normalized.studentname || "Inconnu",
                grade: normalized.grade || normalized.note || "?/20",
                appreciation: normalized.appreciation || normalized.avis || "Non renseigné.",
                transcription: normalized.transcription || normalized.analyse || normalized.details || "Pas de détail fourni.",
                mistakes: normalized.mistakes || normalized.erreurs || []
            };

        } catch (e) { 
            console.warn("⚠️ [AI-ENGINE] JSON Fail -> Mode RAW.");
            return {
                studentName: "Erreur Format",
                grade: "?",
                appreciation: "L'IA a répondu hors format JSON.",
                transcription: "🔴 CONTENU BRUT :\n\n" + text, 
                mistakes: []
            };
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const targetModel = "gemini-2.0-flash"; 
        
        if (!apiKey) return "ERREUR CLÉ API";

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ 
                model: targetModel,
                systemInstruction: systemInstruction
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (e) {
            console.error(`💥 CRASH GOOGLE :`, e.message);
            return `ERREUR GOOGLE: ${e.message}`;
        }
    }
};

module.exports = AIEngine;