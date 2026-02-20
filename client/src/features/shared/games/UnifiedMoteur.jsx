// @signatures: UnifiedMoteur, handleAnswerClick, triggerWinSequence, startCurrentLevel, updateBarLogic, changeQuestionLogic
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from '../../../services/SoundExpert';
import { api } from '../../../services/api';
import { createGameBase } from '../../../services/gameCore';

/**
 * 🧠 UNIFIED MOTEUR V9.5 (DEBUG & BRIDGE)
 * REPAIRS: 
 * - Error Reporting UI (Affiche les crashs de script).
 * - Complete Bridge (SHAKE, SUBMIT_ANSWER).
 * - Multi-level reset fix.
 */

const ZOMBIE_FALLBACK_CODE = `class MiniGame extends MiniGameBase {
    constructor(canvas, assets, callbacks) {
        super(canvas, assets, callbacks);
        this.resetInternalState();
    }
    resetInternalState() {
        this.projectiles = []; this.zombieX = 100; this.zombieState = "WALKING"; 
        this.heroState = "IDLE"; this.heroTimer = 0; this.isStopped = false;
    }
    start() { this.game.setUI(true); if(this.HEROS) this.HEROS.play("IDLE", true); }
    onResult(isCorrect) {
        if (isCorrect && this.HEROS) {
            this.HEROS.play("TIRER", false); this.heroState = "SHOOT"; this.heroTimer = 40;
            this.projectiles.push({ x: this.HEROS.x + 5, y: this.HEROS.y - 5 });
        } else if (!isCorrect) { this.zombieX -= 10; this.game.shake(); }
    }
    update() {
        if (this.isStopped) return;
        if (this.zombieState === "WALKING") {
            this.zombieX -= this.isBossPhase ? 0.08 : 0.15;
            if (this.ZOMBIE) this.ZOMBIE.x = this.zombieX;
            if (this.zombieX < 20) { this.game.damage(1); this.zombieX = 100; }
        }
        this.projectiles.forEach((p,i) => { p.x += 3; if(p.x > 100) this.projectiles.splice(i,1); });
    }
}`;

export default function UnifiedMoteur({ gameData, onExit, isStudioTest = false, user }) {
    const [lives, setLives] = useState(4);
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [allLevels, setAllLevels] = useState([]);
    const [levelQuestions, setLevelQuestions] = useState([]);
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [showAnswerUI, setShowAnswerUI] = useState(true);
    const [showLevelIntro, setShowLevelIntro] = useState(true);
    const [showLevelBanner, setShowLevelBanner] = useState(false);
    const [showStageClear, setShowStageClear] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [showGameComplete, setShowGameComplete] = useState(false);
    const [zoomMedia, setZoomMedia] = useState(null);
    const [activeBossVisual, setActiveBossVisual] = useState(false);
    const [isShake, setIsShake] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [userInput, setUserInput] = useState("");
    const [loadProgress, setLoadProgress] = useState("");
    const [isReady, setIsReady] = useState(false);
    const [engineStarted, setEngineStarted] = useState(false);
    
    // --- NOUVEAU : GESTION DES ERREURS DE SCRIPT ---
    const [scriptError, setScriptError] = useState(null);

    const canvasRef = useRef(null);
    const frameIdRef = useRef(null);
    const gameInstanceRef = useRef(null);
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const projectRef = useRef(gameData || {});
    const bossModeRef = useRef(false);
    const liveData = useRef({ qStates: [], qIndex: 0, lives: 4 });
    const keysPressed = useRef({});

    const bridgeProxy = useRef((type, value) => {
        switch(type) {
            case 'DAMAGE':
                setIsShake(true); setTimeout(() => setIsShake(false), 500);
                liveData.current.lives = Math.max(0, liveData.current.lives - (value || 1));
                setLives(liveData.current.lives);
                if (liveData.current.lives <= 0) { 
                    setShowGameOver(true); 
                    if (gameInstanceRef.current) gameInstanceRef.current.isStopped = true; 
                    triggerGlobalEvent("DEFAITE"); 
                }
                break;
            case 'WIN_ROUND': updateBarLogic(true); break;
            case 'FAIL_ROUND': updateBarLogic(false); break;
            case 'NEXT_Q': changeQuestionLogic(); break;
            case 'SET_BOSS': setActiveBossVisual(!!value); bossModeRef.current = !!value; break;
            case 'SET_UI': setShowAnswerUI(!!value); break;
            case 'SHAKE': setIsShake(true); setTimeout(() => setIsShake(false), 600); break;
            case 'SUBMIT_ANSWER': handleAnswerClick(value); break;
            case 'AUDIO': triggerGlobalEvent(value); break;
        }
    });

    const resolveUrl = (url) => {
        if (!url) return "";
        if (url.startsWith('blob:') || url.startsWith('data:')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    };

    const triggerGlobalEvent = (eventName) => {
        const scene = projectRef.current.scenes?.[0];
        if (!scene || !scene.globalSounds) return;
        const cleanTarget = eventName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const event = scene.globalSounds.find(g => g.name && g.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() === cleanTarget);
        if (event && event.sounds && audioCtxRef.current) {
            if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
            event.sounds.forEach(snd => {
                const buffer = audioBuffersRef.current.get(resolveUrl(snd.url));
                if (buffer) {
                    const s = audioCtxRef.current.createBufferSource(); s.buffer = buffer; s.connect(audioCtxRef.current.destination); s.start(0);
                }
            });
        }
    };

    const updateBarLogic = (isCorrect) => {
        const idx = liveData.current.qIndex;
        if (isCorrect) { liveData.current.qStates[idx] = Math.min(3, (liveData.current.qStates[idx] || 0) + 1); } 
        else { liveData.current.qStates[idx] = Math.max(0, (liveData.current.qStates[idx] || 0) - 1); }
        setQuestionStates([...liveData.current.qStates]);
    };

    const changeQuestionLogic = () => {
        setFeedback(null); setUserInput("");
        const states = liveData.current.qStates;
        const available = states.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        if (available.length > 0) {
            const currentIdx = liveData.current.qIndex;
            if (states[currentIdx] === 2) { bridgeProxy.current('SET_BOSS', true); } 
            else {
                const others = available.filter(idx => idx !== currentIdx);
                let nextIdx = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : available[0];
                liveData.current.qIndex = nextIdx;
                setCurrentQIndex(nextIdx);
                bridgeProxy.current('SET_BOSS', states[nextIdx] === 2);
            }
        } else { triggerWinSequence(); }
    };

    const triggerWinSequence = async () => {
        const isGameFinished = !allLevels[currentLevelIdx + 1];
        if (!isStudioTest && user && gameData?._id) {
            try {
                await fetch('/api/games/save-progress', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ studentId: user._id || user.id, gameId: gameData._id, score: lives * 100, levelReached: isGameFinished ? 1 : 0 })
                });
            } catch(e) {}
        }
        if (isGameFinished) { triggerGlobalEvent("VICTOIRE"); setShowGameComplete(true); } 
        else { 
            triggerGlobalEvent("UPLEVEL"); 
            setShowStageClear(true); 
            setTimeout(() => { 
                setShowStageClear(false); 
                setCurrentLevelIdx(p => p + 1); 
                setEngineStarted(false);
                setShowLevelIntro(true); 
            }, 3000); 
        }
    };

    useEffect(() => {
        const initGame = async () => {
            let levelsData = gameData?.levels || [];
            if (levelsData.length === 0) {
                 try { const res = await api.get('/games/test-data'); levelsData = res?.levels?.length > 0 ? res.levels : []; } catch(e) {} 
            }
            if (levelsData.length === 0) levelsData = [{ name: "Niveau 1", questions: [{q:"Prêt ?",options:["OUI","NON"],a:0}] }];
            setAllLevels(levelsData);
            if (levelsData[currentLevelIdx]) {
                const qs = levelsData[currentLevelIdx].questions || [];
                setLevelQuestions(qs);
                const initialStates = new Array(qs.length).fill(0);
                liveData.current.qStates = initialStates;
                liveData.current.qIndex = 0; liveData.current.lives = 4;
                setQuestionStates(initialStates); setCurrentQIndex(0); setLives(4); setActiveBossVisual(false); bossModeRef.current = false;
                setShowLevelIntro(true); setScriptError(null);
            }
        };
        initGame();
    }, [gameData, currentLevelIdx]);

    useEffect(() => {
        if (!gameData) return;
        setIsReady(false);
        projectRef.current = gameData; 
        const scene = gameData.scenes?.[0];
        if (scene) {
            const imgs = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
            const snds = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            let loadedCount = 0;
            if (imgs.length === 0) setIsReady(true);
            imgs.forEach(url => { 
                const rKey = resolveUrl(url); 
                const img = new Image(); img.crossOrigin = "anonymous"; 
                img.onload = () => { imageAssetsRef.current.set(rKey, img); loadedCount++; setLoadProgress(`${Math.round(loadedCount/imgs.length*100)}%`); if (loadedCount >= imgs.length) setIsReady(true); };
                img.onerror = () => { loadedCount++; if (loadedCount >= imgs.length) setIsReady(true); };
                img.src = rKey; 
            });
            snds.forEach(url => { SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => { if (buf) audioBuffersRef.current.set(resolveUrl(url), buf); }); });
        }
    }, [gameData]);

    const handleAnswerClick = (val) => {
        if (feedback || showLevelIntro || showStageClear || showGameOver) return;
        const currentQ = levelQuestions[currentQIndex];
        const clean = (s) => String(s).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let isCorrect = (typeof val === 'number') ? (currentQ.a === val) : (clean(val) === clean(currentQ.options[currentQ.a]));
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);
        setTimeout(() => { updateBarLogic(isCorrect); changeQuestionLogic(); }, 1200);
    };

    const startCurrentLevel = async () => { 
        if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
        setEngineStarted(true); setShowLevelIntro(false); setShowLevelBanner(true); 
        setTimeout(() => triggerGlobalEvent("DEPART"), 100);
        setTimeout(() => setShowLevelBanner(false), 1500); 
    };

    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;
        try {
            const MiniGameBase = createGameBase({ 
                audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, projectRef, sceneIdx: 0, imageAssets: imageAssetsRef.current, resolveUrl, canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'), 
                playParallelSound: (url) => { if(audioCtxRef.current) { const b = audioBuffersRef.current.get(resolveUrl(url)); if(b){ const s = audioCtxRef.current.createBufferSource(); s.buffer=b; s.connect(audioCtxRef.current.destination); s.start(0); } } },
                bridge: { trigger: (t, v) => bridgeProxy.current(t, v) }, questions: levelQuestions
            });
            
            const scriptToRun = projectRef.current.generatedCode || ZOMBIE_FALLBACK_CODE;
            
            // --- WRAPPER DE SÉCURITÉ ---
            let factory, instance;
            try {
                factory = new Function('MiniGameBase', scriptToRun + "\n return MiniGame;");
                instance = new (factory(MiniGameBase))(canvasRef.current, {}, {});
            } catch (initErr) {
                setScriptError(`Erreur d'initialisation : ${initErr.message}`);
                return;
            }

            gameInstanceRef.current = instance; if (instance.start) instance.start();
            
            const tick = () => {
                try {
                    if (instance && !instance.isStopped) {
                        if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                        instance.isBossPhase = bossModeRef.current;
                        instance.currentQIndex = liveData.current.qIndex;
                        if (instance.update) instance.update(); 
                        if (instance._render) instance._render(); 
                        if (instance.draw) instance.draw();
                    }
                    frameIdRef.current = requestAnimationFrame(tick);
                } catch (runtimeErr) {
                    setScriptError(`Erreur d'exécution : ${runtimeErr.message}`);
                    cancelAnimationFrame(frameIdRef.current);
                }
            };
            tick();
        } catch (e) { setScriptError(`Crash Moteur : ${e.message}`); }
        return () => { if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted]);

    useEffect(() => {
        const hDown = (e) => keysPressed.current[e.code] = true;
        const hUp = (e) => keysPressed.current[e.code] = false;
        window.addEventListener('keydown', hDown); window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, []);

    return (
        <div className={"fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center " + (isShake ? 'animate-shake' : '')}>
            
            {/* ALERT ERREUR SCRIPT */}
            {scriptError && (
                <div className="absolute top-0 left-0 right-0 bg-red-600 text-white p-4 text-center font-black z-[100000] animate-in slide-in-from-top">
                    ⚠️ ERREUR SCRIPT STUDIO : {scriptError}
                    <button onClick={() => setScriptError(null)} className="ml-4 underline">Fermer</button>
                </div>
            )}

            {showLevelBanner && <div className="fixed top-[20%] z-[5000] animate-in zoom-in"><span className="text-yellow-400 font-black text-6xl uppercase drop-shadow-lg">Niveau {currentLevelIdx + 1}</span></div>}
            {showStageClear && <div className="fixed top-[40%] z-[5000] animate-in zoom-in text-center"><span className="text-green-500 font-black text-8xl uppercase drop-shadow-lg block">STAGE CLEAR !</span></div>}
            
            {showLevelIntro && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-[6000] p-8 text-center animate-in zoom-in">
                    <h1 className="text-5xl text-white font-black mb-6 uppercase">{allLevels[currentLevelIdx]?.name || ("Niveau " + (currentLevelIdx+1))}</h1>
                    <div className="flex gap-10 mb-12 w-full max-w-4xl justify-center h-[280px]">
                        <div onClick={() => allLevels[currentLevelIdx]?.intro?.sheetUrl && setZoomMedia('sheet')} className="h-full aspect-[3/4] bg-slate-800 rounded-3xl border-4 border-slate-700 overflow-hidden flex items-center justify-center shadow-2xl cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all">
                            {allLevels[currentLevelIdx]?.intro?.sheetUrl ? <img src={resolveUrl(allLevels[currentLevelIdx].intro.sheetUrl)} className="w-full h-full object-contain" /> : <span className="text-slate-500 font-bold uppercase text-[10px]">Fiche</span>}
                        </div>
                        <div onClick={() => allLevels[currentLevelIdx]?.intro?.videoUrl && setZoomMedia('video')} className="h-full aspect-video bg-black rounded-3xl border-4 border-slate-700 overflow-hidden shadow-2xl flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all relative group">
                            {allLevels[currentLevelIdx]?.intro?.videoUrl ? <span className="text-6xl">▶️</span> : <span className="text-slate-500 font-bold uppercase text-[10px]">Vidéo</span>}
                        </div>
                    </div>
                    <button onClick={startCurrentLevel} disabled={!isReady} className="px-16 py-6 rounded-full font-black text-3xl shadow-2xl border-4 bg-white text-indigo-900 border-indigo-500 hover:scale-110">
                        {isReady ? 'DÉMARRER 🚀' : `CHARGEMENT ${loadProgress}`}
                    </button>
                </div>
            )}
            
            {engineStarted && !showLevelIntro && (
                <>
                    <div className="absolute top-6 w-full flex justify-between px-10 pointer-events-none z-30">
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-lg pointer-events-auto">{"❤️".repeat(lives)}</div>
                        <div className="flex-1 mx-10">
                            <div className={"bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 text-xl text-center border-slate-600 " + (activeBossVisual ? 'border-red-500 ring-2 ring-red-500/50' : '')}>
                                {feedback === 'CORRECT' ? "✅ BIEN JOUÉ !" : feedback === 'WRONG' ? "❌ MAUVAISE RÉPONSE" : levelQuestions[currentQIndex]?.q}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {questionStates.map((s, i) => (
                                <div key={i} className={"w-6 h-16 rounded-lg border-2 " + (currentQIndex === i ? 'border-white scale-110' : 'border-slate-600 opacity-60') + " bg-slate-800 overflow-hidden relative"}>
                                    <div className={"absolute bottom-0 w-full transition-all duration-500 " + (s >= 3 ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : s >= 2 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-yellow-500')} style={{height: (s/3*100) + "%" }}></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <canvas ref={canvasRef} width={800} height={450} className={"aspect-video shadow-2xl bg-black border-4 " + (activeBossVisual ? 'border-red-600 shadow-[0_0_50px_red]' : 'border-slate-800') + " rounded-lg"} />
                    {showAnswerUI && levelQuestions[currentQIndex] && !showStageClear && !showGameComplete && !showGameOver && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            {activeBossVisual ? (
                                <div className="flex gap-4 w-full max-w-2xl animate-in slide-in-from-bottom">
                                    <input autoFocus className="flex-1 bg-slate-900 border-4 border-red-600 text-white text-3xl font-black py-4 px-8 rounded-2xl text-center outline-none" value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnswerClick(userInput)} placeholder="TAPE TA RÉPONSE..." />
                                    <button onClick={() => handleAnswerClick(userInput)} className="bg-red-600 text-white px-10 rounded-2xl font-black text-xl border-b-8 border-red-800 uppercase">Attaquer</button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl">
                                    {levelQuestions[currentQIndex].options.map((o, i) => (<button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2">{o}</button>))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <button onClick={onExit} className="absolute top-2 right-4 w-10 h-10 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xl font-black z-[7000] border-2 border-white/20">✕</button>
            {showGameOver && (<div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[8000] animate-in zoom-in"><h1 className="text-8xl font-black text-red-600 mb-8 uppercase tracking-widest">GAME OVER</h1><button onClick={handleRetry} className="bg-white text-black px-12 py-5 rounded-2xl font-black text-2xl hover:bg-red-500 hover:text-white transition-all uppercase">RÉESSAYER 🔄</button></div>)}
        </div>
    );
}