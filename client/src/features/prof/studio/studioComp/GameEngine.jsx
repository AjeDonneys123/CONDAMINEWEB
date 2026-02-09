// @signatures: GameEngine, handleStartGame, logSonde
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';

/**
 * 🎮 MOTEUR "MOUVEMENT & SON" (V825 - FIX SCOPE)
 * Corrige "MiniGameBase is not defined" en injectant la classe de base
 * dans le scope du script utilisateur via une Factory dédiée.
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);
    
    // Références persistantes
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);

    const logSonde = (msg, type = 'info') => {
        const id = Math.random();
        setDebugLogs(prev => [...prev, { id, text: msg, type }].slice(-6));
    };

    // 1. PRÉ-CHARGEMENT DES RESSOURCES
    useEffect(() => {
        logSonde("🛠️ Chargement ressources...");
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const scene = project.scenes?.[activeSceneIdx];
        if (!scene) return;

        // Images
        const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
        imgUrls.forEach(url => {
            const img = new Image(); img.crossOrigin = "anonymous";
            img.onload = () => imageAssetsRef.current.set(resolveUrl(url), img);
            img.src = resolveUrl(url);
        });

        // Sons
        const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
        sndUrls.forEach(url => {
            SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                if (buf) {
                    audioBuffersRef.current.set(url, buf);
                    logSonde("🎵 Son prêt: " + url.split('/').pop(), "success");
                }
            });
        });

        return () => {
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
            if (gameInstanceRef.current && gameInstanceRef.current.stop) gameInstanceRef.current.stop();
        };
    }, [project]);

    // 2. DÉMARRAGE UTILISATEUR
    const handleStartGame = async () => {
        if (audioCtxRef.current?.state === 'suspended') {
            await audioCtxRef.current.resume();
            logSonde("🔊 Audio Déverrouillé", "success");
        }
        setEngineStarted(true);
    };

    // 3. INITIALISATION MOTEUR (Quand Canvas Prêt)
    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;

        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Contexte 2D introuvable");

            logSonde("🎮 Compilation...", "info");

            // A. GÉNÉRATION DE LA CLASSE DE BASE (EXOSQUELETTE)
            const BaseFactory = new Function('params', `
                const { audioBuffers, audioCtx, logSonde, project, sceneIdx, imageAssets, resolveUrl, canvas, ctx } = params;
                
                class ActorProxy {
                    constructor(data, engine) { 
                        this.id = data.id; this.name = data.name; this.engine = engine;
                        this.x = data.initialX || 50; this.y = data.initialY || 50;
                        this.scale = data.scale || 1; this.visible = true;
                        this.currentAction = data.actions?.[0]?.name || 'IDLE';
                        this.frameIdx = 0; this.lastAnimTime = 0;
                    }
                    play(name) { 
                        if(this.currentAction.toUpperCase() !== name.toUpperCase()) { 
                            this.currentAction = name; this.frameIdx = 0;
                            this.engine._triggerActionSounds(this.id, name);
                        } 
                    }
                }

                return class MiniGameBase {
                    constructor() {
                        this.canvas = canvas; this.ctx = ctx; this.keys = {};
                        const s = project.scenes[sceneIdx];
                        // Injection automatique des acteurs (this.HEROS, etc.)
                        if(s && s.actors) s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a, this); });
                        
                        document.onkeydown = e => this.keys[e.code] = true;
                        document.onkeyup = e => this.keys[e.code] = false;
                    }

                    _triggerActionSounds(actorId, actionName) {
                        const actor = project.scenes[sceneIdx].actors.find(a => a.id === actorId);
                        const action = actor?.actions.find(act => act.name.toUpperCase() === actionName.toUpperCase());
                        if(action && action.sounds) action.sounds.forEach(snd => this._playSound(snd.url));
                    }

                    _playSound(url) {
                        const buffer = audioBuffers.get(url);
                        if(buffer && audioCtx) {
                            const source = audioCtx.createBufferSource();
                            source.buffer = buffer; source.connect(audioCtx.destination); source.start(0);
                        }
                    }

                    playGlobal(name) {
                        const gs = project.scenes[sceneIdx].globalSounds?.find(s => s.name.toUpperCase() === name.toUpperCase());
                        if(gs && gs.sounds) gs.sounds.forEach(snd => this._playSound(snd.url));
                    }

                    _render() {
                        const s = project.scenes[sceneIdx];
                        // Fond de sécurité
                        ctx.fillStyle = "#0f172a"; ctx.fillRect(0,0,canvas.width, canvas.height);
                        
                        // Background Image
                        const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
                        if(bd) {
                            const img = imageAssets.get(resolveUrl(bd.url));
                            if(img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        }

                        // Actors
                        for(let key in this) {
                            const p = this[key];
                            if(p instanceof ActorProxy && p.visible) {
                                const aData = project.scenes[sceneIdx].actors.find(ac => ac.id === p.id);
                                if(!aData) continue;
                                const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                                if(act && act.frames?.length > 0) {
                                    const now = Date.now();
                                    if (now - p.lastAnimTime > (act.speed || 100)) { p.frameIdx = (p.frameIdx+1)%act.frames.length; p.lastAnimTime=now; }
                                    const spr = imageAssets.get(resolveUrl(act.frames[p.frameIdx].url));
                                    if(spr) {
                                        const xPx = (p.x/100)*canvas.width; const yPx = (p.y/100)*canvas.height; let sz = 150*p.scale;
                                        ctx.save(); ctx.translate(xPx, yPx);
                                        if (aData.direction) ctx.rotate(aData.direction * Math.PI / 180);
                                        ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); ctx.restore();
                                    }
                                }
                            }
                        }
                    }
                }
            `);

            // Création de la classe Parent
            const MiniGameBase = BaseFactory({ 
                audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, 
                imageAssets: imageAssetsRef.current, resolveUrl, logSonde, project, sceneIdx: activeSceneIdx, canvas, ctx
            });

            // B. COMPILATION DU CODE UTILISATEUR
            // On injecte MiniGameBase comme argument pour que 'extends MiniGameBase' fonctionne
            const UserCodeFactory = new Function('MiniGameBase', `
                ${code}
                return MiniGame;
            `);

            const UserGameClass = UserCodeFactory(MiniGameBase);
            const instance = new UserGameClass();
            gameInstanceRef.current = instance;

            // C. LANCEMENT
            if (instance.start) instance.start();
            
            // Boucle
            const tick = () => {
                if (instance.update) instance.update();
                if (instance._render) instance._render(); // Appel de la méthode interne du parent
                if (instance.draw) instance.draw();       // HUD utilisateur par dessus
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();

        } catch (e) {
            logSonde("💥 ERREUR CODE: " + e.message, "error");
            console.error(e);
        }
    }, [engineStarted]);

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
             <div className="absolute top-0 left-0 p-4 z-[100] flex flex-col gap-1 pointer-events-none">
                {debugLogs.map(log => (
                    <div key={log.id} className={`px-3 py-1 rounded text-[9px] font-black shadow-lg border-l-4 ${log.type === 'error' ? 'bg-red-500 text-white' : log.type === 'success' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>
                        {log.text}
                    </div>
                ))}
             </div>

             {!engineStarted ? (
                 <button onClick={handleStartGame} className="px-20 py-10 bg-white text-indigo-600 rounded-full font-black text-5xl shadow-2xl border-8 border-indigo-200 hover:scale-110 transition-all animate-pulse">
                    🚀 JOUER
                 </button>
             ) : (
                <div className="relative animate-in zoom-in">
                    <canvas ref={canvasRef} width={800} height={450} className="max-w-full shadow-2xl bg-black rounded-lg border-4 border-slate-800" />
                    <button onClick={onStop} className="absolute -top-12 -right-12 w-10 h-10 bg-red-600 text-white rounded-full font-black hover:bg-red-500 cursor-pointer">✕</button>
                </div>
             )}
        </div>
    );
}
