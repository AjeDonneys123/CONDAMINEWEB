const configuredBaseUrl = String(import.meta.env.VITE_GAMES_BASE_URL || '').trim();

const developmentBaseUrl = import.meta.env.DEV && typeof window !== 'undefined' ? window.location.origin : '';

export const GAMES_BASE_URL = (developmentBaseUrl || configuredBaseUrl || 'https://condamine-games.vercel.app').replace(/\/$/, '');

export const gameUrl = (path) => `${GAMES_BASE_URL}/${String(path || '').replace(/^\//, '')}`;
