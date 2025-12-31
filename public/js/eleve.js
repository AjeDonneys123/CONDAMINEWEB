import { ZombieGame } from './games/ZombieGame.js';
import { RedactionGame } from './games/RedactionGame.js';
import { HomeworkGame } from './games/HomeworkGame.js';
import { StarshipGame } from './games/StarshipGame.js';
import { JumperGame } from './games/JumperGame.js';

const GameClasses = { ZombieGame, RedactionGame, HomeworkGame, StarshipGame, JumperGame };

export async function initStudentInterface() {
    console.log("🚀 Lancement Interface Eleve");
    document.getElementById("chapterSelection").style.display = "block";
    document.getElementById("logoutBtn").style.display = "block";
    
    // Charger les questions de la classe depuis la BDD
    const classKey = window.state.getClassKey(window.state.currentPlayerData.classroom); 
    const res = await window.api.get(`/api/game-levels/${classKey}`);
    if(res) window.state.allQuestionsData[classKey] = res;

    // Carnet de fautes
    const btnMistakes = document.getElementById("myMistakesBtn");
    btnMistakes.style.display = "block";
    btnMistakes.onclick = loadMistakes;
    document.getElementById("closeMistakesBtn").onclick = () => document.getElementById("mistakesModal").style.display = "none";
    
    document.getElementById("backToMenuBtn").onclick = () => window.location.reload();
}

async function loadMistakes() {
    const listContainer = document.getElementById("mistakesList");
    const modal = document.getElementById("mistakesModal");
    listContainer.innerHTML = "<p>Chargement du carnet...</p>";
    modal.style.display = "flex";

    try {
        const res = await fetch(`/api/player-data/${window.state.currentPlayerId}`);
        const data = await res.json();
        const mistakes = data.spellingMistakes || [];

        if (mistakes.length === 0) {
            listContainer.innerHTML = "<div style='padding:20px; text-align:center;'>🎉 Aucune faute !</div>";
        } else {
            let html = `
                <table class="correction-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom:2px solid #eee;">
                            <th style="padding:10px; text-align:left;">Mot</th>
                            <th style="padding:10px; text-align:left;">Correction</th>
                            <th style="padding:10px; text-align:left;">Explication</th>
                            <th style="padding:10px; text-align:center;"></th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            mistakes.reverse().forEach((m, index) => {
                const realIndex = mistakes.length - 1 - index;
                html += `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px;"><span class="wrong-word">${m.wrong}</span></td>
                        <td style="padding:10px;"><span class="right-word">${m.correct}</span></td>
                        <td style="padding:10px; font-size:0.85em; color:#475569;">${m.reason || "Usage"}</td>
                        <td style="padding:10px; text-align:center;">
                            <button onclick="window.deleteMistakeFromServer(${realIndex})" style="background:#fee2e2; color:#dc2626; border:none; border-radius:50%; width:25px; height:25px; cursor:pointer;">✕</button>
                        </td>
                    </tr>`;
            });
            html += `</tbody></table>`;
            listContainer.innerHTML = html;
        }
    } catch (e) { listContainer.innerHTML = "Erreur de chargement."; }
}

window.deleteMistakeFromServer = async (idx) => {
    if(!confirm("Supprimer cette faute ?")) return;
    const res = await fetch('/api/delete-mistake', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ playerId: window.state.currentPlayerId, mistakeIndex: idx })
    });
    if(res.ok) loadMistakes();
};

document.body.addEventListener('click', async (e) => {
    if (e.target.matches('.chapter-action-btn')) {
        const parent = e.target.closest('.chapter-box');
        const gameClassStr = parent.dataset.gameClass;
        const chapterId = parent.dataset.chapter;
        const tmplId = parent.dataset.templateId;

        document.getElementById("chapterSelection").style.display = 'none';
        document.getElementById("game").style.display = 'block';
        document.getElementById("backToMenuBtn").style.display = 'inline-block';

        const container = document.getElementById("gameModuleContainer");
        container.innerHTML = "";
        container.appendChild(document.getElementById(tmplId).content.cloneNode(true));

        const controller = {
            notifyCorrectAnswer: () => window.incrementProgress(1),
            notifyWrongAnswer: (msg) => window.wrongAnswerFlow(msg),
            getState: () => ({ isLocked: false })
        };

        window.state.currentGameModuleInstance = new GameClasses[gameClassStr](container, controller);
        
        if (gameClassStr === "HomeworkGame") {
            window.state.currentGameModuleInstance.loadHomeworks();
        } else {
            const classKey = window.state.getClassKey(window.state.currentPlayerData.classroom);
            window.state.levels = (window.state.allQuestionsData[classKey] || []).filter(l => l.chapterId === chapterId);
            if(window.state.levels.length) setupLevel(0);
            else container.innerHTML = "Pas de niveaux pour ce chapitre.";
        }
    }
});

function setupLevel(idx) {
    window.state.currentLevel = idx;
    const lvl = window.state.levels[idx];
    document.getElementById("levelTitle").textContent = lvl.title;
    window.state.general = 0; window.state.currentIndex = 0; window.state.lives = 4;
    document.getElementById("lives").innerHTML = "❤️".repeat(4);
    document.getElementById("mainBar").style.width = "0%";
    loadActiveQuestion();
}

function loadActiveQuestion() {
    const q = window.state.levels[window.state.currentLevel].questions[window.state.currentIndex];
    window.state.currentGameModuleInstance.loadQuestion(q);
}

window.incrementProgress = (val) => {
    window.state.general++;
    const total = window.state.levels[window.state.currentLevel].questions.length;
    document.getElementById("mainBar").style.width = (window.state.general / total * 100) + "%";
    
    if(window.state.general >= total) {
        alert("Niveau terminé !");
        window.location.reload();
    } else {
        window.state.currentIndex++;
        setTimeout(() => loadActiveQuestion(), 1000);
    }
};

window.wrongAnswerFlow = (msg) => {
    window.state.lives--;
    document.getElementById("lives").innerHTML = "❤️".repeat(window.state.lives);
    if(window.state.lives <= 0) {
        alert("Perdu ! Recommence le niveau.");
        window.location.reload();
    }
};