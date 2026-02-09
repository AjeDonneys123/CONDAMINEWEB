// @signatures: GameEngine, initLevel, handleAnswerClick, triggerWinSequence, handleStartGame
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../../services/api';
import SoundExpert from './SoundExpert';

/**
 * 🎮 MOTEUR DE JEU (V710 - ULTIMATE STARTUP STABILITY)
 * Fix : Écran noir + Décodage Son.
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const gameInstanceRef = useRef(null);
    const [engineReady, setEngineReady] = useState(false);
    const [engineStarted, setEngineStarted] = useState(false);
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

    // 2. LOADER RÉSILIENT (DÉBLOQUE LE NOIR)
    useEffect(() => {
        if (!project) return;
        
        async function loadAssets() {
            try {
                logSonde("🛠️ Initialisation du moteur...");
                const scene = project.scenes?.[activeSceneIdx];
                if (!scene) return;

                if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();

                const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
                const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);

                logSonde(`📦 Chargement : ${imgUrls.length} imgs, ${sndUrls.length} sons`);

                // Chargement des images (Bloquant)
                await Promise.all(imgUrls.map(url => new Promise(res => {
                    const img = new Image(); img.crossOrigin = "anonymous";
                    img.onload = () => { imageAssetsRef.current.set(resolveUrl(url), img); res(); };
                    img.onerror = () => { console.error("Image error", url); res(); };
                    img.src = resolveUrl(url);
                })));

                // Chargement des sons (Non-bloquant)
                sndUrls.forEach(url => {
                    SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                        if (buf) {
                            audioBuffersRef.current.set(url, buf);
                            logSonde(`🎵 Son prêt`, "success");
                        } else {
                            logSonde(`⚠️ Décodage raté`, "error");
                        }
                    });
                });

                // --- DÉBLOCAGE IMMÉDIAT DU NOIR ---
                setEngineReady(true);
                logSonde("🚀 Moteur prêt", "success");
            } catch (e) { logSonde("Erreur chargement", "error"); }
        }

        loadAssets();
        return () => { if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close(); };
    }, [project, activeSceneIdx]);

    // 3. COMPILATION & INSTANCIATION (V710 Blindée)
    useEffect(() => {
        if (!engineReady || !code || !canvasRef.current) return;
        try {
            const headerCode = `
                const { canvas, ctx, project, sceneIdx, resolveUrl, audioBuffers, imageAssets, audioCtx, logSonde } = params;
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
                    constructor(c, a, cb) { 
                        this.canvas = c; this.ctx = ctx; this.assets = a; this.keys = {};
                        const s = project.scenes[sceneIdx];
                        if(s && s.actors) s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a, this); });
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
                        if(buffer && audioCtx && audioCtx.state !== 'closed') {
                            const source = audioCtx.createBufferSource();
                            source.buffer = buffer; source.connect(audioCtx.destination); source.start(0);
                            logSonde("⚡ PLAY", "success");
                        }
                    }
                    _system_render() {
                        const s = project.scenes[sceneIdx];
                        ctx.fillStyle = "black"; ctx.fillRect(0,0,canvas.width, canvas.height);
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
                canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'), project, sceneIdx: activeSceneIdx, resolveUrl, logSonde,
                audioBuffers: audioBuffersRef.current, imageAssets: imageAssetsRef.current, audioCtx: audioCtxRef.current,
                callbacks: { onPlayerHit: () => setLives(l => Math.max(0, l - 1)) } 
            }))({});
        } catch (e) { setCrash(e.message); }
    }, [engineReady, code]);

    const handleStartGame = async () => {
        if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
        setEngineStarted(true);
        if (gameInstanceRef.current?.start) gameInstanceRef.current.start();
    };

    useEffect(() => {
        let frameId;
        const loop = () => {
            if (engineStarted && gameInstanceRef.current && !crash) {
                if (gameInstanceRef.current.update) gameInstanceRef.current.update();
                if (gameInstanceRef.current._system_render) gameInstanceRef.current._system_render();
                if (gameInstanceRef.current.draw) gameInstanceRef.current.draw();
            }
            frameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(frameId);
    }, [engineStarted, crash]);

    return (
        <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center">
             <div className="absolute top-0 left-0 p-4 z-[100] flex flex-col gap-1">
                {debugLogs.map(log => (<div key={log.id} className={`px-2 py-1 rounded text-[9px] font-black shadow-lg border-l-4 ${log.type === 'error' ? 'bg-red-500 text-white' : log.type === 'success' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>{log.text}</div>))}
             </div>

             {!engineStarted && (
                 <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md">
                     <button onClick={handleStartGame} disabled={!engineReady} className="px-16 py-8 bg-white text-indigo-600 rounded-full font-black text-4xl shadow-2xl hover:scale-105 disabled:opacity-30 border-8 border-indigo-100 transition-all">
                        {engineReady ? "🚀 JOUER" : "CHARGEMENT..."}
                     </button>
                 </div>
             )}

             {engineStarted && (
                 <>
                    <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-50 pointer-events-none">
                        <div className="bg-black/60 p-3 rounded-2xl text-2xl">{"❤️".repeat(lives)}</div>
                        {levelQuestions[currentQIndex] && (
                            <div className="bg-white text-slate-900 font-black py-4 px-10 rounded-2xl shadow-2xl text-xl">{levelQuestions[currentQIndex].q}</div>
                        )}
                        <div className="w-20"></div>
                    </div>
                    <canvas ref={canvasRef} width={800} height={450} className="max-w-full shadow-2xl bg-black rounded-lg border-4 border-slate-800" />
                 </>
             )}
             
             <button onClick={onStop} className="absolute top-6 right-6 w-12 h-12 bg-red-600 text-white rounded-full font-black text-2xl hover:bg-red-500 shadow-xl flex items-center justify-center z-[60]">✕</button>
             {crash && <div className="absolute inset-0 bg-red-950 text-white p-20 z-[300] overflow-auto"><h2>ERREUR SCRIPT</h2><pre>{crash}</pre><button onClick={onStop}>QUITTER</button></div>}
        </div>
    );
}
