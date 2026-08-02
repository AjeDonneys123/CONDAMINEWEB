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

const resolveGeminiModel = () => String(process.env.GEMINI_MODEL || 'gemini-flash-latest').trim();
const resolveAlbertApiKey = () => String(process.env.ALBERT_API_KEY || process.env.ALBERT_TOKEN || '').trim();
const resolveAlbertBaseUrl = () => String(process.env.ALBERT_API_BASE_URL || 'https://albert.api.etalab.gouv.fr').trim().replace(/\/$/, '');
let cachedAlbertModel = '';

const promptToText = (prompt) => Array.isArray(prompt)
    ? prompt.map((part) => String(part?.text || '')).join('\n\n').trim()
    : String(prompt || '').trim();

const pickAlbertModel = (models = []) => {
    const ids = (Array.isArray(models) ? models : [])
        .map((model) => String(model?.id || model?.name || '').trim())
        .filter(Boolean);
    return ids.find((id) => /chat|instruct|llama|mistral|qwen|gemma/i.test(id)) || ids[0] || '';
};

const resolveAlbertModel = async (apiKey, baseUrl) => {
    const explicit = String(process.env.ALBERT_MODEL || '').trim();
    if (explicit) return explicit;
    if (cachedAlbertModel) return cachedAlbertModel;
    const response = await fetch(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`ALBERT_MODELS_HTTP_${response.status}: ${errText.slice(0, 300)}`);
    }
    const data = await response.json();
    cachedAlbertModel = pickAlbertModel(data?.data || data?.models || data);
    if (!cachedAlbertModel) throw new Error('ALBERT_MODEL introuvable: aucun modele disponible.');
    return cachedAlbertModel;
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

    askOllamaServer: async (prompt, systemInstruction = "", requestOptions = {}) => {
        const baseUrl = String(process.env.OLLAMA_API_SERVER_URL || '').trim().replace(/\/$/, '');
        const apiKey = String(process.env.OLLAMA_API_KEY || '').trim();
        const defaultModel = String(process.env.OLLAMA_API_MODEL || 'llama3.1:8b').trim();
        const model = String(requestOptions.model || defaultModel).trim();
        if (!baseUrl || !apiKey || !model) return "";
        const userText = Array.isArray(prompt)
            ? prompt.map((p) => String(p?.text || '')).join('\n\n').trim()
            : String(prompt || '').trim();
        if (!userText) return "";
        try {
            requestOptions.onStatus?.({
                phase: 'request',
                model,
                message: `Modele IA utilise: ${model}`
            });
            const response = await fetch(`${baseUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: String(systemInstruction || '') },
                        { role: 'user', content: userText }
                    ],
                    options: {
                        temperature: Number(requestOptions.temperature ?? process.env.OLLAMA_API_TEMPERATURE ?? 0.2),
                        num_predict: Number(requestOptions.numPredict ?? process.env.OLLAMA_API_MAX_TOKENS ?? 220)
                    }
                })
            });
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`OLLAMA_SERVER_HTTP_${response.status}: ${errText.slice(0, 300)}`);
            }
            const data = await response.json();
            return String(data?.message?.content || '').trim();
        } catch (e) {
            console.error('AI Ollama Server Error:', e.message);
            if (requestOptions.model && model !== defaultModel && !requestOptions._fallbackTried) {
                console.warn(`AI Ollama Server: modele ${model} indisponible, repli sur ${defaultModel}`);
                requestOptions.onStatus?.({
                    phase: 'fallback',
                    model: defaultModel,
                    previousModel: model,
                    message: `Modele rapide indisponible, repli sur ${defaultModel}`
                });
                return AIEngine.askOllamaServer(prompt, systemInstruction, {
                    ...requestOptions,
                    model: defaultModel,
                    _fallbackTried: true
                });
            }
            return "";
        }
    },

    askOllamaServerStream: async (prompt, systemInstruction = "", onChunk = () => {}, requestOptions = {}) => {
        const baseUrl = String(process.env.OLLAMA_API_SERVER_URL || '').trim().replace(/\/$/, '');
        const apiKey = String(process.env.OLLAMA_API_KEY || '').trim();
        const defaultModel = String(process.env.OLLAMA_API_MODEL || 'llama3.1:8b').trim();
        const model = String(requestOptions.model || defaultModel).trim();
        const userText = promptToText(prompt);
        if (!baseUrl || !apiKey || !model || !userText) return '';

        const controller = new AbortController();
        const timeoutMs = Number(process.env.OLLAMA_API_TIMEOUT_MS || 120000);
        const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 120000);
        let complete = '';
        let buffer = '';
        try {
            requestOptions.onStatus?.({
                phase: 'request',
                model,
                message: `Modele IA utilise: ${model}`
            });
            const response = await fetch(`${baseUrl}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                signal: controller.signal,
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: String(systemInstruction || '') },
                        { role: 'user', content: userText }
                    ],
                    options: {
                        temperature: Number(requestOptions.temperature ?? process.env.OLLAMA_API_TEMPERATURE ?? 0.2),
                        num_predict: Number(requestOptions.numPredict ?? process.env.OLLAMA_API_MAX_TOKENS ?? 220)
                    }
                })
            });
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`OLLAMA_STREAM_HTTP_${response.status}: ${errText.slice(0, 300)}`);
            }
            for await (const chunk of response.body) {
                buffer += chunk.toString('utf8');
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const data = JSON.parse(line);
                    if (data.error) throw new Error(data.error);
                    const text = String(data?.message?.content || '');
                    if (text) {
                        complete += text;
                        onChunk(text);
                    }
                }
            }
            return complete.trim();
        } catch (error) {
            if (complete) throw error;
            if (requestOptions.model && model !== defaultModel && !requestOptions._fallbackTried) {
                console.warn(`AI Ollama streaming: modele ${model} indisponible, repli sur ${defaultModel}:`, error.message);
                requestOptions.onStatus?.({
                    phase: 'fallback',
                    model: defaultModel,
                    previousModel: model,
                    message: `Modele rapide indisponible, repli sur ${defaultModel}`
                });
                return AIEngine.askOllamaServerStream(prompt, systemInstruction, onChunk, {
                    ...requestOptions,
                    model: defaultModel,
                    _fallbackTried: true
                });
            }
            console.warn('AI Ollama streaming indisponible, repli sans streaming:', error.message);
            const fallback = await AIEngine.askOllamaServer(prompt, systemInstruction, requestOptions);
            if (fallback) onChunk(fallback);
            return fallback;
        } finally {
            clearTimeout(timeout);
        }
    },

    askAlbert: async (prompt, systemInstruction = "", options = {}) => {
        const apiKey = resolveAlbertApiKey();
        if (!apiKey) return "ERROR_KEY";
        const baseUrl = resolveAlbertBaseUrl();
        const userText = promptToText(prompt);
        if (!userText) return "";
        const controller = new AbortController();
        const timeoutMs = Number(process.env.ALBERT_API_TIMEOUT_MS || 60000);
        const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 60000);
        try {
            const model = await resolveAlbertModel(apiKey, baseUrl);
            options.onStatus?.({
                phase: 'request',
                model,
                message: `Connexion a Albert (${model})...`
            });
            const body = {
                model,
                messages: [
                    ...(String(systemInstruction || '').trim() ? [{ role: 'system', content: String(systemInstruction || '') }] : []),
                    { role: 'user', content: userText }
                ],
                temperature: Number(options?.temperature ?? process.env.ALBERT_API_TEMPERATURE ?? 0.2),
                max_tokens: Number(options?.maxOutputTokens ?? options?.numPredict ?? process.env.ALBERT_API_MAX_TOKENS ?? 900)
            };
            if (options?.responseMimeType === 'application/json') {
                body.response_format = { type: 'json_object' };
            }
            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`
                },
                signal: controller.signal,
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(`ALBERT_HTTP_${response.status}: ${errText.slice(0, 500)}`);
            }
            const data = await response.json();
            return String(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '').trim() || "[]";
        } catch (e) {
            console.error('AI Albert Error:', e.message);
            return "[]";
        } finally {
            clearTimeout(timeout);
        }
    },

    ask: async (prompt, systemInstruction = "", options = {}) => {
        const provider = String(process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
        if (provider === 'ollama_server') {
            return (await AIEngine.askOllamaServer(prompt, systemInstruction, options)) || "[]";
        }
        if (provider === 'albert') {
            return (await AIEngine.askAlbert(prompt, systemInstruction, options)) || "[]";
        }
        const useLocalFirst = provider === 'local' || provider === 'ollama';
        if (useLocalFirst) {
            const localText = await AIEngine.askLocal(prompt, systemInstruction);
            if (localText) return localText;
        }
        await assertAiWithinFreeTier({ teacherId: String(options?.teacherId || '').trim() });
        const apiKey = resolveGeminiApiKey();
        if (!apiKey) return "ERROR_KEY";

        const parts = Array.isArray(prompt) ? prompt : [{ text: prompt }];
        const model = resolveGeminiModel();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);
        
        try {
            const response = await fetch(url, { 
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ role: "user", parts: parts }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        temperature: Number(options?.temperature ?? 0.2),
                        maxOutputTokens: Number(options?.maxOutputTokens ?? options?.numPredict ?? 4096),
                        ...(Number.isFinite(Number(options?.thinkingBudget)) ? { thinkingConfig: { thinkingBudget: Number(options.thinkingBudget) } } : {}),
                        ...(options?.responseMimeType ? { responseMimeType: String(options.responseMimeType) } : {})
                    }
                }) 
            });
            clearTimeout(timeout);
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            const text = (data.candidates?.[0]?.content?.parts || [])
                .map((part) => String(part?.text || ''))
                .join('')
                .trim() || "[]";
            await logGeminiUsage({
                teacherId: String(options?.teacherId || '').trim(),
                source: 'central',
                model,
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
                model,
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
