// @signatures: GameEngine, initLevel, handleAnswerClick, triggerWinSequence, handleStartGame
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../../services/api';
import SoundExpert from './SoundExpert';

/**
 * 🎮 MOTEUR DE JEU (V700 - NON-BLOCKING LOADER)
 * L'écran noir est banni : le jeu démarre même si les sons échouent.
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
        setDebugLogs(prev => [...prev, { id, text: msg, type }].slice(-8));
        setTimeout(() => setDebugLogs(prev => prev.filter(l => l.id !== id)), 6000);
    };

    // 1. DATA
    useEffect(() => {
        api.get('/games/test-data').then(data => {
            const lvl = data?.levels?.[0] || { questions: [{ q: "Test ?", options: ["OK"], a: 0 }] };
            setLevelQuestions(lvl.questions);
        });
    }, []);

    // 2. LOADER NON-BLOQUANT
    useEffect(() => {
        if (!project) return;
        
        async function loadAssets() {
            logSonde("🛠️ Analyse de la scène...");
            const scene = project.scenes?.[activeSceneIdx];
            if (!scene) return;

            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();

            const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
            const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);

            // CHARGEMENT DES IMAGES (BLOQUANT car vital pour le visuel)
            logSonde(`🖼️ Chargement de ${imgUrls.length} images...`);
            await Promise.all(imgUrls.map(url => new Promise(res => {
                const img = new Image(); img.crossOrigin = "anonymous";
                img.onload = () => { imageAssetsRef.current.set(resolveUrl(url), img); res(); };
                img.onerror = () => { logSonde("❌ Image corrompue: " + url.split('/').pop(), "error"); res(); };
                img.src = resolveUrl(url);
            })));

            // CHARGEMENT DES SONS (NON-BLOQUANT)
            logSonde(`🎵 Préparation de ${sndUrls.length} sons...`);
            sndUrls.forEach(url => {
                SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                    if (buf) {
                        audioBuffersRef.current.set(url, buf);
                        logSonde("✅ Son OK: " + url.split('/').pop(), "success");
                    } else {
                        logSonde("⚠️ Échec Son: " + url.split('/').pop(), "error");
                    }
                });
            });

            // ON DÉBLOQUE L'ÉCRAN ICI, peu importe si les sons ont fini ou pas
            setEngineReady(true);
            logSonde("🚀 MOTEUR PRÊT", "success");
        }

        loadAssets();
        return () => { if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close(); };
    }, [project]);

    // 3. INJECTION
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
                        if(buffer && audioCtx) {
                            const source = audioCtx.createBufferSource();
                            source.buffer = buffer; source.connect(audioCtx.destination); source.start(0);
                            logSonde("🔊 Lecture son...", "success");
                        } else {
                            logSonde("🔈 Son manquant: " + url.split('/').pop(), "error");
                        }
                    }
                    _system_render() {
                        const s = project.scenes[sceneIdx];
                        ctx.fillStyle = "#0f172a"; ctx.fillRect(0,0,canvas.width, canvas.height);
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
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center">
             <div className="absolute top-0 left-0 p-4 z-[100] flex flex-col gap-1">
                {debugLogs.map(log => (<div key={log.id} className={`px-2 py-1 rounded text-[9px] font-black shadow-lg border-l-4 ${log.type === 'error' ? 'bg-red-500 text-white' : log.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-black'}`}>{log.text}</div>))}
             </div>

             {!engineStarted && (
                 <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                     <button onClick={handleStartGame} disabled={!engineReady} className="px-16 py-8 bg-white text-indigo-600 rounded-full font-black text-4xl shadow-2xl hover:scale-105 disabled:opacity-30 transition-all border-8 border-indigo-100">
                        {engineReady ? "🚀 JOUER" : "CHARGEMENT..."}
                     </button>
                 </div>
             )}

             {engineStarted && (
                 <>
                    <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-50 pointer-events-none">
                        <div className="bg-black/80 px-4 py-2 rounded-xl text-2xl border border-white/20">{"❤️".repeat(lives)}</div>
                        {levelQuestions[currentQIndex] && (
                            <div className="bg-white text-slate-900 font-black py-4 px-10 rounded-2xl shadow-2xl text-xl">{levelQuestions[currentQIndex].q}</div>
                        )}
                        <div className="w-20"></div>
                    </div>
                    <canvas ref={canvasRef} width={800} height={450} className="max-w-full shadow-2xl bg-black rounded-lg border-4 border-slate-800" />
                    <div className="absolute bottom-6 left-6 right-6 flex justify-center gap-4">
                        {levelQuestions[currentQIndex]?.options?.map((o, i) => (<button key={i} onClick={() => {
                            if(feedback) return;
                            const isCorrect = levelQuestions[currentQIndex].a === i;
                            setFeedback(isCorrect ? 'OK' : 'KO');
                            gameInstanceRef.current?.onResult?.(isCorrect);
                            if(!isCorrect) setLives(l => Math.max(0, l-1));
                            setTimeout(() => {
                                setFeedback(null);
                                setCurrentQIndex(prev => (prev + 1) % levelQuestions.length);
                            }, 1000);
                        }} className={`py-4 px-8 rounded-xl font-black uppercase transition-all shadow-lg ${feedback === 'OK' && levelQuestions[currentQIndex].a === i ? 'bg-green-500 text-white scale-110' : feedback === 'KO' && levelQuestions[currentQIndex].a === i ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>{o}</button>))}
                    </div>
                 </>
             )}
             <button onClick={onStop} className="absolute top-6 right-6 w-10 h-10 bg-red-600 text-white rounded-full font-black text-xl hover:bg-red-500">✕</button>
             {crash && <div className="absolute inset-0 bg-red-950 text-white p-20 z-[300] overflow-auto"><h2>ERREUR SCRIPT</h2><pre className="bg-black/40 p-5 mt-5 rounded">{crash}</pre><button onClick={onStop} className="mt-10 bg-white text-red-900 p-4 rounded-xl font-bold">RETOUR STUDIO</button></div>}
        </div>
    );
}
