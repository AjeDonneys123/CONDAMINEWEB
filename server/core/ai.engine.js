const fetch = require('node-fetch');
const { logGeminiUsage } = require('../services/aiUsage.service');
const { assertAiWithinFreeTier } = require('../services/aiGuard.service');

const resolveGeminiApiKey = () => {
    const candidates = [
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.GOOGLE_AI_API_KEY
    ];
    for (const raw of candidates) {
        const key = String(raw || '').trim();
        if (key) return key;
    }
    return '';
};

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

    askLocal: async (prompt, systemInstruction = "") => {
        const baseUrl = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim();
        const model = String(process.env.OLLAMA_MODEL || 'qwen2.5:14b-instruct').trim();
        if (!baseUrl || !model) return "";
        const userText = Array.isArray(prompt)
            ? prompt.map((p) => String(p?.text || '')).join('\n\n').trim()
            : String(prompt || '').trim();
        if (!userText) return "";
        try {
            const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    stream: false,
                    options: {
                        temperature: 0.3,
                        num_predict: 450
                    },
                    messages: [
                        { role: 'system', content: String(systemInstruction || '') },
                        { role: 'user', content: userText }
                    ]
                })
            });
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`OLLAMA_HTTP_${response.status}: ${errText.slice(0, 300)}`);
            }
            const data = await response.json();
            return String(data?.message?.content || '').trim();
        } catch (e) {
            console.error('AI Local Error:', e.message);
            return "";
        }
    },

    ask: async (prompt, systemInstruction = "", options = {}) => {
        await assertAiWithinFreeTier({ teacherId: String(options?.teacherId || '').trim() });
        const provider = String(process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
        const useLocalFirst = provider === 'local' || provider === 'ollama';
        if (useLocalFirst) {
            const localText = await AIEngine.askLocal(prompt, systemInstruction);
            if (localText) return localText;
        }
        const apiKey = resolveGeminiApiKey();
        if (!apiKey) return "ERROR_KEY";

        const parts = Array.isArray(prompt) ? prompt : [{ text: prompt }];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);
        
        try {
            const response = await fetch(url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ role: "user", parts: parts }],
                    systemInstruction: { parts: [{ text: systemInstruction }] }
                }) 
            });
            clearTimeout(timeout);
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            await logGeminiUsage({
                teacherId: String(options?.teacherId || '').trim(),
                source: 'central',
                model: 'gemini-2.5-flash-lite',
                usageMetadata: data?.usageMetadata,
                route: String(options?.route || '').trim(),
                feature: String(options?.feature || '').trim(),
                prompt,
                systemInstruction,
                responseText: text,
                status: 'success'
            });
            return text;
        } catch (e) { 
            clearTimeout(timeout);
            console.error("AI Core Error:", e.message);
            await logGeminiUsage({
                teacherId: String(options?.teacherId || '').trim(),
                source: 'central',
                model: 'gemini-2.5-flash-lite',
                route: String(options?.route || '').trim(),
                feature: String(options?.feature || '').trim(),
                prompt,
                systemInstruction,
                status: 'error',
                errorMessage: e.message || 'AI core error'
            });
            return "[]"; 
        }
    }
};

module.exports = AIEngine;
