import { config } from './config.js';
import { clampPrompt } from './security.js';

const withTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

const callOllama = async (path, payload) => {
  const response = await withTimeout(`${config.ollamaBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OLLAMA_${response.status}: ${text.slice(0, 600)}`);
  }

  return response.json();
};

export const listModels = async () => {
  const response = await withTimeout(`${config.ollamaBaseUrl}/api/tags`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OLLAMA_TAGS_${response.status}: ${text.slice(0, 600)}`);
  }
  const data = await response.json();
  return Array.isArray(data?.models) ? data.models : [];
};

export const pingOllama = async () => {
  const startedAt = Date.now();
  const models = await listModels();

  return {
    ok: true,
    baseUrl: config.ollamaBaseUrl,
    defaultModel: config.defaultModel,
    models: models.map((model) => model.name).filter(Boolean),
    elapsedMs: Date.now() - startedAt
  };
};

export const chat = async ({
  messages = [],
  prompt = '',
  system = '',
  model = config.defaultModel,
  temperature = 0.3,
  maxTokens = config.maxOutputTokens
} = {}) => {
  const normalizedMessages = Array.isArray(messages) && messages.length
    ? messages
    : [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt }
      ];

  const cleanMessages = normalizedMessages
    .map((message) => ({
      role: ['system', 'assistant', 'user'].includes(message?.role) ? message.role : 'user',
      content: clampPrompt(message?.content)
    }))
    .filter((message) => message.content);

  if (!cleanMessages.length) {
    throw new Error('EMPTY_PROMPT');
  }

  const startedAt = Date.now();
  const data = await callOllama('/api/chat', {
    model: String(model || config.defaultModel).trim(),
    stream: false,
    messages: cleanMessages,
    options: {
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.3,
      num_predict: Math.min(Number(maxTokens) || config.maxOutputTokens, config.maxOutputTokens)
    }
  });

  return {
    ok: true,
    provider: 'ollama',
    model: data?.model || model || config.defaultModel,
    text: String(data?.message?.content || '').trim(),
    message: data?.message || null,
    elapsedMs: Date.now() - startedAt
  };
};

export const generate = async ({
  prompt = '',
  system = '',
  model = config.defaultModel,
  temperature = 0.3,
  maxTokens = config.maxOutputTokens
} = {}) => {
  const cleanPrompt = clampPrompt(prompt);
  if (!cleanPrompt) {
    throw new Error('EMPTY_PROMPT');
  }

  const startedAt = Date.now();
  const data = await callOllama('/api/generate', {
    model: String(model || config.defaultModel).trim(),
    stream: false,
    prompt: cleanPrompt,
    system: clampPrompt(system),
    options: {
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.3,
      num_predict: Math.min(Number(maxTokens) || config.maxOutputTokens, config.maxOutputTokens)
    }
  });

  return {
    ok: true,
    provider: 'ollama',
    model: data?.model || model || config.defaultModel,
    text: String(data?.response || '').trim(),
    elapsedMs: Date.now() - startedAt
  };
};
