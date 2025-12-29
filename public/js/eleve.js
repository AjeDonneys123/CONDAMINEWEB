// --- RESTAURATION DE LA LOGIQUE JEU AVANCÉE (SUB-BARS) ---

// Imports Jeux (Modules)
import { ZombieGame } from './games/ZombieGame.js';
import { RedactionGame } from './games/RedactionGame.js';
import { HomeworkGame } from './games/HomeworkGame.js';
import { StarshipGame } from './games/StarshipGame.js';
import { JumperGame } from './games/JumperGame.js';

const GameClasses = { "ZombieGame": ZombieGame, "RedactionGame": RedactionGame, "HomeworkGame": HomeworkGame, "StarshipGame": StarshipGame, "JumperGame": JumperGame };

export async function initStudentInterface() {
    console.log("🚀 Eleve Init (Advanced)");
    document.getElementById("chapterSelection").style.display = "block";
    document.getElementById("logoutBtn").style.display = "block";
    
    // BACKDOOR
    if(window.state.currentPlayerData.firstName === "Eleve" && window.state.currentPlayerData.lastName === "Test") {
        const btn = document.getElementById("backToProfBtn");
        btn.style.display = "block";
        btn.onclick = () => {
            localStorage.setItem("player", JSON.stringify({ id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" }));
            window.location.reload();
        };
    }

    // QUESTIONS
    const classKey = window.state.getClassKey(window.state.currentPlayerData.classroom);
    try {
        const res = await fetch(`questions/questions-${classKey}.json`);
        if(res.ok) window.state.allQuestionsData[classKey] = await res.json();
    } catch(e) {}
    
    document.querySelectorAll(".chapter-action-btn").forEach(b => b.disabled = false);
    document.getElementById("backToMenuBtn").onclick = () => window.location.reload();
    
    // MES FAUTES
    const btnMistakes = document.getElementById("myMistakesBtn");
    if(btnMistakes && window.state.currentPlayerData.id !== "prof") {
        btnMistakes.style.display = "block";
        btnMistakes.onclick = loadMistakes;
        document.getElementById("closeMistakesBtn").onclick = () => document.getElementById("mistakesModal").style.display = "none";
    }

    document.getElementById("pauseReportBtn").onclick = () => { window.state.isGlobalPaused = true; document.getElementById("bugModal").style.display="flex"; };
    document.getElementById("resumeGameBtn").onclick = () => { window.state.isGlobalPaused = false; document.getElementById("bugModal").style.display="none"; };
    document.getElementById("sendBugBtn").onclick = async () => {
        await window.api.reportBug({ reporterName: window.state.currentPlayerData.firstName, description: document.getElementById("bugDescription").value });
        alert("Envoyé !"); document.getElementById("bugModal").style.display="none"; window.state.isGlobalPaused = false;
    };

    const mainBar = document.getElementById("mainProgress");
    if (mainBar) {
        mainBar.onclick = () => {
            if (window.state.isRKeyDown && window.state.isTKeyDown) {
                window.state.general = window.state.levels[window.state.currentLevel].questions.length;
                updateBars(); nextQuestion(false);
            }
        };
    }
}

async function loadMistakes() {
    const list = document.getElementById("mistakesList");
    const modal = document.getElementById("mistakesModal");
    list.innerHTML = "Chargement...";
    modal.style.display = "flex";
    try {
        const res = await fetch(`/api/player-data/${window.state.currentPlayerId}`);
        const data = await res.json();
        const mistakes = data.spellingMistakes || [];
        if(mistakes.length === 0) list.innerHTML = "<p>Aucune faute !</p>";
        else {
            const html = mistakes.reverse().map(m => `
                <li class='spelling-item' style="margin-bottom:10px; border-bottom:1px solid #eee;">
                    <span class='wrong-word' style="color:red; text-decoration:line-through;">${m.wrong}</span> 👉 <span class='right-word' style="color:green; font-weight:bold;">${m.correct}</span>
                </li>`).join('');
            list.innerHTML = `<ul style="list-style:none; padding:0;">${html}</ul>`;
        }
    } catch(e) { list.innerHTML = "Erreur."; }
}

document.body.addEventListener('click', async (e) => {
    if (e.target.matches('.chapter-action-btn')) {
        const parent = e.target.closest('.chapter-box');
        const tmplId = parent.dataset.templateId;
        const gameClassStr = parent.dataset.gameClass;
        const chapterId = parent.dataset.chapter;

        document.getElementById("chapterSelection").style.display = 'none';
        document.getElementById("game").style.display = 'block';
        document.getElementById("backToMenuBtn").style.display = 'inline-block';
        const btnMistakes = document.getElementById("myMistakesBtn");
        if(btnMistakes) btnMistakes.style.display = 'none';

        const container = document.getElementById("gameModuleContainer");
        container.innerHTML = "";
        const tmpl = document.getElementById(tmplId);
        if(tmpl) container.appendChild(tmpl.content.cloneNode(true));

        window.state.isGameActive = true;
        window.state.locked = false;
        
        const controller = {
            notifyCorrectAnswer: () => incrementProgress(1),
            notifyWrongAnswer: (msg) => wrongAnswerFlow(msg),
            getState: () => ({ isLocked: window.state.locked })
        };

        const GameClass = GameClasses[gameClassStr];
        if(GameClass) {
            window.state.currentGameModuleInstance = new GameClass(container, controller);
            if (gameClassStr === "HomeworkGame") {
                document.getElementById("levelTitle").textContent = "Devoirs Maison";
                toggleUI(false);
                if(window.state.currentGameModuleInstance.loadHomeworks) window.state.currentGameModuleInstance.loadHomeworks();
            } else {
                toggleUI(true);
                const classKey = window.state.getClassKey(window.state.currentPlayerData.classroom);
                const allLevels = window.state.allQuestionsData[classKey] || [];
                window.state.levels = allLevels.filter(l => l.chapterId === chapterId);
                
                // Calcul niveau
                const validatedIds = (window.state.currentPlayerData.validatedLevels || []).map(v => (typeof v === 'string' ? v : v.levelId));
                let startLvl = window.state.levels.findIndex(l => !validatedIds.includes(l.id));
                if (startLvl === -1) startLvl = 0; 

                if(window.state.levels.length > 0) setupLevel(startLvl);
                else container.innerHTML = "<h3 style='text-align:center; margin-top:50px'>Pas de niveaux.</h3>";
            }
        }
    }
});

function toggleUI(show) {
    const disp = show ? "block" : "none";
    const flex = show ? "flex" : "none";
    document.getElementById("mainProgress").style.display = disp;
    document.getElementById("subBars").style.display = flex;
    document.getElementById("lives").style.display = flex;
}

// --- LOGIQUE BARRES ET PROGRESSION RESTAURÉE ---
function setupLevel(idx) {
    if(!window.state.levels[idx]) { document.getElementById("gameModuleContainer").innerHTML = "<h1>Terminé ! 🏆</h1>"; return; }
    window.state.currentLevel = idx;
    const lvl = window.state.levels[idx];
    document.getElementById("levelTitle").textContent = lvl.title;
    
    const btnL = document.getElementById("openLessonBtn");
    const txtL = document.getElementById("lessonText");
    if(lvl.lesson) { btnL.style.display = "block"; txtL.innerHTML = lvl.lesson; } 
    else { btnL.style.display = "none"; }

    window.state.localScores = new Array(lvl.questions.length).fill(0);
    window.state.general = 0; 
    window.state.currentIndex = -1; 
    window.state.lives = 4;
    renderLives();
    
    // RESTAURATION DES PETITES BARRES
    const sub = document.getElementById("subBars"); sub.innerHTML = "";
    lvl.questions.forEach((_, i) => {
        const d = document.createElement("div"); d.className = "subProgress";
        d.innerHTML = `<div class="subBar" id="subBar${i}"></div>`;
        d.onclick = () => {
            if (window.state.isGameActive && window.state.isRKeyDown && window.state.isTKeyDown) {
                window.state.currentIndex = i; 
                incrementProgress(1);
                loadActiveQuestion();
            }
        };
        sub.appendChild(d);
    });
    
    updateBars();
    nextQuestion(false);
}

function nextQuestion(keep) {
    window.state.locked = false;
    const lvl = window.state.levels[window.state.currentLevel];
    if(window.state.general >= lvl.questions.length) {
        saveProgress("level", lvl.id, "A");
        if(window.state.currentLevel < window.state.levels.length - 1) setTimeout(() => setupLevel(window.state.currentLevel + 1), 1500);
        else document.getElementById("gameModuleContainer").innerHTML = "<h1 style='text-align:center'>Bravo ! 👑</h1>";
        return;
    }
    
    let nextIdx = -1;
    const req = lvl.requiredPerQuestion || 3;
    for(let i=window.state.currentIndex+1; i<lvl.questions.length; i++) if(window.state.localScores[i] < req) { nextIdx = i; break; }
    if(nextIdx === -1) for(let i=0; i<=window.state.currentIndex; i++) if(window.state.localScores[i] < req) { nextIdx = i; break; }
    
    if(nextIdx !== -1) {
        window.state.currentIndex = nextIdx;
        loadActiveQuestion();
    }
}

function loadActiveQuestion() {
    if(!window.state.currentGameModuleInstance || !window.state.currentGameModuleInstance.loadQuestion) return;
    
    const lvl = window.state.levels[window.state.currentLevel];
    const q = lvl.questions[window.state.currentIndex];
    const score = window.state.localScores[window.state.currentIndex];
    const req = lvl.requiredPerQuestion || 3;
    
    const qToSend = JSON.parse(JSON.stringify(q));
    
    if (score >= req - 1) {
        console.log("🔥 DERNIER PALIER -> MODE TEXTE");
        delete qToSend.options; 
    }
    
    window.state.currentGameModuleInstance.loadQuestion(qToSend);
}

function incrementProgress(val) {
    const req = window.state.levels[window.state.currentLevel].requiredPerQuestion || 3;
    window.state.localScores[window.state.currentIndex] = Math.max(0, Math.min(req, window.state.localScores[window.state.currentIndex] + val));
    
    updateBars();

    if (window.state.localScores[window.state.currentIndex] >= req) { 
        window.state.general++; 
        setTimeout(() => nextQuestion(false), 1200); 
    } 
    else if (val > 0) {
        setTimeout(() => loadActiveQuestion(), 1000);
    }
}

function updateBars() {
    const req = window.state.levels[window.state.currentLevel].requiredPerQuestion || 3;
    window.state.localScores.forEach((score, i) => {
        const bar = document.getElementById(`subBar${i}`);
        if(bar) { 
            const pct = (score / req) * 100;
            bar.style.width = pct + "%"; 
            if(score >= req) bar.parentElement.classList.add("completed"); 
        }
    });
    document.getElementById("mainBar").style.width = (window.state.general / window.state.levels[window.state.currentLevel].questions.length * 100) + "%";
}

function renderLives() { document.getElementById("lives").innerHTML = "❤️❤️❤️❤️".substring(0, window.state.lives*2); }

function wrongAnswerFlow(msg) {
    window.state.lives--; 
    renderLives();
    
    const req = window.state.levels[window.state.currentLevel].requiredPerQuestion || 3;
    window.state.localScores[window.state.currentIndex] = Math.max(0, window.state.localScores[window.state.currentIndex] - 1);
    updateBars();

    if(window.state.lives <= 0) {
        document.getElementById("overlay").style.display = "flex";
    } else { 
        if(msg) { 
            document.getElementById("correctionText").textContent = msg; 
            document.getElementById("correctionOverlay").style.display = "flex"; 
        }
        setTimeout(() => loadActiveQuestion(), 1500);
    }
}

async function saveProgress(type, val, grade) {
    if(window.state.currentPlayerId && window.state.currentPlayerId !== "prof") {
        try {
            await fetch("/api/save-progress", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ playerId: window.state.currentPlayerId, progressType: type, value: val, grade: grade }) });
            if(type === "level") {
                if(!window.state.currentPlayerData.validatedLevels) window.state.currentPlayerData.validatedLevels = [];
                window.state.currentPlayerData.validatedLevels.push(val);
                localStorage.setItem("player", JSON.stringify(window.state.currentPlayerData));
            }
        } catch(e) {}
    }
}

document.getElementById("closeCorrectionBtn").onclick = () => { document.getElementById("correctionOverlay").style.display="none"; };
document.getElementById("restartBtn").onclick = () => { document.getElementById("overlay").style.display="none"; setupLevel(window.state.currentLevel); };