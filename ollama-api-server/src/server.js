import express from 'express';
import { config } from './config.js';
import { chat, generate, listModels, pingOllama } from './ollama.js';
import { asyncRoute, corsMiddleware, jsonBodyParser, requireApiKey } from './security.js';

const app = express();

app.disable('x-powered-by');
app.use(corsMiddleware);
app.use(jsonBodyParser);

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    name: 'condamine-ollama-api-server',
    routes: [
      'GET /health',
      'GET /api/models',
      'POST /api/chat',
      'POST /api/generate',
      'POST /v1/chat/completions'
    ]
  });
});

app.get('/health', asyncRoute(async (_req, res) => {
  res.json(await pingOllama());
}));

app.get('/api/models', requireApiKey, asyncRoute(async (_req, res) => {
  const models = await listModels();
  res.json({
    ok: true,
    models: models.map((model) => ({
      name: model.name,
      modifiedAt: model.modified_at,
      size: model.size
    }))
  });
}));

app.post('/api/chat', requireApiKey, asyncRoute(async (req, res) => {
  const result = await chat(req.body || {});
  res.json(result);
}));

app.post('/api/generate', requireApiKey, asyncRoute(async (req, res) => {
  const result = await generate(req.body || {});
  res.json(result);
}));

app.post('/v1/chat/completions', requireApiKey, asyncRoute(async (req, res) => {
  if (req.body?.stream) {
    res.status(400).json({
      error: {
        message: 'Le streaming n’est pas encore activé sur ce serveur.',
        type: 'unsupported_stream'
      }
    });
    return;
  }

  const result = await chat({
    model: req.body?.model,
    messages: req.body?.messages,
    temperature: req.body?.temperature,
    maxTokens: req.body?.max_tokens
  });

  res.json({
    id: `chatcmpl-local-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: result.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: result.text
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  });
}));

app.use((error, _req, res, _next) => {
  const message = String(error?.message || 'SERVER_ERROR');
  const status = message === 'EMPTY_PROMPT' ? 400 : 502;

  res.status(status).json({
    ok: false,
    error: message,
    message: status === 502
      ? 'Le serveur API fonctionne, mais Ollama ne répond pas correctement.'
      : 'La requête envoyée au serveur IA est vide ou invalide.'
  });
});

app.listen(config.port, config.host, () => {
  console.log(`Condamine Ollama API prête sur http://${config.host}:${config.port}`);
  console.log(`Ollama cible: ${config.ollamaBaseUrl}`);
  console.log(`Modèle par défaut: ${config.defaultModel}`);
});
