// @signatures: GameEngine, initLevel, handleAnswerClick, triggerWinSequence, handleStartGame
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../../services/api';
import SoundExpert from './SoundExpert';

/**
 * 🎮 MOTEUR DE JEU (V610 - BULLETPROOF RENDER & AUDIO)
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const gameInstanceRef = useRef(null);
    const [engineReady, setEngineReady] = useState(false);
    const [engineStarted, setEngineStarted] = useState(false);
    const [crash, setCrash] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [lives, setLives] = useState(4);
    const [isLevelWon, setIsLevelWon] = useState(false);
    const isLevelWonRef = useRef(false);
    const [debugLogs, setDebugLogs] = useState([]);

    const audioCtxRef = useRef(new (window.AudioContext || window.webkitAudioContext)());
    const audioBuffersRef = useRef(new Map());

    const logSonde = (msg, type = 'info') => {
        const id = Math.random();
        setDebugLogs(prev => [...prev, { id, text: msg, type }].slice(-6));
        setTimeout(() => setDebugLogs(prev => prev.filter(l => l.id !== id)), 4000);
    };

    useEffect(() => {
        api.get('/games/test-data').then(data => {
            const levelsData = data?.levels?.length > 0 ? data.levels : [{ name: "Demo", questions: [{ q: "Prêt ?", options: ["OUI", "NON"], a: 0 }] }];
            setAllLevels(levelsData);
            initLevel(0, levelsData);
        });
        return () => { if(audioCtxRef.current) audioCtxRef.current.close(); };
    }, []);

    const initLevel = (idx, sourceData) => {
        if (!sourceData[idx]) return;
        setCurrentLevelIdx(idx);
        setLevelQuestions(sourceData[idx].questions || []);
        setQuestionStates(new Array((sourceData[idx].questions || []).length).fill(0));
        setIsLevelWon(false); isLevelWonRef.current = false;
        setCurrentQIndex(0);
    };

    useEffect(() => {
        if (!project || !audioCtxRef.current) return;
        async function loadAssets() {
            const scene = project.scenes[activeSceneIdx];
            if (!scene) return;
            logSonde("📦 Chargement...");

            const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
            const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);

            await Promise.all([
                ...imgUrls.map(url => new Promise(res => {
                    const img = new Image(); img.crossOrigin = "anonymous";
                    img.onload = res; img.onerror = res; img.src = resolveUrl(url);
                })),
                ...sndUrls.map(url => new Promise(async res => {
                    const buffer = await SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current);
                    if (buffer) audioBuffersRef.current.set(url, buffer);
                    res();
                }))
            ]);
            setEngineReady(true);
            logSonde("🚀 Ressources OK", "success");
        }
        loadAssets();
    }, [project]);

    const handleStartGame = async () => {
        if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
        setEngineStarted(true);
        setTimeout(() => {
            if (gameInstanceRef.current?.start) {
                try { gameInstanceRef.current.start(); logSonde("🎬 Start() exécuté"); } catch(e) { setCrash(e.message); }
            }
        }, 100);
    };

    const handleAnswerClick = (choiceIdx) => {
        if (!engineStarted || feedback || currentQIndex === -1 || isLevelWonRef.current) return;
        const currentQ = levelQuestions[currentQIndex];
        const isCorrect = currentQ.a === choiceIdx;
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        if (isCorrect) {
            setQuestionStates(p => { const n=[...p]; n[currentQIndex]=Math.min(3, n[currentQIndex]+1); return n; });
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(true);
        } else {
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(false);
            if (!isLevelWonRef.current) setLives(l => Math.max(0, l - 1));
        }
        setTimeout(() => {
            setFeedback(null);
            const avail = questionStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
            if (avail.length > 0) setCurrentQIndex(avail[Math.floor(Math.random() * avail.length)]);
            else triggerWinSequence();
        }, 1000);
    };

    const triggerWinSequence = () => {
        setIsLevelWon(true); isLevelWonRef.current = true;
        if (gameInstanceRef.current?.onLevelWin) gameInstanceRef.current.onLevelWin();
    };

    useEffect(() => {
        if (!engineReady || !code || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const headerCode = `
            const { canvas, ctx, project, sceneIdx, resolveUrl, audioBuffers, audioCtx, logSonde } = params;
            
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
                    this.canvas = c || canvas; this.ctx = ctx; this.callbacks = cb || params.callbacks; this.keys = {};
                    const s = project.scenes[sceneIdx];
                    if(s && s.actors) { s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a, this); }); }
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
                    }
                }
                _system_render() {
                    const s = project.scenes[sceneIdx];
                    const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
                    // ANTI-SILENT CRASH : Vérification stricte des images
                    if(bd) {
                        const img = new Image(); img.src = resolveUrl(bd.url);
                        if(img.complete) this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                        else { this.ctx.fillStyle = "#000"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }
                    } else { this.ctx.fillStyle = "#111"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }

                    for(let key in this) {
                        const p = this[key];
                        if(p instanceof ActorProxy && p.visible) {
                            const aData = project.scenes[sceneIdx].actors.find(ac => ac.id === p.id);
                            if(!aData) continue;
                            const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                            if(act && act.frames?.length > 0) {
                                const now = Date.now();
                                if (now - p.lastAnimTime > (act.speed || 100)) { p.frameIdx = (p.frameIdx+1)%act.frames.length; p.lastAnimTime=now; }
                                const spr = new Image(); spr.src = resolveUrl(act.frames[p.frameIdx].url);
                                if(spr.complete) {
                                    const xPx = (p.x/100)*this.canvas.width; const yPx = (p.y/100)*this.canvas.height; let sz = 150*p.scale;
                                    this.ctx.save(); this.ctx.translate(xPx, yPx);
                                    this.ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); this.ctx.restore();
                                }
                            }
                        }
                    }
                }
            }
        `;

        try {
            const FinalClass = new Function('params', headerCode + "\n" + code + "\n return MiniGame;");
            gameInstanceRef.current = new FinalClass({ 
                canvas, ctx, project, sceneIdx: activeSceneIdx, resolveUrl, logSonde,
                audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current,
                callbacks: { onPlayerHit: () => { if (!isLevelWonRef.current) setLives(l => Math.max(0, l - 1)); } } 
            });

            let animationFrameId;
            const loop = () => {
                if (engineStarted && gameInstanceRef.current) {
                    try {
                        if (gameInstanceRef.current.update) gameInstanceRef.current.update();
                        if (gameInstanceRef.current._system_render) gameInstanceRef.current._system_render();
                        if (gameInstanceRef.current.draw) gameInstanceRef.current.draw();
                    } catch(e) { console.warn("Render loop error", e); }
                }
                animationFrameId = requestAnimationFrame(loop);
            };
            loop();
            return () => cancelAnimationFrame(animationFrameId);
        } catch(e) { setCrash(e.message); }
    }, [engineReady, engineStarted, code]);

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center font-sans overflow-hidden">
             <div className="absolute top-0 left-0 p-4 z-[100] pointer-events-none">
                <div className="flex flex-col gap-1">{debugLogs.map(log => (<div key={log.id} className={`px-3 py-1 rounded text-[9px] font-black shadow-lg border-l-4 ${log.type === 'error' ? 'bg-red-500 text-white' : log.type === 'success' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>{log.text}</div>))}</div>
             </div>

             {!engineStarted && engineReady && (
                 <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                     <button onClick={handleStartGame} className="px-16 py-8 bg-white text-indigo-600 rounded-full font-black text-4xl shadow-2xl hover:scale-110 transition-transform animate-pulse">🚀 JOUER</button>
                 </div>
             )}

             {engineStarted && (
                 <>
                    <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-50 pointer-events-none">
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl pointer-events-auto flex gap-1">{"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}</div>
                        <div className="flex-1 flex justify-center px-4">
                            {levelQuestions[currentQIndex] && !isLevelWon && (<div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto">{feedback === 'CORRECT' ? "✅ BRAVO !" : feedback === 'WRONG' ? "❌ RATÉ..." : levelQuestions[currentQIndex].q}</div>)}
                        </div>
                        <div className="w-40"></div>
                    </div>
                    <div className="relative"><canvas ref={canvasRef} width={800} height={450} className="aspect-video shadow-2xl bg-black border-4 border-slate-800 rounded-xl" /></div>
                    <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center z-50 pointer-events-none">
                        {!isLevelWon && (<div className="grid grid-cols-4 gap-4 w-full max-w-6xl pointer-events-auto">{levelQuestions[currentQIndex]?.options?.map((o, i) => (<button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-5 rounded-xl font-black uppercase shadow-xl hover:bg-indigo-500 transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1">{o}</button>))}</div>)}
                    </div>
                 </>
             )}

             {crash && (<div className="absolute inset-0 bg-red-950 flex flex-col items-center justify-center text-white p-10 text-center z-[10000]"><span className="text-8xl mb-8">💥</span><h2 className="text-4xl font-black mb-4 uppercase">Erreur Fatale</h2><pre className="bg-black/50 p-8 rounded-3xl font-mono text-lg text-red-200 border-2 border-red-500/30 max-w-4xl overflow-auto mb-10">{crash}</pre><button onClick={onStop} className="px-12 py-5 bg-white text-red-600 rounded-full font-black text-xl">Corriger</button></div>)}
            <button onClick={onStop} className="absolute top-6 right-6 bg-red-600 text-white w-12 h-12 rounded-full font-black text-2xl shadow-xl border-4 border-white hover:scale-110 transition-all flex items-center justify-center pointer-events-auto z-[60]">✕</button>
        </div>
    );
}
