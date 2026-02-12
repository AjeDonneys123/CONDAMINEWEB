// @signatures: UnifiedMoteur, handleBridgeEvent, handleAnswerClick, handleRoundValidation, pickNextQuestion, handleHeartClick, handleBarClick, playParallelSoundImpl, triggerGlobalEvent, getYoutubeEmbed
import React, { useState, useRef, useEffect, useCallback } from 'react';
import SoundExpert from '../../../services/SoundExpert';
import { api } from '../../../services/api';
import { createGameBase } from '../../../services/gameCore';

/**
 * 🧠 UNIFIED MOTEUR V7.0 (FINAL HYBRID)
 * - Supporte le Bridge (V5+) ET les Callbacks Legacy.
 * - Initialisation sécurisée des questions (Anti écran noir).
 */
export default function UnifiedMoteur({ gameData, onExit, isStudioTest = false }) {
    // --- ÉTATS ---
    const [lives, setLives] = useState(4);
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [allLevels, setAllLevels] = useState([]);
    const [levelQuestions, setLevelQuestions] = useState([]);
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    
    // --- UI STATES ---
    const [showLevelIntro, setShowLevelIntro] = useState(true);
    const [showLevelBanner, setShowLevelBanner] = useState(false);
    const [showStageClear, setShowStageClear] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [showGameComplete, setShowGameComplete] = useState(false);
    const [zoomMedia, setZoomMedia] = useState(null);
    const [activeBossVisual, setActiveBossVisual] = useState(false);
    const [isShake, setIsShake] = useState(false);
    
    // --- REFS ---
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [userInput, setUserInput] = useState("");

    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const keysPressed = useRef({});
    const projectRef = useRef(gameData || {});
    const bossModeRef = useRef(false);
    const pendingResultRef = useRef(null);
    const [assetsSignature, setAssetsSignature] = useState("");

    // 🚀 STATE REF
    const stateRef = useRef({ currentQIndex, questionStates, lives, allLevels, currentLevelIdx, levelQuestions });
    useEffect(() => { stateRef.current = { currentQIndex, questionStates, lives, allLevels, currentLevelIdx, levelQuestions }; }, [currentQIndex, questionStates, lives, allLevels, currentLevelIdx, levelQuestions]);

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    const playParallelSoundImpl = (url) => {
        if (!url || !audioCtxRef.current) return;
        const buffer = audioBuffersRef.current.get(resolveUrl(url));
        if (buffer) {
            try {
                if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
                const source = audioCtxRef.current.createBufferSource();
                source.buffer = buffer; 
                source.connect(audioCtxRef.current.destination);
                source.start(0);
            } catch(e) {}
        }
    };

    const triggerGlobalEvent = (eventName) => {
        const scene = projectRef.current.scenes?.[0];
        if (!scene || !scene.globalSounds) return;
        const cleanTarget = eventName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const event = scene.globalSounds.find(g => g.name && g.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() === cleanTarget);
        if (event && event.sounds) event.sounds.forEach(snd => playParallelSoundImpl(snd.url));
    };

    // --- 1. BRIDGE ---
    const bridgeProxy = useRef((type, value) => {
        const currentState = stateRef.current;
        switch(type) {
            case 'DAMAGE':
                setIsShake(true); setTimeout(() => setIsShake(false), 500);
                setLives(prev => {
                    const newVal = Math.max(0, prev - (value || 1));
                    if (newVal === 0) { setShowGameOver(true); if (gameInstanceRef.current) gameInstanceRef.current.isStopped = true; }
                    return newVal;
                });
                break;
            case 'HEAL': setLives(prev => Math.min(4, prev + (value || 1))); break;
            case 'WIN_ROUND': handleRoundValidation(true, currentState); break;
            case 'FAIL_ROUND': handleRoundValidation(false, currentState); break;
            case 'SET_BOSS': 
                setActiveBossVisual(!!value); 
                bossModeRef.current = !!value;
                if(gameInstanceRef.current) gameInstanceRef.current.isBossPhase = !!value;
                break;
            case 'SHAKE': setIsShake(true); setTimeout(() => setIsShake(false), 500); break;
            case 'AUDIO': triggerGlobalEvent(value); break;
            case 'VICTORY': triggerWinSequence(currentState); break;
            case 'GAME_OVER': setShowGameOver(true); break;
            case 'NEXT_Q': forceNextQuestion(currentState); break;
        }
    });

    // --- 2. LOGIQUE METIER ---
    const handleRoundValidation = (success, state) => {
        const isCorrect = pendingResultRef.current !== null ? pendingResultRef.current : success;
        const nextStates = [...state.questionStates];
        const idx = state.currentQIndex;
        if (isCorrect) nextStates[idx] = Math.min(3, nextStates[idx] + 1);
        else nextStates[idx] = Math.max(0, nextStates[idx] - 1);
        setQuestionStates(nextStates);
        if (!isCorrect) {
            setLives(prev => {
                const n = Math.max(0, prev - 1);
                if(n===0) { setShowGameOver(true); if(gameInstanceRef.current) gameInstanceRef.current.isStopped = true; }
                return n;
            });
        }
    };

    const forceNextQuestion = (state) => {
        setFeedback(null);
        setUserInput("");
        pendingResultRef.current = null;
        const available = state.questionStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        if (available.length > 0) {
            if (state.questionStates[state.currentQIndex] === 2) { bridgeProxy.current('SET_BOSS', true); }
            else {
                const others = available.filter(idx => idx !== state.currentQIndex);
                if (others.length > 0) {
                    const nextIdx = others[Math.floor(Math.random() * others.length)];
                    setCurrentQIndex(nextIdx);
                    bridgeProxy.current('SET_BOSS', false);
                }
            }
        } else {
            triggerWinSequence(state);
        }
    };

    const triggerWinSequence = (state) => {
        setShowStageClear(true);
        triggerGlobalEvent("VICTOIRE");
        setTimeout(() => {
            setShowStageClear(false);
            if (state.allLevels && state.allLevels[state.currentLevelIdx + 1]) {
                setCurrentLevelIdx(p => p + 1); setEngineStarted(false); setShowLevelIntro(true);
            } else { setShowGameComplete(true); }
        }, 3000);
    };

    // --- 3. CHARGEMENT SÉCURISÉ ---
    useEffect(() => { 
        if (!gameData) return;
        projectRef.current = gameData; 
        const scene = gameData.scenes?.[0];
        if (scene) {
            const imgs = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean).sort().join('|');
            if (imgs !== assetsSignature) setAssetsSignature(imgs);
        }
    }, [gameData]);

    useEffect(() => {
        const initLevel = async () => {
            let levelsData = gameData?.levels || [];
            // Si données vides (mode test), on charge le mock
            if (isStudioTest || levelsData.length === 0) {
                try {
                    const res = await api.get('/games/test-data');
                    levelsData = res?.levels?.length > 0 ? res.levels : [];
                } catch(e) {}
            }
            
            // Fallback ultime pour éviter l'écran noir sans questions
            if (levelsData.length === 0) {
                levelsData = [{ name: "Test", questions: [{q: "Question Test ?", options:["A","B"], a:0}] }];
            }

            setAllLevels(levelsData);
            if (levelsData[currentLevelIdx]) {
                const qs = levelsData[currentLevelIdx].questions || [];
                setLevelQuestions(qs);
                setQuestionStates(new Array(qs.length).fill(0));
                setCurrentQIndex(0);
                setShowLevelIntro(true);
            }
        };
        initLevel();
    }, [gameData, currentLevelIdx]);

    useEffect(() => {
        if (!assetsSignature) { setIsReady(true); return; }
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        setIsReady(false);
        const scene = projectRef.current?.scenes?.[0];
        if (!scene) { setIsReady(true); return; }
        const imgs = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
        let loadedImgs = 0;
        const checkDone = () => { loadedImgs++; setLoadProgress(`${Math.round(loadedImgs/imgs.length*100)}%`); if (loadedImgs >= imgs.length) setIsReady(true); };
        if (imgs.length === 0) setIsReady(true);
        else {
            imgs.forEach(url => {
                const rKey = resolveUrl(url);
                const img = new Image(); 
                img.crossOrigin = "anonymous"; 
                img.onload = () => { imageAssetsRef.current.set(rKey, img); checkDone(); }; 
                img.onerror = () => { checkDone(); }; 
                img.src = rKey;
            });
        }
    }, [assetsSignature]);

    const startCurrentLevel = async () => { 
        setEngineStarted(true); setShowLevelIntro(false); setShowLevelBanner(true); 
        if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
        triggerGlobalEvent("DEPART");
        setTimeout(() => setShowLevelBanner(false), 1500); 
    };

    const handleAnswerClick = (val) => {
        if (feedback || showLevelIntro) return;
        const currentQ = levelQuestions[currentQIndex];
        const isCorrect = (typeof val === 'number') ? currentQ.a === val : val === currentQ.options[currentQ.a];
        pendingResultRef.current = isCorrect;
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);
    };

    // --- 4. MOTEUR RENDU ---
    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;
        try {
            const MiniGameBase = createGameBase({ 
                audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, projectRef, sceneIdx: 0, imageAssets: imageAssetsRef.current, resolveUrl, canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'), 
                playParallelSound: playParallelSoundImpl, 
                bridge: { trigger: (t, v) => bridgeProxy.current(t, v) }
            });

            const scriptToRun = projectRef.current.generatedCode || "";
            // Protection script vide
            const safeCode = scriptToRun.length > 20 ? scriptToRun : `class MiniGame extends MiniGameBase { update(){} }`;

            const factory = new Function('MiniGameBase', `${safeCode}\nreturn MiniGame;`);
            const instance = new (factory(MiniGameBase))(canvasRef.current, {}, null);
            gameInstanceRef.current = instance; 
            if (instance.start) instance.start();
            const tick = () => {
                if (instance && !instance.isStopped) {
                    if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                    instance.isBossPhase = bossModeRef.current;
                    if (instance.update) instance.update(); 
                    if (instance._render) instance._render(); 
                    if (instance.draw) instance.draw();
                }
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) { console.error("🔥 CRASH MOTEUR:", e); }
        return () => { if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted]);

    // Cheats
    useEffect(() => {
        const hDown = (e) => keysPressed.current[e.code] = true;
        const hUp = (e) => keysPressed.current[e.code] = false;
        window.addEventListener('keydown', hDown); window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, []);
    const isCheat = () => keysPressed.current['KeyS'];
    const cheatLife = () => isCheat() && bridgeProxy.current('DAMAGE');
    const cheatWin = () => isCheat() && bridgeProxy.current('VICTORY');
    const cheatBar = (idx) => isCheat() && setQuestionStates(p => { const n=[...p]; n[idx]=3; return n; });

    const currentLevelData = allLevels[currentLevelIdx] || {};
    const safeQ = levelQuestions[currentQIndex];

    return (
        <div className={`fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans ${isShake ? 'animate-shake' : ''}`}>
            <div className="absolute top-2 left-4 px-3 py-1 bg-black/50 text-[10px] font-black text-yellow-500 rounded-full border border-yellow-500/30 z-[5000]">MOTEUR V7.0 (HYBRID SAFE)</div>
            <button onClick={onExit} className="absolute top-6 right-6 w-14 h-14 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-2xl font-black z-[4000] border-2 border-white/20">✕</button>

            {showLevelBanner && <div className="fixed top-[20%] z-[5000] animate-in zoom-in"><span className="text-yellow-400 font-black text-6xl uppercase drop-shadow-lg">Niveau {currentLevelIdx + 1}</span></div>}
            {showStageClear && <div className="fixed top-[40%] z-[5000] animate-in zoom-in"><span className="text-green-500 font-black text-8xl uppercase drop-shadow-lg">STAGE CLEAR !</span></div>}
            
            {showLevelIntro && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-[6000] animate-in zoom-in p-8 text-center">
                    <h1 className="text-5xl text-white font-black mb-6 uppercase tracking-tighter">{currentLevelData.name || `Niveau ${currentLevelIdx+1}`}</h1>
                    <button onClick={startCurrentLevel} disabled={!isReady} className={`px-16 py-6 rounded-full font-black text-3xl shadow-2xl border-4 transition-all ${isReady ? 'bg-white text-indigo-900 border-indigo-500 hover:scale-110' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>{isReady ? "JOUER 🚀" : `CHARGEMENT ${loadProgress}...`}</button>
                </div>
            )}

            {/* GAMEPLAY */}
            {engineStarted && !showLevelIntro && (
                <>
                    <div className="absolute top-6 w-full flex justify-between px-10 pointer-events-none z-30">
                        <div onClick={cheatLife} className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-lg pointer-events-auto cursor-pointer">{"❤️".repeat(lives)}</div>
                        
                        {safeQ && (
                            <div onClick={cheatWin} className="flex-1 mx-10 pointer-events-auto cursor-pointer">
                                <div className={`bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 shadow-2xl text-xl text-center border-slate-600 ${activeBossVisual ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}>
                                    {feedback === 'CORRECT' ? "✅ BIEN JOUÉ !" : feedback === 'WRONG' ? "❌ MAUVAISE RÉPONSE" : safeQ.q}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pointer-events-auto">
                            {questionStates.map((s, i) => (
                                <div key={i} onClick={() => cheatBar(i)} className={`w-6 h-16 rounded-lg border-2 ${currentQIndex === i ? 'border-white scale-110 shadow-lg' : 'border-slate-600 opacity-60'} bg-slate-800 overflow-hidden relative transition-all cursor-pointer`}>
                                    <div className={`absolute bottom-0 w-full transition-all duration-500 ${s >= 3 ? 'bg-green-500' : s >= 2 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{height: `${(s/3)*100}%`}}></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 ${activeBossVisual ? 'border-red-600 shadow-[0_0_50px_red]' : 'border-slate-800'} rounded-lg`} />
                    {safeQ && !showStageClear && !showGameComplete && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                                {safeQ.options.map((o, i) => (
                                    <button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2 hover:bg-indigo-500 transition-colors shadow-lg">{o}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {showGameComplete && ( <div className="absolute inset-0 z-[7000] bg-gradient-to-br from-yellow-500 to-purple-600 flex flex-col items-center justify-center animate-in zoom-in"> <h1 className="text-9xl mb-4">🏆</h1> <h1 className="text-8xl font-black text-white drop-shadow-lg uppercase tracking-tighter">VICTOIRE !</h1> <button onClick={onExit} className="mt-10 px-12 py-5 bg-white text-purple-700 font-black text-2xl rounded-2xl shadow-2xl hover:scale-105 transition-transform uppercase">RETOURNER AU MENU</button> </div> )}
            {showGameOver && ( <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[8000] animate-in zoom-in"> <h1 className="text-8xl font-black text-red-600 mb-8 uppercase tracking-widest glitch-text">GAME OVER</h1> <button onClick={() => { setShowGameOver(false); setLives(4); setEngineStarted(false); setShowLevelIntro(true); }} className="bg-white text-black px-8 py-4 rounded-full font-black text-xl hover:bg-red-500 hover:text-white transition-colors uppercase">RÉESSAYER</button> </div> )}
        </div>
    );
}
