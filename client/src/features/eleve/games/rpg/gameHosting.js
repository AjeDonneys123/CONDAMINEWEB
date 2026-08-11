const configuredBaseUrl = String(import.meta.env.VITE_GAMES_BASE_URL || '').trim();

export const GAMES_BASE_URL = (configuredBaseUrl || 'https://condamine-games.vercel.app').replace(/\/$/, '');

export const gameUrl = (path) => `${GAMES_BASE_URL}/${String(path || '').replace(/^\//, '')}`;
