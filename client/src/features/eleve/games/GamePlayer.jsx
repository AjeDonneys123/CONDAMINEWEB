// @signatures: GamePlayer, handleAnswer, handleBarCheat, getEmbedUrl, checkAnswerPermissive
import React, { useState, useEffect, useRef } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

/**
 * 🕹️ MOTEUR UNIFIÉ V190 (BOSS MODE & KEYBOARD INPUT)
 * Rôle : Gère le passage en mode Boss (2/3 de barre) avec saisie clavier.
 */
export default function GamePlayer({ user, gameData, onExit, isStudioTest = false }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [showLevelIntro, setShowLevelIntro] = useState(true); 
    const [loading, setLoading] = useState(true);
    const [zoomMedia, setZoomMedia] = useState(null); 
    const [showLevelBanner, setShowLevelBanner] = useState(false); 
    
    // Saisie Clavier pour Mode Boss
    const [userInput, setUserInput] = useState("");
    
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
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [questionStates, setQuestionStates] = useState([]); // 0: Vide, 1: 1/3, 2: 2/3 (BOSS), 3: PLEIN
    const [isMuted, setIsMuted] = useState(false);

    const currentLevelData = levels[currentLevelIdx] || {};
    const questions = currentLevelData.questions || [];
    const currentQ = questions[currentQIdx];
    const isBossPhase = questionStates[currentQIdx] >= 2;

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    const checkAnswerPermissive = (input, target) => {
        if (!input || !target) return false;
        const clean = (s) => s.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlever accents
            .replace(/\s+/g, '') // Enlever espaces
            .trim();
        return clean(input) === clean(target);
    };

    const getEmbedUrl = (url) => {
        if (!url) return null;
        let videoId = "";
        if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        else if (url.includes('embed/')) videoId = url.split('embed/')[1].split('?')[0];
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : url;
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
                    if (testQuiz) { finalGameData.levels = testQuiz.levels; setLevels(testQuiz.levels); }
                } else { setLevels(finalGameData.levels || []); }
                projectRef.current = finalGameData;
                
                const qCount = projectRef.current.levels?.[currentLevelIdx]?.questions?.length || 0;
                setQuestionStates(new Array(qCount).fill(0));
                
                const scene = finalGameData.scenes?.[0] || { actors: [], backdrops: [] };
                const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
                await Promise.all(imgUrls.map(url => new Promise(resolve => {
                    const img = new Image(); img.crossOrigin = "anonymous";
                    const rUrl = resolveUrl(url);
                    img.onload = () => { imageAssetsRef.current.set(rUrl, img); resolve(); };
                    img.onerror = resolve; img.src = rUrl;
                })));
                const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
                await Promise.all(sndUrls.map(async url => {
                    const rUrl = resolveUrl(url);
                    const buf = await SoundExpert.decodeAudio(rUrl, audioCtxRef.current);
                    if (buf) audioBuffersRef.current.set(rUrl, buf);
                }));
                setLoading(false);
            } catch (e) { console.error("Engine Load Error", e); }
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
                    setLives(l => { const next = Math.max(0, l - 1); if (next === 0) triggerGameOver(); return next; });
                }
            }
        });
        try {
            const factory = new Function('MiniGameBase', `${projectRef.current.generatedCode}\nreturn MiniGame;`);
            const GameClass = factory(MiniGameBase);
            const instance = new GameClass(canvasRef.current, {}, { onPlayerHit: () => { if (keysPressed.current['KeyF']) return; setLives(l => Math.max(0, l - 1)); } });
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

    const handleAnswer = (val) => {
        if (!currentQ) return;
        
        let isCorrect = false;
        if (typeof val === 'number') {
            isCorrect = currentQ.a === val;
        } else {
            const correctText = currentQ.options[currentQ.a];
            isCorrect = checkAnswerPermissive(val, correctText);
        }

        setFeedback(isCorrect ? 'GOOD' : 'BAD');
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);
        
        const newStates = [...questionStates];
        if (isCorrect) {
            newStates[currentQIdx] = Math.min(3, newStates[currentQIdx] + 1);
        } else {
            newStates[currentQIdx] = Math.max(0, newStates[currentQIdx] - 1);
            setLives(l => keysPressed.current['KeyF'] ? l : Math.max(0, l - 1));
        }
        setQuestionStates(newStates);
        setUserInput(""); // Reset input

        setTimeout(() => {
            setFeedback(null);
            // Si la barre est pleine, on cherche la prochaine question non finie
            if (isCorrect && newStates[currentQIdx] === 3) {
                const nextQ = newStates.findIndex((s, idx) => s < 3 && idx > currentQIdx) || newStates.findIndex(s => s < 3);
                if (nextQ !== -1 && nextQ !== currentQIdx) {
                    setCurrentQIdx(nextQ);
                } else if (newStates.every(s => s === 3)) {
                    triggerWin();
                }
            }
        }, 1000);
    };

    const handleBarCheat = (idx) => { if (!keysPressed.current['KeyF']) return; const newStates = [...questionStates]; newStates[idx] = 3; setQuestionStates(newStates); };
    const triggerWin = () => { triggerGlobalEvent("LEVEL_WIN"); alert("NIVEAU RÉUSSI !"); onExit(); };
    const triggerGameOver = () => { triggerGlobalEvent("DÉFAITE"); alert("GAME OVER"); onExit(); };

    const startCurrentLevel = () => {
        setShowLevelIntro(false);
        setEngineStarted(true);
        triggerGlobalEvent("UPLEVEL");
        setShowLevelBanner(true);
        setTimeout(() => setShowLevelBanner(false), 1500); 
    };

    return (
        <div className="game-player-fullscreen bg-slate-950 flex flex-col items-center justify-center">
            <button onClick={onExit} className="fixed top-6 right-6 w-14 h-14 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-2xl font-black transition-all z-[3500] border-2 border-white/20 hover:scale-110 active:scale-95">✕</button>

            {showLevelBanner && (
                <div className="fixed top-[20%] left-0 right-0 z-[5000] flex justify-center pointer-events-none animate-in fade-in zoom-in duration-300">
                    <span className="text-yellow-400 font-black text-6xl uppercase tracking-tighter italic drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                        Niveau {currentLevelIdx + 1}
                    </span>
                </div>
            )}

            {zoomMedia && (
                <div className="fixed inset-0 z-[4000] bg-black flex items-center justify-center p-0 animate-in fade-in duration-300" onClick={() => setZoomMedia(null)}>
                    <button className="absolute top-8 right-8 w-16 h-16 bg-white text-black rounded-full text-3xl font-black z-[4001]">✕</button>
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {zoomMedia === 'sheet' ? (
                            <img src={resolveUrl(currentLevelData.intro?.sheetUrl)} className="h-[90vh] w-auto max-w-[95vw] object-contain rounded-lg shadow-2xl" />
                        ) : (
                            <div className="h-[90vh] aspect-video max-w-[95vw] bg-black rounded-2xl overflow-hidden border-4 border-white/10 shadow-2xl">
                                <iframe className="w-full h-full" src={getEmbedUrl(currentLevelData.intro?.videoUrl)} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen></iframe>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showLevelIntro ? (
                <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex flex-col items-center p-8 overflow-y-auto custom-scrollbar">
                    <div className="w-full max-w-6xl animate-in zoom-in slide-in-from-bottom-10 duration-500 text-center">
                        <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-2">{projectRef.current.title}</h1>
                        <div className="inline-block px-6 py-2 bg-indigo-600 rounded-full text-white font-black uppercase text-xs mb-10">Niveau {currentLevelIdx + 1} : {currentLevelData.name}</div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
                            <div onClick={() => currentLevelData.intro?.sheetUrl && setZoomMedia('sheet')} className="cursor-pointer group">
                                <h2 className="text-indigo-400 font-black uppercase text-xs mb-4">📖 Fiche</h2>
                                <div className="aspect-[4/3] bg-slate-800 rounded-3xl border-4 border-slate-700 overflow-hidden flex items-center justify-center group-hover:border-indigo-500 transition-all">
                                    {currentLevelData.intro?.sheetUrl ? <img src={resolveUrl(currentLevelData.intro.sheetUrl)} className="w-full h-full object-contain" /> : "Aucune fiche"}
                                </div>
                            </div>
                            <div onClick={() => currentLevelData.intro?.videoUrl && setZoomMedia('video')} className="cursor-pointer group">
                                <h2 className="text-indigo-400 font-black uppercase text-xs mb-4">🎥 Vidéo</h2>
                                <div className="aspect-[4/3] bg-black rounded-3xl border-4 border-slate-700 overflow-hidden flex items-center justify-center group-hover:border-indigo-500 transition-all text-white text-4xl">▶</div>
                            </div>
                        </div>
                        <button disabled={loading} onClick={startCurrentLevel} className="px-20 py-8 bg-white text-indigo-600 font-black text-3xl rounded-full shadow-2xl hover:scale-110 transition-all uppercase">
                            {loading ? '⌛ CHARGEMENT...' : '🚀 C\'EST PARTI !'}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl pointer-events-auto" onClick={() => keysPressed.current['KeyF'] && setLives(4)}>
                            {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                        </div>
                        <div className="flex-1 flex flex-col items-center px-4 gap-2">
                            <div className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase">{projectRef.current.title}</div>
                            {currentQ && (
                                <div className={`bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 shadow-2xl text-xl pointer-events-auto text-center max-w-2xl ${isBossPhase ? 'border-red-500 ring-2 ring-red-500/50' : 'border-slate-600'}`}>
                                    {feedback === 'GOOD' ? "✅ BIEN JOUÉ !" : feedback === 'BAD' ? "❌ MAUVAISE RÉPONSE" : currentQ.q}
                                    {isBossPhase && !feedback && <div className="text-[10px] text-red-500 mt-1 animate-pulse">⚠️ PHASE FINALE : SAISIS LA RÉPONSE !</div>}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 items-center pointer-events-auto">
                            {questionStates.map((mastery, idx) => (
                                <div key={idx} onClick={() => { handleBarCheat(idx); setCurrentQIdx(idx); }} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden cursor-pointer transition-all ${currentQIdx === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-40'}`}>
                                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery >= 3 ? 'bg-green-500' : mastery >= 2 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <canvas ref={canvasRef} width={800} height={450} className={`rounded-xl shadow-2xl bg-black border-4 transition-all duration-500 ${isBossPhase ? 'border-red-900 shadow-[0_0_50px_rgba(255,0,0,0.2)]' : 'border-slate-800'}`} />

                    <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                        {isBossPhase ? (
                            <div className="flex flex-col items-center gap-4 w-full max-w-xl animate-in slide-in-from-bottom-5">
                                <div className="relative w-full">
                                    <input 
                                        autoFocus
                                        className="w-full bg-slate-900 border-4 border-red-600 text-white text-3xl font-black py-6 px-10 rounded-3xl text-center outline-none focus:ring-4 ring-red-500/30 uppercase placeholder:text-slate-700"
                                        placeholder="TAPE LA RÉPONSE..."
                                        value={userInput}
                                        onChange={e => setUserInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAnswer(userInput)}
                                    />
                                    <button 
                                        onClick={() => handleAnswer(userInput)}
                                        className="absolute right-4 top-4 bottom-4 bg-red-600 hover:bg-red-500 text-white px-8 rounded-2xl font-black text-xl shadow-lg transition-transform active:scale-95"
                                    >
                                        ATTAQUER ⚔️
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
                                {currentQ?.options.map((o, i) => (
                                    <button key={i} onClick={() => handleAnswer(i)} className="bg-indigo-600 text-white py-6 px-4 rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-white hover:text-indigo-600 hover:scale-105 border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2 transition-all">
                                        {o || "..."}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
