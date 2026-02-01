// @signatures: ProfAI, ask, sanitize
const fetch = require('node-fetch');

const ProfAI = {
    ask: async (prompt, system = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return "ERROR_KEY";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ role: "user", parts: (Array.isArray(prompt) ? prompt : [{ text: prompt }]) }],
                    systemInstruction: { parts: [{ text: system }] },
                    generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
                })
            });
            clearTimeout(timeout);
            const data = await res.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        } catch (e) { 
            clearTimeout(timeout);
            return "ERROR_AI_REACH"; 
        }
    },

    sanitize: (text) => {
        if (!text || typeof text !== 'string') return { error: "Réponse vide" };
        try {
            // Nettoyage ultra-agressif du bruit Gemini
            let clean = text.trim();
            if (clean.includes('```')) {
                clean = clean.split('```')[1];
                if (clean.startsWith('json')) clean = clean.substring(4);
                if (clean.startsWith('javascript')) clean = clean.substring(10);
            }
            const firstBrace = clean.indexOf('{');
            const lastBrace = clean.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
            }
            return JSON.parse(clean);
        } catch (e) { 
            return { error: "Format JSON corrompu", raw: text }; 
        }
    }
};

module.exports = ProfAI;
