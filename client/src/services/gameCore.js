/**
 * 🎮 CORE ENGINE V12.5 (ACTOR ALIASING)
 * REPAIRS:
 * - Normalisation des noms d'acteurs pour usage direct dans le code (Dot Notation).
 * - Alias de secours ACTOR_1, ACTOR_2.
 */
export const createGameBase = (params) => {
    const { imageAssets, resolveUrl, canvas, ctx, playParallelSound, bridge, questions, callbacks } = params;

    const normalizeKey = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

    class ActorProxy {
        constructor(data, engine) { 
            this.id = data?.id || "unknown"; 
            this.name = data?.name || "ACTEUR"; 
            this.engine = engine;
            this.x = data?.initialX ?? 50; 
            this.y = data?.initialY ?? 50;
            this.scale = data?.scale ?? 1;
            this.baseScale = data?.scale ?? 1;
            this.visible = true; 
            this.direction = data?.direction ?? 0; 
            this.rotationStyle = data?.rotationStyle || 'all';
            this.currentAction = data?.actions?.[0]?.name || 'IDLE';
            this.frameIdx = 0; 
            this.lastAnimTime = 0; 
            this.facingFrame = 0;
            this.flipX = false;
            this.isAnimFinished = String(this.currentAction).toUpperCase() === 'IDLE';
            this.loop = true;
        }
        play(name, loop = true) { 
            const normalizedName = String(name || '').toUpperCase();
            if (/HAUT|UP/.test(normalizedName)) this.facingFrame = 1;
            else if (/DROIT|RIGHT/.test(normalizedName)) this.facingFrame = 2;
            else if (/GAUCH|LEFT/.test(normalizedName)) this.facingFrame = 3;
            else if (/BAS|DOWN/.test(normalizedName)) this.facingFrame = 0;

            if (normalizedName === 'IDLE') {
                this.currentAction = name;
                this.frameIdx = this.facingFrame;
                this.loop = false;
                this.isAnimFinished = true;
                return;
            }
            if(String(this.currentAction).toUpperCase() !== String(name).toUpperCase()) { 
                this.currentAction = name; this.frameIdx = 0; this.loop = loop; this.isAnimFinished = false;
                if (this.engine._triggerActionSounds) this.engine._triggerActionSounds(this.id, name);
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
            this.questions = questions || []; 
            this.currentQIndex = 0;

            const safeTrigger = (type, val) => { if (bridge && bridge.trigger) bridge.trigger(type, val); };
            
            this.game = {
                damage: (v=1) => safeTrigger('DAMAGE', v),
                winRound: () => safeTrigger('WIN_ROUND'),
                failRound: () => safeTrigger('FAIL_ROUND'),
                nextQuestion: () => safeTrigger('NEXT_Q'),
                setBoss: (v) => safeTrigger('SET_BOSS', v),
                setUI: (v) => safeTrigger('SET_UI', v),
                shake: () => safeTrigger('SHAKE'),
                audio: (eventName) => safeTrigger('AUDIO', eventName),
                submitAnswer: (idx) => safeTrigger('SUBMIT_ANSWER', idx),
                start: () => {}
            };

            this.callbacks = cb || {};
            
            this._triggerActionSounds = (actorId, actionName) => {
                const project = params.projectRef?.current || {};
                const s = project.scenes?.[0];
                if (!s) return;
                const actor = s.actors.find(a => a.id === actorId);
                const action = actor?.actions.find(act => act.name.toUpperCase() === actionName.toUpperCase());
                if (action?.sounds) action.sounds.forEach(snd => playParallelSound(snd.url));
            };

            const project = params.projectRef?.current || {};
            const scene = project.scenes?.[0] || { actors: [] };
            
            if(scene.actors) {
                scene.actors.forEach((a, index) => { 
                    const safeName = normalizeKey(a.name);
                    const proxy = new ActorProxy(a, this);
                    this[safeName] = proxy; 
                    this[safeName.toLowerCase()] = proxy;
                    const displayName = String(a.name || '').trim().replace(/[^a-zA-Z0-9_$]/g, '_');
                    if (displayName) {
                        this[displayName] = proxy;
                        this[displayName.charAt(0).toUpperCase() + displayName.slice(1)] = proxy;
                    }
                    this[`ACTOR_${index+1}`] = proxy; // Alias de secours numérique
                });
                
                // Defaults pour compatibilité
                if (!this.HEROS && scene.actors.length > 0) this.HEROS = this[normalizeKey(scene.actors[0].name)];
                if (scene.actors.length > 1) {
                    const secondActor = this[normalizeKey(scene.actors[1].name)];
                    if (!this.ZOMBIE) this.ZOMBIE = secondActor;
                    // Alias de PNJ utilisés par les scripts d'aventure existants.
                    if (!this.SHEN) this.SHEN = secondActor;
                    if (!this.shen) this.shen = secondActor;
                    if (!this.PNJ) this.PNJ = secondActor;
                    if (!this.pnj) this.pnj = secondActor;
                    if (!this.NPC) this.NPC = secondActor;
                    if (!this.npc) this.npc = secondActor;
                }
            }
        }
        
        _render() {
            if (!this.ctx || !this.canvas) return;
            const project = params.projectRef?.current || {};
            const scene = project.scenes?.[0];
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            const bd = scene?.backdrops?.[scene.currentBackdropIdx || 0];
            if(bd) { const img = imageAssets.get(resolveUrl(bd.url)); if(img) this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height); }
            const renderedActorIds = new Set();
            for(let key in this) {
                const p = this[key];
                if(p instanceof ActorProxy && p.visible) {
                    // Un même proxy possède plusieurs alias (nom, ACTOR_2, SHEN...).
                    // Il ne doit malgré tout être dessiné qu'une seule fois par frame.
                    if (renderedActorIds.has(p.id)) continue;
                    renderedActorIds.add(p.id);
                    const aData = scene.actors?.find(ac => ac.id === p.id);
                    const act = (aData?.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData?.actions?.[0];
                    if(act?.frames?.length > 0) {
                        const now = Date.now();
                        if (now - p.lastAnimTime > (parseInt(act.speed) || 100)) { 
                            if (!p.isAnimFinished) {
                                p.frameIdx++;
                                if (p.frameIdx >= act.frames.length) { if (p.loop) p.frameIdx = 0; else { p.frameIdx = act.frames.length - 1; p.isAnimFinished = true; } }
                                p.lastAnimTime = now; 
                            }
                        }
                        const spr = imageAssets.get(resolveUrl(act.frames[Math.min(p.frameIdx, act.frames.length - 1)].url));
                        if(spr) {
                            const xPx = (p.x/100)*this.canvas.width, yPx = (p.y/100)*this.canvas.height; let sz = 150 * (p.scale || 1);
                            if (this.isBossPhase && p.name === 'ZOMBIE') { sz *= 1.5; this.ctx.filter = "hue-rotate(-50deg) saturate(3)"; }
                            this.ctx.save(); this.ctx.translate(xPx, yPx);
                            if (p.flipX || (p.rotationStyle === 'left-right' && p.direction > 90 && p.direction < 270)) this.ctx.scale(-1, 1);
                            else if (p.rotationStyle === 'all') this.ctx.rotate(p.direction * Math.PI / 180);
                            this.ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); this.ctx.restore(); this.ctx.filter = "none";
                        }
                    }
                }
            }
        }
    };
};
