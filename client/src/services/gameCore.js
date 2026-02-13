/**
 * 🎮 CORE ENGINE V11.2 (UI BRIDGE)
 */
export const createGameBase = (params) => {
    const { imageAssets, resolveUrl, canvas, ctx, playParallelSound, bridge } = params;

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
            this.assets = a || {};
            this.isBossPhase = false;
            this._triggerActionSounds = (actorId, actionName) => {
                const project = params.projectRef?.current || {};
                const s = project.scenes?.[params.sceneIdx];
                if (!s) return;
                const actor = s.actors.find(a => a.id === actorId);
                const action = actor?.actions.find(act => act.name.toUpperCase() === actionName.toUpperCase());
                if (action?.sounds) action.sounds.forEach(snd => playParallelSound(snd.url));
            };
            const safeTrigger = (type, val) => { if (bridge && bridge.trigger) bridge.trigger(type, val); };
            this.game = {
                damage: (v=1) => safeTrigger('DAMAGE', v),
                heal: (v=1) => safeTrigger('HEAL', v),
                winRound: () => safeTrigger('WIN_ROUND'),
                failRound: () => safeTrigger('FAIL_ROUND'),
                nextQuestion: () => safeTrigger('NEXT_Q'),
                setBoss: (v) => safeTrigger('SET_BOSS', v),
                setUI: (v) => safeTrigger('SET_UI', v), // ✅ AJOUT ICI
                gameOver: () => safeTrigger('GAME_OVER'),
                victory: () => safeTrigger('VICTORY'),
                shake: () => safeTrigger('SHAKE'),
                playAudio: (n) => safeTrigger('AUDIO', n)
            };
            this.callbacks = {
                onPlayerHit: () => this.game.damage(1),
                onRoundEnd: (success) => { if (success) { this.game.winRound(); this.game.nextQuestion(); } else { this.game.failRound(); } },
                ...(cb || {})
            };
            const project = params.projectRef?.current || {};
            const s = project.scenes?.[params.sceneIdx] || { actors: [] };
            if(s.actors) s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a, this); });
        }
        _render() {
            if (!this.ctx || !this.canvas) return;
            const project = params.projectRef?.current || {};
            const s = project.scenes?.[params.sceneIdx];
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
            if(bd) { const img = imageAssets.get(resolveUrl(bd.url)); if(img) this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height); }
            for(let key in this) {
                const p = this[key];
                if(p instanceof ActorProxy && p.visible) {
                    const aData = s.actors?.find(ac => ac.id === p.id);
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
                            const xPx = (p.x/100)*this.canvas.width; const yPx = (p.y/100)*this.canvas.height; let sz = 150 * (p.scale || 1);
                            if (this.isBossPhase && p.name === 'ZOMBIE') { sz *= 1.5; this.ctx.filter = "hue-rotate(-50deg) saturate(3)"; }
                            this.ctx.save(); this.ctx.translate(xPx, yPx);
                            if (p.rotationStyle === 'left-right' && p.direction > 90 && p.direction < 270) this.ctx.scale(-1, 1);
                            else if (p.rotationStyle === 'all') this.ctx.rotate(p.direction * Math.PI / 180);
                            this.ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); this.ctx.restore(); this.ctx.filter = "none";
                        }
                    }
                }
            }
        }
    };
};
