// @signatures: GameEngine, initLevel, handleAnswerClick, handleGameOver, retryLevel, nextLevel, preloadAssets
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';
import { api } from '../../../../services/api';

/**
 * 🎮 MOTEUR STUDIO V1006 (PHASE APPRENTISSAGE)
 * Ajout de l'étape Fiche + Vidéo avant chaque niveau.
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    
    const [isReady, setIsReady] = useState(false);
    const [engineStarted, setEngineStarted] = useState(false);
    const [loadProgress, setLoadProgress] = useState("0%");
    const [debugLogs, setDebugLogs] = useState([]);
    const [hitFlash, setHitFlash] = useState(false);
    
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(-1);
    const [lives, setLives] = useState(4);
    const [feedback, setFeedback] = useState(null);

    // --- NOUVEAUX ÉTATS APPRENTISSAGE ---
    const [isStudyPhase, setIsStudyPhase] = useState(false);
    const [showLevelTitle, setShowLevelTitle] = useState(false);
    const [isLevelWon, setIsLevelWon] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isGameCompleted, setIsGameCompleted] = useState(false);
    
    const isPausedRef = useRef(false);
    const activeTimeoutsRef = useRef([]);

    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const keysPressed = useRef({}); 
    const activeSourcesRef = useRef([]);

    const logSonde = (msg, type = 'info') => {
        setDebugLogs(prev => [...prev, { id: Math.random(), text: msg, type }].slice(-6));
    };

    const safeTimeout = (fn, delay) => {
        const id = setTimeout(fn, delay);
        activeTimeoutsRef.current.push(id);
        return id;
    };

    const clearAllTimeouts = () => {
        activeTimeoutsRef.current.forEach(clearTimeout);
        activeTimeoutsRef.current = [];
    };

    const stopAllSounds = () => {
        activeSourcesRef.current.forEach(src => { try { src.stop(); } catch(e){} });
        activeSourcesRef.current.length = 0; 
    };

    const playSystemSound = (soundName) => {
        if (!project || !audioCtxRef.current) return;
        const scene = project.scenes[activeSceneIdx];
        const soundEvent = scene?.globalSounds?.find(gs => gs.name.toUpperCase().trim() === soundName.toUpperCase().trim());
        if (!soundEvent || !soundEvent.sounds || soundEvent.sounds.length === 0) return;
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
        soundEvent.sounds.forEach(snd => {
            const buffer = audioBuffersRef.current.get(snd.url);
            if (buffer) {
                try {
                    const source = audioCtxRef.current.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioCtxRef.current.destination);
                    source.start(0);
                    activeSourcesRef.current.push(source);
                } catch (e) { console.error("Audio Play Error:", e); }
            }
        });
    };

    useEffect(() => {
        const preloadAssets = async () => {
            if (!project) return;
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const scene = project.scenes?.[activeSceneIdx];
            if (!scene) { setIsReady(true); return; }
            const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
            const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
            const total = imgUrls.length + sndUrls.length;
            let loaded = 0;
            const updateProgress = () => { loaded++; setLoadProgress(`${Math.round((loaded / total) * 100)}%`); };
            imageAssetsRef.current.clear();
            const imgPromises = imgUrls.map(url => new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                const finalUrl = resolveUrl(url);
                img.onload = () => { imageAssetsRef.current.set(finalUrl, img); updateProgress(); resolve(); };
                img.onerror = () => { updateProgress(); resolve(); };
                img.src = finalUrl;
            }));
            const sndPromises = sndUrls.map(url => new Promise(resolve => {
                SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                    if (buf) audioBuffersRef.current.set(url, buf);
                    updateProgress();
                    resolve();
                });
            }));
            await Promise.all([...imgPromises, ...sndPromises]);
            setIsReady(true);
        };

        api.get('/games/test-data').then(data => {
            let levelsData = data?.levels?.length > 0 ? data.levels : [{ name: "Defaut", questions: [{ q: "Q1", options:["A","B"], a:0 }] }];
            setAllLevels(levelsData);
            preloadAssets();
        });

        const handleKeyDown = (e) => { keysPressed.current[e.code] = true; };
        const handleKeyUp = (e) => { keysPressed.current[e.code] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { 
            window.removeEventListener('keydown', handleKeyDown); 
            window.removeEventListener('keyup', handleKeyUp);
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
            stopAllSounds();
            clearAllTimeouts();
        };
    }, [project]);

    // --- INITIALISATION NIVEAU AVEC PHASE ETUDE ---
    const initLevel = (idx, sourceData) => {
        if (!sourceData[idx]) return;
        stopAllSounds(); clearAllTimeouts(); 
        const lvl = sourceData[idx];
        setCurrentLevelIdx(idx);
        setLevelQuestions(lvl.questions || []);
        setQuestionStates(new Array((lvl.questions || []).length).fill(0));
        setCurrentQIndex(0);
        setIsLevelWon(false); setIsGameOver(false); setIsGameCompleted(false);
        
        // 1. On active la phase d'étude
        setIsStudyPhase(true);
        isPausedRef.current = true;
    };

    const startLevelAfterStudy = () => {
        setIsStudyPhase(false);
        setShowLevelTitle(true);
        safeTimeout(() => {
            setShowLevelTitle(false);
            isPausedRef.current = false; 
            if (gameInstanceRef.current && gameInstanceRef.current.start) {
                gameInstanceRef.current.start();
            }
            playSystemSound("DÉPART");
        }, 1500);
    };

    const handleGameOver = () => {
        stopAllSounds(); setIsGameOver(true); isPausedRef.current = true;
        logSonde("💀 GAME OVER", "error");
        safeTimeout(() => { playSystemSound("DÉFAITE"); }, 500);
    };

    const retryLevel = () => { setLives(4); initLevel(currentLevelIdx, allLevels); };

    const nextLevel = () => {
        const nextIdx = currentLevelIdx + 1;
        if (allLevels[nextIdx]) initLevel(nextIdx, allLevels);
        else {
            stopAllSounds(); setIsGameCompleted(true);
            safeTimeout(() => { playSystemSound("VICTOIRE"); }, 500);
        }
    };

    const triggerPlayerHit = () => {
        if (isPausedRef.current) return;
        setHitFlash(true);
        setTimeout(() => setHitFlash(false), 200);
        setLives(prev => {
            const newVal = Math.max(0, prev - 1);
            if (newVal === 0) { isPausedRef.current = true; safeTimeout(handleGameOver, 1000); }
            return newVal;
        });
    };

    const handleBarClick = (idx) => {
        if (keysPressed.current['KeyF']) {
            const newStates = [...questionStates]; newStates[idx] = 3; setQuestionStates(newStates);
            if(newStates.filter(s => s<3).length === 0) { setIsLevelWon(true); isPausedRef.current=true; safeTimeout(nextLevel, 1500); }
        }
    };

    const handleAnswerClick = (choiceIdx) => {
        if (feedback || currentQIndex === -1 || isPausedRef.current) return;
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
            triggerPlayerHit();
        }
        setQuestionStates(newStates);
        safeTimeout(() => {
            setFeedback(null);
            if (lives > 0) {
                const available = newStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
                if (available.length > 0) setCurrentQIndex(available[Math.floor(Math.random() * available.length)]);
                else {
                    setIsLevelWon(true); isPausedRef.current = true;
                    if (gameInstanceRef.current?.onLevelWin) gameInstanceRef.current.onLevelWin();
                    safeTimeout(nextLevel, 4000);
                }
            }
        }, 1000);
    };

    const handleStartGame = async () => {
        if (audioCtxRef.current) { try { await audioCtxRef.current.resume(); } catch (e) {} }
        setEngineStarted(true);
        initLevel(0, allLevels);
    };

    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;
        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const gameCallbacks = { onPlayerHit: triggerPlayerHit, playSound: (name) => {} };
            const BaseFactory = new Function('params', `
                const { audioBuffers, audioCtx, project, sceneIdx, imageAssets, resolveUrl, canvas, ctx, activeSources } = params;
                class ActorProxy {
                    constructor(data, engine) { 
                        this.id = data.id; this.name = data.name; this.engine = engine;
                        this.x = data.initialX || 50; this.y = data.initialY || 50;
                        this.scale = data.scale || 1; this.visible = true;
                        this.direction = data.direction || 0;
                        this.rotationStyle = data.rotationStyle || 'all';
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
                    constructor(c, a, cb) {
                        this.canvas = c || canvas; this.ctx = ctx; this.keys = {};
                        this.callbacks = cb; this.assets = a || {};
                        this.currentLevel = 1; 
                        const s = project.scenes[sceneIdx];
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
                        try {
                            const buffer = audioBuffers.get(url);
                            if(buffer && audioCtx) {
                                if (audioCtx.state === 'suspended') audioCtx.resume();
                                const source = audioCtx.createBufferSource();
                                source.buffer = buffer; source.connect(audioCtx.destination); source.start(0);
                                activeSources.push(source);
                            }
                        } catch(e) {}
                    }
                    _render() {
                        const s = project.scenes[sceneIdx];
                        ctx.fillStyle = "#0f172a"; ctx.fillRect(0,0,canvas.width, canvas.height);
                        const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
                        if(bd) {
                            const key = resolveUrl(bd.url);
                            const img = imageAssets.get(key);
                            if(img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        }
                        for(let key in this) {
                            const p = this[key];
                            if(p instanceof ActorProxy && p.visible) {
                                const aData = project.scenes[sceneIdx].actors.find(ac => ac.id === p.id);
                                if(!aData) continue;
                                const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                                if(act && act.frames && act.frames.length > 0) {
                                    const now = Date.now();
                                    if (now - p.lastAnimTime > (act.speed || 100)) { p.frameIdx = (p.frameIdx+1)%act.frames.length; p.lastAnimTime=now; }
                                    const assetKey = resolveUrl(act.frames[p.frameIdx].url);
                                    const spr = imageAssets.get(assetKey);
                                    if(spr) {
                                        const xPx = (p.x/100)*canvas.width; const yPx = (p.y/100)*canvas.height; let sz = 150*p.scale;
                                        this.ctx.save(); this.ctx.translate(xPx, yPx);
                                        if(p.rotationStyle === 'left-right' && Math.abs(p.scale) !== p.scale) this.ctx.scale(Math.sign(p.scale), 1);
                                        else if (p.direction) this.ctx.rotate(p.direction * Math.PI / 180);
                                        this.ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); this.ctx.restore();
                                    }
                                }
                            }
                        }
                    }
                }
            `);
            const MiniGameBase = BaseFactory({ audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, imageAssets: imageAssetsRef.current, resolveUrl, logSonde, project, sceneIdx: activeSceneIdx, canvas, ctx, callbacks: gameCallbacks, activeSources: activeSourcesRef.current });
            const UserCodeFactory = new Function('MiniGameBase', `${code}\nreturn MiniGame;`);
            const UserGameClass = UserCodeFactory(MiniGameBase);
            const instance = new UserGameClass(canvas, {}, gameCallbacks);
            gameInstanceRef.current = instance;
            const tick = () => {
                if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                instance.currentLevel = currentLevelIdx + 1;
                if (!isPausedRef.current && instance.update) instance.update();
                if (instance._render) instance._render();
                if (instance.draw) instance.draw();
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) { logSonde("CRASH: " + e.message, "error"); }
    }, [engineStarted]);

    // --- RENDU UI ---
    const currentLvlData = allLevels[currentLevelIdx];

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
             {hitFlash && <div className="absolute inset-0 bg-red-500/30 z-[100] pointer-events-none animate-ping"></div>}
             <button onClick={onStop} className="absolute top-6 right-6 bg-red-600 text-white w-12 h-12 rounded-full font-black text-2xl shadow-xl border-4 border-white hover:scale-110 transition-all flex items-center justify-center pointer-events-auto z-50">✕</button>

             {!engineStarted ? (
                 <button onClick={handleStartGame} disabled={!isReady} className={`px-20 py-10 rounded-full font-black text-5xl shadow-2xl border-8 transition-all ${isReady ? 'bg-white text-indigo-600 border-indigo-200 hover:scale-110 animate-pulse' : 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed'}`}>
                    {isReady ? "🚀 JOUER" : `CHARGEMENT ${loadProgress}...`}
                 </button>
             ) : (
                <>
                    <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl pointer-events-auto flex gap-1" onClick={() => { if (keysPressed.current['KeyF']) triggerPlayerHit(); }}>
                            {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                        </div>
                        <div className="flex-1 flex justify-center px-4">
                            {levelQuestions[currentQIndex] && !isStudyPhase && !isLevelWon && !isGameOver && !showLevelTitle && (
                                <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto animate-in slide-in-from-top">
                                    {feedback === 'CORRECT' ? "✅ BRAVO !" : feedback === 'WRONG' ? "❌ RATÉ..." : levelQuestions[currentQIndex].q}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 items-center pointer-events-auto mr-20">
                            {questionStates.map((mastery, idx) => (
                                <div key={idx} onClick={() => handleBarClick(idx)} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden cursor-pointer ${currentQIndex === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-60'}`}>
                                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in">
                        <canvas ref={canvasRef} width={800} height={450} className="aspect-video shadow-2xl bg-black border-4 border-slate-800 rounded-xl" />
                        
                        {/* --- MODALE APPRENTISSAGE --- */}
                        {isStudyPhase && currentLvlData && (
                            <div className="absolute inset-4 bg-slate-900/95 backdrop-blur-xl rounded-xl z-50 flex flex-col p-6 border-2 border-indigo-500 animate-in fade-in duration-300">
                                <h2 className="text-3xl font-black text-indigo-400 uppercase text-center mb-4">Préparation : {currentLvlData.name}</h2>
                                <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
                                    {/* FICHE */}
                                    <div className="flex-1 bg-white rounded-lg overflow-hidden border-4 border-slate-800 flex items-center justify-center">
                                        {currentLvlData.intro?.sheetUrl ? (
                                            <img src={resolveUrl(currentLvlData.intro.sheetUrl)} className="max-w-full max-h-full object-contain" />
                                        ) : <div className="text-slate-300 font-bold uppercase">Aucune fiche niveau</div>}
                                    </div>
                                    {/* VIDÉO */}
                                    <div className="flex-1 bg-black rounded-lg overflow-hidden border-4 border-slate-800 flex items-center justify-center">
                                        {currentLvlData.intro?.videoUrl ? (
                                            <iframe className="w-full h-full" src={currentLvlData.intro.videoUrl.replace("watch?v=", "embed/")} frameBorder="0" allowFullScreen></iframe>
                                        ) : <div className="text-slate-600 font-bold uppercase">Aucune vidéo niveau</div>}
                                    </div>
                                </div>
                                <button onClick={startLevelAfterStudy} className="mt-6 bg-indigo-600 text-white py-4 rounded-2xl font-black text-2xl hover:scale-105 transition-transform shadow-xl border-b-8 border-indigo-900 active:border-b-0 active:translate-y-2 uppercase">J'ai compris, on commence !</button>
                            </div>
                        )}

                        {showLevelTitle && (
                            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center rounded-xl z-40 animate-in fade-in">
                                <h1 className="text-6xl font-black text-yellow-400 drop-shadow-lg mb-4">NIVEAU {currentLevelIdx + 1}</h1>
                            </div>
                        )}
                        {isLevelWon && (
                            <div className="absolute inset-0 flex items-center justify-center bg-green-900/80 backdrop-blur-sm rounded-xl animate-in zoom-in z-40">
                                <h2 className="text-5xl font-black text-white uppercase">Niveau Réussi !</h2>
                            </div>
                        )}
                        {isGameOver && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 backdrop-blur-md rounded-xl z-50">
                                <h2 className="text-6xl font-black text-white uppercase mb-8">💀 GAME OVER</h2>
                                <button onClick={retryLevel} className="bg-white text-red-600 px-8 py-4 rounded-full font-black text-xl uppercase">🔄 Réessayer</button>
                            </div>
                        )}
                        {isGameCompleted && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-500/90 backdrop-blur-md rounded-xl z-50">
                                <h2 className="text-6xl font-black text-white uppercase mb-4">VICTOIRE TOTALE !</h2>
                                <button onClick={onStop} className="mt-8 bg-white text-yellow-600 px-8 py-4 rounded-full font-black text-xl uppercase">QUITTER</button>
                            </div>
                        )}
                    </div>

                    {!isLevelWon && !isGameOver && !isGameCompleted && !showLevelTitle && !isStudyPhase && levelQuestions[currentQIndex] && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                                {levelQuestions[currentQIndex].options.map((o, i) => (
                                    <button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-indigo-500 border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2">{o}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
             )}
        </div>
    );
}
