// @signatures: UnifiedMoteur, handleBridgeEvent, handleAnswerClick, handleRoundEnd, triggerWinSequence, startCurrentLevel
import React, { useState, useRef, useEffect, useCallback } from 'react';
import SoundExpert from '../../../services/SoundExpert';
import { api } from '../../../services/api';
import { createGameBase } from '../../../services/gameCore';

/**
 * 🧠 UNIFIED MOTEUR V4.5 (BRIDGE READY)
 * - Base stable (Pas d'écran noir)
 * - Ascenseur JS <-> JSX installé (Bridge)
 */
export default function UnifiedMoteur({ gameData, onExit, isStudioTest = false }) {
    // --- ÉTATS ---
    const [lives, setLives] = useState(4);
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [allLevels, setAllLevels] = useState([]);
    const [levelQuestions, setLevelQuestions] = useState([]);
    
    // --- UI STATES ---
    const [showLevelIntro, setShowLevelIntro] = useState(true);
    const [showLevelBanner, setShowLevelBanner] = useState(false);
    const [showStageClear, setShowStageClear] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [showGameComplete, setShowGameComplete] = useState(false);
    const [zoomMedia, setZoomMedia] = useState(null);
    const [isPowerOff, setIsPowerOff] = useState(false);
    const [activeBossVisual, setActiveBossVisual] = useState(false);
    const [isShake, setIsShake] = useState(false); // Effet secousse
    
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
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);

    // --- 1. L'ASCENSEUR (BRIDGE) ---
    // C'est ici que React reçoit les ordres du code JS
    const handleBridgeEvent = useCallback((type, value) => {
        // console.log("🛗 ASCENSEUR REÇU :", type, value);
        switch(type) {
            case 'DAMAGE':
                setIsShake(true); setTimeout(() => setIsShake(false), 500);
                setLives(l => {
                    const n = Math.max(0, l - (value || 1));
                    if (n === 0) {
                        setShowGameOver(true);
                        triggerGlobalEvent("DEFAITE");
                        if (gameInstanceRef.current) gameInstanceRef.current.isStopped = true;
                    }
                    return n;
                });
                break;
            case 'HEAL': setLives(l => Math.min(4, l + (value || 1))); break;
            case 'WIN_ROUND': handleRoundEnd(true); break; // Appelle ta logique existante
            case 'FAIL_ROUND': handleRoundEnd(false); break; // Appelle ta logique existante
            case 'SET_BOSS': 
                setActiveBossVisual(!!value); 
                bossModeRef.current = !!value;
                if(gameInstanceRef.current) gameInstanceRef.current.isBossPhase = !!value;
                break;
            case 'SHAKE': setIsShake(true); setTimeout(() => setIsShake(false), 500); break;
            case 'AUDIO': triggerGlobalEvent(value); break;
        }
    }, []);

    // --- 2. LOGIQUE EXISTANTE (STABILISÉE) ---

    // Sync Data
    useEffect(() => { 
        if (!gameData) return;
        projectRef.current = gameData; 
        const scene = gameData.scenes?.[0];
        if (scene) {
            const imgs = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean).sort().join('|');
            const snds = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean).sort().join('|');
            const sig = `${imgs}__${snds}`;
            if (sig !== assetsSignature) setAssetsSignature(sig);
        }
    }, [gameData]);

    // Data Loading
    useEffect(() => {
        const loadLogic = async () => {
            let levelsData = gameData?.levels || [];
            if (isStudioTest || levelsData.length === 0) {
                const res = await api.get('/games/test-data');
                levelsData = res?.levels?.length > 0 ? res.levels : [];
            }
            setAllLevels(levelsData);
            if (levelsData[currentLevelIdx]) {
                const qs = levelsData[currentLevelIdx].questions || [];
                setLevelQuestions(qs);
                setQuestionStates(new Array(qs.length).fill(0));
                setCurrentQIndex(0);
            }
        };
        loadLogic();
        
        const hDown = (e) => { keysPressed.current[e.code] = true; };
        const hUp = (e) => { keysPressed.current[e.code] = false; };
        window.addEventListener('keydown', hDown);
        window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, [gameData, currentLevelIdx]);

    // Assets Loading
    useEffect(() => {
        if (!assetsSignature) return;
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
                if (imageAssetsRef.current.has(rKey)) checkDone();
                else { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { imageAssetsRef.current.set(rKey, img); checkDone(); }; img.onerror = () => { checkDone(); }; img.src = rKey; }
            });
        }
        // Audio loading... (simplifié pour le snippet)
        setIsReady(true); 
    }, [assetsSignature]);

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    const triggerGlobalEvent = (eventName) => { /* ... Logique son ... */ };
    const playParallelSoundImpl = (url) => { /* ... Logique son ... */ };

    // --- LOGIQUE JEU ---
    const handleRoundEnd = useCallback((success) => {
        const isCorrect = pendingResultRef.current !== null ? pendingResultRef.current : success;
        setQuestionStates(prev => {
            const next = [...prev];
            if (isCorrect) next[currentQIndex] = Math.min(3, next[currentQIndex] + 1);
            else {
                next[currentQIndex] = Math.max(0, next[currentQIndex] - 1);
                setLives(l => {
                    const n = Math.max(0, l - 1);
                    if(n===0) { setShowGameOver(true); triggerGlobalEvent("DEFAITE"); }
                    return n;
                });
            }
            setTimeout(() => {
                setFeedback(null); setUserInput(""); pendingResultRef.current = null;
                // Logique changement question...
                const available = next.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
                if (available.length > 0) {
                    if (isCorrect && next[currentQIndex] === 2) { /* Boss Reste */ }
                    else {
                        const others = available.filter(idx => idx !== currentQIndex);
                        if(others.length > 0) setCurrentQIndex(others[Math.floor(Math.random() * others.length)]);
                    }
                } else {
                    triggerWinSequence();
                }
            }, 500);
            return next;
        });
    }, [currentQIndex]);

    const handleAnswerClick = (val) => {
        if (feedback) return;
        const currentQ = levelQuestions[currentQIndex];
        const isCorrect = (typeof val === 'number') ? currentQ.a === val : val === currentQ.options[currentQ.a];
        pendingResultRef.current = isCorrect;
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);
    };

    const startCurrentLevel = async () => { setEngineStarted(true); setShowLevelIntro(false); setShowLevelBanner(true); setTimeout(() => setShowLevelBanner(false), 1500); };
    const triggerWinSequence = () => { setShowStageClear(true); setTimeout(() => { setShowStageClear(false); if(allLevels[currentLevelIdx+1]) setCurrentLevelIdx(p=>p+1); else setShowGameComplete(true); }, 3000); };

    // --- 3. RENDU DU MOTEUR ---
    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;
        
        try {
            const MiniGameBase = createGameBase({ 
                audioBuffers: audioBuffersRef.current, 
                audioCtx: audioCtxRef.current, 
                projectRef, 
                sceneIdx: 0, 
                imageAssets: imageAssetsRef.current, 
                resolveUrl, 
                canvas: canvasRef.current, 
                ctx: canvasRef.current.getContext('2d'), 
                playParallelSound: playParallelSoundImpl, 
                
                // 🚀 C'EST ICI QU'ON INSTALLE L'ASCENSEUR
                bridge: { trigger: handleBridgeEvent },
                
                callbacks: { onRoundEnd: handleRoundEnd } // On garde l'ancien système en secours
            });

            const scriptToRun = projectRef.current.generatedCode || "";
            const factory = new Function('MiniGameBase', `${scriptToRun}\nreturn MiniGame;`);
            const instance = new (factory(MiniGameBase))(canvasRef.current, {}, null);
            gameInstanceRef.current = instance; 
            if (instance.start) instance.start();
            
            const tick = () => {
                if (!instance.isStopped) {
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
    }, [engineStarted, handleBridgeEvent]); // On redémarre si le bridge change

    // --- RENDER JSX ---
    const safeQ = levelQuestions[currentQIndex];
    return (
        <div className={`fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans ${isShake ? 'animate-shake' : ''}`}>
            <div className="absolute top-2 left-4 px-3 py-1 bg-black/50 text-[10px] font-black text-yellow-500 rounded-full border border-yellow-500/30 z-[5000]">MOTEUR V4.5 (BRIDGE)</div>
            <button onClick={onExit} className="absolute top-6 right-6 w-14 h-14 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-2xl font-black z-[4000] border-2 border-white/20">✕</button>

            {showLevelBanner && <div className="fixed top-[20%] z-[5000] animate-in zoom-in"><span className="text-yellow-400 font-black text-6xl uppercase">Niveau {currentLevelIdx + 1}</span></div>}
            {showStageClear && <div className="fixed top-[40%] z-[5000] animate-in zoom-in"><span className="text-green-500 font-black text-8xl uppercase">STAGE CLEAR !</span></div>}
            
            {showGameComplete && (
                <div className="absolute inset-0 z-[7000] bg-gradient-to-br from-yellow-500 to-purple-600 flex flex-col items-center justify-center animate-in zoom-in">
                    <h1 className="text-8xl font-black text-white">VICTOIRE !</h1>
                    <button onClick={onExit} className="mt-8 px-12 py-5 bg-white text-purple-700 font-black text-2xl rounded-2xl shadow-2xl">MENU</button>
                </div>
            )}

            {engineStarted && !showLevelIntro && (
                <>
                    <div className="absolute top-6 w-full flex justify-between px-10 pointer-events-none z-30">
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl">{"❤️".repeat(lives)}</div>
                        {activeBossVisual && <div className="text-red-500 font-black text-3xl animate-pulse">⚠️ BOSS ⚠️</div>}
                        <div className="flex gap-2">
                            {questionStates.map((s, i) => (
                                <div key={i} className="w-4 h-12 rounded-md border border-slate-600 bg-slate-800 overflow-hidden relative">
                                    <div className={`absolute bottom-0 w-full transition-all duration-300 ${s >= 3 ? 'bg-green-500' : s >= 2 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{height: `${(s/3)*100}%`}}></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 ${activeBossVisual ? 'border-red-600 shadow-red-500' : 'border-slate-800'}`} />
                    
                    {safeQ && !showStageClear && !showGameComplete && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                                {safeQ.options.map((o, i) => (
                                    <button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2">{o}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {showLevelIntro && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-50 animate-in zoom-in">
                    <h1 className="text-5xl text-white font-black mb-6">NIVEAU {currentLevelIdx + 1}</h1>
                    <button onClick={startCurrentLevel} disabled={!isReady} className="px-16 py-6 rounded-full bg-white text-indigo-900 font-black text-3xl shadow-2xl hover:scale-110 transition-transform">
                        {isReady ? "JOUER 🚀" : `CHARGEMENT ${loadProgress}...`}
                    </button>
                </div>
            )}

            {showGameOver && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] animate-in zoom-in">
                    <h1 className="text-6xl font-black text-red-500 mb-4">GAME OVER</h1>
                    <button onClick={() => { setShowGameOver(false); setLives(4); setEngineStarted(false); setShowLevelIntro(true); }} className="bg-white text-black px-6 py-3 rounded-xl font-black">RÉESSAYER</button>
                </div>
            )}
        </div>
    );
}
