const required = (name) => {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`Variable obligatoire manquante: ${name}`);
    return value;
};

const positiveInteger = (name, fallback) => {
    const value = Number(process.env[name] || fallback);
    if (!Number.isInteger(value) || value < 1) throw new Error(`Variable invalide: ${name}`);
    return value;
};

const loadConfig = () => {
    const apiKey = required('API_KEY');
    if (apiKey.length < 32 || apiKey.includes('REMPLACER')) {
        throw new Error('API_KEY doit contenir au moins 32 caracteres aleatoires');
    }
    return {
        host: String(process.env.HOST || '0.0.0.0').trim(),
        port: positiveInteger('PORT', 8787),
        ollamaBaseUrl: String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim().replace(/\/$/, ''),
        defaultModel: String(process.env.DEFAULT_MODEL || 'llama3.1:8b').trim(),
        requestTimeoutMs: positiveInteger('REQUEST_TIMEOUT_MS', 120000),
        maxConcurrent: positiveInteger('MAX_CONCURRENT', 1),
        maxQueue: positiveInteger('MAX_QUEUE', 20),
        apiKey
    };
};

module.exports = { loadConfig };
