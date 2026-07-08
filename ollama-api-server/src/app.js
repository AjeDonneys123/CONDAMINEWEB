const crypto = require('crypto');
const express = require('express');

const safeEqual = (left, right) => {
    const a = Buffer.from(String(left || ''));
    const b = Buffer.from(String(right || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const createQueue = ({ maxConcurrent, maxQueue }) => {
    let active = 0;
    const waiting = [];

    const drain = () => {
        while (active < maxConcurrent && waiting.length) {
            active += 1;
            const next = waiting.shift();
            Promise.resolve()
                .then(next.task)
                .then(next.resolve, next.reject)
                .finally(() => {
                    active -= 1;
                    drain();
                });
        }
    };

    return (task) => new Promise((resolve, reject) => {
        if (waiting.length >= maxQueue && active >= maxConcurrent) {
            const error = new Error('QUEUE_FULL');
            error.status = 503;
            reject(error);
            return;
        }
        waiting.push({ task, resolve, reject });
        drain();
    });
};

const createApp = (config, dependencies = {}) => {
    const app = express();
    const fetchImpl = dependencies.fetch || global.fetch;
    const enqueue = createQueue(config);

    app.disable('x-powered-by');
    app.use(express.json({ limit: '1mb' }));

    app.get('/health', async (_req, res) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetchImpl(`${config.ollamaBaseUrl}/api/tags`, {
                signal: controller.signal
            });
            res.status(response.ok ? 200 : 503).json({
                ok: response.ok,
                service: 'condamine-ollama-api',
                ollama: response.ok ? 'ready' : 'unavailable',
                model: config.defaultModel
            });
        } catch (_error) {
            res.status(503).json({
                ok: false,
                service: 'condamine-ollama-api',
                ollama: 'unavailable',
                model: config.defaultModel
            });
        } finally {
            clearTimeout(timer);
        }
    });

    app.use((req, res, next) => {
        const bearer = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
        const suppliedKey = req.get('x-api-key') || bearer;
        if (!safeEqual(suppliedKey, config.apiKey)) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }
        next();
    });

    app.post('/chat', async (req, res) => {
        const messages = req.body?.messages;
        const model = String(req.body?.model || config.defaultModel).trim();
        if (!Array.isArray(messages) || !messages.length || !model) {
            res.status(400).json({ error: 'INVALID_REQUEST' });
            return;
        }

        try {
            const data = await enqueue(async () => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
                try {
                    const response = await fetchImpl(`${config.ollamaBaseUrl}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal,
                        body: JSON.stringify({
                            model,
                            stream: false,
                            keep_alive: '30m',
                            messages,
                            options: {
                                temperature: 0.3,
                                num_predict: 320,
                                ...(req.body?.options || {})
                            }
                        })
                    });
                    const body = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        const error = new Error(body?.error || `OLLAMA_HTTP_${response.status}`);
                        error.status = 502;
                        throw error;
                    }
                    return body;
                } finally {
                    clearTimeout(timer);
                }
            });
            res.json({ model: data.model || model, message: data.message, done: data.done });
        } catch (error) {
            const timedOut = error?.name === 'AbortError';
            res.status(error.status || (timedOut ? 504 : 502)).json({
                error: timedOut ? 'OLLAMA_TIMEOUT' : String(error.message || 'OLLAMA_UNAVAILABLE')
            });
        }
    });

    app.post('/chat/stream', async (req, res) => {
        const messages = req.body?.messages;
        const model = String(req.body?.model || config.defaultModel).trim();
        if (!Array.isArray(messages) || !messages.length || !model) {
            res.status(400).json({ error: 'INVALID_REQUEST' });
            return;
        }

        try {
            await enqueue(async () => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
                try {
                    const response = await fetchImpl(`${config.ollamaBaseUrl}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal,
                        body: JSON.stringify({
                            model,
                            stream: true,
                            keep_alive: '30m',
                            messages,
                            options: {
                                temperature: 0.2,
                                num_predict: 320,
                                ...(req.body?.options || {})
                            }
                        })
                    });
                    if (!response.ok) {
                        const detail = await response.text().catch(() => '');
                        const error = new Error(detail || `OLLAMA_HTTP_${response.status}`);
                        error.status = 502;
                        throw error;
                    }

                    res.status(200);
                    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-cache, no-transform');
                    res.setHeader('X-Accel-Buffering', 'no');
                    res.flushHeaders?.();
                    for await (const chunk of response.body) res.write(chunk);
                    res.end();
                } finally {
                    clearTimeout(timer);
                }
            });
        } catch (error) {
            const code = error?.name === 'AbortError' ? 'OLLAMA_TIMEOUT' : String(error.message || 'OLLAMA_UNAVAILABLE');
            if (!res.headersSent) res.status(error.status || 502).json({ error: code });
            else res.end(`${JSON.stringify({ error: code, done: true })}\n`);
        }
    });

    app.use((error, _req, res, _next) => {
        if (error?.type === 'entity.too.large') {
            res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
            return;
        }
        res.status(400).json({ error: 'INVALID_JSON' });
    });

    return app;
};

module.exports = { createApp };
