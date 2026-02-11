/**
 * 🎮 CORE ENGINE V8.1 (SHARED ENGINE)
 * Ce fichier contient la logique basique du moteur de jeu (rendu, gestion des acteurs).
 * Il est utilisé à la fois par le Studio (Prof) et le Player (Élève).
 */

export const createGameBase = (params) => {
    // Extraction des dépendances injectées par React
    const { 
        audioBuffers, 
        audioCtx, 
        projectRef, // Référence dynamique vers le JSON du projet (Scènes, Acteurs)
        sceneIdx, 
        imageAssets, // Map<Url, ImageObject>
        resolveUrl,  // Fonction utilitaire pour nettoyer les URLs
        canvas, 
        ctx, 
        isMutedRef, 
        playParallelSound, // Fonction pour jouer des sons sans bloquer le thread
        callbacks 
    } = params;

    // --- CLASSE PROXY ACTEUR ---
    // Sert d'interface entre le code utilisateur (this.HEROS.x) et les données brutes
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
            
            // Animation
            this.currentAction = data.actions?.[0]?.name || 'IDLE';
            this.frameIdx = 0; 
            this.lastAnimTime = 0; 
            this.isAnimFinished = false; 
            this.loop = true;
        }

        play(name, loop = true) { 
            // On ne change l'action que si elle est différente pour éviter de reset l'anim à chaque frame
            if(this.currentAction.toUpperCase() !== name.toUpperCase()) { 
                this.currentAction = name; 
                this.frameIdx = 0; 
                this.loop = loop; 
                this.isAnimFinished = false;
                this.engine._triggerActionSounds(this.id, name);
            } 
        }
    }

    // --- CLASSE DE BASE DU JEU ---
    // C'est cette classe que le code utilisateur (ZOMBIE_GAME_CODE) va étendre
    return class MiniGameBase {
        constructor(c, a, cb) {
            this.canvas = c || canvas; 
            this.ctx = ctx; 
            this.keys = {}; 
            this.callbacks = cb || callbacks; 
            this.assets = a || {};

            // Initialisation des acteurs au démarrage
            // On lit projectRef.current pour avoir les données à jour (même si le prof modifie en live)
            const s = projectRef.current.scenes[sceneIdx];
            if(s && s.actors) {
                s.actors.forEach(a => { 
                    // On crée une propriété this.HEROS, this.ZOMBIE, etc.
                    this[a.name.toUpperCase()] = new ActorProxy(a, this); 
                });
            }
            
            // Bindings clavier de secours (si non gérés par React)
            // Note: React gère déjà les touches via `keysPressed.current`, mais ceci est une sécurité
            document.onkeydown = e => this.keys[e.code] = true;
            document.onkeyup = e => this.keys[e.code] = false;
        }

        // Jouer un son global (ex: "VICTOIRE")
        playGlobal(name) {
            const s = projectRef.current.scenes[sceneIdx];
            const cleanName = String(name||"").toUpperCase().trim();
            const gs = s.globalSounds?.find(g => g.name.toUpperCase().trim() === cleanName);
            if(gs && gs.sounds) gs.sounds.forEach(snd => this._playSound(snd.url));
        }

        // Méthode interne : Déclenche les sons liés à une action (ex: "TIRER" -> "bang.mp3")
        _triggerActionSounds(actorId, actionName) {
            const s = projectRef.current.scenes[sceneIdx];
            const actor = s.actors.find(a => a.id === actorId);
            const action = actor?.actions.find(act => act.name.toUpperCase() === actionName.toUpperCase());
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

        // --- BOUCLE DE RENDU PRINCIPALE ---
        // Appelée automatiquement par GameEngine.jsx via requestAnimationFrame
        _render() {
            const s = projectRef.current.scenes[sceneIdx];
            if (!this.ctx || !this.canvas) return;

            // 1. Fond Noir
            this.ctx.fillStyle = "#0f172a"; 
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // 2. Décor (Backdrop)
            const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
            if(bd) { 
                // CRUCIAL : On utilise resolveUrl pour matcher la clé stockée dans le Loader
                const img = imageAssets.get(resolveUrl(bd.url)); 
                if(img) this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height); 
            }

            // 3. Acteurs
            for(let key in this) {
                const p = this[key];
                if(p instanceof ActorProxy && p.visible) {
                    // On retrouve les données sources pour récupérer les frames
                    const aData = s.actors.find(ac => ac.id === p.id);
                    if(!aData) continue;
                    
                    const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                    
                    if(act && act.frames && act.frames.length > 0) {
                        const now = Date.now();
                        
                        // Gestion Timing Animation
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
                        
                        // Dessin Sprite
                        const frameUrl = act.frames[Math.min(p.frameIdx, act.frames.length-1)].url;
                        // CRUCIAL : resolveUrl ici aussi !
                        const spr = imageAssets.get(resolveUrl(frameUrl));
                        
                        if(spr) {
                            // Conversion coordonnées % -> Pixels
                            const xPx = (p.x/100)*this.canvas.width; 
                            const yPx = (p.y/100)*this.canvas.height; 
                            let sz = 150*p.scale;
                            
                            this.ctx.save(); 
                            this.ctx.translate(xPx, yPx);
                            
                            // Gestion Rotation / Miroir
                            if(p.rotationStyle === 'left-right' && Math.abs(p.scale) !== p.scale) {
                                this.ctx.scale(Math.sign(p.scale), 1);
                            } else if (p.direction) {
                                this.ctx.rotate(p.direction * Math.PI / 180);
                            }
                            
                            // Effet Boss Rouge (Spécifique Zombie)
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
