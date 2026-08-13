// @signatures: failAction, fireProjectile, getNextQuestion, handleInputAnswer, initZombieGame, loadRound, loop, normalize, renderBars, showFeedback, updatePositions
import { createStudioSpriteAnimator } from '../studioSpriteAnimator';

export function initZombieGame(root, api, onExit) {
    const scenes = Array.isArray(api.gameData?.scenes) ? api.gameData.scenes : [];
    const scene = scenes.find((item) => Array.isArray(item?.actors) && item.actors.length) || scenes[0] || {};
    const findActor = (names) => (scene.actors || []).find((actor) => names.includes(String(actor?.name || '').trim().toUpperCase()));
    const frameUrl = (actor, actions) => {
        const action = (actor?.actions || []).find((item) => actions.includes(String(item?.name || '').trim().toUpperCase()));
        return action?.frames?.find((frame) => frame?.url)?.url || actor?.actions?.flatMap((item) => item?.frames || []).find((frame) => frame?.url)?.url || '';
    };
    const heroActor = findActor(['HEROS', 'HÉROS', 'HERO', 'PLAYER', 'P1']);
    const zombieActor = findActor(['ZOMBIE', 'ENNEMI', 'ENEMY', 'P2']);
    const sprites = {
        hero: frameUrl(heroActor, ['IDLE', 'MARCHER', 'WALK']),
        zombie: frameUrl(zombieActor, ['IDLE', 'AVANCER', 'WALK']),
        boss: frameUrl(zombieActor, ['TAPER', 'ATTACK', 'IDLE'])
    };
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
    let baseSpeed = 0.0175; // Vitesse de base divisée par 2
    let zombieSpeed = baseSpeed; 
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
                    <img class="z-sprite z-hero-sprite" alt="Héros" />
                    <div class="z-emoji z-hero-fallback">🧙‍♂️</div>
                </div>
                <div id="zombie-container" class="z-char-box" style="right: 0%;">
                    <img class="z-sprite z-zombie-sprite" alt="Zombie" />
                    <div class="z-emoji z-zombie-fallback">🧟</div>
                </div>
                <div id="projectile">🔥</div>
                <div id="feedback-msg" class="z-feedback"></div>
            </div>
            <div class="z-interaction-zone">
                <div id="question-text" class="z-q-text">Chargement...</div>
                
                <!-- MODE CLASSIQUE : BOUTONS -->
                <div id="choices-area" class="z-choices-grid"></div>
                
                <!-- MODE BOSS : INPUT TEXTE -->
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

    const installSprite = (selector, fallbackSelector, url) => {
        const image = root.querySelector(selector);
        const fallback = root.querySelector(fallbackSelector);
        if (!image || !url) return;
        image.onload = () => { image.classList.add('is-loaded'); if (fallback) fallback.style.display = 'none'; };
        image.onerror = () => { image.classList.remove('is-loaded'); if (fallback) fallback.style.display = ''; };
        image.src = url;
    };
    installSprite('.z-hero-sprite', '.z-hero-fallback', sprites.hero);
    installSprite('.z-zombie-sprite', '.z-zombie-fallback', sprites.zombie);
    const heroImage = root.querySelector('.z-hero-sprite');
    const zombieImage = root.querySelector('.z-zombie-sprite');
    const heroAnimator = createStudioSpriteAnimator(heroImage, heroActor);
    const zombieAnimator = createStudioSpriteAnimator(zombieImage, zombieActor);
    const playHeroIdle = () => heroAnimator.play(['IDLE']);
    const playZombieWalk = () => zombieAnimator.play(['AVANCER', 'MARCHER', 'WALK', 'IDLE']);
    playHeroIdle();
    playZombieWalk();
    const backdrop = scene?.backdrops?.[scene.currentBackdropIdx || 0]?.url || scene?.backdrops?.[0]?.url || '';
    if (backdrop) root.querySelector('#arena').style.backgroundImage = `url("${String(backdrop).replace(/["\\]/g, '\\$&')}")`;

    const updatePositions = () => {
        els.zombie.style.right = zombiePos + '%';
    };

    // QUITTER SANS SAUVEGARDER
    root.querySelector('.z-quit-btn').onclick = onExit;
    
    // GESTION INPUT BOSS
    els.validateBtn.onclick = () => handleInputAnswer();
    els.input.onkeydown = (e) => {
        // Empêche les commandes globales des jeux de capturer la barre d'espace.
        e.stopPropagation();
        if(e.key === 'Enter') handleInputAnswer();
    };

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
        const available = questionStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        if (available.length === 0) return null;
        const withoutPrevious = available.filter((index) => index !== currentQIndex);
        const pool = withoutPrevious.length > 0 ? withoutPrevious : available;
        return pool[Math.floor(Math.random() * pool.length)];
    };

    // Nettoyage pour tolérance maximale (Accents, Casse, Espaces, Ponctuation)
    const normalize = (str) => (str || "")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève accents
        .replace(/[^a-z0-9]/g, ""); // Enlève tout sauf chiffres et lettres

    const loadRound = () => {
        const nextIdx = getNextQuestion();
        
        // --- VICTOIRE ---
        if (nextIdx === null) {
            alert("VICTOIRE !");
            const finalScore = lives * 100;
            if (api.onFinish) api.onFinish(finalScore, true);
            else onExit();
            return;
        }

        currentQIndex = nextIdx;
        const qData = questionsList[currentQIndex];
        const score = questionStates[currentQIndex];

        els.qText.innerText = qData.q || "Question vide";
        renderBars();

        // --- LOGIQUE BOSS (Palier 3/3 soit score >= 2) ---
        if (score >= 2) {
            // MODE INPUT
            els.choices.style.display = 'none';
            els.inputArea.style.display = 'flex';
            els.input.value = '';
            setTimeout(() => els.input.focus(), 50);
            
            // TRANSFORMATION VISUELLE BOSS
            els.zombieEmoji.innerText = "👹";
            els.zombieEmoji.style.fontSize = "7.5rem"; // +50% taille
            playZombieWalk();
            els.zombie.classList.add('is-boss');
            
            // RALENTISSEMENT
            zombieSpeed = baseSpeed * 0.5; // 50% moins vite
        } else {
            // MODE NORMAL
            els.inputArea.style.display = 'none';
            els.choices.style.display = 'grid';
            
            // RESET VISUEL
            els.zombieEmoji.innerText = "🧟";
            els.zombieEmoji.style.fontSize = "5rem";
            playZombieWalk();
            els.zombie.classList.remove('is-boss');
            
            // VITESSE NORMALE
            zombieSpeed = baseSpeed;

            // GÉNÉRATION BOUTONS
            els.choices.innerHTML = '';
            const rawOpts = qData.options || ["A", "B", "C", "D"];
            const opts = rawOpts.map((txt, idx) => ({ txt, idx }));
            // Mélange des boutons
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
        
        // Comparaison tolérante
        if (normalize(els.input.value) === normalize(correctTxt)) {
            fireProjectile(true);
        } else {
            showFeedback(`Réponse : ${correctTxt}`, false);
            failAction();
        }
    };

    const failAction = () => {
        showFeedback("RATÉ !", false);
        zombieAnimator.play(['TAPER', 'ATTACK'], { loop: false, onComplete: playZombieWalk });
        zombiePos += 15; // Le zombie avance d'un coup
        updatePositions();
    };

    const fireProjectile = (isHit) => {
        isPaused = true;
        heroAnimator.play(['TIRER', 'SHOOT', 'ATTACK'], { loop: false, onComplete: playHeroIdle });
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
                    zombieAnimator.play(['TOUCHE', 'HIT', 'HURT'], { loop: false, onComplete: playZombieWalk });
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

            // COLLISION DU ZOMBIE
            if (zombiePos >= 85) {
                zombieAnimator.play(['TAPER', 'ATTACK'], { loop: false, onComplete: playZombieWalk });
                heroAnimator.play(['TOUCHE', 'HIT', 'HURT'], { loop: false, onComplete: playHeroIdle });
                lives--;
                els.lives.innerText = "❤️".repeat(lives);
                
                // Si on se fait toucher, on perd un point sur la question en cours
                if (questionStates[currentQIndex] > 0) {
                    questionStates[currentQIndex]--;
                    showFeedback("RECULE !", false);
                }
                
                zombiePos = 0; 
                updatePositions();
                
                // Effet écran rouge
                document.querySelector('.z-game-wrapper').style.background = '#fee2e2';
                setTimeout(() => document.querySelector('.z-game-wrapper').style.background = '#f0f9ff', 200);

                // --- DÉFAITE ---
                if (lives <= 0) {
                    alert("GAME OVER !");
                    if (api.onFinish) api.onFinish(0, true); 
                    else onExit();
                } else {
                    // On recharge le round (pour éventuellement enlever le mode Boss si on a perdu le point)
                    loadRound();
                }
            }
        }
        frameId = requestAnimationFrame(loop);
    };

    updatePositions();
    loadRound();
    loop();

    return { destroy: () => { cancelAnimationFrame(frameId); heroAnimator.destroy(); zombieAnimator.destroy(); } };
}
