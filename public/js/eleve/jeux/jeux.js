import { ZombieGame } from '../games/ZombieGame.js';

export async function initJeuxModule(container) {
    container.innerHTML = `
        <div class="card">
            <h3>🎮 Mes Mini-Jeux</h3>
            <div class="chapter-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
                <div class="chapter-box card" id="launch-zombie" style="cursor:pointer; border-left:5px solid var(--primary);">
                    <h3>🧟 Chapitre 1</h3>
                    <p>L’Attaque des Zombies</p>
                    <button class="action-btn">JOUER</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("launch-zombie").onclick = () => startMiniGame("ZombieGame", "ch1-zombie");
}

async function startMiniGame(type, chapterId) {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = `<div class="card"><h2 id="levelTitle" style="text-align:center;">Chargement...</h2><div id="mainProgress"><div id="mainBar"></div></div><div id="subBars" style="display:flex; gap:5px; height:10px; margin-bottom:15px;"></div><div id="lives" style="text-align:center; font-size:1.5rem; margin-bottom:10px;"></div><div id="game-container"></div><button onclick="window.location.reload()" class="action-btn" style="margin-top:20px; background:#eee; color:black;">← Retour au menu</button></div>`;

    const classKey = window.state.getClassKey(window.state.user.classroom);
    const res = await window.api.get(`/api/game-levels/${classKey}`);
    const levels = (res || []).filter(l => l.chapterId === chapterId);

    const controller = {
        setupUI: (total) => {
            const sub = document.getElementById("subBars"); sub.innerHTML = "";
            for(let i=0; i<total; i++) { sub.innerHTML += `<div class="subProgress"><div class="subBar" id="subBar-${i}"></div></div>`; }
        },
        updateProgress: (current, total, idx) => {
            document.getElementById("mainBar").style.width = (current / total * 100) + "%";
            const sb = document.querySelector(`#subBar-${idx}`); if(sb) sb.parentElement.classList.add("completed");
        },
        updateLives: (lives) => { document.getElementById("lives").innerHTML = "❤️".repeat(lives); },
        setLesson: (html) => { /* ... */ },
        gameOver: () => { alert("Perdu !"); window.location.reload(); },
        levelComplete: () => { alert("👑 Gagné !"); window.location.reload(); }
    };

    if (type === "ZombieGame") new ZombieGame(document.getElementById("game-container"), levels, controller);
}


