import { GameProgression } from '../mainGames';

/**
 * MOTEUR ZOMBIE V6 - ARCHITECTURE NETTOYÉE
 * Utilise mainGames.js pour la logique. Ne gère que l'affichage.
 */
export function initZombieGame(rootElement, apiData, onExit) {
    
    // 1. HTML (Visuel uniquement)
    rootElement.innerHTML = `
        <div class="z-top-hud">
            <div class="z-hearts" id="v-hearts">❤️❤️❤️❤️</div>
            <div class="z-global-progress"><div class="z-global-bar-fill" id="v-bar"></div></div>
            <div class="z-questions-tracker" id="v-tracker"></div>
        </div>
        <div class="z-arena">
            <div class="sprite hero">👮‍♂️</div>
            <div class="sprite zombie" id="v-zombie">🧟</div>
            <div class="sprite projectile" id="v-proj">🔥</div>
        </div>
        <div class="z-hud-bottom">
            <div class="z-question-box" id="v-q-text">Chargement...</div>
            <div class="z-options-container" id="v-options"></div>
            <div class="z-input-container" id="v-input-area">
                <input type="text" id="v-input" placeholder="Écris la réponse..." autocomplete="off">
                <button class="z-btn-check" id="v-btn-check">VALIDER</button>
            </div>
        </div>
        <div class="z-overlay" id="v-overlay">
            <h2 id="v-title">FIN</h2>
            <p id="v-msg">...</p>
            <button class="z-btn-restart" id="v-btn-action">Continuer</button>
        </div>
        <button style="position:absolute; top:70px; right:10px; background:#ef4444; color:white; border:none; width:30px; height:30px; border-radius:50%; font-weight:bold; cursor:pointer; z-index:50;" id="v-quit">✕</button>
    `;

    // 2. DOM REFS
    const zombieEl = rootElement.querySelector('#v-zombie');
    const projEl = rootElement.querySelector('#v-proj');
    const qTextEl = rootElement.querySelector('#v-q-text');
    const optionsEl = rootElement.querySelector('#v-options');
    const inputArea = rootElement.querySelector('#v-input-area');
    const inputEl = rootElement.querySelector('#v-input');
    const checkBtn = rootElement.querySelector('#v-btn-check');
    const overlayEl = rootElement.querySelector('#v-overlay');
    const heartsEl = rootElement.querySelector('#v-hearts');
    const trackerEl = rootElement.querySelector('#v-tracker');
    const barEl = rootElement.querySelector('#v-bar');
    const arenaEl = rootElement.querySelector('.z-arena');
    const quitBtn = rootElement.querySelector('#v-quit');
    const titleEl = rootElement.querySelector('#v-title');
    const msgEl = rootElement.querySelector('#v-msg');
    const actionBtn = rootElement.querySelector('#v-btn-action');

    // 3. ENGINE
    let game = null; // Instance de GameProgression
    let currentQ = null;
    let currentIdx = 0;
    
    // État visuel
    let zX = 0;
    let isPaused = false;
    let gameLoopId = null;
    let projInterval = null;

    async function init() {
        try {
            const res = await fetch('/api/game-levels/all');
            const data = await res.json();
            const zLevel = data.find(l => l.chapterId === 'ch1-zombie');
            
            if (zLevel && zLevel.questions.length > 0) {
                // INSTANCIATION DU CERVEAU COMMUN
                game = new GameProgression(zLevel.questions);
                updateUI();
                loadRound();
            } else { gameOver("Aucun niveau.", true); }
        } catch(e) { console.error(e); gameOver("Erreur connexion.", true); }
    }

    function updateUI() {
        const data = game.getTrackerData();
        trackerEl.innerHTML = '';
        
        data.dots.forEach((d, i) => {
            const dot = document.createElement('div');
            dot.className = `z-q-dot ${i === currentIdx ? 'active' : ''} ${d.done ? 'done' : ''}`;
            const fill = document.createElement('div');
            fill.className = 'z-q-dot-fill';
            fill.style.height = `${d.pct}%`;
            dot.appendChild(fill);
            trackerEl.appendChild(dot);
        });

        barEl.style.width = `${data.globalPct}%`;
        heartsEl.textContent = "❤️".repeat(game.getLives());
    }

    function loadRound() {
        const next = game.getNextActiveQuestion();
        
        if (!next) { gameOver("VICTOIRE TOTALE !", true); return; }

        currentQ = next.q;
        currentIdx = next.idx;
        const currentLevel = next.level;

        qTextEl.textContent = currentQ.q;
        zombieEl.innerHTML = "🧟";
        zX = 20; 
        zombieEl.style.right = '20px';
        isPaused = false;

        updateUI();
        startLoop();

        // CHOIX INTERFACE (QCM vs INPUT)
        if (currentLevel < 2) {
            optionsEl.style.display = 'grid';
            inputArea.style.display = 'none';
            optionsEl.innerHTML = '';
            
            currentQ.options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'z-btn';
                btn.textContent = opt;
                btn.onclick = () => handleAttempt(idx, btn); // idx pour QCM
                optionsEl.appendChild(btn);
            });
        } else {
            optionsEl.style.display = 'none';
            inputArea.style.display = 'flex';
            inputEl.value = '';
            inputEl.placeholder = "Écris la réponse...";
            
            // Nettoyage listeners
            checkBtn.onclick = null;
            inputEl.onkeydown = null;

            const validate = () => handleAttempt(inputEl.value, checkBtn);
            checkBtn.onclick = validate;
            inputEl.onkeydown = (e) => { if(e.key === "Enter") validate(); };
            
            setTimeout(() => inputEl.focus(), 100);
        }
    }

    function handleAttempt(answer, btnElement) {
        if (isPaused) return;

        // APPEL AU CERVEAU
        const result = game.submitAnswer(currentIdx, answer);

        if (result.success) {
            isPaused = true;
            if(btnElement) btnElement.classList.add('correct');
            shootAndKill();
        } else {
            if(btnElement) {
                btnElement.classList.add('wrong');
                setTimeout(() => btnElement.classList.remove('wrong'), 500);
            }
            
            // Punition visuelle
            zX += 60; 
            zombieEl.style.right = zX + 'px';
            
            updateUI(); // Met à jour les barres (qui descendent)

            // SI ON ÉTAIT AU NIVEAU 2 ET QU'ON TOMBE À 1 -> RECHARGER UI
            if (result.oldLevel >= 2 && result.newLevel < 2) {
                setTimeout(loadRound, 800);
            }
        }
    }

    // --- PHYSIQUE (COPIER-COLLER CLASSIQUE) ---
    function startLoop() {
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        function loop() {
            if (!isPaused) {
                zX += 1.2; 
                zombieEl.style.right = zX + 'px';
                const arenaW = arenaEl.offsetWidth;
                if ((arenaW - zX) < 100) { playerHit(); return; }
            }
            gameLoopId = requestAnimationFrame(loop);
        }
        loop();
    }

    function shootAndKill() {
        let pX = 80;
        projEl.style.left = pX + 'px';
        projEl.style.display = 'block';
        if(projInterval) clearInterval(projInterval);
        
        projInterval = setInterval(() => {
            pX += 25;
            projEl.style.left = pX + 'px';
            const arenaW = arenaEl.offsetWidth;
            if (pX >= (arenaW - zX - 50)) {
                clearInterval(projInterval);
                projEl.style.display = 'none';
                zombieEl.innerHTML = "💥";
                setTimeout(loadRound, 1000);
            }
        }, 16);
    }

    function playerHit() {
        isPaused = true;
        // APPEL AU CERVEAU POUR LA VIE
        const status = game.loseLife(currentIdx);
        
        updateUI(); // Affiche cœurs et barres

        if (status.isDead) {
            gameOver("TU ES MORT !", false);
        } else {
            zX = 20; zombieEl.style.right = '20px';
            setTimeout(() => {
                // Si on a perdu un niveau critique, on recharge
                if (status.newLevel < 2 && optionsEl.style.display === 'none') {
                    loadRound();
                } else {
                    isPaused = false; 
                    startLoop();
                }
            }, 1000);
        }
    }

    function gameOver(msg, isWin) {
        isPaused = true;
        overlayEl.style.display = 'flex';
        titleEl.textContent = isWin ? "BRAVO" : "PERDU";
        msgEl.textContent = msg;
        actionBtn.textContent = isWin ? "Quitter" : "Réessayer";
        actionBtn.onclick = () => {
            if (isWin) { destroy(); onExit(); }
            else { init(); overlayEl.style.display = 'none'; }
        };
    }

    quitBtn.onclick = () => { destroy(); onExit(); };

    function destroy() {
        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        if(projInterval) clearInterval(projInterval);
        rootElement.innerHTML = '';
    }

    init();
    return { destroy };
}