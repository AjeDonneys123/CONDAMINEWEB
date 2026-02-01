// @signatures: AIEngine, normalizeKeys, sanitizeJSON, ask
const fetch = require('node-fetch');

/**
 * 🤖 MOTEUR IA CORE - V24.2
 * Moteur de secours utilisé pour les diagnostics système.
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
        try {
            const start = Math.max(text.indexOf('{'), text.indexOf('['));
            const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
            if (start !== -1 && end !== -1) {
                const jsonString = text.substring(start, end + 1);
                return AIEngine.normalizeKeys(JSON.parse(jsonString));
            }
            return { verdict: "DANGER", reason: "Format JSON invalide" };
        } catch (e) { 
            return { verdict: "DANGER", reason: "Crash du parseur JSON" };
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return "ERROR_KEY";

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        try {
            const response = await fetch(url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] }
                }) 
            });
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        } catch (e) { return "{}"; }
    }
};

module.exports = AIEngine;
