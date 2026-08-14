const configuredBaseUrl = String(import.meta.env.VITE_GAMES_BASE_URL || '').trim();

const developmentBaseUrl = import.meta.env.DEV && typeof window !== 'undefined' ? window.location.origin : '';

// Les ressources des jeux vivent dans CONDAMINE-GAMES, y compris lorsque
// CondaWeb tourne sur localhost. L'origine locale ne doit servir de repli que
// si aucune URL de jeux n'est configurée.
export const GAMES_BASE_URL = (configuredBaseUrl || developmentBaseUrl || 'https://condamine-games.vercel.app').replace(/\/$/, '');

export const gameUrl = (path) => `${GAMES_BASE_URL}/${String(path || '').replace(/^\//, '')}`;
