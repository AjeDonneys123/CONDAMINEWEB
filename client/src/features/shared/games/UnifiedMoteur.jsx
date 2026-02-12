// @signatures: UnifiedMoteur, handleAnswerClick, triggerWinSequence, startCurrentLevel, getEmbedUrl, playParallelSoundImpl, normalize, getYoutubeEmbed
import React, { useState, useRef, useEffect, useCallback } from 'react';
import SoundExpert from '../../../services/SoundExpert';
import { api } from '../../../services/api';
import { createGameBase } from '../../../services/gameCore';

/**
 * 🧠 UNIFIED MOTEUR V4.8 (REF PROXY STABLE)
 * CORRECTIF CRITIQUE : Utilisation de refs pour le Bridge afin d'éviter les "Stale Closures".
 * Le moteur ne redémarre plus inutilement et a toujours accès aux états à jour (Index question, Vies...).
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
    
    // --- REFS TECHNIQUES ---
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

    // 🚀 REF PROXY : Permet d'accéder à l'état frais dans les callbacks du moteur
    const stateRef = useRef({
        currentQIndex,
        questionStates,
        lives,
        allLevels,
        currentLevelIdx
    });

    // Maintient la ref à jour à chaque rendu
    useEffect(() => {
        stateRef.current = { currentQIndex, questionStates, lives, allLevels, currentLevelIdx };
    }, [currentQIndex, questionStates, lives, allLevels, currentLevelIdx]);

    // --- 1. BRIDGE VIA REF (STABILITÉ MAXIMALE) ---
    // Cette fonction ne change JAMAIS, mais elle accède aux données fraîches via stateRef
    const bridgeProxy = useRef((type, value) => {
        const state = stateRef.current;
        
        switch(type) {
            case 'DAMAGE':
                setIsShake(true); setTimeout(() => setIsShake(false), 500);
                setLives(l => {
                    const n = Math.max(0, l - (value || 1));
                    if (n === 0) {
                        setShowGameOver(true);
                        if (gameInstanceRef.current) gameInstanceRef.current.isStopped = true;
                    }
                    return n;
                });
                break;

            case 'HEAL': 
                setLives(l => Math.min(4, l + (value || 1))); 
                break;

            case 'WIN_ROUND': 
                // Logique Victoire Round avec accès à l'état frais
                handleRoundValidation(true, state); 
                break;

            case 'FAIL_ROUND': 
                handleRoundValidation(false, state); 
                break;

            case 'SET_BOSS': 
                setActiveBossVisual(!!value); 
                bossModeRef.current = !!value;
                if(gameInstanceRef.current) gameInstanceRef.current.isBossPhase = !!value;
                break;

            case 'SHAKE': 
                setIsShake(true); setTimeout(() => setIsShake(false), 500); 
                break;

            case 'AUDIO': 
                /* triggerGlobalEvent(value) */ 
                break;

            case 'VICTORY': 
                triggerWinSequence(state); 
                break;

            case 'GAME_OVER': 
                setShowGameOver(true); 
                break;
            
            case 'NEXT_Q':
                forceNextQuestion(state);
                break;
        }
    });

    // --- 2. LOGIQUE METIER ---

    // Validation Round (Sortie du switch pour lisibilité)
    const handleRoundValidation = (success, state) => {
        const isCorrect = pendingResultRef.current !== null ? pendingResultRef.current : success;
        
        setQuestionStates(prev => {
            const next = [...prev];
            const idx = state.currentQIndex; // Utilisation de l'index frais
            
            if (isCorrect) next[idx] = Math.min(3, next[idx] + 1);
            else next[idx] = Math.max(0, next[idx] - 1);
            
            // Si défaite, on gère les vies ici aussi par sécurité (redondant avec DAMAGE mais sûr)
            if (!isCorrect) {
                setLives(l => {
                    const n = Math.max(0, l - 1);
                    if(n===0) { setShowGameOver(true); if(gameInstanceRef.current) gameInstanceRef.current.isStopped = true; }
                    return n;
                });
            }

            // Préparation suite
            setTimeout(() => {
                setFeedback(null); setUserInput(""); pendingResultRef.current = null;
                pickNextQuestion(next, state.currentQIndex);
            }, 500);

            return next;
        });
    };

    const pickNextQuestion = (nextStates, currentIdx) => {
        const available = nextStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        
        if (available.length > 0) {
            // Règle Boss : Si 2/3, on reste dessus
            if (nextStates[currentIdx] === 2) {
                bridgeProxy.current('SET_BOSS', true);
            } else {
                const others = available.filter(idx => idx !== currentIdx);
                if (others.length > 0) {
                    setCurrentQIndex(others[Math.floor(Math.random() * others.length)]);
                    bridgeProxy.current('SET_BOSS', false);
                }
            }
        } else {
            // Niveau fini
            triggerWinSequence(stateRef.current);
        }
    };

    const forceNextQuestion = (state) => {
        pickNextQuestion(state.questionStates, state.currentQIndex);
    };

    const triggerWinSequence = (state) => {
        setShowStageClear(true);
        setTimeout(() => {
            setShowStageClear(false);
            // Vérif niveau suivant
            if (state.allLevels[state.currentLevelIdx + 1]) {
                setCurrentLevelIdx(p => p + 1);
                setEngineStarted(false);
                setShowLevelIntro(true);
            } else {
                setShowGameComplete(true);
            }
        }, 3000);
    };

    // --- 3. CHARGEMENT ET SYNC ---

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
            if (isStudioTest || levelsData.length === 0) {
                try {
                    const res = await api.get('/games/test-data');
                    levelsData = res?.levels?.length > 0 ? res.levels : [];
                } catch(e) {}
            }
            setAllLevels(levelsData);
            if (levelsData[currentLevelIdx]) {
                const qs = levelsData[currentLevelIdx].questions || [];
                setLevelQuestions(qs);
                setQuestionStates(new Array(qs.length).fill(0));
                setCurrentQIndex(0);
                setShowLevelIntro(true); // Intro visible au changement de niveau
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
        if (imgs.length === 0) setIsReady(true);
        else {
            imgs.forEach(url => {
                const rKey = resolveUrl(url);
                const img = new Image(); 
                img.crossOrigin = "anonymous"; 
                img.onload = () => { imageAssetsRef.current.set(rKey, img); loadedImgs++; setLoadProgress(`${Math.round(loadedImgs/imgs.length*100)}%`); if (loadedImgs >= imgs.length) setIsReady(true); }; 
                img.onerror = () => { loadedImgs++; if (loadedImgs >= imgs.length) setIsReady(true); }; 
                img.src = rKey;
            });
        }
    }, [assetsSignature]);

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    const startCurrentLevel = async () => { 
        setEngineStarted(true); 
        setShowLevelIntro(false); 
        setShowLevelBanner(true); 
        if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
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

    // --- 4. MOTEUR RENDU (STABLE) ---
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
                playParallelSound: () => {}, 
                
                // 🚀 PASSAGE DU PROXY AU LIEU DE LA FONCTION DIRECTE
                // Cela garantit que le moteur appelle toujours la version la plus fraîche via la ref
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
    }, [engineStarted]); // Plus aucune dépendance instable ici !

    // --- HELPERS UI ---
    const getYoutubeEmbed = (url) => {
        if (!url) return "";
        const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        return (m && m[2].length === 11) ? `https://www.youtube.com/embed/${m[2]}` : url;
    };

    // Cheats
    useEffect(() => {
        const hDown = (e) => keysPressed.current[e.code] = true;
        const hUp = (e) => keysPressed.current[e.code] = false;
        window.addEventListener('keydown', hDown); window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, []);

    const isCheat = () => keysPressed.current['KeyS'];
    const cheatWin = () => isCheat() && bridgeProxy.current('VICTORY');
    const cheatLife = () => isCheat() && bridgeProxy.current('DAMAGE');
    const cheatBar = (idx) => isCheat() && setQuestionStates(p => { const n=[...p]; n[idx]=3; return n; });

    const currentLevelData = allLevels[currentLevelIdx] || {};
    const safeQ = levelQuestions[currentQIndex];

    return (
        <div className={`fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans ${isShake ? 'animate-shake' : ''}`}>
            {/* DEBUGGER */}
            <div className="absolute top-2 left-4 px-3 py-1 bg-black/50 text-[10px] font-black text-yellow-500 rounded-full border border-yellow-500/30 z-[5000]">MOTEUR V4.8 (REF PROXY)</div>
            <button onClick={onExit} className="absolute top-6 right-6 w-14 h-14 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-2xl font-black z-[4000] border-2 border-white/20">✕</button>

            {/* OVERLAYS JEU */}
            {showLevelBanner && <div className="fixed top-[20%] z-[5000] animate-in zoom-in"><span className="text-yellow-400 font-black text-6xl uppercase drop-shadow-lg">Niveau {currentLevelIdx + 1}</span></div>}
            {showStageClear && <div className="fixed top-[40%] z-[5000] animate-in zoom-in"><span className="text-green-500 font-black text-8xl uppercase drop-shadow-lg">STAGE CLEAR !</span></div>}
            
            {/* ECRAN INTRO (FICHE/VIDEO) RESTAURÉ */}
            {showLevelIntro && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-[6000] animate-in zoom-in p-8 text-center">
                    <h1 className="text-5xl text-white font-black mb-6 uppercase tracking-tighter">{currentLevelData.name || `Niveau ${currentLevelIdx+1}`}</h1>
                    <div className="flex gap-10 mb-12 w-full max-w-4xl justify-center h-[280px]">
                        <div onClick={() => currentLevelData.intro?.sheetUrl && setZoomMedia('sheet')} className="h-full aspect-[3/4] bg-slate-800 rounded-3xl border-4 border-slate-700 overflow-hidden flex items-center justify-center shadow-2xl cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all relative group">
                            {currentLevelData.intro?.sheetUrl ? <img src={resolveUrl(currentLevelData.intro.sheetUrl)} className="w-full h-full object-contain" /> : <span className="text-slate-500 font-bold">PAS DE FICHE</span>}
                        </div>
                        <div onClick={() => currentLevelData.intro?.videoUrl && setZoomMedia('video')} className="h-full aspect-video bg-black rounded-3xl border-4 border-slate-700 overflow-hidden shadow-2xl flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all relative group">
                            {currentLevelData.intro?.videoUrl ? <span className="text-6xl">▶️</span> : <span className="text-slate-500 font-bold">PAS DE VIDÉO</span>}
                        </div>
                    </div>
                    <button onClick={startCurrentLevel} disabled={!isReady} className={`px-16 py-6 rounded-full font-black text-3xl shadow-2xl border-4 transition-all ${isReady ? 'bg-white text-indigo-900 border-indigo-500 hover:scale-110' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>{isReady ? "JOUER 🚀" : `CHARGEMENT ${loadProgress}...`}</button>
                </div>
            )}

            {/* ZOOM MEDIA */}
            {zoomMedia && (
                <div className="fixed inset-0 z-[7000] bg-black flex items-center justify-center p-0 animate-in fade-in" onClick={() => setZoomMedia(null)}>
                    <button className="absolute top-8 right-8 w-16 h-16 bg-white hover:bg-red-600 hover:text-white text-black rounded-full flex items-center justify-center text-3xl font-black shadow-2xl z-[7001]">✕</button>
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {zoomMedia === 'sheet' ? <img src={resolveUrl(currentLevelData.intro?.sheetUrl)} className="h-[90vh] object-contain" /> : <div className="h-[90vh] aspect-video"><iframe className="w-full h-full" src={getYoutubeEmbed(currentLevelData.intro?.videoUrl)} frameBorder="0" allowFullScreen></iframe></div>}
                    </div>
                </div>
            )}

            {/* GAMEPLAY */}
            {engineStarted && !showLevelIntro && (
                <>
                    <div className="absolute top-6 w-full flex justify-between px-10 pointer-events-none z-30">
                        <div onClick={cheatLife} className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-lg pointer-events-auto cursor-pointer">{"❤️".repeat(lives)}</div>
                        
                        {/* 🚀 BOITE QUESTION CENTRALE */}
                        {safeQ && (
                            <div onClick={cheatWin} className="flex-1 mx-10 pointer-events-auto cursor-pointer">
                                <div className={`bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 shadow-2xl text-xl text-center border-slate-600 ${activeBossVisual ? 'border-red-500 ring-2 ring-red-500/50' : ''}`}>
                                    {feedback === 'CORRECT' ? "✅ BIEN JOUÉ !" : feedback === 'WRONG' ? "❌ MAUVAISE RÉPONSE" : safeQ.q}
                                    {activeBossVisual && !feedback && <div className="text-[10px] text-red-500 mt-1 animate-pulse uppercase tracking-widest">⚠️ Boss Final : Saisis la réponse !</div>}
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
                    
                    {/* BOUTONS RÉPONSES */}
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

            {/* FIN */}
            {showGameComplete && (
                <div className="absolute inset-0 z-[7000] bg-gradient-to-br from-yellow-500 to-purple-600 flex flex-col items-center justify-center animate-in zoom-in">
                    <h1 className="text-9xl mb-4">🏆</h1>
                    <h1 className="text-8xl font-black text-white drop-shadow-lg uppercase tracking-tighter">VICTOIRE !</h1>
                    <button onClick={onExit} className="mt-10 px-12 py-5 bg-white text-purple-700 font-black text-2xl rounded-2xl shadow-2xl hover:scale-105 transition-transform uppercase">RETOURNER AU MENU</button>
                </div>
            )}

            {showGameOver && (
                <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[8000] animate-in zoom-in">
                    <h1 className="text-8xl font-black text-red-600 mb-8 uppercase tracking-widest glitch-text">GAME OVER</h1>
                    <button onClick={() => { setShowGameOver(false); setLives(4); setEngineStarted(false); setShowLevelIntro(true); }} className="bg-white text-black px-8 py-4 rounded-full font-black text-xl hover:bg-red-500 hover:text-white transition-colors uppercase">RÉESSAYER</button>
                </div>
            )}
        </div>
    );
}
