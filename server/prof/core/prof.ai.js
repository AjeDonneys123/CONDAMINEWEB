// @signatures: ProfAI, ask, sanitize
const fetch = require('node-fetch');

/**
 * 🤖 MOTEUR IA RÉSERVÉ AU PROF (CRÉATION)
 */
const ProfAI = {
    ask: async (prompt, system = "") => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    systemInstruction: { parts: [{ text: system }] }
                })
            });
            const data = await res.json();
            return data.candidates[0].content.parts[0].text;
        } catch (e) { return "{}"; }
    },
    sanitize: (text) => {
        try {
            const clean = text.replace(/```json|```/g, '').trim();
            const start = clean.indexOf('{');
            const end = clean.lastIndexOf('}');
            return JSON.parse(clean.substring(start, end + 1));
        } catch (e) { return {}; }
    }
};
module.exports = ProfAI;
