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
        if (!text) return null;
        const tryParse = (candidate) => {
            if (!candidate) return null;
            try { return JSON.parse(candidate); } catch (_) { return null; }
        };
        const repairJsonLike = (candidate) => String(candidate || '')
            .replace(/,\s*([}\]])/g, '$1') // trailing commas
            .replace(/\u0000/g, '')
            .trim();
        try {
            // Nettoyage agressif des balises Markdown et espaces
            let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const objStart = clean.indexOf('{');
            const objEnd = clean.lastIndexOf('}');
            if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
                const rawObject = clean.substring(objStart, objEnd + 1);
                const parsedObject = tryParse(rawObject) || tryParse(repairJsonLike(rawObject));
                if (parsedObject) return AIEngine.normalizeKeys(parsedObject);
            }
            const arrStart = clean.indexOf('[');
            const arrEnd = clean.lastIndexOf(']');
            if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
                const rawArray = clean.substring(arrStart, arrEnd + 1);
                const parsedArray = tryParse(rawArray) || tryParse(repairJsonLike(rawArray));
                if (parsedArray) return AIEngine.normalizeKeys(parsedArray);
            }
            return null;
        } catch (e) {
            console.error("❌ Erreur de parsing JSON IA:", e.message);
            return null;
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
