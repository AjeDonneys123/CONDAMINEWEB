// @signatures: EleveAI, analyze
const fetch = require('node-fetch');

/**
 * 🤖 MOTEUR IA RÉSERVÉ À L'ÉLÈVE (CORRECTION)
 */
const EleveAI = {
    analyze: async (userText, instruction, aiHints) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const prompt = `Consigne: ${instruction}. Aide: ${aiHints}. Réponse: "${userText}"`;
        const system = "Tu es un correcteur. Réponds en JSON strict: {grade: 'A|B|C', feedback_fond: '...'}";
        
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
            const text = data.candidates[0].content.parts[0].text;
            return JSON.parse(text.replace(/```json|```/g, ''));
        } catch (e) {
            return { grade: 'B', feedback_fond: "Analyse indisponible." };
        }
    }
};
module.exports = EleveAI;
