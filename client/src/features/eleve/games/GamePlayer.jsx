// @signatures: GamePlayer, handleAnswer, handleBarCheat, handleHeartClick, initGame, triggerLevelIntro
import React, { useState, useEffect, useRef } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

/**
 * 🕹️ MOTEUR UNIFIÉ V150 (SCÈNE + QUIZ + SONS)
 * SOURCE UNIQUE DE VÉRITÉ : Utilisé par le Studio (Prof) et le Player (Élève).
 * Gère les multi-niveaux, l'intro par niveau, et le moteur graphique.
 */
export default function GamePlayer({ user, gameData, onExit, isStudioTest = false }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [showLevelIntro, setShowLevelIntro] = useState(!isStudioTest); 
    const [loading, setLoading] = useState(true);
    
    // Refs Engine
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const isRunningRef = useRef(true);
    const projectRef = useRef(gameData);
    const keysPressed = useRef({});

    // États du Quiz (Logique JSX)
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [lives, setLives] = useState(4);
    const [score, setScore] = useState(0);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [questionStates, setQuestionStates] = useState([]);
    const [isMuted, setIsMuted] = useState(false);

    // Extraction des données de niveau
    const levels = gameData?.levels || [];
    const currentLevelData = levels[currentLevelIdx] || {};
    const questions = currentLevelData.questions || [];

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    const playParallelSoundImpl = (url) => {
        if (!isRunningRef.current || !audioCtxRef.current || isMuted) return;
        const buffer = audioBuffersRef.current.get(resolveUrl(url));
        if (buffer) {
            if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
            try {
                const source = audioCtxRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(audioCtxRef.current.destination);
                source.start(0);
            } catch(e) {}
        }
    };

    const triggerGlobalEvent = (eventName) => {
        const scene = gameData.scenes?.[0];
        if (!scene || !scene.globalSounds) return;
        const event = scene.globalSounds.find(g => g.name.toUpperCase().trim() === eventName.toUpperCase().trim());
        if (event && event.sounds) {
            event.sounds.forEach(snd => playParallelSoundImpl(snd.url));
        }
    };

    // ⌨️ GESTION CHEATS
    useEffect(() => {
        const hDown = (e) => { keysPressed.current[e.code] = true; };
        const hUp = (e) => { keysPressed.current[e.code] = false; };
        window.addEventListener('keydown', hDown);
        window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, []);

    // 1. CHARGEMENT COMPLET (ASSETS + INIT MAITRISE)
    useEffect(() => {
        isRunningRef.current = true;
        const loadAssets = async () => {
            try {
                if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                
                const scene = gameData.scenes?.[0] || { actors: [], backdrops: [] };
                
                // IMAGES
                const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
                await Promise.all(imgUrls.map(url => new Promise(resolve => {
                    const img = new Image(); img.crossOrigin = "anonymous";
                    const rUrl = resolveUrl(url);
                    img.onload = () => { imageAssetsRef.current.set(rUrl, img); resolve(); };
                    img.onerror = resolve; img.src = rUrl;
                })));

                // SONS
                const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
                await Promise.all(sndUrls.map(async url => {
                    const rUrl = resolveUrl(url);
                    const buf = await SoundExpert.decodeAudio(rUrl, audioCtxRef.current);
                    if (buf) audioBuffersRef.current.set(rUrl, buf);
                }));

                // Reset des états de maîtrise pour le niveau actuel
                setQuestionStates(new Array(questions.length).fill(0));
                setLoading(false);
                
                // Si on est en test studio, on force le démarrage sans intro
                if (isStudioTest) {
                    setEngineStarted(true);
                    triggerGlobalEvent("UPLEVEL");
                }
            } catch (e) { console.error("Unified Engine Load Error", e); }
        };
        loadAssets();
        return () => { isRunningRef.current = false; if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [gameData, currentLevelIdx]); // On recharge si on change de niveau

    // 2. MOTEUR GRAPHIQUE
    useEffect(() => {
        if (!engineStarted || !canvasRef.current || loading) return;

        const MiniGameBase = createGameBase({
            audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current,
            projectRef: { current: gameData }, sceneIdx: 0, imageAssets: imageAssetsRef.current,
            resolveUrl, canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'),
            playParallelSound: playParallelSoundImpl,
            callbacks: { 
                onPlayerHit: () => setLives(l => {
                    if (keysPressed.current['KeyF']) return l;
                    const next = Math.max(0, l - 1);
                    if (next === 0) triggerGameOver();
                    return next;
                }) 
            }
        });

        try {
            const factory = new Function('MiniGameBase', `${gameData.generatedCode}\nreturn MiniGame;`);
            const GameClass = factory(MiniGameBase);
            const instance = new GameClass(canvasRef.current, {}, {});
            gameInstanceRef.current = instance;
            if (instance.start) instance.start();

            const tick = () => {
                if (!isRunningRef.current || !gameInstanceRef.current) return;
                try {
                    gameInstanceRef.current.isBossPhase = (questionStates[currentQIdx] >= 2);
                    gameInstanceRef.current.keys = keysPressed.current;
                    if (instance.update) instance.update();
                    if (instance._render) instance._render();
                    if (instance.draw) instance.draw();
                } catch (e) { }
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (err) { console.error("Engine Crash", err); }

        return () => { isRunningRef.current = false; if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted, loading, currentQIdx]);

    // 3. LOGIQUE RÉPONSE
    const handleAnswer = (idx) => {
        if (!questions[currentQIdx]) return;
        const isCorrect = questions[currentQIdx].a === idx;
        setFeedback(isCorrect ? 'GOOD' : 'BAD');
        
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);

        const newStates = [...questionStates];
        if (isCorrect) newStates[currentQIdx] = Math.min(3, newStates[currentQIdx] + 1);
        else {
            newStates[currentQIdx] = Math.max(0, newStates[currentQIdx] - 1);
            setLives(l => keysPressed.current['KeyF'] ? l : Math.max(0, l - 1));
        }
        setQuestionStates(newStates);

        setTimeout(() => {
            setFeedback(null);
            if (isCorrect && newStates[currentQIdx] === 3) {
                const nextQ = newStates.findIndex(s => s < 3);
                if (nextQ !== -1) {
                    setCurrentQIdx(nextQ);
                } else {
                    // Fin du niveau !
                    if (levels[currentLevelIdx + 1]) {
                        triggerGlobalEvent("LEVEL_WIN");
                        alert("NIVEAU RÉUSSI ! PASSAGE AU SUIVANT...");
                        setCurrentLevelIdx(prev => prev + 1);
                        setCurrentQIdx(0);
                        setShowLevelIntro(true);
                        setEngineStarted(false);
                    } else {
                        triggerWin();
                    }
                }
            }
        }, 1000);
    };

    const handleBarCheat = (idx) => {
        if (!keysPressed.current['KeyF']) return;
        const newStates = [...questionStates];
        newStates[idx] = 3;
        setQuestionStates(newStates);
        if (newStates.every(s => s === 3)) {
             if (levels[currentLevelIdx + 1]) {
                setCurrentLevelIdx(prev => prev + 1);
                setCurrentQIdx(0);
                setShowLevelIntro(true);
                setEngineStarted(false);
             } else triggerWin();
        }
    };

    const triggerWin = () => { triggerGlobalEvent("LEVEL_WIN"); alert("VICTOIRE FINALE !"); onExit(); };
    const triggerGameOver = () => { triggerGlobalEvent("DÉFAITE"); alert("GAME OVER"); onExit(); };

    if (loading) return <div className="game-player-fullscreen bg-slate-900 flex items-center justify-center text-white font-black">SYNCHRONISATION DES ASSETS...</div>;

    const hasSheet = currentLevelData.intro?.sheetUrl;
    const hasVideo = currentLevelData.intro?.videoUrl;

    return (
        <div className="game-player-fullscreen bg-slate-950 flex flex-col items-center justify-center">
            {showLevelIntro ? (
                <div className="flex flex-col items-center animate-in zoom-in max-w-4xl px-6">
                    <div className="bg-indigo-600 text-white px-6 py-2 rounded-full font-black uppercase tracking-widest text-sm mb-4">
                        Niveau {currentLevelIdx + 1} : {currentLevelData.name}
                    </div>
                    <h1 className="text-4xl font-black text-white uppercase mb-8 text-center">{gameData.title}</h1>
                    <div className="flex gap-6 mb-10 h-[320px] w-full justify-center">
                        {hasSheet && <img src={resolveUrl(hasSheet)} className="h-full rounded-2xl border-4 border-white shadow-2xl bg-white object-contain" />}
                        {hasVideo && <iframe src={hasVideo.replace("watch?v=", "embed/")} className="h-full aspect-video rounded-2xl border-4 border-white shadow-2xl" />}
                        {!hasSheet && !hasVideo && <div className="h-full flex items-center text-slate-500 font-black uppercase text-xl">Préparez-vous...</div>}
                    </div>
                    <button onClick={() => { setShowLevelIntro(false); setEngineStarted(true); triggerGlobalEvent("UPLEVEL"); }} className="px-16 py-6 bg-white text-indigo-600 font-black text-3xl rounded-full shadow-2xl hover:scale-110 transition-all uppercase">
                        🚀 GO !
                    </button>
                </div>
            ) : (
                <>
                    <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl flex gap-1 cursor-pointer pointer-events-auto" onClick={() => keysPressed.current['KeyF'] && setLives(4)}>
                            {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center px-4 gap-2">
                            <div className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase border border-indigo-400">
                                {gameData.title} • LVL {currentLevelIdx + 1}
                            </div>
                            {questions[currentQIdx] && (
                                <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto">
                                    {feedback === 'GOOD' ? "✅ BIEN JOUÉ !" : feedback === 'BAD' ? "❌ MAUVAISE RÉPONSE" : questions[currentQIdx].q}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 items-center pointer-events-auto">
                            {questionStates.map((mastery, idx) => (
                                <div key={idx} onClick={() => handleBarCheat(idx)} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden cursor-pointer ${currentQIdx === idx ? 'ring-2 ring-indigo-400' : 'opacity-60'}`}>
                                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <canvas ref={canvasRef} width={800} height={450} className="rounded-xl shadow-2xl bg-black border-4 border-slate-800" />

                    {!loading && questions[currentQIdx] && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                                {questions[currentQIdx].options.map((o, i) => (
                                    <button key={i} onClick={() => handleAnswer(i)} className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-indigo-50 hover:scale-105 border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2">
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
