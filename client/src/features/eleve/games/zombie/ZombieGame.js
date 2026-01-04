export class ZombieGame {
    constructor(container, controller) {
        console.log("🧟 [ZOMBIE ENGINE] Initialisation...");
        this.c = container;
        this.ctrl = controller; // Le pont vers React (API, State)

        // Récupération des éléments du DOM (injectés par React)
        this.arena = container.querySelector("#zombie-arena");
        this.zombie = container.querySelector("#z-zombie");
        this.projectile = container.querySelector("#z-projectile");
        this.qEl = container.querySelector("#z-question");
        this.feedback = container.querySelector("#feedback-bubble");
        
        // Inputs
        this.aiZone = container.querySelector("#ai-input-zone");
        this.input = container.querySelector("#z-answer");
        this.btnSubmit = container.querySelector("#z-submit");

        // QCM
        this.qcmZone = container.querySelector("#options-grid");
        this.optBtns = container.querySelectorAll(".option-btn");

        // État interne du jeu
        this.zPos = 20; 
        this.interval = null; 
        this.projInterval = null; 
        this.isPaused = false;

        this.initListeners();
    }

    initListeners() {
        if(this.btnSubmit) this.btnSubmit.onclick = () => this.checkAI();
        if(this.input) this.input.onkeydown = (e) => { if(e.key==="Enter") this.checkAI(); };
        
        this.optBtns.forEach((btn, idx) => {
            btn.onclick = (e) => {
                // Petit effet visuel
                e.target.style.transform = "scale(0.95)";
                setTimeout(() => e.target.style.transform = "scale(1)", 100);
                this.checkQCM(idx);
            };
        });
    }

    loadQuestion(q) {
        console.log("🧟 [ZOMBIE] Nouvelle Question :", q);
        this.currentQ = q;
        
        if(this.qEl) this.qEl.textContent = q.q;
        if(this.feedback) { this.feedback.style.display = "none"; this.feedback.innerHTML = ""; }
        
        // Reset Positions
        this.stop(); 
        this.zPos = 20; 
        if(this.zombie) { this.zombie.style.right = "20px"; this.zombie.style.display = "block"; }
        if(this.projectile) this.projectile.style.display = "none";
        this.isPaused = false;

        // Détection du mode : QCM ou IA
        const hasOptions = (q.options && Array.isArray(q.options) && q.options.length > 0);

        if (hasOptions) {
            // MODE QCM
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
            // MODE IA (Réponse libre)
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
            if(this.isPaused) return;
            
            // Le zombie avance
            this.zPos += 1.5; 
            if(this.zombie) this.zombie.style.right = this.zPos + "px";
            
            // Collision Zombie -> Héro
            if(this.arena && this.zPos > (this.arena.offsetWidth - 80)) {
                this.handleZombieBite();
            }
        }, 50);
    }

    stop() { if(this.interval) clearInterval(this.interval); }

    handleZombieBite() {
        this.stop();
        this.ctrl.playSound('bite'); // Si le controller gère le son
        this.showFeedback("<strong>Mordu !</strong> 🧟", "error");
        
        setTimeout(() => {
            this.ctrl.onWrong(); // Notifie React que c'est raté
        }, 1500);
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
            projX += 25; // Vitesse du projectile
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
        this.ctrl.onCorrect(); // Notifie React que c'est gagné
    }

    // --- LOGIQUE QCM ---
    checkQCM(idx) {
        if (this.isPaused) return;
        
        const selected = this.currentQ.options[idx];
        const correct = this.currentQ.a;
        
        // Vérif : supporte index (0,1,2) ou valeur ("reponse")
        let isCorrect = (typeof correct === 'number') ? (idx === correct) : (selected === correct);

        const btn = this.optBtns[idx];

        if (isCorrect) {
            btn.style.background = "#dcfce7";
            btn.style.borderColor = "#22c55e";
            this.isPaused = true; 
            this.shootProjectile();
        } else {
            btn.style.background = "#fee2e2";
            btn.style.borderColor = "#ef4444";
            
            // On laisse l'erreur 0.5s puis on reprend
            setTimeout(() => {
                btn.style.background = "white";
                btn.style.borderColor = "#e2e8f0";
            }, 500);
            
            // Pénalité : Le zombie avance d'un coup !
            this.zPos += 50;
        }
    }

    // --- LOGIQUE IA ---
    async checkAI() {
        const val = this.input.value.trim(); if(!val) return;
        this.isPaused = true; 
        this.input.disabled = true; this.btnSubmit.disabled = true;
        
        this.showFeedback("🧠 Analyse IA...", "neutral");

        // On délègue l'appel API au controller React
        try {
            const res = await this.ctrl.checkAnswerWithAI(this.currentQ.q, val);
            
            // Construction du HTML de correction
            let html = "";
            if(res.corrections && res.corrections.length > 0) {
                html = "<ul style='text-align:left; margin-top:10px; font-size:0.9rem;'>";
                res.corrections.forEach(c => html += `<li><s>${c.wrong}</s> ➔ <b>${c.correct}</b></li>`);
                html += "</ul>";
            }

            // Bouton OK pour fermer la modale
            const btnHtml = `<br><button id="btn-ok-fb" style="margin-top:10px; padding:5px 15px; background:#2563eb; color:white; border:none; border-radius:5px; cursor:pointer;">Continuer</button>`;

            if(res.grade && parseInt(res.grade) > 10) {
                // Succès
                this.showFeedback(`<strong>Correct !</strong> ${res.grade}` + html, "success");
                setTimeout(() => {
                    this.feedback.style.display = 'none';
                    this.shootProjectile();
                }, 1500); // Délai pour lire
            } else {
                // Echec
                this.showFeedback(`<strong>Incorrect</strong> ${html || res.feedback_fond}` + btnHtml, "error");
                
                // Attente du clic sur OK
                setTimeout(() => {
                    const btn = this.c.querySelector("#btn-ok-fb");
                    if(btn) btn.onclick = () => {
                        this.feedback.style.display = "none";
                        this.isPaused = false;
                        this.input.disabled = false;
                        this.btnSubmit.disabled = false;
                        this.input.focus();
                        this.zPos += 50; // Pénalité
                    };
                }, 100);
            }

        } catch(e) {
            console.error(e);
            this.showFeedback("Erreur technique", "error");
            this.isPaused = false;
        }
    }

    showFeedback(html, type) {
        if(!this.feedback) return;
        this.feedback.innerHTML = html;
        this.feedback.className = ""; 
        this.feedback.classList.add(`fb-${type}`);
        this.feedback.style.display = "block";
    }
}