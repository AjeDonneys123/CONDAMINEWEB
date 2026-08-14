const configuredBaseUrl = String(import.meta.env.VITE_GAMES_BASE_URL || '').trim();

// Les ressources vivent toujours dans CONDAMINE-GAMES. Utiliser l'origine de
// CondaWeb en développement rechargeait l'application dans l'iframe et
// affichait un écran gris à la place du jeu.
export const GAMES_BASE_URL = (configuredBaseUrl || 'https://condamine-games.vercel.app').replace(/\/$/, '');

export const gameUrl = (path) => `${GAMES_BASE_URL}/${String(path || '').replace(/^\//, '')}`;
