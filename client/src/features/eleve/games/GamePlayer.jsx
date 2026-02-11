// @signatures: GamePlayer, handleAnswer, handleBarCheat, handleHeartClick, initGame, syncTestData, getEmbedUrl
import React, { useState, useEffect, useRef } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

/**
 * 🕹️ MOTEUR UNIFIÉ V160 (SCÈNE + QUIZ + SONS + INTRO RÉVISIONS)
 * SOURCE UNIQUE DE VÉRITÉ : Studio Prof & Player Élève.
 * Ajout : Bouton Fermer & Dashboard d'intro pédagogique.
 */
export default function GamePlayer({ user, gameData, onExit, isStudioTest = false }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [showLevelIntro, setShowLevelIntro] = useState(true); 
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

    // États du Quiz
    const [levels, setLevels] = useState(gameData?.levels || []);
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [lives, setLives] = useState(4);
    const [score, setScore] = useState(0);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [questionStates, setQuestionStates] = useState([]);
    const [isMuted, setIsMuted] = useState(false);

    const currentLevelData = levels[currentLevelIdx] || {};
    const questions = currentLevelData.questions || [];

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    // Transformateur d'URL YouTube pour Iframe
    const getEmbedUrl = (url) => {
        if (!url) return null;
        if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
        if (url.includes('youtu.be/')) return url.split('youtu.be/')[1] ? `https://www.youtube.com/embed/${url.split('youtu.be/')[1]}` : url;
        return url;
    };

    const playParallelSoundImpl = (url) => {
        if (!isRunningRef.current || !audioCtxRef.current || isMuted) return;
        const resolved = resolveUrl(url);
        const buffer = audioBuffersRef.current.get(resolved);
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
        const scene = projectRef.current?.scenes?.[0];
        if (!scene || !scene.globalSounds) return;
        const event = scene.globalSounds.find(g => g.name.toUpperCase().trim() === eventName.toUpperCase().trim());
        if (event && event.sounds) {
            event.sounds.forEach(snd => playParallelSoundImpl(snd.url));
        }
    };

    useEffect(() => {
        const hDown = (e) => { keysPressed.current[e.code] = true; };
        const hUp = (e) => { keysPressed.current[e.code] = false; };
        window.addEventListener('keydown', hDown);
        window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, []);

    useEffect(() => {
        isRunningRef.current = true;
        const load = async () => {
            try {
                if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                
                let finalGameData = { ...gameData };

                if (isStudioTest && (!finalGameData.levels || finalGameData.levels.length === 0)) {
                    const res = await fetch('/api/games/test-data');
                    const testQuiz = await res.json();
                    if (testQuiz) {
                        finalGameData.levels = testQuiz.levels;
                        setLevels(testQuiz.levels);
                    }
                } else {
                    setLevels(finalGameData.levels || []);
                }

                projectRef.current = finalGameData;
                const scene = finalGameData.scenes?.[0] || { actors: [], backdrops: [] };
                
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

                const qCount = finalGameData.levels?.[currentLevelIdx]?.questions?.length || 0;
                setQuestionStates(new Array(qCount).fill(0));
                
                setLoading(false);
            } catch (e) { console.error("Unified Engine Load Error", e); }
        };
        load();
        return () => { isRunningRef.current = false; if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [gameData]);

    useEffect(() => {
        if (!engineStarted || !canvasRef.current || loading) return;

        const MiniGameBase = createGameBase({
            audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current,
            projectRef, sceneIdx: 0, imageAssets: imageAssetsRef.current,
            resolveUrl, canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'),
            playParallelSound: playParallelSoundImpl,
            callbacks: { 
                onPlayerHit: () => {
                    if (keysPressed.current['KeyF']) return;
                    setLives(l => {
                        const next = Math.max(0, l - 1);
                        if (next === 0) triggerGameOver();
                        return next;
                    });
                }
            }
        });

        try {
            const factory = new Function('MiniGameBase', `${projectRef.current.generatedCode}\nreturn MiniGame;`);
            const GameClass = factory(MiniGameBase);
            const instance = new GameClass(canvasRef.current, {}, { 
                onPlayerHit: () => {
                    if (keysPressed.current['KeyF']) return;
                    setLives(l => Math.max(0, l - 1));
                }
            });
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
                if (nextQ !== -1) setCurrentQIdx(nextQ);
                else triggerWin();
            }
        }, 1000);
    };

    const handleBarCheat = (idx) => {
        if (!keysPressed.current['KeyF']) return;
        const newStates = [...questionStates];
        newStates[idx] = 3;
        setQuestionStates(newStates);
    };

    const triggerWin = () => { triggerGlobalEvent("LEVEL_WIN"); alert("NIVEAU RÉUSSI !"); onExit(); };
    const triggerGameOver = () => { triggerGlobalEvent("DÉFAITE"); alert("GAME OVER"); onExit(); };

    if (loading) return (
        <div className="game-player-fullscreen bg-slate-900 flex flex-col items-center justify-center text-white font-black">
            <div className="text-6xl animate-bounce mb-8">⏳</div>
            <div className="uppercase tracking-[0.2em]">Chargement des ressources...</div>
        </div>
    );

    return (
        <div className="game-player-fullscreen bg-slate-950 flex flex-col items-center justify-center">
            {/* BOUTON FERMER UNIVERSEL */}
            <button 
                onClick={onExit}
                className="fixed top-6 right-6 w-14 h-14 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-2xl font-black transition-all z-[100] border-2 border-white/20 hover:scale-110 active:scale-95"
            >
                ✕
            </button>

            {showLevelIntro ? (
                <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex flex-col items-center p-8 overflow-y-auto custom-scrollbar">
                    <div className="w-full max-w-6xl animate-in zoom-in slide-in-from-bottom-10 duration-500">
                        <div className="text-center mb-10">
                            <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-2">{projectRef.current.title}</h1>
                            <div className="inline-block px-6 py-2 bg-indigo-600 rounded-full text-white font-black uppercase text-xs">
                                Niveau {currentLevelIdx + 1} : {currentLevelData.name}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
                            {/* FICHE D'ÉTUDE */}
                            <div className="flex flex-col gap-4">
                                <h2 className="text-indigo-400 font-black uppercase text-sm tracking-widest">📖 Fiche de révision</h2>
                                <div className="aspect-[4/5] bg-slate-800 rounded-3xl border-4 border-slate-700 overflow-hidden flex items-center justify-center shadow-2xl group">
                                    {currentLevelData.intro?.sheetUrl ? (
                                        <img 
                                            src={resolveUrl(currentLevelData.intro.sheetUrl)} 
                                            className="w-full h-full object-contain hover:scale-105 transition-transform duration-700"
                                            alt="Fiche"
                                        />
                                    ) : (
                                        <div className="text-slate-600 font-black uppercase text-xs text-center p-10">
                                            Aucune fiche visuelle<br/>disponible pour ce niveau
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* VIDÉO */}
                            <div className="flex flex-col gap-4">
                                <h2 className="text-indigo-400 font-black uppercase text-sm tracking-widest">🎥 Vidéo explicative</h2>
                                <div className="aspect-video bg-black rounded-3xl border-4 border-slate-700 overflow-hidden shadow-2xl">
                                    {currentLevelData.intro?.videoUrl ? (
                                        <iframe 
                                            className="w-full h-full" 
                                            src={getEmbedUrl(currentLevelData.intro.videoUrl)} 
                                            title="Leçon"
                                            frameBorder="0" 
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                            allowFullScreen
                                        ></iframe>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600 font-black uppercase text-xs text-center p-10">
                                            Aucune vidéo<br/>associée à ce niveau
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 mt-auto">
                                    <h3 className="text-white font-black uppercase text-xs mb-2">Objectif :</h3>
                                    <p className="text-slate-400 text-sm font-bold leading-relaxed">
                                        Prends le temps de réviser ces ressources. Une fois prêt, clique sur le bouton ci-dessous pour lancer le défi !
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center pb-10">
                            <button 
                                onClick={() => { setShowLevelIntro(false); setEngineStarted(true); triggerGlobalEvent("UPLEVEL"); }} 
                                className="group relative px-20 py-8 bg-white text-indigo-600 font-black text-4xl rounded-full shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-95 transition-all uppercase overflow-hidden"
                            >
                                <span className="relative z-10">🚀 LANCER LE NIVEAU</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* UI JEU */}
                    <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl flex gap-1 cursor-pointer pointer-events-auto" onClick={() => keysPressed.current['KeyF'] && setLives(4)}>
                            {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                        </div>
                        <div className="flex-1 flex flex-col items-center px-4 gap-2">
                            <div className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase border border-indigo-400">
                                {projectRef.current.title} • {currentLevelData.name}
                            </div>
                            {questions[currentQIdx] && (
                                <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto text-center max-w-2xl">
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
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
                                {questions[currentQIdx].options.map((o, i) => (
                                    <button key={i} onClick={() => handleAnswer(i)} className="bg-indigo-600 text-white py-6 px-4 rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-white hover:text-indigo-600 hover:scale-105 border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2 transition-all">
                                        {o || "..."}
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
