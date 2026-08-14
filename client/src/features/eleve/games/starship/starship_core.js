// @signatures: clearLevel, failAction, fire, getNextQuestion, handleBossInput, handleKey, initStarshipGame, isCorrect, loadRound, moveShip, normalize, renderBars, startBossPhase, startInvaderPhase, triggerNuke, update
import { GameProgression } from '../mainGames';
import { createStudioSpriteAnimator } from '../studioSpriteAnimator';
import { installCoordinateTouchRouter, protectGameSurface } from '../protectedGameTouch';

export function initStarshipGame(root, api, onExit) {
    const removeSurfaceProtection = protectGameSurface(root);
    const scenes = Array.isArray(api.gameData?.scenes) ? api.gameData.scenes : [];
    const scene = scenes.find((item) => Array.isArray(item?.actors) && item.actors.length) || scenes[0] || {};
    const findActor = (names) => (scene.actors || []).find((actor) => names.includes(String(actor?.name || '').trim().toUpperCase()));
    const frameUrl = (actor, actions) => {
        const action = (actor?.actions || []).find((item) => actions.includes(String(item?.name || '').trim().toUpperCase()));
        return action?.frames?.find((frame) => frame?.url)?.url || actor?.actions?.flatMap((item) => item?.frames || []).find((frame) => frame?.url)?.url || '';
    };
    const playerActor = findActor(['P1', 'PLAYER', 'VAISSEAU', 'SHIP', 'HEROS', 'HÉROS']);
    const enemyActor = findActor(['P2', 'ENNEMI', 'ENEMY', 'BOSS']);
    const sprites = {
        ship: frameUrl(playerActor, ['IDLE', 'FLY', 'VOLER']),
        boss: frameUrl(enemyActor, ['IDLE', 'FLY', 'VOLER'])
    };
    const STARSHIP_FALL_SPEED_MULTIPLIER = 0.5; // Demande UX: diviser par 2 la descente.
    const fitTextInBox = (el, {
        maxFont = 22,
        minFont = 10,
        lineHeight = 1.12
    } = {}) => {
        if (!el) return;
        let size = maxFont;
        el.style.lineHeight = String(lineHeight);
        el.style.fontSize = `${size}px`;
        // Réduit progressivement tant que le contenu déborde.
        while (size > minFont && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)) {
            size -= 1;
            el.style.fontSize = `${size}px`;
        }
    };
    const formatOptionLabel = (value = '', maxPerLine = 12, maxLines = 3) => {
        const src = String(value || '').replace(/\s+/g, ' ').trim();
        if (!src) return '';
        const words = src.split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
            const next = line ? `${line} ${w}` : w;
            if (next.length <= maxPerLine) {
                line = next;
                continue;
            }
            if (line) lines.push(line);
            line = w.length > maxPerLine ? w.slice(0, maxPerLine) : w;
            if (lines.length >= maxLines - 1) break;
        }
        if (lines.length < maxLines && line) lines.push(line);
        if (lines.length > maxLines) lines.length = maxLines;
        return lines.join('\n');
    };
    const formatQuestionLabel = (value = '', maxPerLine = 42, maxLines = 3) => {
        const src = String(value || '').replace(/\s+/g, ' ').trim();
        if (!src) return '';
        const words = src.split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
            const next = line ? `${line} ${w}` : w;
            if (next.length <= maxPerLine) {
                line = next;
                continue;
            }
            if (line) lines.push(line);
            line = w.length > maxPerLine ? w.slice(0, maxPerLine) : w;
            if (lines.length >= maxLines - 1) break;
        }
        if (lines.length < maxLines && line) lines.push(line);
        if (lines.length > maxLines) lines.length = maxLines;
        return lines.join('\n');
    };

    let questionsList = api.level.questions || [{ q: "Erreur", options: ["Bug"], a: 0 }];
    const questionStates = questionsList.map(() => 0);
    
    let currentQIndex = -1;
    let currentQ = null; 
    let lives = 4;
    
    let shipX = 50; 
    let projectiles = []; 
    let enemies = []; 
    let spawnInterval;
    let isPaused = false;
    let frameId;
    
    root.innerHTML = `
        <div class="s-game-wrapper">
            <div class="s-stars"></div>
            <div class="s-hud">
                <div class="s-lives">❤️❤️❤️❤️</div>
                <div class="s-bars-container" id="s-bars"></div>
                <button class="s-quit-btn">QUITTER</button>
            </div>
            <div id="s-q-banner" class="s-question-banner">Prêt ?</div>
            <div class="s-play-area" id="s-area">
                <div id="s-ship" class="s-ship"><img class="s-ship-sprite" alt="Vaisseau" /><span class="s-ship-fallback">🚀</span></div>
                <div id="s-projectiles-layer"></div>
                <div id="s-enemies-layer"></div>
            </div>
            <div class="s-boss-interface" id="s-boss-ui" style="display:none">
                <input type="text" id="s-boss-input" class="s-boss-input" placeholder="CODE DE TIR !" autocomplete="off">
                <button id="s-nuke-btn" class="s-nuke-btn">☢️ NUKE</button>
            </div>
            <div class="s-mobile-controls">
                <div class="s-mobile-move">
                    <button class="s-mobile-btn" id="s-mobile-left" data-game-code="left">◀</button>
                    <button class="s-mobile-btn" id="s-mobile-right" data-game-code="right">▶</button>
                </div>
                <div class="s-mobile-actions">
                    <button class="s-mobile-btn s-mobile-fire" id="s-mobile-fire" data-game-code="fire">TIR</button>
                    <button class="s-mobile-btn s-mobile-jump" id="s-mobile-jump" data-game-code="jump">SAUT</button>
                </div>
            </div>
        </div>
    `;

    const els = {
        ship: root.querySelector('#s-ship'),
        area: root.querySelector('#s-area'),
        pLayer: root.querySelector('#s-projectiles-layer'),
        eLayer: root.querySelector('#s-enemies-layer'),
        qText: root.querySelector('#s-q-banner'),
        bars: root.querySelector('#s-bars'),
        lives: root.querySelector('.s-lives'),
        bossUI: root.querySelector('#s-boss-ui'),
        bossInput: root.querySelector('#s-boss-input'),
        nukeBtn: root.querySelector('#s-nuke-btn')
    };
    const shipImage = root.querySelector('.s-ship-sprite');
    const shipFallback = root.querySelector('.s-ship-fallback');
    if (sprites.ship) {
        shipImage.onload = () => { shipImage.classList.add('is-loaded'); shipFallback.style.display = 'none'; };
        shipImage.onerror = () => { shipImage.classList.remove('is-loaded'); shipFallback.style.display = ''; };
        shipImage.src = sprites.ship;
    }
    const shipAnimator = createStudioSpriteAnimator(shipImage, playerActor);
    const playShipFlight = () => shipAnimator.play(['FLY', 'VOLER', 'MARCHER', 'IDLE']);
    playShipFlight();
    const backdrop = scene?.backdrops?.[scene.currentBackdropIdx || 0]?.url || scene?.backdrops?.[0]?.url || '';
    if (backdrop) {
        const stars = root.querySelector('.s-stars');
        stars.style.backgroundImage = `linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.28)), url("${String(backdrop).replace(/["\\]/g, '\\$&')}")`;
        stars.style.backgroundSize = 'cover';
        stars.style.backgroundPosition = 'center';
        stars.style.opacity = '1';
    }

    const renderBars = () => {
        els.bars.innerHTML = '';
        questionStates.forEach((score, i) => {
            const box = document.createElement('div');
            box.className = 's-mini-bar-box';
            if (i === currentQIndex) box.classList.add('active');
            for(let s=0; s<3; s++) {
                const seg = document.createElement('div');
                seg.className = 's-bar-seg';
                if (score > s) seg.classList.add('filled');
                box.appendChild(seg);
            }
            els.bars.appendChild(box);
        });
    };

    const normalize = (str) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    const failAction = (msg) => {
        lives--;
        els.lives.innerText = "❤️".repeat(lives);
        if (questionStates[currentQIndex] > 0) questionStates[currentQIndex]--;

        const fb = document.createElement('div');
        fb.className = 's-feedback';
        fb.innerText = msg || "IMPACT !";
        root.appendChild(fb);
        setTimeout(() => fb.remove(), 1500);

        if (lives <= 0) {
            alert("VAISSEAU DÉTRUIT !");
            if (api.onFinish) api.onFinish(0, true); 
            else onExit();
        } else {
            loadRound(); 
        }
    };

    const triggerNuke = () => {
        isPaused = true;
        const flash = document.createElement('div');
        flash.className = 's-nuke-flash';
        root.appendChild(flash);
        setTimeout(() => { flash.remove(); isPaused = false; loadRound(); }, 800);
    };

    const handleBossInput = () => {
        if (isPaused) return;
        const qData = questionsList[currentQIndex];
        const correctTxt = qData.options[qData.a];
        if (normalize(els.bossInput.value) === normalize(correctTxt)) {
            questionStates[currentQIndex]++;
            triggerNuke();
        } else {
            failAction(`Non ! C'était : ${correctTxt}`);
        }
    };

    const clampShip = () => {
        const areaWidth = Math.max(1, els.area.clientWidth);
        const halfShip = Math.max(24, els.ship.getBoundingClientRect().width / 2);
        const marginPct = Math.min(45, ((halfShip + 6) / areaWidth) * 100);
        shipX = Math.max(marginPct, Math.min(100 - marginPct, shipX));
        els.ship.style.left = `${shipX}%`;
    };
    const moveShip = (delta) => { if (!isPaused) { shipX += delta; clampShip(); } };

    const fire = () => {
        if (isPaused || questionStates[currentQIndex] >= 2) return;
        shipAnimator.play(['SHOOT', 'TIRER', 'ATTACK'], { loop: false, onComplete: playShipFlight });
        const p = document.createElement('div');
        p.className = 's-projectile';
        p.style.left = shipX + '%';
        p.style.bottom = '80px'; 
        els.pLayer.appendChild(p);
        projectiles.push({ div: p, xPct: shipX, y: 80 });
    };

    const startBossPhase = () => {
        const boss = document.createElement('div');
        boss.className = 's-boss';
        if (sprites.boss) {
            const image = document.createElement('img');
            image.src = sprites.boss;
            image.alt = 'Boss';
            image.onerror = () => { image.remove(); boss.innerText = '🛸'; };
            boss.appendChild(image);
        } else boss.innerText = "🛸";
        boss.style.left = '50%';
        boss.style.top = '10%';
        els.eLayer.appendChild(boss);
        enemies.push({ div: boss, xPct: 50, y: 50, speed: 0.2 * STARSHIP_FALL_SPEED_MULTIPLIER, isCorrect: true, type: 'boss' });
    };

    const startInvaderPhase = () => {
        const qData = questionsList[currentQIndex];
        const opts = qData.options;
        const laneCount = Math.max(1, opts.length);
        let nextLane = 0;
        spawnInterval = setInterval(() => {
            if (isPaused || enemies.length >= laneCount) return;
            let laneIndex = nextLane % laneCount;
            nextLane++;
            for (let offset = 0; offset < laneCount; offset++) {
                const candidate = (laneIndex + offset) % laneCount;
                if (!enemies.some((enemy) => enemy.type === 'invader' && enemy.laneIndex === candidate)) {
                    laneIndex = candidate;
                    break;
                }
            }
            if (enemies.some((enemy) => enemy.type === 'invader' && enemy.laneIndex === laneIndex)) return;
            const rIdx = laneIndex;
            const isCorrect = (rIdx === qData.a);
            const el = document.createElement('div');
            el.className = isCorrect ? 's-enemy s-correct-target' : 's-enemy';
            const fullLabel = String(opts[rIdx] || '');
            el.innerText = formatOptionLabel(fullLabel, 10, 3);
            el.title = fullLabel;
            const startX = ((laneIndex + 0.5) / laneCount) * 100;
            el.style.left = startX + '%';
            const startY = Math.max(34, Math.min(110, els.area.clientHeight * 0.16));
            el.style.top = `${startY}px`;
            el.style.setProperty('--lane-count', String(laneCount));
            els.eLayer.appendChild(el);
            fitTextInBox(el, { maxFont: 18, minFont: 8, lineHeight: 1.1 });
            enemies.push({
                div: el,
                xPct: startX,
                y: startY,
                laneIndex,
                speed: (1.5 + (Math.random() * 1)) * STARSHIP_FALL_SPEED_MULTIPLIER,
                isCorrect: isCorrect,
                type: 'invader'
            });
        }, 1500);
    };

    const clearLevel = () => {
        clearInterval(spawnInterval);
        enemies.forEach(e => e.div.remove()); enemies = [];
        projectiles.forEach(p => p.div.remove()); projectiles = [];
    };

    const getNextQuestion = () => {
        const available = questionStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        if (available.length === 0) return null;
        const withoutPrevious = available.filter((index) => index !== currentQIndex);
        const pool = withoutPrevious.length > 0 ? withoutPrevious : available;
        return pool[Math.floor(Math.random() * pool.length)];
    };

    const loadRound = () => {
        clearLevel();
        const nextIdx = getNextQuestion();
        if (nextIdx === null) {
            alert("GALAXIE SAUVÉE !");
            if (api.onFinish) api.onFinish(lives * 100, true);
            else onExit();
            return;
        }
        currentQIndex = nextIdx;
        currentQ = questionsList[currentQIndex];
        const qData = currentQ;
        const score = questionStates[currentQIndex];
        els.qText.innerText = formatQuestionLabel(qData.q, 34, 3);
        fitTextInBox(els.qText, { maxFont: 20, minFont: 10, lineHeight: 1.15 });
        renderBars();
        if (score >= 2) {
            els.bossUI.style.display = 'flex';
            els.bossInput.value = '';
            setTimeout(() => els.bossInput.focus(), 50);
            startBossPhase();
        } else {
            els.bossUI.style.display = 'none';
            startInvaderPhase();
        }
    };

    const update = () => {
        if (!isPaused) {
            for (let i = projectiles.length - 1; i >= 0; i--) {
                const p = projectiles[i];
                p.y += 8;
                p.div.style.bottom = p.y + 'px';
                if (p.y > els.area.clientHeight + 30) { p.div.remove(); projectiles.splice(i, 1); }
            }
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                e.y += e.speed;
                e.div.style.top = e.y + 'px';
                if (e.type === 'invader') {
                    const eRect = e.div.getBoundingClientRect();
                    for (let j = projectiles.length - 1; j >= 0; j--) {
                        const p = projectiles[j];
                        const pRect = p.div.getBoundingClientRect();
                        if (!(pRect.right < eRect.left || pRect.left > eRect.right || pRect.bottom < eRect.top || pRect.top > eRect.bottom)) {
                            p.div.remove(); projectiles.splice(j, 1);
                            e.div.remove(); enemies.splice(i, 1);
                            if (e.isCorrect) { questionStates[currentQIndex]++; loadRound(); } else { failAction("MAUVAISE CIBLE !"); }
                            return; 
                        }
                    }
                }
                const shipRect = els.ship.getBoundingClientRect();
                const eRect = e.div.getBoundingClientRect();
                const hitbox = { left: shipRect.left + 10, right: shipRect.right - 10, top: shipRect.top + 10, bottom: shipRect.bottom - 10 };
                if (!(hitbox.right < eRect.left || hitbox.left > eRect.right || hitbox.bottom < eRect.top || hitbox.top > eRect.bottom)) {
                    failAction("COLLISION !"); return;
                }
                if (e.y > els.area.clientHeight - 20) { e.div.remove(); enemies.splice(i, 1); }
            }
        }
        frameId = requestAnimationFrame(update);
    };

    root.querySelector('.s-quit-btn').onclick = onExit;
    const handleKey = (e) => {
        const tag = String(e.target?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
        if (e.key === 'ArrowLeft') moveShip(-5);
        if (e.key === 'ArrowRight') moveShip(5);
        if (e.code === 'Space') { e.preventDefault(); fire(); }
    };
    document.addEventListener('keydown', handleKey);
    let mobileHold = null;
    const mobileActions = { left: () => moveShip(-3), right: () => moveShip(3), fire, jump: fire };
    const stopMobileHold = () => { if (mobileHold) clearInterval(mobileHold); mobileHold = null; };
    const removeMobileRouter = installCoordinateTouchRouter(root.querySelector('.s-mobile-controls'), {
        continuousCodes: ['left', 'right'],
        onPress: (code) => {
            stopMobileHold();
            mobileActions[code]?.();
            if (code === 'left' || code === 'right') mobileHold = setInterval(mobileActions[code], 70);
        },
        onRelease: stopMobileHold,
    });
    root.querySelectorAll('.s-mobile-btn').forEach((button) => button.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'touch') return;
        event.preventDefault();
        mobileActions[button.dataset.gameCode]?.();
    }));
    els.bossInput.onkeydown = (e) => {
        e.stopPropagation();
        if(e.key === 'Enter') handleBossInput();
    };
    els.nukeBtn.onclick = handleBossInput;
    const resizeObserver = new ResizeObserver(clampShip);
    resizeObserver.observe(els.area);
    clampShip();

    loadRound();
    update();

    return { destroy: () => { cancelAnimationFrame(frameId); clearInterval(spawnInterval); stopMobileHold(); removeMobileRouter(); resizeObserver.disconnect(); removeSurfaceProtection(); shipAnimator.destroy(); document.removeEventListener('keydown', handleKey); } };
}
