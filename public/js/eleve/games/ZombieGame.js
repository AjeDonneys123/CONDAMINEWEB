import { state, api } from '../../../app.js';

export class ZombieGame {
    constructor(container, levels, controller) {
        this.c = container; this.levels = levels; this.ctrl = controller;
        this.currentQIdx = 0; this.lives = 4; this.score = 0;
        this.c.innerHTML = `
            <div id="zombie-arena" style="position:relative; height:250px; background:#dbeafe; overflow:hidden; border-radius:10px; border:2px solid #60a5fa;">
                <img id="z-zombie" src="https://em-content.zobj.net/source/apple/354/zombie_1f9df.png" style="position:absolute; right:20px; bottom:10px; height:100px; transition: right 0.1s linear;">
                <div id="z-projectile" style="position:absolute; width:20px; height:20px; background:yellow; border-radius:50%; display:none; bottom:22px;"></div>
            </div>
            <div id="z-question" style="text-align:center; font-weight:bold; margin:15px 0; font-size:1.2rem;"></div>
            <div id="options-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;"></div>
        `;
        this.zombie = this.c.querySelector("#z-zombie");
        this.projectile = this.c.querySelector("#z-projectile");
        this.qEl = this.c.querySelector("#z-question");
        this.grid = this.c.querySelector("#options-grid");
        this.init();
    }

    init() {
        const lvl = this.levels[0];
        if(!lvl) return;
        document.getElementById("levelTitle").textContent = lvl.title;
        this.ctrl.setupUI(lvl.questions.length);
        this.ctrl.updateLives(this.lives);
        this.loadQuestion();
    }

    loadQuestion() {
        const q = this.levels[0].questions[this.currentQIdx];
        this.currentQ = q;
        this.qEl.textContent = q.q;
        this.grid.innerHTML = "";
        q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.className = "option-btn"; btn.textContent = opt;
            btn.onclick = () => this.check(i);
            this.grid.appendChild(btn);
        });
        this.zPos = 20; this.startLoop();
    }

    startLoop() {
        if(this.int) clearInterval(this.int);
        this.int = setInterval(() => {
            if(state.isGlobalPaused) return;
            this.zPos += 1.5; this.zombie.style.right = this.zPos + "px";
            if(this.zPos > 240) { 
                clearInterval(this.int); this.lives--; this.ctrl.updateLives(this.lives); 
                if(this.lives <= 0) this.ctrl.gameOver(); else this.loadQuestion(); 
            }
        }, 50);
    }

    check(i) {
        if(i === this.currentQ.a) { clearInterval(this.int); this.shoot(); }
        else { this.lives--; this.ctrl.updateLives(this.lives); if(this.lives <= 0) this.ctrl.gameOver(); }
    }

    shoot() {
        this.projectile.style.display = "block";
        let p = 60; const pi = setInterval(() => {
            p += 20; this.projectile.style.left = p + "px";
            if(p > 320) { 
                clearInterval(pi); this.projectile.style.display = "none"; 
                this.score++; this.ctrl.updateProgress(this.score, this.levels[0].questions.length, this.currentQIdx);
                if(this.score >= this.levels[0].questions.length) this.ctrl.levelComplete(); 
                else { this.currentQIdx++; this.loadQuestion(); }
            }
        }, 20);
    }
}