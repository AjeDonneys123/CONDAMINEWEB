/**
 * 🎮 CORE ENGINE V8.6 (SHARED ENGINE - FIX HITBOX CALLBACKS)
 * Rôle : Moteur de rendu partagé Prof/Élève.
 * Gère le dessin des personnages, les animations et le Boss Mode.
 * UPDATE V8.6 : Fusion intelligente des callbacks pour garantir que onPlayerHit fonctionne.
 */
export const createGameBase = (params) => {
    const { 
        audioBuffers, audioCtx, projectRef, sceneIdx, 
        imageAssets, resolveUrl, canvas, ctx, isMutedRef, 
        playParallelSound, callbacks 
    } = params;

    class ActorProxy {
        constructor(data, engine) { 
            this.id = data?.id || "unknown"; 
            this.name = data?.name || "ACTEUR"; 
            this.engine = engine;
            this.x = data?.initialX ?? 50; 
            this.y = data?.initialY ?? 50;
            this.baseScale = data?.scale ?? 1; 
            this.scale = this.baseScale;
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
                if (this.engine._triggerActionSounds) this.engine._triggerActionSounds(this.id, name);
            } 
        }
    }

    return class MiniGameBase {
        constructor(c, a, cb) {
            this.canvas = c || canvas; 
            this.ctx = ctx; 
            this.keys = {}; 
            
            // FIX V8.6 : Fusionner les callbacks système avec ceux passés par l'instance
            // Cela garantit que onPlayerHit (défini dans callbacks système) n'est pas écrasé par un {} vide
            this.callbacks = { ...(callbacks || {}), ...(cb || {}) };
            
            this.assets = a || {};
            this.isBossPhase = false;

            const project = projectRef?.current || {};
            const scenes = project.scenes || [];
            const s = scenes[sceneIdx] || { actors: [] };

            if(s.actors && Array.isArray(s.actors)) {
                s.actors.forEach(a => { 
                    this[a.name.toUpperCase()] = new ActorProxy(a, this); 
                });
            }
        }

        _triggerActionSounds(actorId, actionName) {
            try {
                const s = projectRef.current.scenes[sceneIdx];
                const actor = s?.actors?.find(a => a.id === actorId);
                const action = actor?.actions?.find(act => act.name.toUpperCase() === actionName.toUpperCase());
                if(action?.sounds) {
                    action.sounds.forEach(snd => {
                        if(playParallelSound) playParallelSound(snd.url);
                    });
                }
            } catch(e) {}
        }

        _render() {
            if (!this.ctx || !this.canvas) return;
            const project = projectRef?.current || {};
            const s = project.scenes?.[sceneIdx] || { actors: [], backdrops: [] };

            this.ctx.fillStyle = "#0f172a"; 
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            const bd = s.backdrops?.[s.currentBackdropIdx || 0];
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
                            
                            let scaleMultiplier = 1;
                            if (this.isBossPhase && p.name === 'ZOMBIE') {
                                scaleMultiplier = 1.6;
                                this.ctx.filter = "drop-shadow(0 0 15px red) hue-rotate(-50deg)";
                            }

                            let sz = 150 * (p.scale || 1) * scaleMultiplier;
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
