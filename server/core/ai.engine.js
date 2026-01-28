const fetch = require('node-fetch');

/**
 * 🤖 MOTEUR IA - V31 (GEMINI 2.0)
 * Utilise le modèle confirmé disponible sur votre compte.
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
        if (text && text.startsWith("ERREUR")) {
             return {
                studentName: "Erreur API",
                grade: "?",
                appreciation: "Problème technique.",
                transcription: `🔴 ${text}`,
                mistakes: []
            };
        }

        if (!text) return { grade: "?", appreciation: "Vide.", transcription: "Rien." };

        let clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
        try {
            const start = clean.indexOf('{');
            const end = clean.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                const parsed = JSON.parse(clean.substring(start, end + 1));
                const norm = AIEngine.normalizeKeys(parsed);
                let trans = norm.transcription || norm.text || "Pas de texte";
                if (typeof trans === 'object') trans = JSON.stringify(trans, null, 2);
                return {
                    studentname: norm.studentname || "Inconnu",
                    grade: norm.grade || "?",
                    appreciation: norm.appreciation || "Pas d'avis",
                    transcription: trans,
                    mistakes: norm.mistakes || []
                };
            }
            throw new Error("No JSON");
        } catch (e) { 
            console.warn("⚠️ Mode RAW.");
            let htmlText = text.replace(/\*\*(.*?)\*\*/g, '<span style="color:#ef4444; font-weight:bold;">$1</span>').replace(/\n/g, '<br/>');
            return {
                studentName: "Mode Texte",
                grade: "?",
                appreciation: "Format brut.",
                transcription: htmlText, 
                mistakes: []
            };
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        // LE MODÈLE CONFIRMÉ PAR VOTRE TEST :
        const modelName = "gemini-2.0-flash"; 

        if (!apiKey) return "ERREUR CLÉ API MANQUANTE";

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const contents = [];
        const parts = [];
        if (Array.isArray(prompt)) {
            prompt.forEach(p => {
                if (p.text) parts.push({ text: p.text });
                if (p.inlineData) {
                    parts.push({ inline_data: { mime_type: p.inlineData.mimeType, data: p.inlineData.data } });
                }
            });
        } else {
            parts.push({ text: prompt });
        }
        contents.push({ role: "user", parts: parts });

        const body = {
            contents: contents,
            systemInstruction: { parts: [{ text: systemInstruction || "Tu es un assistant." }] },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ],
            generationConfig: { temperature: 0.2 }
        };

        try {
            console.log(`📡 [AI-ENGINE] Appel ${modelName}...`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();

            if (data.error) {
                console.error("❌ ERREUR API GOOGLE :", data.error);
                return `ERREUR GOOGLE (${data.error.code}): ${data.error.message}`;
            }

            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else {
                return "Réponse vide.";
            }
        } catch (e) {
            return `ERREUR RÉSEAU: ${e.message}`;
        }
    }
};

module.exports = AIEngine;
