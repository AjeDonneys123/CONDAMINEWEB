require('dotenv').config();

const { createApp } = require('./app');
const { loadConfig } = require('./config');

const config = loadConfig();
const server = createApp(config).listen(config.port, config.host, () => {
    console.log(`Condamine Ollama API ecoute sur http://${config.host}:${config.port}`);
});

const shutdown = (signal) => {
    console.log(`${signal}: arret du serveur`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
