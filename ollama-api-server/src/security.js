import cors from 'cors';
import express from 'express';
import { config } from './config.js';

export const jsonBodyParser = express.json({
  limit: '2mb'
});

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origine non autorisée: ${origin}`));
  }
});

export const requireApiKey = (req, res, next) => {
  if (!config.apiKey) {
    next();
    return;
  }

  const headerKey = String(req.get('x-api-key') || '').trim();
  const bearer = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

  if (headerKey === config.apiKey || bearer === config.apiKey) {
    next();
    return;
  }

  res.status(401).json({
    ok: false,
    error: 'UNAUTHORIZED',
    message: 'Clé API manquante ou invalide.'
  });
};

export const clampPrompt = (value) => {
  const text = String(value || '').trim();
  if (text.length <= config.maxPromptChars) return text;
  return text.slice(0, config.maxPromptChars);
};

export const asyncRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};
