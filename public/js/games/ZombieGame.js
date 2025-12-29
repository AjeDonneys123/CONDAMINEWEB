// 1. IMPORT : On importe l'objet global 'api' depuis app.js
import { state, api } from '../app.js';

export class ZombieGame {
    constructor(container, controller) {
        this.c = container;
        this.ctrl = controller;

        this.arena = container.querySelector("#zombie-arena");
        this.zombie = container.querySelector("#z-zombie");
        this.projectile = container.querySelector("#z-projectile");
        this.qEl = container.querySelector("#z-question");
        this.feedback = container.querySelector("#feedback-bubble");
        
        this.aiZone = container.querySelector("#ai-input-zone");
        this.input = container.querySelector("#z-answer");
        this.btnSubmit = container.querySelector("#z-submit");

        this.qcmZone = container.querySelector("#options-grid");
        this.optBtns = container.querySelectorAll(".option-btn");

        this.zPos = 20; 
        this.interval = null; 
        this.projInterval = null; 
        this.isPaused = false;

        if(this.btnSubmit) this.btnSubmit.onclick = () => this.checkAI();
        if(this.input) this.input.onkeydown = (e) => { if(e.key==="Enter") this.checkAI(); };
        
        this.optBtns.forEach((btn, idx) => {
            btn.onclick = (e) => {
                e.target.style.transform = "scale(0.95)";
                setTimeout(() => e.target.style.transform = "scale(1)", 100);
                this.checkQCM(idx);
            };
        });
    }

    loadQuestion(q) {
        this.currentQ = q;
        if(this.qEl) this.qEl.textContent = q.q;
        if(this.feedback) { this.feedback.style.display = "none"; this.feedback.innerHTML = ""; }
        
        this.stop(); 
        this.zPos = 20; 
        if(this.zombie) { this.zombie.style.right = "20px"; this.zombie.style.display = "block"; }
        if(this.projectile) this.projectile.style.display = "none";
        this.isPaused = false;

        const hasOptions = (q.options && Array.isArray(q.options) && q.options.length > 0);

        if (hasOptions) {
            if(this.aiZone) this.aiZone.style.display = 'none';
            if(this.qcmZone) this.qcmZone.style.display = 'grid';
            this.optBtns.forEach((btn, i) => {
                btn.style.background = "white";
                btn.style.color = "#1e293b";
                btn.style.borderColor = "#e2e8f0";
                if (q.options[i]) {
                    btn.textContent = q.options[i];
                    btn.style.display = "block"; 
                } else {
                    btn.style.display = "none"; 
                }
            });
        } else {
            if(this.qcmZone) this.qcmZone.style.display = 'none';
            if(this.aiZone) this.aiZone.style.display = 'flex';
            if(this.input) {
                this.input.value = "";
                this.input.disabled = false;
                setTimeout(() => this.input.focus(), 100);
            }
            if(this.btnSubmit) this.btnSubmit.disabled = false;
        }
        
        this.start();
    }

    start() {
        if(this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            if(state.isGlobalPaused || this.ctrl.getState().isLocked || this.isPaused) return;
            this.zPos += 1.0; 
            if(this.zombie) this.zombie.style.right = this.zPos + "px";
            if(this.arena && this.zPos > (this.arena.offsetWidth - 80)) {
                this.handleZombieBite();
            }
        }, 50);
    }

    stop() { if(this.interval) clearInterval(this.interval); }

    handleZombieBite() {
        this.stop();
        this.ctrl.notifyWrongAnswer("Le zombie t'a mordu !");
        this.zPos = 20;
        if(this.zombie) this.zombie.style.right = "20px";
        setTimeout(() => this.start(), 1000);
    }

    shootProjectile() {
        if(this.feedback) this.feedback.style.display = "none";
        if(!this.projectile) { this.handleZombieHit(); return; }
        
        let projX = 60; 
        this.projectile.style.left = projX + "px";
        this.projectile.style.bottom = "45px"; 
        this.projectile.style.display = "block";

        if(this.projInterval) clearInterval(this.projInterval);
        this.projInterval = setInterval(() => {
            projX += 15; 
            this.projectile.style.left = projX + "px";
            const arenaWidth = this.arena.offsetWidth;
            const zombieLeftX = arenaWidth - this.zPos - 60;

            if (projX >= zombieLeftX) {
                clearInterval(this.projInterval);
                this.projectile.style.display = "none";
                this.handleZombieHit(); 
            }
            if (projX > arenaWidth) {
                clearInterval(this.projInterval);
                this.projectile.style.display = "none";
            }
        }, 20);
    }

    handleZombieHit() {
        if(this.zombie) this.zombie.style.display = "none"; 
        this.stop(); 
        this.ctrl.notifyCorrectAnswer(); 
    }

    checkQCM(idx) {
        if (this.isPaused) return;
        const selected = this.currentQ.options[idx];
        const correct = this.currentQ.a;
        let isCorrect = (typeof correct === 'number') ? (idx === correct) : (selected === correct);

        const btn = this.optBtns[idx];
        if (isCorrect) {
            btn.style.background = "#dcfce7";
            btn.style.borderColor = "#22c55e";
            btn.style.color = "#15803d";
            this.isPaused = true; 
            this.shootProjectile();
        } else {
            btn.style.background = "#fee2e2";
            btn.style.borderColor = "#ef4444";
            btn.style.color = "#991b1b";
            setTimeout(() => {
                btn.style.background = "white";
                btn.style.borderColor = "#e2e8f0";
                btn.style.color = "#1e293b";
            }, 500);
            this.ctrl.notifyWrongAnswer(); 
        }
    }

    async checkAI() {
        const val = this.input.value.trim(); if(!val) return;
        this.isPaused = true; 
        this.input.disabled = true; this.btnSubmit.disabled = true;
        this.showFeedback("🧠 L'IA réfléchit...", "hint");

        try {
            // 2. CORRECTION : UTILISATION DE api.verifyWithAI
            const res = await api.verifyWithAI({
                question: this.currentQ.q, 
                userAnswer: val, 
                expectedAnswer: this.currentQ.a, 
                playerId: state.currentPlayerId
            });

            let spellingHtml = "";
            if(res.corrections && res.corrections.length > 0) {
                spellingHtml = "<br><strong>Fautes :</strong><ul class='spelling-list'>";
                res.corrections.forEach(c => spellingHtml += `<li><s>${c.wrong}</s> → <b>${c.correct}</b></li>`);
                spellingHtml += "</ul>";
            }

            const btnHtml = `<div style="margin-top:10px;"><button id="btn-read-ok" style="background:#2563eb; color:white; border:none; padding:8px 16px; border-radius:4px; font-weight:bold; cursor:pointer;">OK</button></div>`;

            if(res.status === "correct") {
                const msg = spellingHtml ? "<strong>Juste !</strong> Mais..." : "<strong>Excellent !</strong>";
                this.showModalAndListen(msg + spellingHtml, "success", btnHtml, () => {
                    this.feedback.style.display = "none";
                    this.shootProjectile();
                });
            } else {
                this.showModalAndListen(`<strong>Non...</strong> ${res.feedback || ""}` + spellingHtml, "error", btnHtml, () => {
                    this.feedback.style.display = "none";
                    this.ctrl.notifyWrongAnswer(); 
                    this.isPaused = false;
                    this.input.disabled = false;
                    this.btnSubmit.disabled = false;
                    this.input.focus();
                });
            }
        } catch(e) { 
            this.showFeedback("Erreur.", "error"); 
            this.isPaused = false; this.input.disabled = false; this.btnSubmit.disabled = false;
        }
    }

    showModalAndListen(htmlContent, type, btnHtml, callback) {
        if(!this.feedback) return;
        this.feedback.innerHTML = htmlContent + btnHtml;
        this.feedback.className = ""; this.feedback.classList.add(`fb-${type}`);
        this.feedback.style.display = "block";
        this.feedback.style.zIndex = "100";
        this.feedback.style.pointerEvents = "auto";
        setTimeout(() => {
            const btn = this.c.querySelector("#btn-read-ok");
            if(btn) btn.onclick = (e) => { e.stopPropagation(); callback(); };
        }, 50);
    }
    
    showFeedback(html, type) {
        if(!this.feedback) return;
        this.feedback.innerHTML = html;
        this.feedback.className = ""; this.feedback.classList.add(`fb-${type}`);
        this.feedback.style.display = "block";
    }
}