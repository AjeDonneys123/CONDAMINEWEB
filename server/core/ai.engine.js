const fetch = require('node-fetch');

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
        if (!text) return [];
        try {
            // Nettoyage agressif des balises Markdown et espaces
            let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const start = clean.indexOf('[');
            const end = clean.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                const jsonArray = JSON.parse(clean.substring(start, end + 1));
                return AIEngine.normalizeKeys(jsonArray);
            }
            return [];
        } catch (e) {
            console.error("❌ Erreur de parsing JSON IA:", e.message);
            return [];
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return "ERROR_KEY";

        const parts = Array.isArray(prompt) ? prompt : [{ text: prompt }];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
        try {
            const response = await fetch(url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({
                    contents: [{ role: "user", parts: parts }],
                    systemInstruction: { parts: [{ text: systemInstruction }] }
                }) 
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        } catch (e) { 
            console.error("AI Core Error:", e.message);
            return "[]"; 
        }
    }
};

module.exports = AIEngine;
