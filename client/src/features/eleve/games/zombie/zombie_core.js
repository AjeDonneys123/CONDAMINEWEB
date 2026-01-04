/* MOTEUR ZOMBIE V8 - FIX SORTIE PROPRE */
import { GameProgression } from '../mainGames';

export function initZombieGame(rootElement, apiData, onExit) {
    
    // 1. HTML
    rootElement.innerHTML = `
        <div class="z-top-hud"><div class="z-hearts" id="v-hearts">❤️❤️❤️❤️</div><div class="z-global-progress"><div class="z-global-bar-fill" id="v-bar"></div></div><div class="z-questions-tracker" id="v-tracker"></div></div>
        <div class="z-arena"><div class="sprite hero">👮‍♂️</div><div class="sprite zombie" id="v-zombie">🧟</div><div class="sprite projectile" id="v-proj">🔥</div></div>
        <div class="z-hud-bottom"><div class="z-question-box" id="v-q-text">Chargement...</div><div class="z-options-container" id="v-options"></div><div class="z-input-container" id="v-input-area"><input type="text" id="v-input" placeholder="Réponse..." autocomplete="off"><button class="z-btn-check" id="v-btn-check">VALIDER</button></div></div>
        <div class="z-overlay" id="v-overlay"><h2 id="v-title">FIN</h2><p id="v-msg">...</p><button class="z-btn-restart" id="v-btn-action">Continuer</button></div>
        <button style="position:absolute; top:70px; right:10px; background:#ef4444; color:white; border:none; width:30px; height:30px; border-radius:50%; font-weight:bold; cursor:pointer; z-index:50;" id="v-quit">✕</button>
    `;

    // 2. REFS
    const uiRefs = {
        zombie: rootElement.querySelector('#v-zombie'),
        proj: rootElement.querySelector('#v-proj'),
        qText: rootElement.querySelector('#v-q-text'),
        options: rootElement.querySelector('#v-options'),
        inputArea: rootElement.querySelector('#v-input-area'),
        input: rootElement.querySelector('#v-input'),
        checkBtn: rootElement.querySelector('#v-btn-check'),
        overlay: rootElement.querySelector('#v-overlay'),
        hearts: rootElement.querySelector('#v-hearts'),
        tracker: rootElement.querySelector('#v-tracker'),
        bar: rootElement.querySelector('#v-bar'),
        arena: rootElement.querySelector('.z-arena'),
        quit: rootElement.querySelector('#v-quit'),
        title: rootElement.querySelector('#v-title'),
        msg: rootElement.querySelector('#v-msg'),
        action: rootElement.querySelector('#v-btn-action')
    };

    // 3. STATE
    let game = null;
    let currentIdx = 0;
    let zX = 0;
    let isPaused = false;
    let gameLoopId = null;
    let projInterval = null;

    function init() {
        if (apiData.level && apiData.level.questions.length > 0) {
            game = new GameProgression(apiData.level.questions);
            updateUI();
            loadRound();
        } else { gameOver("Erreur niveau.", true); }
    }

    function updateUI() {
        const data = game.getTrackerData();
        uiRefs.tracker.innerHTML = '';
        data.dots.forEach((d, i) => {
            const dot = document.createElement('div');
            dot.className = `z-q-dot ${i === currentIdx ? 'active' : ''} ${d.done ? 'done' : ''}`;
            const fill = document.createElement('div'); fill.className = 'z-q-dot-fill'; fill.style.height = `${d.pct}%`;
            dot.appendChild(fill); uiRefs.tracker.appendChild(dot);
        });
        uiRefs.bar.style.width = `${data.globalPct}%`;
        uiRefs.hearts.textContent = "❤️".repeat(game.getLives());
    }

    function loadRound() {
        const next = game.getNextActiveQuestion();
        if (!next) { gameOver("VICTOIRE !", true); return; }
        
        currentIdx = next.idx; const q = next.q; const lvl = next.level;
        uiRefs.qText.textContent = q.q;
        uiRefs.zombie.innerHTML = "🧟"; 
        zX = 20; uiRefs.zombie.style.right = '20px';
        isPaused = false;
        
        updateUI(); 
        startLoop();

        if (lvl < 2) {
            uiRefs.options.style.display = 'grid'; uiRefs.inputArea.style.display = 'none'; uiRefs.options.innerHTML = '';
            q.options.forEach((opt, idx) => {
                const btn = document.createElement('button'); btn.className = 'z-btn'; btn.textContent = opt;
                btn.onclick = () => handleAttempt(idx, btn); uiRefs.options.appendChild(btn);
            });
        } else {
            uiRefs.options.style.display = 'none'; uiRefs.inputArea.style.display = 'flex';
            uiRefs.input.value = ''; uiRefs.input.placeholder = "Réponse...";
            uiRefs.checkBtn.onclick = null; uiRefs.input.onkeydown = null;
            const validate = () => handleAttempt(uiRefs.input.value, uiRefs.checkBtn);
            uiRefs.checkBtn.onclick = validate; uiRefs.input.onkeydown = (e) => { if(e.key==="Enter") validate(); };
            setTimeout(() => uiRefs.input.focus(), 100);
        }
    }

    function handleAttempt(ans, btn) {
        if (isPaused) return;
        const res = game.submitAnswer(currentIdx, ans);
        if (res.success) {
            isPaused = true; if(btn) btn.classList.add('correct'); shootAndKill();
        } else {
            if(btn) { btn.classList.add('wrong'); setTimeout(() => btn.classList.remove('wrong'), 500); }
            zX += 60; uiRefs.zombie.style.right = zX + 'px'; updateUI();
            if(res.oldLevel >= 2 && res.newLevel < 2) setTimeout(loadRound, 800);
        }
    }

    function startLoop() {
        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        function loop() {
            if(!isPaused) {
                zX += 1.2; uiRefs.zombie.style.right = zX + 'px';
                if((uiRefs.arena.offsetWidth - zX) < 100) { playerHit(); return; }
            }
            gameLoopId = requestAnimationFrame(loop);
        }
        loop();
    }

    function shootAndKill() {
        let pX = 80; uiRefs.proj.style.left = pX + 'px'; uiRefs.proj.style.display = 'block';
        if(projInterval) clearInterval(projInterval);
        projInterval = setInterval(() => {
            pX += 25; uiRefs.proj.style.left = pX + 'px';
            if(pX >= (uiRefs.arena.offsetWidth - zX - 50)) {
                clearInterval(projInterval); uiRefs.proj.style.display = 'none';
                uiRefs.zombie.innerHTML = "💥"; setTimeout(loadRound, 1000);
            }
        }, 16);
    }

    function playerHit() {
        isPaused = true; const s = game.loseLife(currentIdx); updateUI();
        if(s.isDead) gameOver("TU ES MORT !", false);
        else {
            zX = 20; uiRefs.zombie.style.right = '20px';
            setTimeout(() => { if(s.newLevel < 2 && uiRefs.options.style.display === 'none') loadRound(); else { isPaused = false; startLoop(); } }, 1000);
        }
    }

    // --- C'EST ICI LE CORRECTIF ---
    function gameOver(msg, isWin) {
        isPaused = true;
        uiRefs.overlay.style.display = 'flex';
        uiRefs.title.textContent = isWin ? "BRAVO" : "PERDU";
        uiRefs.msg.textContent = msg;
        uiRefs.action.textContent = isWin ? "Quitter" : "Réessayer";
        
        uiRefs.action.onclick = () => {
            if (isWin) {
                // 1. On vide tout D'ABORD
                destroy();
                // 2. On attend un tout petit peu pour que React soit prêt à switcher
                setTimeout(() => {
                    onExit(); 
                }, 50);
            } else {
                init(); uiRefs.overlay.style.display = 'none';
            }
        };
    }

    uiRefs.quit.onclick = () => { destroy(); setTimeout(onExit, 50); };

    function destroy() {
        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        if(projInterval) clearInterval(projInterval);
        try { rootElement.innerHTML = ''; } catch(e) {}
    }

    init();
    return { destroy };
}