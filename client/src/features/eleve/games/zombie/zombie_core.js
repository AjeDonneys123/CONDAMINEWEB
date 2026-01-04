/**
 * MOTEUR ZOMBIE V2 (Fluide & Animé)
 */

export function initZombieGame(rootElement, apiData, onExit) {
    
    // 1. HTML STRUCTURE
    rootElement.innerHTML = `
        <div class="z-ui-container">
            <div class="z-arena">
                <div class="sprite hero">👮‍♂️</div>
                <div class="sprite zombie" id="v-zombie">🧟</div>
                <div class="sprite projectile" id="v-proj">🔥</div>
            </div>
            <div class="z-hud">
                <div class="z-question-box" id="v-q-text">Chargement...</div>
                <div class="z-options-container" id="v-options"></div>
            </div>
            
            <!-- OVERLAY (Fin de partie uniquement) -->
            <div class="z-overlay" id="v-overlay">
                <h2 id="v-title">GAME OVER</h2>
                <p id="v-msg">...</p>
                <button class="z-btn-restart" id="v-btn-action">Continuer</button>
            </div>

            <button style="position:absolute; top:10px; right:10px; background:#ef4444; color:white; border:none; width:30px; height:30px; border-radius:50%; font-weight:bold; cursor:pointer; z-index:50;" id="v-quit">✕</button>
        </div>
    `;

    // 2. DOM ELEMENTS
    const zombieEl = rootElement.querySelector('#v-zombie');
    const projEl = rootElement.querySelector('#v-proj');
    const qTextEl = rootElement.querySelector('#v-q-text');
    const optionsEl = rootElement.querySelector('#v-options');
    const overlayEl = rootElement.querySelector('#v-overlay');
    const titleEl = rootElement.querySelector('#v-title');
    const msgEl = rootElement.querySelector('#v-msg');
    const actionBtn = rootElement.querySelector('#v-btn-action');
    const quitBtn = rootElement.querySelector('#v-quit');
    const arenaEl = rootElement.querySelector('.z-arena');

    // 3. STATE
    let levels = [];
    let currentQIdx = 0;
    let zX = 0; // Distance depuis la droite
    let isPaused = false;
    let gameLoopId = null;
    let projInterval = null;

    // 4. GAME LOOP (Mouvement Zombie)
    function startLoop() {
        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        
        function loop() {
            if (!isPaused) {
                // Avance
                zX += 1.0; // Vitesse modérée
                zombieEl.style.right = zX + 'px';

                // Collision avec le Policier (à gauche)
                // ArenaWidth - zX = Position gauche du zombie. Hero ~80px.
                const arenaW = arenaEl.offsetWidth;
                if ((arenaW - zX) < 100) {
                    gameOver("Le zombie t'a mordu !");
                    return; 
                }
            }
            gameLoopId = requestAnimationFrame(loop);
        }
        loop();
    }

    // 5. ANIMATION TIR (Projectile)
    function shootAndKill() {
        // Position départ (Policier)
        let pX = 80; 
        projEl.style.left = pX + 'px';
        projEl.style.display = 'block';

        if(projInterval) clearInterval(projInterval);

        projInterval = setInterval(() => {
            pX += 25; // Vitesse tir
            projEl.style.left = pX + 'px';

            const arenaW = arenaEl.offsetWidth;
            const zombieLeft = arenaW - zX - 50; // -50 pour marge hitbox

            // Impact ?
            if (pX >= zombieLeft) {
                clearInterval(projInterval);
                projEl.style.display = 'none';
                killZombie();
            }
            
            // Sortie d'écran
            if (pX > arenaW) {
                clearInterval(projInterval);
                projEl.style.display = 'none';
            }
        }, 16); // 60fps
    }

    function killZombie() {
        // Effet visuel
        zombieEl.innerHTML = "💥";
        isPaused = true;

        // Attente 1s puis question suivante
        setTimeout(() => {
            nextQuestion();
        }, 1000);
    }

    // 6. LOGIQUE QUESTIONS
    async function init() {
        try {
            const res = await fetch('/api/game-levels/all');
            const data = await res.json();
            levels = data.filter(l => l.chapterId === 'ch1-zombie');
            
            if(levels.length > 0 && levels[0].questions.length > 0) {
                loadQuestion(levels[0].questions[0]);
            } else {
                showOverlay("VIDE", "Aucun niveau disponible.", true);
            }
        } catch(e) { showOverlay("ERREUR", "Problème connexion.", true); }
    }

    function loadQuestion(q) {
        // Reset Visuel
        zombieEl.innerHTML = "🧟";
        zX = 20; // Repart de droite
        zombieEl.style.right = '20px';
        
        qTextEl.textContent = q.q;
        optionsEl.innerHTML = '';
        currentQ = q;
        isPaused = false;

        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'z-btn';
            btn.textContent = opt;
            btn.onclick = () => checkAnswer(idx, btn);
            optionsEl.appendChild(btn);
        });

        startLoop();
    }

    let currentQ = null;

    function checkAnswer(idx, btn) {
        if(isPaused) return;

        const isCorrect = (idx === currentQ.a);

        if (isCorrect) {
            btn.classList.add('correct');
            isPaused = true; // Stop le zombie le temps du tir
            shootAndKill();
        } else {
            btn.classList.add('wrong');
            // Pénalité : Le zombie bondit !
            zX += 50;
            zombieEl.style.right = zX + 'px';
            
            // On laisse le bouton rouge 0.5s
            setTimeout(() => {
                btn.classList.remove('wrong');
            }, 500);
        }
    }

    function nextQuestion() {
        currentQIdx++;
        const qs = levels[0].questions;
        
        if(currentQIdx < qs.length) {
            loadQuestion(qs[currentQIdx]);
        } else {
            // Victoire finale
            showOverlay("VICTOIRE !", "Tu as survécu à l'invasion.", true);
        }
    }

    function gameOver(reason) {
        isPaused = true;
        showOverlay("PERDU", reason, false);
    }

    function showOverlay(title, msg, isEnd) {
        overlayEl.style.display = 'flex';
        titleEl.textContent = title;
        msgEl.textContent = msg;
        
        actionBtn.textContent = isEnd ? "Quitter" : "Réessayer";
        actionBtn.onclick = () => {
            if(isEnd) {
                destroy();
                onExit();
            } else {
                // Retry niveau
                overlayEl.style.display = 'none';
                currentQIdx = 0;
                loadQuestion(levels[0].questions[0]);
            }
        };
    }

    // Sortie Croix
    quitBtn.onclick = () => { destroy(); onExit(); };

    // Nettoyage
    function destroy() {
        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        if(projInterval) clearInterval(projInterval);
        rootElement.innerHTML = '';
    }

    // Go !
    init();

    return { destroy };
}