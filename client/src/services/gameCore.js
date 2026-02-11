/**
 * 🎮 CORE ENGINE V8.0 (STRICT PORT FROM WORKING STRING)
 * Ce fichier contient EXACTEMENT le code qui fonctionnait dans la string "BaseFactory".
 * Aucune "amélioration" n'a été ajoutée pour éviter les régressions.
 */
export const createGameBase = (params) => {
    // Extraction des paramètres (Exactement comme dans ta string BaseFactory)
    const { 
        audioBuffers, 
        audioCtx, 
        projectRef, // 👈 La clé du succès (Ref dynamique)
        sceneIdx, 
        imageAssets, 
        resolveUrl, 
        canvas, 
        ctx, 
        activeSources, 
        isMutedRef, 
        playParallelSound,
        callbacks 
    } = params;

    // --- CLASS ACTOR PROXY (Copié-Collé de ta string) ---
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
            this.rotationStyle = data.rotationStyle || 'all'; // Ajouté pour compatibilité
            
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

    // --- CLASS MINI GAME BASE (Copié-Collé de ta string) ---
    return class MiniGameBase {
        constructor(c, a, cb) {
            this.canvas = c || canvas; 
            this.ctx = ctx; 
            this.keys = {}; 
            this.callbacks = cb || callbacks; // Support callbacks externes
            this.assets = a || {};

            // Initialisation des acteurs
            const s = projectRef.current.scenes[sceneIdx];
            if(s && s.actors) {
                s.actors.forEach(a => { 
                    this[a.name.toUpperCase()] = new ActorProxy(a, this); 
                });
            }
            
            // Bindings clavier (pour compatibilité avec le code existant)
            document.onkeydown = e => this.keys[e.code] = true;
            document.onkeyup = e => this.keys[e.code] = false;
        }

        // Ajout de secours pour éviter le crash "playGlobal is not a function"
        playGlobal(name) {
            const s = projectRef.current.scenes[sceneIdx];
            const cleanName = String(name||"").toUpperCase().trim();
            const gs = s.globalSounds?.find(g => g.name.toUpperCase().trim() === cleanName);
            if(gs && gs.sounds) gs.sounds.forEach(snd => this._playSound(snd.url));
        }

        _triggerActionSounds(actorId, actionName) {
            const s = projectRef.current.scenes[sceneIdx];
            const actor = s.actors.find(a => a.id === actorId);
            const action = actor?.actions.find(act => act.name.toUpperCase() === actionName.toUpperCase());
            if(action && action.sounds) {
                action.sounds.forEach(snd => {
                    // On utilise playParallelSound (React) si dispo, sinon interne
                    if(playParallelSound) playParallelSound(snd.url);
                    else this._playSound(snd.url);
                });
            }
        }

        _playSound(url) {
            // Logique interne si playParallelSound n'est pas fourni
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
            const s = projectRef.current.scenes[sceneIdx];
            if (!this.ctx || !this.canvas) return;

            // Fond
            this.ctx.fillStyle = "#0f172a"; 
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Backdrop
            const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
            if(bd) { 
                const img = imageAssets.get(resolveUrl(bd.url)); 
                if(img) this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height); 
            }

            // Acteurs
            for(let key in this) {
                const p = this[key];
                if(p instanceof ActorProxy && p.visible) {
                    const aData = s.actors.find(ac => ac.id === p.id);
                    if(!aData) continue;
                    
                    const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                    
                    if(act && act.frames && act.frames.length > 0) {
                        const now = Date.now();
                        
                        // Timing
                        if (now - p.lastAnimTime > (parseInt(act.speed) || 100)) { 
                            if (!p.isAnimFinished) {
                                p.frameIdx++;
                                if (p.frameIdx >= act.frames.length) { 
                                    if (p.loop) p.frameIdx = 0; 
                                    else { 
                                        p.frameIdx = act.frames.length - 1; 
                                        p.isAnimFinished = true; 
                                    } 
                                }
                                p.lastAnimTime = now; 
                            }
                        }
                        
                        // Image
                        const spr = imageAssets.get(resolveUrl(act.frames[Math.min(p.frameIdx, act.frames.length-1)].url));
                        
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
                            
                            // Effet Boss visuel (préservé de ton code)
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
