// @signatures: GameEngine, initLevel, handleAnswerClick, triggerWinSequence, handleBarCheat
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../../services/api';
import SoundExpert from './SoundExpert';

/**
 * 🎮 MOTEUR DE JEU DÉDIÉ (V530 - RESTORATION FINALE SON + UI)
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const gameInstanceRef = useRef(null);
    const [crash, setCrash] = useState(null);
    const [feedback, setFeedback] = useState(null);
    
    // --- ÉTATS DU QUIZ ---
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [lives, setLives] = useState(4);

    // --- ÉTATS DE STRUCTURE ---
    const [isLevelWon, setIsLevelWon] = useState(false);
    const isLevelWonRef = useRef(false);
    const [isPowerOff, setIsPowerOff] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);

    // 🔊 MOTEUR AUDIO
    const audioCtxRef = useRef(new (window.AudioContext || window.webkitAudioContext)());
    const audioBuffersRef = useRef(new Map());

    const logDebug = (msg, type = 'info') => {
        setDebugLogs(prev => [...prev, { id: Date.now() + Math.random(), text: String(msg), type }].slice(-6));
    };

    useEffect(() => {
        logDebug("🕹️ Démarrage Moteur...");
        api.get('/games/test-data').then(data => {
            const levelsData = data?.levels?.length > 0 ? data.levels : [{ name: "Demo", questions: [{ q: "Prêt ?", options: ["OUI", "NON"], a: 0 }] }];
            setAllLevels(levelsData);
            initLevel(0, levelsData);
        });
        return () => { if(audioCtxRef.current) audioCtxRef.current.close(); };
    }, []);

    const initLevel = (idx, sourceData) => {
        if (!sourceData[idx]) return;
        const lvl = sourceData[idx];
        setCurrentLevelIdx(idx);
        setLevelQuestions(lvl.questions || []);
        setQuestionStates(new Array((lvl.questions || []).length).fill(0));
        setIsLevelWon(false); isLevelWonRef.current = false; setIsPowerOff(false);
        setCurrentQIndex(0);
    };

    const handleAnswerClick = (choiceIdx) => {
        if (feedback || currentQIndex === -1 || isLevelWonRef.current) return;
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

        const currentQ = levelQuestions[currentQIndex];
        const isCorrect = currentQ.a === choiceIdx;
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        
        const newStates = [...questionStates];
        if (isCorrect) {
            newStates[currentQIndex] = Math.min(3, newStates[currentQIndex] + 1);
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(true);
        } else {
            newStates[currentQIndex] = Math.max(0, newStates[currentQIndex] - 1);
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(false);
            if (!isLevelWonRef.current) setLives(l => Math.max(0, l - 1));
        }
        setQuestionStates(newStates);

        setTimeout(() => {
            setFeedback(null);
            const available = newStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
            if (available.length > 0) {
                const nIdx = available[Math.floor(Math.random() * available.length)];
                setCurrentQIndex(nIdx);
                if (gameInstanceRef.current?.onQuestion) gameInstanceRef.current.onQuestion(levelQuestions[nIdx]);
            } else { triggerWinSequence(); }
        }, 1000);
    };

    const triggerWinSequence = () => {
        setIsLevelWon(true); isLevelWonRef.current = true;
        if (gameInstanceRef.current?.onLevelWin) gameInstanceRef.current.onLevelWin();
        setTimeout(() => setIsPowerOff(true), 1500);
        setTimeout(() => {
            const nextLvlIdx = currentLevelIdx + 1;
            if (allLevels[nextLvlIdx]) initLevel(nextLvlIdx, allLevels);
            else { alert("🎉 VICTOIRE FINALE !"); onStop(); }
        }, 4000);
    };

    useEffect(() => {
        if (!code || !project || !canvasRef.current) return;
        let isMounting = true;
        let animationFrameId = null;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const assets = {};

        async function startEngine() {
            try {
                const scene = project.scenes[activeSceneIdx];
                if (!scene) return;

                logDebug("📦 Chargement...");

                const imgUrls = (scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url));
                const sndUrls = (scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url)));

                await Promise.all([
                    ...[...new Set(imgUrls)].filter(Boolean).map(url => new Promise(res => {
                        const img = new Image(); img.crossOrigin = "anonymous";
                        img.onload = () => { assets[resolveUrl(url)] = img; res(); };
                        img.onerror = res; img.src = resolveUrl(url);
                    })),
                    ...[...new Set(sndUrls)].filter(Boolean).map(url => new Promise(async res => {
                        try {
                            if (!audioBuffersRef.current.has(url)) {
                                const buffer = await SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current);
                                if (buffer) audioBuffersRef.current.set(url, buffer);
                            }
                        } catch(e) {}
                        res();
                    }))
                ]);
                
                if (!isMounting) return;
                logDebug("🚀 Prêt !");

                const headerCode = `
                    const { canvas, ctx, assets, project, sceneIdx, resolveUrl, callbacks, audioBuffers, audioCtx } = params;
                    
                    class ActorProxy {
                        constructor(data, engine) {
                            this.id = data.id; this.name = data.name; this.engine = engine;
                            this.x = data.initialX || 50; this.y = data.initialY || 50;
                            this.dir = data.direction || 0; this.scale = data.scale || 1;
                            this.visible = true; this.currentAction = data.actions?.[0]?.name || 'IDLE';
                            this.rotationStyle = data.rotationStyle || 'all';
                            this.frameIdx = 0; this.lastAnimTime = 0;
                        }
                        play(name) { 
                            if(this.currentAction.toUpperCase() !== name.toUpperCase()) { 
                                this.currentAction = name; this.frameIdx = 0; this.lastAnimTime = 0;
                                // 🔊 TRIGGER AUDIO IMMÉDIAT
                                this.engine._triggerActionSounds(this.id, name);
                            } 
                        }
                    }

                    class MiniGameBase {
                        constructor(c, a, cb) {
                            this.canvas = c || canvas; this.ctx = ctx; this.assets = a || assets; this.callbacks = cb || callbacks; this.keys = {};
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
                                if(audioCtx.state === 'suspended') audioCtx.resume();
                                const source = audioCtx.createBufferSource();
                                source.buffer = buffer; source.connect(audioCtx.destination); source.start(0);
                            }
                        }

                        _system_render() {
                            const s = project.scenes[sceneIdx];
                            const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
                            if(bd && this.assets[resolveUrl(bd.url)]) this.ctx.drawImage(this.assets[resolveUrl(bd.url)], 0, 0, this.canvas.width, this.canvas.height);
                            else { this.ctx.fillStyle = "#000"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }
                            for(let key in this) {
                                const p = this[key];
                                if(p instanceof ActorProxy && p.visible) {
                                    const aData = project.scenes[sceneIdx].actors.find(ac => ac.id === p.id);
                                    if(!aData) continue;
                                    const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                                    if(act && act.frames?.length > 0) {
                                        const now = Date.now();
                                        if (now - p.lastAnimTime > (act.speed || 100)) { p.frameIdx = (p.frameIdx+1)%act.frames.length; p.lastAnimTime=now; }
                                        const img = this.assets[resolveUrl(act.frames[p.frameIdx].url)];
                                        if(img) {
                                            const xPx = (p.x/100)*this.canvas.width; const yPx = (p.y/100)*this.canvas.height; let sz = 150*p.scale;
                                            this.ctx.save(); this.ctx.translate(xPx, yPx);
                                            if(p.rotationStyle==='left-right' && (((p.dir%360)+360)%360)>90 && (((p.dir%360)+360)%360)<270) this.ctx.scale(-1,1);
                                            else if(p.rotationStyle==='all') this.ctx.rotate(p.dir*Math.PI/180);
                                            this.ctx.drawImage(img, -sz/2, -sz/2, sz, sz); this.ctx.restore();
                                        }
                                    }
                                }
                            }
                        }
                    }
                `;

                const finalScript = headerCode + "\n" + code + "\n return MiniGame;";
                const FinalClass = new Function('params', finalScript)({ 
                    canvas, ctx, assets, project, sceneIdx: activeSceneIdx, resolveUrl, 
                    audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current,
                    callbacks: { onPlayerHit: () => { if (!isLevelWonRef.current) setLives(l => Math.max(0, l - 1)); } } 
                });
                
                const instance = new FinalClass();
                gameInstanceRef.current = instance;
                if(instance.start) instance.start();

                const loop = () => {
                    if (!isMounting) return;
                    if (instance.update) instance.update();
                    if (instance._system_render) instance._system_render();
                    if (instance.draw) instance.draw();
                    animationFrameId = requestAnimationFrame(loop);
                };
                loop();
            } catch(e) { setCrash(e.message); }
        }
        startEngine();
        return () => { isMounting = false; if (animationFrameId) cancelAnimationFrame(animationFrameId); };
    }, [code, project, activeSceneIdx]);

    const currentQ = levelQuestions[currentQIndex];

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center font-sans overflow-hidden">
             
             {/* 🛠️ DEBUG HUD */}
             <div className="absolute top-0 left-0 p-4 z-[100] pointer-events-none">
                <div className="flex flex-col gap-1">
                    {debugLogs.map(log => (
                        <div key={log.id} className={`px-3 py-1 rounded text-[9px] font-mono shadow-lg border-l-4 w-fit ${log.type === 'error' ? 'bg-red-900/90 text-red-200 border-red-500' : 'bg-black/80 text-green-400 border-green-500'}`}>
                            {log.text}
                        </div>
                    ))}
                </div>
             </div>

             {/* UI TOP: VIES & QUESTION */}
             <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-50 pointer-events-none">
                <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl pointer-events-auto flex gap-1">
                    {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                </div>
                <div className="flex-1 flex justify-center px-4">
                    {currentQ && !isLevelWon && (
                        <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto">
                            {feedback === 'CORRECT' ? "✅ BRAVO !" : feedback === 'WRONG' ? "❌ RATÉ..." : currentQ.q}
                        </div>
                    )}
                </div>
                <div className="flex gap-2 items-center pointer-events-auto mr-16">
                    {questionStates.map((mastery, idx) => (
                        <div key={idx} onClick={() => handleBarCheat(idx)} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden transition-all cursor-help ${currentQIndex === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-60'}`}>
                            <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                        </div>
                    ))}
                </div>
            </div>

            {/* STAGE */}
            <div className="relative flex items-center justify-center w-full h-full">
                <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 border-slate-800 rounded-xl transition-opacity duration-1000 ${isPowerOff ? 'opacity-0' : 'opacity-100'}`} />
                {isLevelWon && (<div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm rounded-xl animate-in zoom-in"><div className="bg-white p-10 rounded-[40px] shadow-2xl text-center border-8 border-green-500"><span className="text-6xl block mb-4">🏆</span><h2 className="text-4xl font-black text-slate-800 uppercase">Niveau Réussi !</h2></div></div>)}
            </div>
            
            {crash && (
                <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center text-white p-10 text-center z-[1000]">
                    <span className="text-6xl mb-6">💥</span>
                    <h2 className="text-3xl font-black uppercase mb-4">Erreur Script</h2>
                    <pre className="bg-black/50 p-6 rounded-2xl font-mono text-sm text-red-400 border border-red-800 max-w-2xl overflow-auto mb-8">{crash}</pre>
                    <button onClick={onStop} className="px-10 py-4 bg-white text-red-600 rounded-2xl font-black uppercase shadow-xl">Retour</button>
                </div>
            )}

            {/* UI BOTTOM: RÉPONSES */}
            <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center z-50 pointer-events-none">
                <div className="grid grid-cols-4 gap-4 w-full max-w-6xl pointer-events-auto">
                    {currentQ?.options?.map((o, i) => (
                        <button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-5 rounded-xl font-black uppercase shadow-xl hover:bg-indigo-500 transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1">
                            {o}
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={onStop} className="absolute top-6 right-6 bg-red-600 text-white w-12 h-12 rounded-full font-black text-2xl shadow-xl border-4 border-white hover:scale-110 transition-all flex items-center justify-center pointer-events-auto z-[60]">✕</button>
        </div>
    );
}
