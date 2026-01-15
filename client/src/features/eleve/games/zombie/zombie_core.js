import { GameProgression } from '../mainGames';
export function initZombieGame(root, api, onExit) {
    root.innerHTML = `<div class="z-arena">🧟</div>`;
    return { destroy: () => {} };
}