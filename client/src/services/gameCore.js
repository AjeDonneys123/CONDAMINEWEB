/**
 * 🎮 CORE ENGINE V8.2 (SHARED ENGINE - BULLETPROOF)
 * Correction : Ajout de sécurités pour éviter le crash si 'scenes' est absent.
 */

export const createGameBase = (params) => {
    const { 
        audioBuffers, 
        audioCtx, 
        projectRef, 
        sceneIdx, 
        imageAssets, 
        resolveUrl,  
        canvas, 
        ctx, 
        isMutedRef, 
        playParallelSound, 
        callbacks 
    } = params;

    class ActorProxy {
        constructor(data, engine) { 
            this.id = data.id; 
            this.name = data.name; 
            this.engine = engine;
            this.x = data.initialX || 50; 
            this.y = data.initialY || 50;
            this.baseScale = data.scale || 1; 
            this.scale = this.baseScale;
            this.visible = true; 
            this.direction = data.direction || 0; 
            this.rotationStyle = data.rotationStyle || 'all';
            this.currentAction = data.actions?.[0]?.name || 'IDLE';
            this.frameIdx = 0; 
            this.lastAnimTime = 0; 
            this.isAnimFinished = false; 
            this.loop = true;
        }
        play(name, loop = true) { 
            if(this.currentAction.toUpperCase() !== name.toUpperCase()) { 
                this.currentAction = name; 
                this.frameIdx = 0; 
                this.loop = loop; 
                this.isAnimFinished = false;
                this.engine._triggerActionSounds(this.id, name);
            } 
        }
    }

    return class MiniGameBase {
        constructor(c, a, cb) {
            this.canvas = c || canvas; 
            this.ctx = ctx; 
            this.keys = {}; 
            this.callbacks = cb || callbacks; 
            this.assets = a || {};

            // FIX V8.2 : SÉCURITÉ SUR L'ACCÈS AUX SCÈNES
            const project = projectRef.current || {};
            const scenes = project.scenes || [];
            const s = scenes[sceneIdx] || { actors: [], globalSounds: [], backdrops: [] };

            if(s.actors) {
                s.actors.forEach(a => { 
                    this[a.name.toUpperCase()] = new ActorProxy(a, this); 
                });
            }
            
            document.onkeydown = e => this.keys[e.code] = true;
            document.onkeyup = e => this.keys[e.code] = false;
        }

        playGlobal(name) {
            const scenes = projectRef.current?.scenes || [];
            const s = scenes[sceneIdx];
            if (!s) return;
            const cleanName = String(name||"").toUpperCase().trim();
            const gs = s.globalSounds?.find(g => g.name.toUpperCase().trim() === cleanName);
            if(gs && gs.sounds) gs.sounds.forEach(snd => this._playSound(snd.url));
        }

        _triggerActionSounds(actorId, actionName) {
            const scenes = projectRef.current?.scenes || [];
            const s = scenes[sceneIdx];
            if (!s) return;
            const actor = s.actors?.find(a => a.id === actorId);
            const action = actor?.actions?.find(act => act.name.toUpperCase() === actionName.toUpperCase());
            if(action && action.sounds) {
                action.sounds.forEach(snd => {
                    if(playParallelSound) playParallelSound(snd.url);
                    else this._playSound(snd.url);
                });
            }
        }

        _playSound(url) {
            if(isMutedRef?.current) return;
            const buffer = audioBuffers.get(url);
            if(buffer && audioCtx) {
                if (audioCtx.state === 'suspended') audioCtx.resume();
                try {
                    const source = audioCtx.createBufferSource();
                    source.buffer = buffer; source.connect(audioCtx.destination); source.start(0);
                } catch(e) { console.error(e); }
            }
        }

        _render() {
            const project = projectRef.current || {};
            const scenes = project.scenes || [];
            const s = scenes[sceneIdx];
            if (!this.ctx || !this.canvas || !s) return;

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
                    if(act && act.frames && act.frames.length > 0) {
                        const now = Date.now();
                        if (now - p.lastAnimTime > (parseInt(act.speed) || 100)) { 
                            if (!p.isAnimFinished) {
                                p.frameIdx++;
                                if (p.frameIdx >= act.frames.length) { 
                                    if (p.loop) p.frameIdx = 0; 
                                    else { p.frameIdx = act.frames.length - 1; p.isAnimFinished = true; } 
                                }
                                p.lastAnimTime = now; 
                            }
                        }
                        const frameUrl = act.frames[Math.min(p.frameIdx, act.frames.length-1)].url;
                        const spr = imageAssets.get(resolveUrl(frameUrl));
                        if(spr) {
                            const xPx = (p.x/100)*this.canvas.width; 
                            const yPx = (p.y/100)*this.canvas.height; 
                            let sz = 150*p.scale;
                            this.ctx.save(); 
                            this.ctx.translate(xPx, yPx);
                            if(p.rotationStyle === 'left-right' && Math.abs(p.scale) !== p.scale) {
                                this.ctx.scale(Math.sign(p.scale), 1);
                            } else if (p.direction) {
                                this.ctx.rotate(p.direction * Math.PI / 180);
                            }
                            if (this.isBossPhase && p.name === 'ZOMBIE') {
                                this.ctx.filter = "drop-shadow(0 0 15px red) hue-rotate(-50deg)";
                            }
                            this.ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); 
                            this.ctx.restore();
                        }
                    }
                }
            }
        }
    };
};
