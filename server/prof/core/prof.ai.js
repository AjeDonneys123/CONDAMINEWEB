// @signatures: ProfAI, ask, sanitize
const fetch = require('node-fetch');

const ProfAI = {
    ask: async (prompt, system = "") => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("❌ [ProfAI] API KEY MANQUANTE");
            return "ERROR_KEY";
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000); // Timeout étendu à 45s

        try {
            console.log("🤖 [ProfAI] Envoi requête Gemini...");
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ role: "user", parts: (Array.isArray(prompt) ? prompt : [{ text: prompt }]) }],
                    systemInstruction: { parts: [{ text: system }] },
                    generationConfig: { 
                        temperature: 0.1, // Très strict
                        // response_mime_type: "application/json" // On laisse libre pour éviter les erreurs 400 si le modèle ne supporte pas
                    }
                })
            });
            clearTimeout(timeout);
            
            if (!res.ok) {
                const errText = await res.text();
                console.error(`❌ [ProfAI] Erreur API (${res.status}):`, errText);
                return "ERROR_API";
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            return text;

        } catch (e) { 
            clearTimeout(timeout);
            console.error("❌ [ProfAI] Exception:", e.message);
            return "ERROR_AI_REACH"; 
        }
    },

    sanitize: (text) => {
        if (!text || typeof text !== 'string') return [];
        
        console.log("🧹 [ProfAI] Nettoyage réponse brute (début):", text.substring(0, 50) + "...");

        try {
            // 1. Nettoyage Markdown
            let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

            // 2. Recherche du premier crochet ouvrant [ et dernier fermant ]
            const firstBracket = clean.indexOf('[');
            const lastBracket = clean.lastIndexOf(']');

            if (firstBracket !== -1 && lastBracket !== -1) {
                clean = clean.substring(firstBracket, lastBracket + 1);
            } else {
                // Si pas de tableau trouvé, on tente de trouver un objet et de le mettre dans un tableau
                const firstBrace = clean.indexOf('{');
                const lastBrace = clean.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    clean = `[${clean.substring(firstBrace, lastBrace + 1)}]`;
                }
            }

            // 3. Parsing
            const result = JSON.parse(clean);
            
            // 4. Validation finale (Doit être un tableau)
            if (Array.isArray(result)) return result;
            return [];

        } catch (e) { 
            console.error("❌ [ProfAI] Parse Error:", e.message);
            console.error("   Contenu problématique:", text);
            return []; 
        }
    }
};

module.exports = ProfAI;
