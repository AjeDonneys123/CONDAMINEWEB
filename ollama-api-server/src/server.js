require('dotenv').config();

const { createApp } = require('./app');
const { loadConfig } = require('./config');

const config = loadConfig();
const server = createApp(config).listen(config.port, config.host, () => {
    console.log(`Condamine Ollama API ecoute sur http://${config.host}:${config.port}`);
});

const warmModel = async (model = config.defaultModel, reason = 'warmup') => {
    try {
        const startedAt = Date.now();
        const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                stream: false,
                keep_alive: '30m',
                messages: [
                    { role: 'user', content: 'ping' }
                ],
                options: {
                    temperature: 0,
                    num_predict: 1
                }
            })
        });
        console.log(`Ollama ${reason} ${model}: ${response.ok ? 'pret' : `HTTP ${response.status}`} (${Date.now() - startedAt}ms)`);
    } catch (error) {
        console.warn(`Ollama ${reason} ${model}: echec (${error.message})`);
    }
};

const warmConfiguredModels = (reason = 'warmup') => {
    const models = [...new Set([config.defaultModel, config.fastModel].filter(Boolean))];
    models.forEach((model) => warmModel(model, reason));
};

setTimeout(() => warmConfiguredModels('warmup'), 1000).unref();
setInterval(() => warmConfiguredModels('keepalive'), 15 * 60 * 1000).unref();

const shutdown = (signal) => {
    console.log(`${signal}: arret du serveur`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
