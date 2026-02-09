// @signatures: GameEngine, initLevel, handleAnswerClick, triggerWinSequence, handleStartGame
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../../services/api';
import SoundExpert from './SoundExpert';

/**
 * 🎮 MOTEUR DE JEU (V680 - ANTI-DEADLOCK & RENDER FALLBACK)
 * Correction : Écran noir + Son bloqué.
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const gameInstanceRef = useRef(null);
    const [engineReady, setEngineReady] = useState(false);
    const [engineStarted, setEngineStarted] = useState(false);
    const [crash, setCrash] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
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

    // 1. INITIALISATION DATA
    useEffect(() => {
        api.get('/games/test-data').then(data => {
            const lvl = data?.levels?.[0] || { questions: [{ q: "Prêt ?", options: ["OUI"], a: 0 }] };
            setLevelQuestions(lvl.questions);
            setQuestionStates(new Array(lvl.questions.length).fill(0));
        });
    }, []);

    // 2. CHARGEMENT ASSETS (ANTI-BLOCAGE)
    useEffect(() => {
        if (!project) return;
        async function prefetch() {
            try {
                if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                const scene = project.scenes?.[activeSceneIdx];
                if (!scene) return;

                logSonde("📦 Chargement...");
                const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
                const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);

                // On charge images et sons en parallèle, mais on ne bloque PAS si un son échoue
                await Promise.all([
                    ...imgUrls.map(url => new Promise(res => {
                        const img = new Image(); img.crossOrigin = "anonymous";
                        img.onload = () => { imageAssetsRef.current.set(resolveUrl(url), img); res(); };
                        img.onerror = res; img.src = resolveUrl(url);
                    })),
                    ...sndUrls.map(url => SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                        if (buf) {
                            audioBuffersRef.current.set(url, buf);
                            logSonde("🎵 Son chargé", "success");
                        }
                    }))
                ]);

                logSonde("🚀 Ressources Prêtes", "success");
                setEngineReady(true);
            } catch (e) { logSonde("Erreur Init", "error"); }
        }
        prefetch();
        return () => { if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close(); };
    }, [project, activeSceneIdx]);

    // 3. COMPILATION SCRIPT
    useEffect(() => {
        if (!engineReady || !code || !canvasRef.current) return;
        try {
            const headerCode = `
                const { canvas, ctx, project, sceneIdx, resolveUrl, audioBuffers, imageAssets, audioCtx, logSonde } = params;
                class ActorProxy {
                    constructor(data, engine) { 
                        this.id = data.id; this.name = data.name; this.engine = engine;
                        this.x = data.initialX || 50; this.y = data.initialY || 50;
                        this.dir = 0; this.scale = data.scale || 1; this.visible = true;
                        this.currentAction = data.actions?.[0]?.name || 'IDLE';
                        this.frameIdx = 0; this.lastAnimTime = 0;
                    }
                    play(name) { 
                        if(this.currentAction.toUpperCase() !== name.toUpperCase()) { 
                            this.currentAction = name; this.frameIdx = 0; this.lastAnimTime = 0;
                            this.engine._triggerActionSounds(this.id, name);
                        } 
                    }
                }
                class MiniGameBase {
                    constructor(c, a, cb) { 
                        this.canvas = c; this.ctx = ctx; this.assets = a; this.callbacks = params.callbacks; this.keys = {};
                        const s = project.scenes[sceneIdx];
                        if(s && s.actors) s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a, this); });
                        document.addEventListener('keydown', e => this.keys[e.code] = true);
                        document.addEventListener('keyup', e => this.keys[e.code] = false);
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

    const handleAnswerClick = (idx) => {
        if (!engineStarted || feedback) return;
        const isCorrect = levelQuestions[currentQIndex]?.a === idx;
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        gameInstanceRef.current?.onResult?.(isCorrect);
        if (!isCorrect) setLives(l => Math.max(0, l - 1));
        setTimeout(() => {
            setFeedback(null);
            const avail = questionStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
            if (avail.length > 0) setCurrentQIndex(avail[Math.floor(Math.random() * avail.length)]);
        }, 1000);
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
             <div className="absolute top-0 left-0 p-4 z-[100] flex flex-col gap-1">{debugLogs.map(log => (<div key={log.id} className={`px-2 py-1 rounded text-[9px] font-black shadow-lg border-l-4 ${log.type === 'error' ? 'bg-red-500 text-white' : log.type === 'success' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>{log.text}</div>))}</div>
             {!engineStarted && engineReady && (
                 <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
                     <button onClick={handleStartGame} className="px-20 py-10 bg-white text-indigo-600 rounded-full font-black text-5xl shadow-2xl hover:scale-110 transition-transform animate-pulse border-8 border-indigo-200">🚀 JOUER</button>
                 </div>
             )}
             {engineStarted && (
                 <>
                    <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-50 pointer-events-none">
                        <div className="bg-black/60 p-3 rounded-2xl text-2xl">{"❤️".repeat(lives)}</div>
                        {levelQuestions[currentQIndex] && (
                            <div className="bg-slate-900/90 text-white font-black py-4 px-8 rounded-2xl border-2 border-slate-700 text-lg">{feedback === 'CORRECT' ? "✅ BRAVO" : feedback === 'WRONG' ? "❌ RATE" : levelQuestions[currentQIndex].q}</div>
                        )}
                        <div className="w-20"></div>
                    </div>
                    <canvas ref={canvasRef} width={800} height={450} className="max-w-full shadow-2xl bg-slate-900 rounded-xl" />
                    <div className="absolute bottom-6 left-6 right-6 flex justify-center gap-4">
                        {levelQuestions[currentQIndex]?.options?.map((o, i) => (<button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-4 px-8 rounded-xl font-black uppercase shadow-xl hover:bg-indigo-500 active:translate-y-1 transition-all">{o}</button>))}
                    </div>
                 </>
             )}
             <button onClick={onStop} className="absolute top-6 right-6 bg-red-600 text-white w-10 h-10 rounded-full font-black text-xl z-[60]">✕</button>
             {crash && <div className="absolute inset-0 bg-red-900 text-white p-20 overflow-auto z-[300]"><h2>CRASH</h2><pre>{crash}</pre><button onClick={onStop}>QUITTER</button></div>}
        </div>
    );
}
