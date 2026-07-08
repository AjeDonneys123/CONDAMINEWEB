import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const config = {
  port: numberFromEnv('PORT', 8787),
  host: String(process.env.HOST || '0.0.0.0').trim(),
  ollamaBaseUrl: String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
  defaultModel: String(process.env.DEFAULT_MODEL || 'llama3.1:8b').trim(),
  apiKey: String(process.env.API_KEY || '').trim(),
  allowedOrigins: String(process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxPromptChars: numberFromEnv('MAX_PROMPT_CHARS', 12000),
  maxOutputTokens: numberFromEnv('MAX_OUTPUT_TOKENS', 900),
  requestTimeoutMs: numberFromEnv('REQUEST_TIMEOUT_MS', 120000)
};
