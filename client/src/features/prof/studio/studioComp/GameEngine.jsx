// @signatures: GameEngine, initLevel, handleAnswerClick, triggerWinSequence, handleBarCheat
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';
import { api } from '../../../../services/api';
// IMPORT DU NOUVEAU MOTEUR (Copié de ta string)
import { createGameBase } from '../../../../services/gameCore';

export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState("");
    const [debugLogs, setDebugLogs] = useState([]);
    
    // --- ÉTATS DU QUIZ ---
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(-1);
    const [lives, setLives] = useState(4);
    const [feedback, setFeedback] = useState(null);

    // --- ÉTATS VISUELS ---
    const [isLevelWon, setIsLevelWon] = useState(false);
    const isLevelWonRef = useRef(false);
    const [isPowerOff, setIsPowerOff] = useState(false);
    
    // --- MODE BOSS (Propriété du moteur V10) ---
    const bossModeRef = useRef(false);

    // Références persistantes
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const keysPressed = useRef({});
    
    // 🔥 REF PROJET INDISPENSABLE POUR LE MOTEUR V8
    const projectRef = useRef(project);
    useEffect(() => { projectRef.current = project; }, [project]);

    // Mute Ref
    const isMutedRef = useRef(false);

    const logSonde = (msg, type = 'info') => {
        const id = Math.random();
        setDebugLogs(prev => [...prev, { id, text: msg, type }].slice(-6));
    };

    const playParallelSound = (url) => {
        if (isMutedRef.current || !audioCtxRef.current) return;
        const buffer = audioBuffersRef.current.get(url);
        if (buffer) {
            if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
            const source = audioCtxRef.current.createBufferSource();
            source.buffer = buffer; source.connect(audioCtxRef.current.destination); source.start(0);
        }
    };

    // 1. INIT DONNÉES QUIZ
    useEffect(() => {
        api.get('/games/test-data').then(data => {
            const levelsData = data?.levels?.length > 0 ? data.levels : [{ 
                name: "Test Default", 
                questions: [
                    { q: "Quelle est la capitale de la France ?", options: ["Lyon", "Paris", "Marseille", "Lille"], a: 1 },
                    { q: "Combien font 2 + 2 ?", options: ["3", "4", "5", "22"], a: 1 }
                ] 
            }];
            setAllLevels(levelsData);
            initLevel(0, levelsData);
        });

        const handleKeyDown = (e) => { keysPressed.current[e.code] = true; };
        const handleKeyUp = (e) => { keysPressed.current[e.code] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    const initLevel = (idx, sourceData) => {
        if (!sourceData[idx]) return;
        const lvl = sourceData[idx];
        setCurrentLevelIdx(idx);
        const questions = lvl.questions || [];
        setLevelQuestions(questions);
        setQuestionStates(new Array(questions.length).fill(0));
        setIsLevelWon(false);
        isLevelWonRef.current = false;
        setIsPowerOff(false);
        if (questions.length > 0) setCurrentQIndex(0);
    };

    // LOGIQUE BOSS
    useEffect(() => {
        const isBoss = (currentQIndex !== -1 && (questionStates[currentQIndex] || 0) >= 2);
        bossModeRef.current = isBoss;
        if (gameInstanceRef.current) gameInstanceRef.current.isBossPhase = isBoss;
    }, [currentQIndex, questionStates]);

    // 2. PRÉ-CHARGEMENT
    useEffect(() => {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        const scene = project.scenes?.[activeSceneIdx];
        if (!scene) { setIsReady(true); return; }

        const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
        let loaded = 0;
        const total = imgUrls.length;

        if (total === 0) setIsReady(true);

        imgUrls.forEach(url => {
            const img = new Image(); img.crossOrigin = "anonymous";
            img.onload = () => {
                imageAssetsRef.current.set(resolveUrl(url), img);
                loaded++;
                setLoadProgress(`${Math.round(loaded/total*100)}%`);
                if (loaded >= total) setIsReady(true);
            };
            img.onerror = () => {
                console.error("Img error:", url);
                loaded++;
                if (loaded >= total) setIsReady(true);
            };
            img.src = resolveUrl(url);
        });

        const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
        sndUrls.forEach(url => {
            SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                if (buf) audioBuffersRef.current.set(url, buf);
            });
        });

        return () => {
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
            // Pas de stop sur l'instance ici pour éviter les clignotements
        };
    }, [project]);

    // 3. LOGIQUE JEU
    const handleAnswerClick = (choiceIdx) => {
        if (feedback || currentQIndex === -1 || isLevelWonRef.current) return;
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
            setLives(l => Math.max(0, l - 1));
        }
        setQuestionStates(newStates);

        setTimeout(() => {
            setFeedback(null);
            const available = newStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
            if (available.length > 0) {
                // On change de question si possible
                const others = available.filter(idx => idx !== currentQIndex);
                const nIdx = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : available[0];
                setCurrentQIndex(nIdx);
            } else {
                triggerWinSequence();
            }
        }, 1000);
    };

    const triggerWinSequence = () => {
        setIsLevelWon(true);
        isLevelWonRef.current = true;
        if (gameInstanceRef.current?.onLevelWin) gameInstanceRef.current.onLevelWin();
        setTimeout(() => setIsPowerOff(true), 1500);
        setTimeout(() => {
            const nextLvlIdx = currentLevelIdx + 1;
            if (allLevels[nextLvlIdx]) initLevel(nextLvlIdx, allLevels);
            else { alert("🎉 JEU TERMINÉ !"); onStop(); }
        }, 4000);
    };

    // 4. DÉMARRAGE
    const handleStartGame = async () => {
        if (audioCtxRef.current) {
            try { await audioCtxRef.current.resume(); } catch (e) {}
        }
        setEngineStarted(true);
    };

    // 5. ENGINE LOOP (LE COEUR DU SYSTÈME)
    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;

        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            // --- CALLBACKS ---
            const gameCallbacks = {
                onPlayerHit: () => {
                    logSonde("💥 AIE ! Coup reçu !", "error");
                    if (!isLevelWonRef.current) setLives(l => Math.max(0, l - 1));
                },
                onLevelWin: () => console.log("Win trigger internal"),
                playSound: (name) => console.log("Sound req", name)
            };

            // 🚀 CRÉATION DE LA CLASSE DE BASE VIA LE SERVICE (VRAIE IMPORTATION)
            const MiniGameBase = createGameBase({ 
                audioBuffers: audioBuffersRef.current, 
                audioCtx: audioCtxRef.current, 
                projectRef, // ✅ PASSAGE DE LA REF
                sceneIdx: activeSceneIdx, 
                imageAssets: imageAssetsRef.current, 
                resolveUrl, 
                canvas, 
                ctx, 
                isMutedRef, 
                playParallelSound,
                callbacks: gameCallbacks
            });

            // Injection du code utilisateur (ZOMBIE V9.8)
            const UserCodeFactory = new Function('MiniGameBase', `${code}\nreturn MiniGame;`);
            const UserGameClass = UserCodeFactory(MiniGameBase);
            
            // Instanciation
            const instance = new UserGameClass(canvas, {}, gameCallbacks);
            gameInstanceRef.current = instance;

            if (instance.start) instance.start();
            
            const tick = () => {
                if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                instance.isBossPhase = bossModeRef.current;
                
                if (instance.update) instance.update();
                // LE RENDU EST GÉRÉ PAR LA CLASSE PARENTE (Importée)
                if (instance._render) instance._render();
                // LE HUD EST GÉRÉ PAR L'UTILISATEUR
                if (instance.draw) instance.draw();
                
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();

        } catch (e) {
            logSonde("CRASH: " + e.message, "error");
            console.error(e);
        }
        return () => { if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted]);

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
             <button onClick={onStop} className="absolute top-6 right-6 bg-red-600 text-white w-12 h-12 rounded-full font-black text-2xl shadow-xl border-4 border-white hover:scale-110 transition-all flex items-center justify-center pointer-events-auto z-50">✕</button>

             <div className="absolute top-20 left-4 flex flex-col gap-1 pointer-events-none z-40">
                {debugLogs.map(log => (
                    <div key={log.id} className={`px-3 py-1 rounded text-[9px] font-black shadow-lg border-l-4 ${log.type === 'error' ? 'bg-red-500 text-white' : log.type === 'success' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>
                        {log.text}
                    </div>
                ))}
             </div>

             {!engineStarted ? (
                 <button 
                    onClick={handleStartGame} 
                    disabled={!isReady}
                    className={`px-20 py-10 rounded-full font-black text-5xl shadow-2xl border-8 transition-all ${isReady ? 'bg-white text-indigo-600 border-indigo-200 hover:scale-110 animate-pulse' : 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed'}`}
                 >
                    {isReady ? "🚀 JOUER" : `CHARGEMENT ${loadProgress}...`}
                 </button>
             ) : (
                <>
                    <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl pointer-events-auto flex gap-1">
                            {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                        </div>
                        <div className="flex-1 flex justify-center px-4">
                            {levelQuestions[currentQIndex] && !isLevelWon && (
                                <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto animate-in slide-in-from-top">
                                    {feedback === 'CORRECT' ? "✅ BRAVO !" : feedback === 'WRONG' ? "❌ RATÉ..." : levelQuestions[currentQIndex].q}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 items-center pointer-events-auto mr-20">
                            {questionStates.map((mastery, idx) => (
                                <div key={idx} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden transition-all ${currentQIndex === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-60'}`}>
                                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in">
                        <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 border-slate-800 rounded-xl transition-opacity duration-1000 ${isPowerOff ? 'opacity-0' : 'opacity-100'}`} />
                        {isLevelWon && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-xl animate-in zoom-in z-40">
                                <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center border-8 border-green-500">
                                    <span className="text-6xl block mb-4">🏆</span>
                                    <h2 className="text-4xl font-black text-slate-800 uppercase">Niveau Réussi !</h2>
                                </div>
                            </div>
                        )}
                    </div>

                    {!isLevelWon && !isPowerOff && levelQuestions[currentQIndex] && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                                {levelQuestions[currentQIndex].options.map((o, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => handleAnswerClick(i)} 
                                        className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-indigo-500 hover:scale-105 transition-all border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2"
                                    >
                                        {o}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
             )}
        </div>
    );
}
