// @signatures: GamePlayer, handleAnswer, playParallelSoundImpl, triggerGlobalEvent, initGame
import React, { useState, useEffect, useRef } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

/**
 * 🕹️ LECTEUR MIROIR ABSOLU V110
 * Rôle : Julian voit EXACTEMENT la même chose que le prof.
 * HUD, Audio et Logique 1:1.
 */
export default function GamePlayer({ user, gameData, onExit }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Refs Engine
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const isRunningRef = useRef(true);
    const projectRef = useRef(gameData);

    // États Jeu (Identiques au Prof)
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [lives, setLives] = useState(4);
    const [score, setScore] = useState(0);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [questionStates, setQuestionStates] = useState([]);

    const levels = gameData?.levels || [];
    const currentLevelData = levels[currentLevelIdx] || {};
    const questions = currentLevelData.questions || [];

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    // 🔊 FONCTION AUDIO MIROIR
    const playParallelSoundImpl = (url) => {
        if (!isRunningRef.current || !audioCtxRef.current) return;
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

    // 🌍 ÉVÉNEMENTS GLOBAUX (UPLEVEL, LEVEL_WIN...)
    const triggerGlobalEvent = (eventName) => {
        const scene = gameData.scenes?.[0];
        if (!scene || !scene.globalSounds) return;
        const event = scene.globalSounds.find(g => g.name.toUpperCase().trim() === eventName.toUpperCase().trim());
        if (event && event.sounds) {
            event.sounds.forEach(snd => playParallelSoundImpl(snd.url));
        }
    };

    // 1. CHARGEMENT ASSETS (IMAGES + SONS)
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

                // Init questions states
                setQuestionStates(new Array(questions.length).fill(0));
                setLoading(false);
                setEngineStarted(true);
                triggerGlobalEvent("UPLEVEL");
            } catch (e) { console.error("Loader Error", e); }
        };
        loadAssets();
        return () => { isRunningRef.current = false; if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [gameData]);

    // 2. DÉMARRAGE DU MOTEUR (MIROIR gameCore)
    useEffect(() => {
        if (!engineStarted || !canvasRef.current || loading) return;

        const MiniGameBase = createGameBase({
            audioBuffers: audioBuffersRef.current,
            audioCtx: audioCtxRef.current,
            projectRef,
            sceneIdx: 0,
            imageAssets: imageAssetsRef.current,
            resolveUrl, canvas: canvasRef.current,
            ctx: canvasRef.current.getContext('2d'),
            playParallelSound: playParallelSoundImpl, // ✅ PASSAGE DE LA FONCTION AUDIO
            callbacks: { 
                onPlayerHit: () => setLives(l => {
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
        
        // Notification au script (Magicien tire, Zombie recule)
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);

        const newStates = [...questionStates];
        if (isCorrect) {
            newStates[currentQIdx] = Math.min(3, newStates[currentQIdx] + 1);
        } else {
            newStates[currentQIdx] = Math.max(0, newStates[currentQIdx] - 1);
            setLives(l => Math.max(0, l - 1));
        }
        setQuestionStates(newStates);

        setTimeout(() => {
            setFeedback(null);
            if (isCorrect && newStates[currentQIdx] === 3) {
                // Question maîtrisée, on passe à la suivante
                const nextQ = newStates.findIndex(s => s < 3);
                if (nextQ !== -1) {
                    setCurrentQIdx(nextQ);
                } else {
                    triggerWin();
                }
            }
        }, 1000);
    };

    const triggerWin = () => {
        triggerGlobalEvent("LEVEL_WIN");
        alert("NIVEAU RÉUSSI !");
        onExit();
    };

    const triggerGameOver = () => {
        triggerGlobalEvent("DÉFAITE");
        alert("PLUS DE VIES !");
        onExit();
    };

    return (
        <div className="game-player-fullscreen bg-slate-950 flex flex-col items-center justify-center">
            {/* 💖 HUD MIROIR (HAUT) */}
            <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl flex gap-1">
                    {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                </div>
                
                <div className="flex-1 flex flex-col items-center px-4 gap-2">
                    <div className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-lg border border-indigo-400">
                        {gameData.title || "DÉFI STUDIO"}
                    </div>
                    {questions[currentQIdx] && (
                        <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto">
                            {feedback === 'GOOD' ? "✅ BRAVO !" : feedback === 'BAD' ? "❌ RATÉ..." : questions[currentQIdx].q}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 items-center pointer-events-auto">
                    {questionStates.map((mastery, idx) => (
                        <div key={idx} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden ${currentQIdx === idx ? 'ring-2 ring-indigo-400' : 'opacity-60'}`}>
                            <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                        </div>
                    ))}
                </div>
            </div>
            
            <canvas ref={canvasRef} width={800} height={450} className="rounded-xl shadow-2xl bg-black border-4 border-slate-800" />

            {/* ⌨️ BOUTONS MIROIR (BAS) */}
            {!loading && questions[currentQIdx] && (
                <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                    <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                        {questions[currentQIdx].options.map((o, i) => (
                            <button 
                                key={i} 
                                onClick={() => handleAnswer(i)} 
                                className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-indigo-500 hover:scale-105 transition-all border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2"
                            >
                                {o}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
