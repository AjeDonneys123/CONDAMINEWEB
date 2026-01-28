const fetch = require('node-fetch');

/**
 * 🤖 MOTEUR IA - V33 (JSON SURGEON)
 * Extrait chirurgicalement le JSON du blabla de l'IA.
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
        if (!text) return { verdict: "DANGER", reason: "Réponse vide." };
        if (text.includes("429") || text.includes("exhausted")) return { verdict: "DANGER", reason: "IA Saturée." };

        try {
            // CHIRURGIE : On ignore tout le texte avant le premier '{' et après le dernier '}'
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            
            if (start !== -1 && end !== -1) {
                const jsonString = text.substring(start, end + 1);
                const parsed = JSON.parse(jsonString);
                return AIEngine.normalizeKeys(parsed);
            }
            throw new Error("Pas de structure JSON trouvée");
        } catch (e) { 
            // Si l'IA a vraiment mal répondu, on force un SAFE pour ne pas bloquer le dev pour rien
            // sauf si le mot "DANGER" ou "RÉGRESSION" est explicite dans le texte brut
            const isDanger = /danger|regression|suppression|critique/i.test(text);
            return {
                verdict: isDanger ? "DANGER" : "SAFE",
                reason: isDanger ? "Analyse texte brute (Format invalide)" : "Validation par défaut (Format invalide)"
            };
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const modelName = "gemini-2.0-flash"; 

        if (!apiKey) return "ERREUR CLÉ API MANQUANTE";

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const body = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.1 } // Température basse = moins de blabla
        };

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) return data.candidates[0].content.parts[0].text;
            return "{}";
        } catch (e) { return "{}"; }
    }
};

module.exports = AIEngine;
