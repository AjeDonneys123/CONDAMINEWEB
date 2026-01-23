import { GameProgression } from '../mainGames';

export function initStarshipGame(root, api, onExit) {
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
                <div id="s-ship" class="s-ship">🚀</div>
                <div id="s-projectiles-layer"></div>
                <div id="s-enemies-layer"></div>
            </div>
            <div class="s-boss-interface" id="s-boss-ui" style="display:none">
                <input type="text" id="s-boss-input" class="s-boss-input" placeholder="CODE DE TIR !" autocomplete="off">
                <button id="s-nuke-btn" class="s-nuke-btn">☢️ NUKE</button>
            </div>
            <button class="s-mobile-shoot" id="s-mobile-fire">🔥</button>
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

    const moveShip = (delta) => { if (!isPaused) { shipX = Math.max(5, Math.min(95, shipX + delta)); els.ship.style.left = shipX + '%'; } };

    const fire = () => {
        if (isPaused || questionStates[currentQIndex] >= 2) return;
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
        boss.innerText = "🛸"; 
        boss.style.left = '50%';
        boss.style.top = '10%';
        els.eLayer.appendChild(boss);
        enemies.push({ div: boss, xPct: 50, y: 50, speed: 0.2, isCorrect: true, type: 'boss' });
    };

    const startInvaderPhase = () => {
        const qData = questionsList[currentQIndex];
        spawnInterval = setInterval(() => {
            if (isPaused || enemies.length > 6) return;
            const opts = qData.options;
            const rIdx = Math.floor(Math.random() * opts.length);
            const isCorrect = (rIdx === qData.a);
            const el = document.createElement('div');
            el.className = isCorrect ? 's-enemy s-correct-target' : 's-enemy';
            el.innerText = opts[rIdx];
            const startX = 10 + Math.random() * 80;
            el.style.left = startX + '%';
            el.style.top = '-60px';
            els.eLayer.appendChild(el);
            enemies.push({ div: el, xPct: startX, y: -60, speed: 1.5 + (Math.random() * 1), isCorrect: isCorrect, type: 'invader' });
        }, 1500);
    };

    const clearLevel = () => {
        clearInterval(spawnInterval);
        enemies.forEach(e => e.div.remove()); enemies = [];
        projectiles.forEach(p => p.div.remove()); projectiles = [];
    };

    const getNextQuestion = () => {
        if (currentQIndex !== -1 && questionStates[currentQIndex] < 3) return currentQIndex;
        const available = questionStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
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
        els.qText.innerText = qData.q;
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
                if (p.y > window.innerHeight) { p.div.remove(); projectiles.splice(i, 1); }
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
                if (e.y > window.innerHeight - 50) { e.div.remove(); enemies.splice(i, 1); }
            }
        }
        frameId = requestAnimationFrame(update);
    };

    root.querySelector('.s-quit-btn').onclick = onExit;
    const handleKey = (e) => { if (e.key === 'ArrowLeft') moveShip(-5); if (e.key === 'ArrowRight') moveShip(5); if (e.code === 'Space') { e.preventDefault(); fire(); } };
    document.addEventListener('keydown', handleKey);
    root.addEventListener('touchstart', (e) => { if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') { const x = e.touches[0].clientX; if (x < window.innerWidth / 2) moveShip(-5); else moveShip(5); } });
    root.querySelector('#s-mobile-fire').onclick = (e) => { e.stopPropagation(); fire(); };
    els.bossInput.onkeydown = (e) => { if(e.key === 'Enter') handleBossInput(); };
    els.nukeBtn.onclick = handleBossInput;

    loadRound();
    update();

    return { destroy: () => { cancelAnimationFrame(frameId); clearInterval(spawnInterval); document.removeEventListener('keydown', handleKey); } };
}