import { GameProgression } from '../mainGames';
export function initStarshipGame(root, api, onExit) {
    root.innerHTML = `<div class="s-arena" id="s-arena"><div class="s-ship" id="s-ship">🚀</div></div>`;
    const ship = root.querySelector('#s-ship');
    let x = 50;
    const move = (e) => { if(e.key === 'ArrowLeft') x-=5; if(e.key === 'ArrowRight') x+=5; ship.style.left = x + '%'; };
    document.addEventListener('keydown', move);
    return { destroy: () => document.removeEventListener('keydown', move) };
}