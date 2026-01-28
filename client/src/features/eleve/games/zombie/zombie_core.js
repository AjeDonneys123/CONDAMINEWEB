// @signatures: failAction, fireProjectile, getNextQuestion, handleInputAnswer, initZombieGame, loadRound, loop, normalize, renderBars, showFeedback, updatePositions
export function initZombieGame(root, api, onExit) {
    // --- 1. DONNÉES & ÉTAT ---
    let questionsList = api.level.questions;
    if (!questionsList || !Array.isArray(questionsList) || questionsList.length === 0) {
        questionsList = [{ q: "Erreur config", options: ["OK"], a: 0 }];
    }

    const questionStates = questionsList.map(() => 0); 
    let currentQIndex = -1;
    let lives = 4;
    
    // Mouvement
    let zombiePos = 0; 
    let zombieSpeed = 0.035; 
    let frameId;
    let isPaused = false; 

    // --- 2. HTML UI ---
    root.innerHTML = `
        <div class="z-game-wrapper">
            <div class="z-hud">
                <div class="z-lives">❤️❤️❤️❤️</div>
                <div class="z-bars-container" id="bars-container"></div>
                <button class="z-quit-btn">QUITTER</button>
            </div>
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
            <div class="z-interaction-zone">
                <div id="question-text" class="z-q-text">Chargement...</div>
                <div id="choices-area" class="z-choices-grid"></div>
                <div id="input-area" class="z-input-box" style="display:none">
                    <input type="text" id="answer-input" placeholder="TAPEZ LA RÉPONSE..." autocomplete="off" />
                    <button id="validate-btn">TIRER</button>
                </div>
            </div>
        </div>
    `;

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

    // QUITTER SANS SAUVEGARDER (Bouton Quitter)
    root.querySelector('.z-quit-btn').onclick = onExit;
    
    els.validateBtn.onclick = () => handleInputAnswer();
    els.input.onkeydown = (e) => { if(e.key === 'Enter') handleInputAnswer(); };

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

    const getNextQuestion = () => {
        if (currentQIndex !== -1 && questionStates[currentQIndex] < 3) return currentQIndex;
        const available = questionStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    };

    const normalize = (str) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    const loadRound = () => {
        const nextIdx = getNextQuestion();
        
        // --- VICTOIRE ---
        if (nextIdx === null) {
            alert("VICTOIRE !");
            // CALCUL DU SCORE (Basique : Vies restantes * 100)
            const finalScore = lives * 100;
            // APPEL API POUR SAUVEGARDER
            if (api.onFinish) api.onFinish(finalScore, true);
            else onExit();
            return;
        }

        currentQIndex = nextIdx;
        const qData = questionsList[currentQIndex];
        const score = questionStates[currentQIndex];

        els.qText.innerText = qData.q || "Question vide";
        renderBars();

        if (score >= 2) {
            els.choices.style.display = 'none';
            els.inputArea.style.display = 'flex';
            els.input.value = '';
            setTimeout(() => els.input.focus(), 50);
            els.zombieEmoji.innerText = "👹"; 
            els.zombieImg.style.filter = "drop-shadow(0 0 15px red) hue-rotate(-50deg)";
        } else {
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
        zombiePos += 15; 
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
                    zombiePos = 0; 
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

    const loop = () => {
        if (!isPaused) {
            zombiePos += zombieSpeed;
            updatePositions();

            if (zombiePos >= 85) {
                lives--;
                els.lives.innerText = "❤️".repeat(lives);
                if (questionStates[currentQIndex] > 0) {
                    questionStates[currentQIndex]--;
                    showFeedback("RECULE !", false);
                }
                zombiePos = 0; 
                updatePositions();
                document.querySelector('.z-game-wrapper').style.background = '#fee2e2';
                setTimeout(() => document.querySelector('.z-game-wrapper').style.background = '#f0f9ff', 200);

                // --- DÉFAITE ---
                if (lives <= 0) {
                    alert("GAME OVER !");
                    // SAUVEGARDE MÊME EN CAS DE DÉFAITE (Score partiel)
                    // On considère que le jeu est "FAIT" même si perdu, pour enlever le badge rouge
                    // Ou alors false pour levelReached pour dire "Non validé"
                    if (api.onFinish) api.onFinish(0, true); 
                    else onExit();
                } else {
                    loadRound();
                }
            }
        }
        frameId = requestAnimationFrame(loop);
    };

    updatePositions();
    loadRound();
    loop();

    return { destroy: () => cancelAnimationFrame(frameId) };
}
