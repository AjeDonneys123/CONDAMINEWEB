export function initZombieGame(root, api, onExit) {
    // --- 1. DONNÉES & ÉTAT ---
    let questionsList = api.level.questions;
    
    // Sécurité anti-crash
    if (!questionsList || !Array.isArray(questionsList) || questionsList.length === 0) {
        questionsList = [{
            q: "Aucune question configurée.",
            options: ["Continuer", "Quitter", "Erreur", "Bug"],
            a: 1
        }];
    }

    const questionStates = questionsList.map(() => 0); 
    let currentQIndex = -1;
    let lives = 4;
    
    // Mouvement
    let zombiePos = 0; 
    let zombieSpeed = 0.035; // <--- VITESSE RÉDUITE (Plus lent)
    let frameId;
    let isPaused = false; 

    // --- 2. HTML UI ---
    root.innerHTML = `
        <div class="z-game-wrapper">
            <!-- HUD -->
            <div class="z-hud">
                <div class="z-lives">❤️❤️❤️❤️</div>
                <div class="z-bars-container" id="bars-container"></div>
                <button class="z-quit-btn">QUITTER</button>
            </div>

            <!-- ARÈNE -->
            <div id="arena">
                <div id="hero-container" class="z-char-box" style="left: 5%;">
                    <div class="z-emoji">🧙‍♂️</div>
                    <img src="/images/hero.png" class="z-img-layer" onload="this.style.opacity=1" onerror="this.style.display='none'"/>
                </div>
                
                <div id="zombie-container" class="z-char-box" style="right: 0%;">
                    <div class="z-emoji">🧟</div>
                    <img src="/images/zombi.png" class="z-img-layer" onload="this.style.opacity=1" onerror="this.style.display='none'"/>
                </div>

                <div id="projectile">🔥</div>
                <div id="feedback-msg" class="z-feedback"></div>
            </div>

            <!-- ZONE QUIZ -->
            <div class="z-interaction-zone">
                <div id="question-text" class="z-q-text">Chargement...</div>
                
                <!-- QCM -->
                <div id="choices-area" class="z-choices-grid"></div>
                
                <!-- BOSS -->
                <div id="input-area" class="z-input-box" style="display:none">
                    <input type="text" id="answer-input" placeholder="TAPEZ LA RÉPONSE..." autocomplete="off" />
                    <button id="validate-btn">TIRER</button>
                </div>
            </div>
        </div>
    `;

    // Refs
    const els = {
        hero: root.querySelector('#hero-container'),
        zombie: root.querySelector('#zombie-container'),
        zombieImg: root.querySelector('#zombie-container .z-img-layer'),
        zombieEmoji: root.querySelector('#zombie-container .z-emoji'),
        projectile: root.querySelector('#projectile'),
        lives: root.querySelector('.z-lives'),
        bars: root.querySelector('#bars-container'),
        qText: root.querySelector('#question-text'),
        choices: root.querySelector('#choices-area'),
        inputArea: root.querySelector('#input-area'),
        input: root.querySelector('#answer-input'),
        validateBtn: root.querySelector('#validate-btn'),
        feedback: root.querySelector('#feedback-msg')
    };

    const updatePositions = () => {
        els.zombie.style.right = zombiePos + '%';
    };

    root.querySelector('.z-quit-btn').onclick = onExit;
    els.validateBtn.onclick = () => handleInputAnswer();
    els.input.onkeydown = (e) => { if(e.key === 'Enter') handleInputAnswer(); };

    // --- 3. BARRES ---
    const renderBars = () => {
        els.bars.innerHTML = '';
        questionStates.forEach((score, i) => {
            const barBox = document.createElement('div');
            barBox.className = 'z-mini-bar-box';
            if (i === currentQIndex) barBox.classList.add('active-q');
            
            for(let s=0; s<3; s++) {
                const seg = document.createElement('div');
                seg.className = 'z-bar-seg';
                if (score > s) seg.classList.add('filled');
                barBox.appendChild(seg);
            }
            els.bars.appendChild(barBox);
        });
    };

    // --- 4. CHARGEMENT QUESTION ---
    const getNextQuestion = () => {
        if (currentQIndex !== -1 && questionStates[currentQIndex] < 3) return currentQIndex;
        const available = questionStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    };

    const normalize = (str) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    const loadRound = () => {
        const nextIdx = getNextQuestion();
        if (nextIdx === null) {
            alert("VICTOIRE !");
            return onExit();
        }
        currentQIndex = nextIdx;
        const qData = questionsList[currentQIndex];
        const score = questionStates[currentQIndex];

        els.qText.innerText = qData.q || "Question vide";
        renderBars();

        // MODE BOSS (Score >= 2)
        if (score >= 2) {
            els.choices.style.display = 'none';
            els.inputArea.style.display = 'flex';
            els.input.value = '';
            setTimeout(() => els.input.focus(), 50);
            
            els.zombieEmoji.innerText = "👹"; 
            els.zombieImg.style.filter = "drop-shadow(0 0 15px red) hue-rotate(-50deg)";
        } 
        // MODE QCM
        else {
            els.inputArea.style.display = 'none';
            els.choices.style.display = 'grid';
            
            els.zombieEmoji.innerText = "🧟";
            els.zombieImg.style.filter = "none";
            
            els.choices.innerHTML = '';
            const rawOpts = qData.options || ["A", "B", "C", "D"];
            const opts = rawOpts.map((txt, idx) => ({ txt, idx }));
            opts.sort(() => Math.random() - 0.5);

            opts.forEach(o => {
                const btn = document.createElement('button');
                btn.className = 'z-btn';
                btn.style.color = "#000"; 
                btn.innerText = o.txt;
                btn.onclick = () => {
                    if (o.idx === qData.a) fireProjectile(true);
                    else failAction();
                };
                els.choices.appendChild(btn);
            });
        }
    };

    const handleInputAnswer = () => {
        if (isPaused) return;
        const qData = questionsList[currentQIndex];
        const correctTxt = qData.options[qData.a]; 
        if (normalize(els.input.value) === normalize(correctTxt)) fireProjectile(true);
        else {
            showFeedback(`Réponse : ${correctTxt}`, false);
            failAction();
        }
    };

    const failAction = () => {
        showFeedback("RATÉ !", false);
        zombiePos += 15; // Punition : il avance
        updatePositions();
    };

    const fireProjectile = (isHit) => {
        isPaused = true;
        els.projectile.style.display = 'block';
        let projX = 10;
        const targetX = 100 - zombiePos - 10; 

        const anim = setInterval(() => {
            projX += 4;
            els.projectile.style.left = projX + '%';

            if (projX >= targetX) {
                clearInterval(anim);
                els.projectile.style.display = 'none';
                
                if (isHit) {
                    questionStates[currentQIndex]++;
                    zombiePos = 0; // Recule à fond
                    updatePositions();
                    showFeedback("TOUCHÉ !", true);
                    
                    setTimeout(() => {
                        isPaused = false;
                        loadRound();
                    }, 500);
                }
            }
        }, 16);
    };

    const showFeedback = (msg, good) => {
        els.feedback.innerText = msg;
        els.feedback.style.color = good ? '#22c55e' : '#ef4444';
        els.feedback.style.opacity = 1;
        els.feedback.style.transform = 'translate(-50%, -50%) scale(1.5)';
        setTimeout(() => {
            els.feedback.style.opacity = 0;
            els.feedback.style.transform = 'translate(-50%, -50%) scale(0)';
        }, 1000);
    };

    // --- 5. BOUCLE (MOUVEMENT + COLLISION) ---
    const loop = () => {
        if (!isPaused) {
            zombiePos += zombieSpeed;
            updatePositions();

            // Collision (Héro est à gauche ~5-15%)
            if (zombiePos >= 85) {
                // MIAM : Dégâts + Régression
                lives--;
                els.lives.innerText = "❤️".repeat(lives);
                
                // PÉNALITÉ : On perd un niveau sur la barre !
                if (questionStates[currentQIndex] > 0) {
                    questionStates[currentQIndex]--;
                    showFeedback("GRRR ! RECULE D'UN NIVEAU !", false);
                }

                // Reset position Zombie
                zombiePos = 0; 
                updatePositions();
                
                // Flash rouge
                document.querySelector('.z-game-wrapper').style.background = '#fee2e2';
                setTimeout(() => document.querySelector('.z-game-wrapper').style.background = '#f0f9ff', 200);

                if (lives <= 0) {
                    alert("GAME OVER !");
                    onExit();
                } else {
                    // On recharge le round : 
                    // Si on était au Boss (niveau 2) et qu'on descend au niveau 1 -> On repasse en QCM
                    loadRound();
                }
            }
        }
        frameId = requestAnimationFrame(loop);
    };

    // START
    updatePositions();
    loadRound();
    loop();

    return { destroy: () => cancelAnimationFrame(frameId) };
}