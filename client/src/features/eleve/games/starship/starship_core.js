import { GameProgression } from '../mainGames';

/**
 * MOTEUR STARSHIP V6 - COLLISION PIXEL PERFECT
 * Utilise getBoundingClientRect pour des collisions précises.
 */
export function initStarshipGame(rootElement, apiData, onExit) {
    
    // 1. HTML
    rootElement.innerHTML = `
        <div class="s-top-hud"><div class="s-hearts" id="s-hearts">❤️❤️❤️❤️</div><div class="s-global-progress"><div class="s-global-bar-fill" id="s-bar"></div></div><div class="s-questions-tracker" id="s-tracker"></div></div>
        <div class="s-arena" id="s-arena"><div class="s-question-display" id="s-q-text">Chargement...</div><div class="s-ship" id="s-ship">🚀</div><div class="s-boss" id="s-boss">🛸</div><div class="s-input-layer" id="s-input-area"><input type="text" id="s-input" placeholder="Réponse..." autocomplete="off"><button class="s-btn-check" id="s-btn-check">TIRER</button></div></div>
        <div class="s-overlay" id="s-overlay"><h2 id="s-title">FIN</h2><p id="s-msg">...</p><button class="s-btn-restart" id="s-btn-action">Continuer</button></div>
        <button style="position:absolute; top:80px; right:10px; background:#ef4444; color:white; border:none; width:30px; height:30px; border-radius:50%; font-weight:bold; cursor:pointer; z-index:50;" id="s-quit">✕</button>
    `;

    // 2. REFS
    const refs = {
        arena: rootElement.querySelector('#s-arena'),
        ship: rootElement.querySelector('#s-ship'),
        boss: rootElement.querySelector('#s-boss'),
        qText: rootElement.querySelector('#s-q-text'),
        inputArea: rootElement.querySelector('#s-input-area'),
        input: rootElement.querySelector('#s-input'),
        checkBtn: rootElement.querySelector('#s-btn-check'),
        overlay: rootElement.querySelector('#s-overlay'),
        hearts: rootElement.querySelector('#s-hearts'),
        tracker: rootElement.querySelector('#s-tracker'),
        bar: rootElement.querySelector('#s-bar'),
        title: rootElement.querySelector('#s-title'),
        msg: rootElement.querySelector('#s-msg'),
        action: rootElement.querySelector('#s-btn-action'),
        quit: rootElement.querySelector('#s-quit')
    };

    // 3. STATE
    let game = null;
    let currentIdx = 0;
    let shipX = 50; 
    let missiles = []; 
    let targets = []; 
    let bossY = -20;
    let keys = { left: false, right: false, space: false };
    let gameLoopId = null;
    let isPaused = false;
    let lastShot = 0;
    let isBossMode = false;

    function init() {
        if (apiData.level && apiData.level.questions.length > 0) {
            game = new GameProgression(apiData.level.questions);
            updateUI();
            loadRound();
            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('keyup', onKeyUp);
        } else { gameOver("Erreur niveau", true); }
    }

    function updateUI() {
        const data = game.getTrackerData();
        refs.tracker.innerHTML = '';
        data.dots.forEach((d, i) => {
            const dot = document.createElement('div');
            dot.className = `s-q-dot ${i === currentIdx ? 'active' : ''} ${d.done ? 'done' : ''}`;
            const fill = document.createElement('div'); fill.className = 's-q-dot-fill'; fill.style.height = `${d.pct}%`;
            dot.appendChild(fill); refs.tracker.appendChild(dot);
        });
        refs.bar.style.width = `${data.globalPct}%`;
        refs.hearts.textContent = "❤️".repeat(game.getLives());
    }

    function loadRound() {
        const next = game.getNextActiveQuestion();
        if (!next) { gameOver("MISSION ACCOMPLIE !", true); return; }

        currentIdx = next.idx;
        const q = next.q;
        const lvl = next.level;

        refs.qText.textContent = q.q;
        clearEntities();
        isPaused = false;
        
        updateUI();

        if (lvl < 2) {
            // MODE ARCADE
            isBossMode = false;
            refs.inputArea.style.display = 'none';
            refs.ship.style.display = 'flex';
            refs.boss.style.display = 'none';
            spawnTargets(q.options);
        } else {
            // MODE BOSS
            isBossMode = true;
            refs.ship.style.display = 'none';
            refs.inputArea.style.display = 'flex';
            refs.boss.style.display = 'block';
            refs.boss.style.top = '-100px';
            refs.boss.innerHTML = "🛸";
            bossY = 10;
            refs.input.value = '';
            refs.input.focus();
            
            const correctText = q.options[q.a];
            refs.checkBtn.onclick = () => handleInput(correctText);
            refs.input.onkeydown = (e) => { 
                e.stopPropagation(); 
                if(e.key==="Enter") handleInput(correctText); 
            };
        }
        
        startLoop();
    }

    function handleInput(correctText) {
        if (isPaused) return;
        const res = game.submitAnswer(currentIdx, refs.input.value);
        
        if (res.success) {
            refs.boss.innerHTML = "💥";
            refs.checkBtn.style.background = '#22c55e';
            isPaused = true;
            setTimeout(loadRound, 1000);
        } else {
            refs.input.value = "";
            refs.input.placeholder = "Indice: " + correctText.substring(0,3) + "...";
            handleErrorLogic(res);
        }
    }

    function spawnTargets(options) {
        options.forEach((opt, i) => {
            const el = document.createElement('div');
            el.className = 's-target';
            el.textContent = opt;
            refs.arena.appendChild(el);
            // Position aléatoire horizontale
            const x = 10 + (i * 20) + (Math.random() * 10 - 5);
            targets.push({ 
                el, 
                x: 10 + (i * 20) + (Math.random() * 10 - 5), 
                y: 10 + (Math.random() * 20), 
                index: i, 
                speed: 0.03 + (Math.random() * 0.03)
            });
        });
    }

    function onKeyDown(e) {
        if (isBossMode) return;
        if (e.key === "ArrowLeft") keys.left = true;
        if (e.key === "ArrowRight") keys.right = true;
        if (e.key === " ") fireMissile();
    }
    function onKeyUp(e) {
        if (e.key === "ArrowLeft") keys.left = false;
        if (e.key === "ArrowRight") keys.right = false;
    }

    function fireMissile() {
        if(isPaused || Date.now() - lastShot < 300) return;
        lastShot = Date.now();
        const el = document.createElement('div');
        el.className = 's-missile';
        refs.arena.appendChild(el);
        missiles.push({ el, x: shipX, y: 15 });
    }

    // --- FONCTION DE COLLISION (Hitbox Rectangulaire) ---
    function isColliding(rect1, rect2) {
        return !(rect1.right < rect2.left || 
                 rect1.left > rect2.right || 
                 rect1.bottom < rect2.top || 
                 rect1.top > rect2.bottom);
    }

    function startLoop() {
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        
        function loop() {
            if (!isPaused) {
                
                if (!isBossMode) {
                    // Mouvement Vaisseau
                    if (keys.left && shipX > 5) shipX -= 1.5;
                    if (keys.right && shipX < 95) shipX += 1.5;
                    refs.ship.style.left = `${shipX}%`;

                    // Gestion Missiles
                    for (let i = missiles.length - 1; i >= 0; i--) {
                        const m = missiles[i];
                        m.y += 1.5;
                        m.el.style.bottom = `${m.y}%`;
                        m.el.style.left = `${m.x}%`; // IMPORTANT: Le CSS utilise left%

                        // Récupération des rectangles (Hitboxes) en PIXELS réels
                        const mRect = m.el.getBoundingClientRect();

                        let hitIndex = -1;
                        
                        // Vérification contre toutes les cibles
                        for (let j = 0; j < targets.length; j++) {
                            const t = targets[j];
                            const tRect = t.el.getBoundingClientRect();
                            
                            // LE TEST ULTIME
                            if (isColliding(mRect, tRect)) {
                                hitIndex = j;
                                break; // On arrête de chercher, un missile = une cible
                            }
                        }

                        if (hitIndex !== -1) {
                            checkHit(targets[hitIndex]);
                            m.el.remove();
                            missiles.splice(i, 1);
                        } else if (m.y > 100) {
                            m.el.remove();
                            missiles.splice(i, 1);
                        }
                    }

                    // Mouvement Cibles
                    targets.forEach(t => {
                        t.y += t.speed;
                        t.el.style.top = `${t.y}%`;
                        t.el.style.left = `${t.x}%`;
                        if (t.y > 90) playerHit("Envahi !");
                    });

                } else {
                    // Boss
                    bossY += 0.04;
                    refs.boss.style.top = `${bossY}%`;
                    if (bossY > 80) { playerHit("Écrasé !"); bossY = 10; }
                }
            }
            gameLoopId = requestAnimationFrame(loop);
        }
        loop();
    }

    function checkHit(target) {
        const res = game.submitAnswer(currentIdx, target.index);
        
        if (res.success) {
            target.el.style.background = '#22c55e';
            target.el.style.color = 'white';
            target.el.innerHTML = "✨";
            isPaused = true;
            setTimeout(loadRound, 800);
        } else {
            target.el.style.background = '#ef4444';
            target.el.style.color = 'white';
            handleErrorLogic(res);
        }
    }

    function handleErrorLogic(res) {
        const status = game.loseLife(currentIdx);
        updateUI();
        if (status.isDead) gameOver("VAISSEAU DÉTRUIT", false);
        else if (res.oldLevel >= 2 && res.newLevel < 2) setTimeout(loadRound, 1000);
    }

    function playerHit(reason) {
        isPaused = true;
        const status = game.loseLife(currentIdx);
        updateUI();
        
        if (status.isDead) gameOver("GAME OVER", false);
        else {
            if(!isBossMode) refs.ship.innerHTML = "💥";
            else refs.boss.innerHTML = "😈";

            setTimeout(() => {
                if(!isBossMode) refs.ship.innerHTML = "🚀";
                if (status.newLevel < 2 && isBossMode) loadRound();
                else {
                    clearEntities();
                    if(!isBossMode) spawnTargets(game.questions[currentIdx].options);
                    isPaused = false; 
                    startLoop();
                }
            }, 1000);
        }
    }

    function clearEntities() {
        targets.forEach(t => t.el.remove());
        missiles.forEach(m => m.el.remove());
        targets = [];
        missiles = [];
    }

    function gameOver(msg, isWin) {
        isPaused = true;
        refs.overlay.style.display = 'flex';
        refs.title.textContent = isWin ? "VICTOIRE" : "ECHEC";
        refs.msg.textContent = msg;
        refs.action.textContent = isWin ? "Quitter" : "Réessayer";
        refs.action.onclick = () => { if (isWin) { destroy(); onExit(); } else { init(); refs.overlay.style.display = 'none'; } };
    }

    refs.quit.onclick = () => { destroy(); onExit(); };

    function destroy() {
        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        rootElement.innerHTML = '';
    }

    init();
    return { destroy };
}