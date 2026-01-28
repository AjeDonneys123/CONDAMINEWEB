const fetch = require('node-fetch');

/**
 * 🤖 MOTEUR IA - V32 (GENERIC JSON)
 * Capable de parser n'importe quelle structure (Oracle ou Scans).
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
        // Cas d'erreur brute
        if (text && (text.startsWith("ERREUR") || text.includes("429"))) {
             return {
                verdict: "DANGER",
                reason: "IA Saturée ou Indisponible.",
                studentName: "Erreur API",
                grade: "?",
                transcription: text
            };
        }

        if (!text) return { verdict: "DANGER", reason: "Réponse vide." };

        let clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
        
        try {
            // Tentative d'extraction du bloc JSON
            const start = clean.indexOf('{');
            const end = clean.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                const parsed = JSON.parse(clean.substring(start, end + 1));
                const norm = AIEngine.normalizeKeys(parsed);
                
                // V32 : On renvoie TOUT ce qu'on a trouvé + des valeurs par défaut au cas où
                return {
                    // Valeurs par défaut Oracle
                    verdict: "DANGER",
                    reason: "Pas d'explication fournie.",
                    
                    // Valeurs par défaut Scans
                    studentname: "Inconnu",
                    grade: "?",
                    appreciation: "Pas d'avis",
                    transcription: "...",
                    mistakes: [],

                    // ON ÉCRASE AVEC LES VRAIES DONNÉES DE L'IA
                    ...norm 
                };
            }
            throw new Error("No JSON found");
        } catch (e) { 
            console.warn("⚠️ IA : Fallback Mode Texte.");
            // En cas d'échec JSON, on renvoie le texte brut dans 'reason' et 'transcription'
            return {
                verdict: "DANGER",
                reason: text.substring(0, 100) + "...", // Pour l'Oracle
                transcription: text, // Pour les Scans
                studentName: "Mode Brut",
                grade: "?"
            };
        }
    },

    ask: async (prompt, systemInstruction = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        const modelName = "gemini-2.0-flash"; 

        if (!apiKey) return "ERREUR CLÉ API MANQUANTE";

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const contents = [];
        const parts = [];
        if (Array.isArray(prompt)) {
            prompt.forEach(p => {
                if (p.text) parts.push({ text: p.text });
                if (p.inlineData) parts.push({ inline_data: { mime_type: p.inlineData.mimeType, data: p.inlineData.data } });
            });
        } else {
            parts.push({ text: prompt });
        }
        contents.push({ role: "user", parts: parts });

        const body = {
            contents: contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ],
            generationConfig: { temperature: 0.2 }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();

            if (data.error) return `ERREUR API: ${data.error.message}`;
            if (data.candidates && data.candidates.length > 0) return data.candidates[0].content.parts[0].text;
            return "Réponse vide.";
        } catch (e) {
            return `ERREUR RÉSEAU: ${e.message}`;
        }
    }
};

module.exports = AIEngine;
