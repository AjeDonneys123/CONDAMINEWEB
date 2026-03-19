// @signatures: ProfAI, ask, sanitize
const fetch = require('node-fetch');

const ProfAI = {
    ask: async (prompt, system = "", options = {}) => {
        const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
        if (!apiKey) {
            console.error("❌ [ProfAI] API KEY MANQUANTE");
            throw new Error("GEMINI_API_KEY manquante");
        }

        const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
        let lastError = null;

        for (const model of models) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 45000);

            try {
                console.log(`🤖 [ProfAI] Envoi requête Gemini (${model}/central)...`);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: (Array.isArray(prompt) ? prompt : [{ text: prompt }]) }],
                        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
                        generationConfig: {
                            temperature: 0.1
                        }
                    })
                });
                clearTimeout(timeout);

                if (!res.ok) {
                    const errText = await res.text();
                    console.error(`❌ [ProfAI] Erreur API (${model}/${res.status}):`, errText);
                    let message = `Gemini ${model} HTTP ${res.status}`;
                    try {
                        const parsed = JSON.parse(errText);
                        const apiMessage = String(parsed?.error?.message || '').trim();
                        const retryDelay = String(parsed?.error?.details?.find?.((d) => String(d?.['@type'] || '').includes('RetryInfo'))?.retryDelay || '').trim();
                        if (res.status === 429) {
                            message = apiMessage
                                ? `Quota Gemini dépassé (${model}). ${apiMessage}`
                                : `Quota Gemini dépassé (${model}).`;
                            if (retryDelay && !message.includes(retryDelay)) message += ` Réessaie dans ${retryDelay}.`;
                        } else if (apiMessage) {
                            message = apiMessage;
                        }
                    } catch (_) {}
                    lastError = new Error(message);
                    continue;
                }

                const data = await res.json();
                const candidate = data?.candidates?.[0];
                const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
                const text = parts
                    .map((part) => String(part?.text || '').trim())
                    .filter(Boolean)
                    .join('\n')
                    .trim();

                if (text) return text;

                const finishReason = String(candidate?.finishReason || '').trim();
                const blockReason = String(data?.promptFeedback?.blockReason || '').trim();
                if (blockReason) {
                    throw new Error(`Gemini bloqué: ${blockReason}`);
                }
                lastError = new Error(finishReason ? `Gemini sans texte (${finishReason})` : 'Gemini sans texte');
            } catch (e) {
                clearTimeout(timeout);
                console.error(`❌ [ProfAI] Exception (${model}):`, e.message);
                lastError = e;
            }
        }

        throw lastError || new Error("Gemini indisponible");
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
