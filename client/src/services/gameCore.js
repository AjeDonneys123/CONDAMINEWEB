/**
 * 🎮 CORE ENGINE V10 (HYBRID & ROBUST)
 * CORRECTIF CRITIQUE : Rétro-compatibilité totale.
 * Si un vieux script appelle `this.callbacks.onPlayerHit`, le moteur le traduit automatiquement en `this.game.damage(1)`.
 * Plus de crash sur les anciens scripts.
 */
export const createGameBase = (params) => {
    const { 
        imageAssets, resolveUrl, canvas, ctx, 
        playParallelSound, bridge 
    } = params;

    class ActorProxy {
        constructor(data, engine) { 
            this.id = data?.id || "unknown"; 
            this.name = data?.name || "ACTEUR"; 
            this.engine = engine;
            this.x = data?.initialX ?? 50; 
            this.y = data?.initialY ?? 50;
            this.scale = data?.scale ?? 1;
            this.visible = true; 
            this.direction = data?.direction ?? 0; 
            this.rotationStyle = data?.rotationStyle || 'all';
            this.currentAction = data?.actions?.[0]?.name || 'IDLE';
            this.frameIdx = 0; 
            this.lastAnimTime = 0; 
            this.isAnimFinished = false; 
            this.loop = true;
        }
        
        play(name, loop = true) { 
            if(String(this.currentAction).toUpperCase() !== String(name).toUpperCase()) { 
                this.currentAction = name; 
                this.frameIdx = 0; 
                this.loop = loop; 
                this.isAnimFinished = false;
            } 
        }
    }

    return class MiniGameBase {
        constructor(c, a, cb) {
            this.canvas = c || canvas; 
            this.ctx = ctx; 
            this.keys = {}; 
            this.assets = a || {};
            this.isBossPhase = false;
            this.isStopped = false; // Sécurité boucle
            
            // --- SYSTÈME DE SECURITÉ BRIDGE ---
            const safeTrigger = (type, val) => {
                if (bridge && bridge.trigger) bridge.trigger(type, val);
            };

            // 1. NOUVELLE API (Bridge)
            this.game = {
                damage: (v=1) => safeTrigger('DAMAGE', v),
                heal: (v=1) => safeTrigger('HEAL', v),
                winRound: () => safeTrigger('WIN_ROUND'),
                failRound: () => safeTrigger('FAIL_ROUND'),
                nextQuestion: () => safeTrigger('NEXT_Q'),
                setBoss: (v) => safeTrigger('SET_BOSS', v),
                gameOver: () => safeTrigger('GAME_OVER'),
                victory: () => safeTrigger('VICTORY'),
                shake: () => safeTrigger('SHAKE'),
                playAudio: (n) => safeTrigger('AUDIO', n)
            };

            // 2. ANCIENNE API (Rétro-compatibilité pour éviter le crash 'onPlayerHit')
            // On mappe les anciens appels vers le nouveau bridge
            this.callbacks = {
                onPlayerHit: () => {
                    console.warn("⚠️ [Legacy] 'onPlayerHit' détecté -> Redirection vers 'game.damage(1)'");
                    this.game.damage(1);
                },
                onRoundEnd: (success) => {
                    console.warn("⚠️ [Legacy] 'onRoundEnd' détecté -> Redirection Bridge");
                    if (success) {
                        this.game.winRound();
                        this.game.nextQuestion();
                    } else {
                        this.game.failRound();
                    }
                },
                ...(cb || {}) // Fusion avec d'éventuels callbacks externes
            };

            // Init Acteurs
            const project = params.projectRef?.current || {};
            const scenes = project.scenes || [];
            const s = scenes[params.sceneIdx] || { actors: [] };

            if(s.actors && Array.isArray(s.actors)) {
                s.actors.forEach(a => { 
                    this[a.name.toUpperCase()] = new ActorProxy(a, this); 
                });
            }
        }

        _render() {
            if (!this.ctx || !this.canvas) return;
            const project = params.projectRef?.current || {};
            const s = project.scenes?.[params.sceneIdx];

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
            if(bd) { 
                const img = imageAssets.get(resolveUrl(bd.url)); 
                if(img) this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height); 
            }

            for(let key in this) {
                const p = this[key];
                if(p instanceof ActorProxy && p.visible) {
                    const aData = s.actors?.find(ac => ac.id === p.id);
                    if(!aData) continue;
                    const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                    
                    if(act?.frames?.length > 0) {
                        const now = Date.now();
                        const speed = parseInt(act.speed) || 100;
                        if (now - p.lastAnimTime > speed) { 
                            if (!p.isAnimFinished) {
                                p.frameIdx++;
                                if (p.frameIdx >= act.frames.length) { 
                                    if (p.loop) p.frameIdx = 0; 
                                    else { p.frameIdx = act.frames.length - 1; p.isAnimFinished = true; } 
                                }
                                p.lastAnimTime = now; 
                            }
                        }
                        const frame = act.frames[Math.min(p.frameIdx, act.frames.length - 1)];
                        const spr = imageAssets.get(resolveUrl(frame.url));
                        if(spr) {
                            const xPx = (p.x/100)*this.canvas.width; 
                            const yPx = (p.y/100)*this.canvas.height; 
                            let sz = 150 * (p.scale || 1);
                            
                            if (this.isBossPhase && p.name === 'ZOMBIE') {
                                sz *= 1.5;
                                this.ctx.filter = "hue-rotate(-50deg) saturate(3)";
                            }

                            this.ctx.save(); 
                            this.ctx.translate(xPx, yPx);
                            
                            if (p.rotationStyle === 'left-right' && p.direction > 90 && p.direction < 270) {
                                this.ctx.scale(-1, 1);
                            } else if (p.rotationStyle === 'all') {
                                this.ctx.rotate(p.direction * Math.PI / 180);
                            }
                            
                            this.ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); 
                            this.ctx.restore();
                            this.ctx.filter = "none";
                        }
                    }
                }
            }
        }
    };
};
