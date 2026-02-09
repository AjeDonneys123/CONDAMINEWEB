// @signatures: GameEngine, handleStartGame, logSonde, handleAnswerClick, startLogic
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../../services/api';
import SoundExpert from './SoundExpert';

/**
 * 🎮 MOTEUR DE JEU (V790 - AUDIO FIRST SEQUENCE)
 * Règle : Le son de DÉPART joue SEUL, puis le jeu se lance.
 * Fix : Reprise exacte de la méthode "Opération Son Pur".
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const gameInstanceRef = useRef(null);
    const [engineReady, setEngineReady] = useState(false);
    const [engineStarted, setEngineStarted] = useState(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [crash, setCrash] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [lives, setLives] = useState(4);
    const [debugLogs, setDebugLogs] = useState([]);

    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());

    const logSonde = (msg, type = 'info') => {
        const id = Math.random();
        setDebugLogs(prev => [...prev, { id, text: msg, type }].slice(-6));
        setTimeout(() => setDebugLogs(prev => prev.filter(l => l.id !== id)), 5000);
    };

    // 1. DATA
    useEffect(() => {
        api.get('/games/test-data').then(data => {
            const lvl = data?.levels?.[0] || { questions: [{ q: "Prêt ?", options: ["OUI"], a: 0 }] };
            setLevelQuestions(lvl.questions || []);
        });
    }, []);

    // 2. CHARGEMENT ASSETS
    useEffect(() => {
        if (!project) return;
        async function prefetch() {
            try {
                if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                const scene = project.scenes?.[activeSceneIdx];
                if (!scene) return;

                const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
                const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);

                await Promise.all([
                    ...imgUrls.map(url => new Promise(res => {
                        const img = new Image(); img.crossOrigin = "anonymous";
                        img.onload = () => { imageAssetsRef.current.set(resolveUrl(url), img); res(); };
                        img.onerror = res; img.src = resolveUrl(url);
                    })),
                    ...sndUrls.map(url => SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                        if (buf) audioBuffersRef.current.set(url, buf);
                    }))
                ]);

                setEngineReady(true);
                logSonde("🚀 Ressources prêtes", "success");
            } catch (e) { logSonde("Erreur Init", "error"); }
        }
        prefetch();
        return () => { if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close(); };
    }, [project, activeSceneIdx]);

    // 3. COMPILATION DU PILOTE
    useEffect(() => {
        if (!engineReady || !code || !canvasRef.current || !engineStarted) return;

        let frameId;
        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            const headerCode = `
                const { canvas, ctx, project, sceneIdx, resolveUrl, audioBuffers, imageAssets, audioCtx, logSonde, callbacks } = params;
                
                class ActorProxy {
                    constructor(data, engine) { 
                        this.id = data.id; this.name = data.name; this.engine = engine;
                        this.x = data.initialX || 50; this.y = data.initialY || 50;
                        this.currentAction = data.actions?.[0]?.name || 'IDLE';
                        this.frameIdx = 0; this.lastAnimTime = 0; this.scale = data.scale || 1; this.visible = true;
                    }
                    play(name) { 
                        if(this.currentAction.toUpperCase() !== name.toUpperCase()) { 
                            this.currentAction = name; this.frameIdx = 0;
                            this.engine._triggerActionSounds(this.id, name);
                        } 
                    }
                }

                class MiniGameBase {
                    constructor() { 
                        this.canvas = canvas; this.ctx = ctx; this.keys = {};
                        this.callbacks = callbacks;
                        const s = project.scenes[sceneIdx];
                        if(s && s.actors) s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a, this); });
                        document.onkeydown = e => this.keys[e.code] = true;
                        document.onkeyup = e => this.keys[e.code] = false;
                    }
                    playGlobal(name) {
                        const gs = project.scenes[sceneIdx].globalSounds?.find(s => s.name.toUpperCase() === name.toUpperCase());
                        if(gs && gs.sounds) gs.sounds.forEach(snd => this._playSound(snd.url));
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
                            logSonde("🔊 SON: " + url.split('/').pop(), "success");
                        }
                    }
                    _system_render() {
                        const s = project.scenes[sceneIdx];
                        ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, canvas.width, canvas.height);
                        const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
                        if(bd) {
                            const img = imageAssets.get(resolveUrl(bd.url));
                            if(img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        }
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
                                        ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); ctx.restore();
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const Factory = new Function('params', headerCode + "\n" + code + "\n return MiniGame;");
            gameInstanceRef.current = new (Factory({ 
                canvas, ctx, project, sceneIdx: activeSceneIdx, resolveUrl, logSonde,
                audioBuffers: audioBuffersRef.current, imageAssets: imageAssetsRef.current, audioCtx: audioCtxRef.current,
                callbacks: { onPlayerHit: () => setLives(l => Math.max(0, l - 1)) } 
            }))({});

            if (gameInstanceRef.current.start) gameInstanceRef.current.start();

            const loop = () => {
                if (gameInstanceRef.current && !crash) {
                    try {
                        if (gameInstanceRef.current.update) gameInstanceRef.current.update();
                        gameInstanceRef.current._system_render();
                        if (gameInstanceRef.current.draw) gameInstanceRef.current.draw();
                    } catch (err) { setCrash(err.message); }
                }
                frameId = requestAnimationFrame(loop);
            };
            loop();

        } catch (e) { setCrash(e.message); }
        return () => cancelAnimationFrame(frameId);
    }, [engineReady, engineStarted]);

    // --- LOGIQUE DE LANCEMENT SÉQUENTIEL ---
    const handleStartGame = async () => {
        if (!audioCtxRef.current) return;
        
        // 1. Déverrouiller le contexte
        if (audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
        }

        // 2. Chercher le son de DÉPART
        const scene = project.scenes[activeSceneIdx];
        const gs = scene.globalSounds?.find(s => s.name.toUpperCase() === "DÉPART");
        
        if (gs && gs.sounds && gs.sounds[0]) {
            const buffer = audioBuffersRef.current.get(gs.sounds[0].url);
            if (buffer) {
                logSonde("🎵 Séquence Audio : DÉPART...");
                setIsAudioPlaying(true);
                
                const source = audioCtxRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(audioCtxRef.current.destination);
                
                // Règle d'or : On attend la fin du son pour lancer les sprites
                source.onended = () => {
                    logSonde("🏁 Son fini. Lancement du jeu !", "success");
                    setIsAudioPlaying(false);
                    setEngineStarted(true);
                };
                
                source.start(0);
                return; // On attend onended
            }
        }

        // Si pas de son DÉPART, on lance direct
        logSonde("⚠️ Pas de son DÉPART. Lancement direct.");
        setEngineStarted(true);
    };

    const handleAnswerClick = (idx) => {
        if (!engineStarted || feedback) return;
        const isCorrect = levelQuestions[currentQIndex]?.a === idx;
        setFeedback(isCorrect ? 'OK' : 'KO');
        gameInstanceRef.current?.onResult?.(isCorrect);
        if (!isCorrect) setLives(l => Math.max(0, l - 1));
        setTimeout(() => {
            setFeedback(null);
            setCurrentQIndex(prev => (prev + 1) % levelQuestions.length);
        }, 1000);
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
             <div className="absolute top-0 left-0 p-4 z-[100] flex flex-col gap-1 pointer-events-none">
                {debugLogs.map(log => (<div key={log.id} className={`px-3 py-1 rounded text-[10px] font-black shadow-lg border-l-4 ${log.type === 'error' ? 'bg-red-600 text-white' : log.type === 'success' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>{log.text}</div>))}
             </div>

             {!engineStarted && (
                 <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
                     {isAudioPlaying ? (
                         <div className="flex flex-col items-center gap-4">
                            <div className="w-20 h-20 border-4 border-white border-t-indigo-500 rounded-full animate-spin"></div>
                            <span className="text-white font-black text-2xl uppercase tracking-widest animate-pulse">Introduction sonore...</span>
                         </div>
                     ) : (
                        <button onClick={handleStartGame} disabled={!engineReady} className="px-16 py-8 bg-white text-indigo-600 rounded-full font-black text-4xl shadow-2xl border-8 border-indigo-100 hover:scale-110 transition-all">
                            {engineReady ? "🚀 JOUER" : "CHARGEMENT..."}
                        </button>
                     )}
                 </div>
             )}

             {engineStarted && (
                 <>
                    <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-50 pointer-events-none">
                        <div className="bg-black/60 p-3 rounded-2xl text-2xl">{"❤️".repeat(lives)}</div>
                        <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-700 text-xl pointer-events-auto">
                            {feedback === 'OK' ? "✅ BRAVO !" : feedback === 'KO' ? "❌ RATÉ..." : levelQuestions[currentQIndex]?.q}
                        </div>
                        <div className="w-20"></div>
                    </div>
                    <canvas ref={canvasRef} width={800} height={450} className="max-w-full shadow-2xl bg-black rounded-lg border-4 border-slate-800" />
                    <div className="absolute bottom-6 left-6 right-6 flex justify-center gap-4">
                        {levelQuestions[currentQIndex]?.options?.map((o, i) => (
                            <button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-4 px-8 rounded-xl font-black uppercase shadow-xl hover:bg-indigo-500 active:translate-y-1 transition-all">{o}</button>
                        ))}
                    </div>
                 </>
             )}
             <button onClick={onStop} className="absolute top-6 right-6 w-10 h-10 bg-red-600 text-white rounded-full font-black text-xl z-[300]">✕</button>
             {crash && <div className="absolute inset-0 bg-red-950 text-white p-20 z-[400] overflow-auto"><h2>💥 CRASH SCRIPT</h2><pre className="bg-black/40 p-5 mt-5 rounded">{crash}</pre><button onClick={onStop}>RETOUR</button></div>}
        </div>
    );
}
