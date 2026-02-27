// coucou
class MiniGame extends MiniGameBase {
    constructor(canvas, assets, callbacks) {
        super(canvas, assets, callbacks);
        
        // 1. PLATEFORMES
        this.answerPlats =[
            { x: 15, y: 65, w: 12, color: '#3b82f6' },
            { x: 35, y: 55, w: 12, color: '#a855f7' },
            { x: 55, y: 65, w: 12, color: '#22c55e' },
            { x: 75, y: 55, w: 12, color: '#ef4444' }
        ];
        
        this.startPlat = { x: 5, y: 85, w: 15 };
        this.endPlat = { x: 85, y: 85, w: 15 };

        // PHYSIQUE
        this.gravity = 0.4;
        this.thrust = 0.8;
        this.maxUpSpeed = -8;
        
        this.velocity = 0;
        this.isGrounded = false;
        this.houseVisible = false;
        this.isFallingPenalty = false; 
        this.playerHalfHeight = 5; 
        this.normalScale = 0.5;
        this.bossScale = 0.75;

        // ÉTATS BOSS
        this.bossInitialized = false;
        this.p1PowerMode = false;
        this.bossDefeated = false;
        this.isStopped = false; // Gèle le jeu pendant les transitions

        this.resetInternalState();
    }

    ensureActors() {
        // Robustesse: selon le projet local, le héros peut s'appeler P1/HEROS/ACTOR_1.
        if (!this.HEROS) this.HEROS = this.P1 || this.PLAYER || this.ACTOR_1 || null;
        if (!this.BOSS) this.BOSS = this.P2 || this.ENNEMI || this.ACTOR_2 || null;
    }

    resetInternalState() {
        this.ensureActors();
        this.BOSS = this.BOSS || this.ACTOR_2 || null;

        if (this.HEROS) {
            this.HEROS.visible = true;
            this.HEROS.x = 10;
            this.HEROS.y = this.startPlat.y - this.playerHalfHeight;
            this.HEROS.scale = this.normalScale;
            this.HEROS.direction = 90;
            this.HEROS.rotationStyle = 'left-right';
            this.HEROS.play("IDLE", true);
        }

        if (this.BOSS) {
            this.BOSS.visible = false;
            this.BOSS.x = 110; // Caché à droite
        }

        this.velocity = 0;
        this.isGrounded = false;
        this.houseVisible = false;
        this.isFallingPenalty = false; 
        this.bossInitialized = false;
        this.p1PowerMode = false;
        this.bossDefeated = false;
        this.isStopped = false;
    }

    start() {
        this.ensureActors();
        this.resetInternalState();
        if(this.game && this.game.setUI) this.game.setUI(false);
    }

    // RÉPONSE AU CLAVIER PENDANT LE BOSS
    onResult(isCorrect) {
        if (!this.isBossPhase || this.bossDefeated || this.isStopped) return;

        if (isCorrect) {
            // BONNE RÉPONSE -> MARIO ATTAQUE
            this.p1PowerMode = true;
            if (this.HEROS) {
                this.HEROS.scale = this.bossScale; // Devient plus grand sans être disproportionné
                this.HEROS.direction = 90; // Regarde à droite
                this.HEROS.play("RUN", true);
            }
            if (this.game.setUI) this.game.setUI(false); // Cache l'input texte
        } else {
            // MAUVAISE RÉPONSE -> SECOUSSE ET DÉGÂTS
            if (this.game.damage) this.game.damage(1);
            if (this.game.failRound) this.game.failRound();
            if (this.game.shake) this.game.shake();
            
            // Le failRound désactive la phase Boss. On réinitialise pour le retour aux plateformes.
            this.bossInitialized = false; 
            if (this.game.setUI) this.game.setUI(false);
        }
    }

    update() {
        this.ensureActors();
        if (!this.HEROS || this.isStopped) return;
        // Garde-fou visibilité: le héros ne doit jamais disparaître.
        this.HEROS.visible = true;

        // --- MODE BOSS (PALIER 3) ---
        if (this.isBossPhase) {
            
            // 1. INITIALISATION DU COMBAT
            if (!this.bossInitialized) {
                this.HEROS.x = 15; 
                this.HEROS.y = this.startPlat.y - this.playerHalfHeight;
                this.HEROS.direction = 90;
                this.HEROS.scale = this.normalScale;
                this.HEROS.play("IDLE", true);
                
                if (this.BOSS) {
                    this.BOSS.visible = true;
                    this.BOSS.x = 110; 
                    this.BOSS.y = this.startPlat.y - 12; // Posé au sol
                    this.BOSS.rotationStyle = 'left-right'; 
                    this.BOSS.direction = 90; // Fixe le moonwalk (reste orienté à gauche par défaut)
                    this.BOSS.play("WALK", true);
                }
                
                this.bossInitialized = true;
                this.p1PowerMode = false;
                this.bossDefeated = false;
                if (this.game.setUI) this.game.setUI(true); // Fait apparaître l'input
            }

            // 2. COMBAT EN COURS
            if (this.BOSS && !this.bossDefeated) {
                
                if (!this.p1PowerMode) {
                    // Le Boss avance vers Mario
                    this.BOSS.x -= 0.12; 
                    
                    // COLLISION (Temps écoulé) : Le Boss écrase Mario
                    if (this.BOSS.x <= this.HEROS.x + 8) {
                        if (this.game.damage) this.game.damage(1); // Perd 1 coeur
                        if (this.game.failRound) this.game.failRound(); // Jauge baisse
                        if (this.game.shake) this.game.shake();
                        
                        this.bossInitialized = false; // Prépare le retour aux plateformes
                        if (this.game.setUI) this.game.setUI(false);
                    }
                } else {
                    // Mario géant fonce sur le Boss
                    this.HEROS.x += 2.5; 
                    
                    // COLLISION (Mario écrase le Boss)
                    if (this.HEROS.x >= this.BOSS.x - 8) {
                        this.bossDefeated = true;
                        
                        if (this.BOSS) {
                            this.BOSS.rotationStyle = 'all'; // Permet de le faire tourner en l'air
                            try { this.BOSS.play("BOING", false); } catch(e){} // Animation + Son local
                        }
                        if (this.game.audio) this.game.audio("BOING"); // Son global de sécurité
                        
                        // Valide le 3e palier (Remplit la jauge)
                        if (this.game.winRound) this.game.winRound(); 
                    }
                }
            }

            // 3. CINÉMATIQUE D'ÉJECTION
            if (this.bossDefeated && this.BOSS) {
                this.BOSS.x += 4; // Vole à droite
                this.BOSS.y -= 4; // Vole en haut
                this.BOSS.direction += 20; // Tourbillonne
                
                // Quand il disparaît de l'écran -> Fin du niveau
                if (this.BOSS.x > 130 || this.BOSS.y < -30) {
                    this.isStopped = true;
                    if (this.game.nextQuestion) this.game.nextQuestion();
                    this.resetInternalState();
                }
            }
            return; // On bloque le reste de la physique en mode Boss
        }

        // --- RETOUR AU MODE NORMAL (Plateformes) ---
        if (this.bossInitialized) {
            // Si on a perdu contre le boss, on nettoie l'écran pour reprendre
            this.resetInternalState();
            if (this.game.setUI) this.game.setUI(false);
        }

        // Contrôles Mario
        if (!this.isFallingPenalty) {
            if (this.keys['ArrowRight']) {
                this.HEROS.x += 0.6; this.HEROS.direction = 90;
                if (this.isGrounded) this.HEROS.play("MARCHE", true);
            } else if (this.keys['ArrowLeft']) {
                this.HEROS.x -= 0.6; this.HEROS.direction = -90;
                if (this.isGrounded) this.HEROS.play("MARCHE", true);
            } else {
                if (this.isGrounded) this.HEROS.play("IDLE", true);
            }

            // Saut
            if (this.keys['Space'] || this.keys['ArrowUp']) {
                this.velocity -= this.thrust;
                if (this.velocity < this.maxUpSpeed) this.velocity = this.maxUpSpeed;
                try { this.HEROS.play("VOLE", true); } catch(e){}
                this.isGrounded = false;
            }
        }

        // Physique & Gravité
        this.velocity += this.gravity;
        this.HEROS.y += this.velocity * 0.5;
        if (!Number.isFinite(this.HEROS.y)) {
            this.HEROS.y = this.startPlat.y - this.playerHalfHeight;
            this.velocity = 0;
        }

        // Plafond
        if (!this.isFallingPenalty && this.HEROS.y < 15) { 
            this.HEROS.y = 15; 
            this.velocity = 0; 
        }

        // Collisions Plateformes
        this.isGrounded = false;
        if (!this.isFallingPenalty) {
            let allPlats =[this.startPlat, this.endPlat, ...this.answerPlats];
            const feetY = this.HEROS.y + this.playerHalfHeight;

            for (let p of allPlats) {
                if (this.HEROS.x > p.x - 2 && this.HEROS.x < p.x + p.w + 2) {
                    if (feetY >= p.y - 2 && feetY <= p.y + 5 && this.velocity > 0) {
                        this.HEROS.y = p.y - this.playerHalfHeight;
                        this.velocity = 0;
                        this.isGrounded = true;
                        
                        // Touche une plateforme de réponse
                        if (allPlats.indexOf(p) >= 2) {
                            this.checkAnswer(allPlats.indexOf(p) - 2);
                        }
                    }
                }
            }
        }

        // Arrivée dans la Maison -> Valide une question
        if (this.houseVisible && this.HEROS.x > 85 && this.isGrounded) {
            this.isStopped = true;
            if(this.game.winRound) this.game.winRound();
            if(this.game.nextQuestion) this.game.nextQuestion();
            this.resetInternalState();
        }

        // Chute dans le vide
        if (this.HEROS.y > 110) {
            this.resetInternalState();
        }
    }

    checkAnswer(idx) {
        if (this.isFallingPenalty || this.houseVisible) return;
        const qIdx = this.currentQIndex || 0;
        const correct = (this.questions && this.questions[qIdx]) ? this.questions[qIdx].a : 0;
        if (idx === correct) {
            this.houseVisible = true; // Ouvre la maison
        } else { 
            if(this.game.damage) this.game.damage(1); 
            this.isFallingPenalty = true;
            this.velocity = Math.max(this.velocity, 2.4); // chute forcée
            setTimeout(() => { if (!this.isStopped) this.resetInternalState(); }, 750);
        }
    }

    drawHeroFallback(ctx, W, H) {
        this.ensureActors();
        if (!this.HEROS || !this.HEROS.visible) return;
        const hx = (this.HEROS.x / 100) * W;
        const hy = (this.HEROS.y / 100) * H;
        const base = Math.max(20, Math.min(40, 30 * (this.HEROS.scale || this.normalScale || 0.5)));
        const dir = this.HEROS.direction < 0 ? -1 : 1;

        ctx.save();
        ctx.translate(hx, hy - 2);
        ctx.scale(dir, 1);
        ctx.globalAlpha = 0.95;

        // Corps simplifié style Mario (fallback si sprite absent)
        ctx.fillStyle = "#2563eb"; // salopette
        ctx.fillRect(-base * 0.26, -base * 0.05, base * 0.52, base * 0.55);
        ctx.fillStyle = "#dc2626"; // haut rouge
        ctx.fillRect(-base * 0.24, -base * 0.28, base * 0.48, base * 0.24);
        ctx.fillStyle = "#fde68a"; // visage
        ctx.beginPath();
        ctx.arc(0, -base * 0.43, base * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b91c1c"; // casquette
        ctx.fillRect(-base * 0.2, -base * 0.57, base * 0.4, base * 0.12);
        ctx.fillRect(-base * 0.14, -base * 0.66, base * 0.28, base * 0.1);
        ctx.fillStyle = "#111827"; // chaussures
        ctx.fillRect(-base * 0.2, base * 0.46, base * 0.16, base * 0.08);
        ctx.fillRect(base * 0.04, base * 0.46, base * 0.16, base * 0.08);

        ctx.restore();
    }

    draw() {
        if (this.isStopped) return;
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const drawFittedText = (text, centerX, centerY, maxWidth) => {
            const raw = String(text || "");
            let size = 18;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            while (size > 9) {
                ctx.font = `900 ${size}px Arial`;
                if (ctx.measureText(raw).width <= maxWidth) break;
                size -= 1;
            }
            let label = raw;
            if (ctx.measureText(label).width > maxWidth) {
                while (label.length > 3 && ctx.measureText(`${label}…`).width > maxWidth) {
                    label = label.slice(0, -1);
                }
                label = `${label}…`;
            }
            ctx.fillStyle = "white";
            ctx.fillText(label, centerX, centerY);
        };

        // N'affiche les blocs réponses que si on N'EST PAS en phase Boss
        if (!this.isBossPhase) {
            const qIdx = this.currentQIndex || 0;
            const opts = (this.questions && this.questions[qIdx]) ? this.questions[qIdx].options : ["?", "?", "?", "?"];
            
            this.answerPlats.forEach((p, i) => {
                const px = (p.x/100)*W, pw = (p.w/100)*W, py = (4/100)*H;
                const boxW = pw + 26;
                const boxH = 44;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.roundRect(px - 13, py, boxW, boxH, 9);
                ctx.fill();
                drawFittedText(opts[i] || "", px + pw/2, py + boxH / 2, boxW - 12);
                
                // Plateforme physique
                ctx.fillStyle = p.color;
                ctx.fillRect((p.x/100)*W, (p.y/100)*H, (p.w/100)*W, 8);
            });
        }

        // Sols départ / arrivée
        ctx.fillStyle = "#475569";
        ctx.fillRect((this.startPlat.x/100)*W, (this.startPlat.y/100)*H, (this.startPlat.w/100)*W, 15);
        ctx.fillRect((this.endPlat.x/100)*W, (this.endPlat.y/100)*H, (this.endPlat.w/100)*W, 15);

        // Maison
        if (!this.isBossPhase) {
            const ex = (87/100)*W, ey = (85/100)*H;
            if (this.houseVisible) {
                ctx.fillStyle = "#f59e0b";
                ctx.fillRect(ex, ey - 40, 40, 40);
                ctx.fillStyle = "#b91c1c";
                ctx.beginPath();
                ctx.moveTo(ex-5, ey-40); ctx.lineTo(ex+45, ey-40); ctx.lineTo(ex+20, ey-60);
                ctx.fill();
            } else {
                ctx.font = "20px Arial";
                ctx.textAlign = "center";
                ctx.fillStyle = "#94a3b8"; 
                ctx.fillText("🔒", ex + 20, ey - 10);
            }
        }

        // Forçage visibilité héros: toujours dessiné en dernier (au-dessus des plateformes)
        this.drawHeroFallback(ctx, W, H);
    }
}
