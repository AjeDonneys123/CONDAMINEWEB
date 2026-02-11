// @signatures: GamePlayer, handleStartGame, triggerWin, triggerGameOver
import React, { useState, useEffect, useRef } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

export default function GamePlayer({ user, gameData, onExit }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [loading, setLoading] = useState(true);
    
    // Refs Engine
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const projectRef = useRef(gameData);

    // Etats Jeu
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [lives, setLives] = useState(4);
    const [score, setScore] = useState(0);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [feedback, setFeedback] = useState(null);

    const levels = gameData.levels || [];
    const currentLevelData = levels[currentLevelIdx] || {};
    const questions = currentLevelData.questions || [];

    // --- CHARGEMENT MIROIR ---
    useEffect(() => {
        const loadAssets = async () => {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            
            const scene = gameData.scenes?.[0] || { actors: [], backdrops: [] };
            
            // 1. Images
            const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
            await Promise.all(imgUrls.map(url => new Promise(resolve => {
                const img = new Image(); img.crossOrigin = "anonymous";
                const rUrl = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
                img.onload = () => { imageAssetsRef.current.set(rUrl, img); resolve(); };
                img.onerror = resolve;
                img.src = rUrl;
            })));

            // 2. Sons
            const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
            await Promise.all(sndUrls.map(async url => {
                const rUrl = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
                const buf = await SoundExpert.decodeAudio(rUrl, audioCtxRef.current);
                if (buf) audioBuffersRef.current.set(rUrl, buf);
            }));

            setLoading(false);
        };
        loadAssets();
    }, [gameData]);

    const handleStartGame = () => {
        setShowIntro(false);
        setEngineStarted(true);
    };

    // --- INITIALISATION MOTEUR ---
    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;

        const MiniGameBase = createGameBase({
            audioBuffers: audioBuffersRef.current,
            audioCtx: audioCtxRef.current,
            projectRef,
            sceneIdx: 0,
            imageAssets: imageAssetsRef.current,
            resolveUrl: (u) => u.startsWith('/api/proxy') ? u : `/api/proxy/${u.split('/').pop()}`,
            canvas: canvasRef.current,
            ctx: canvasRef.current.getContext('2d'),
            callbacks: { onPlayerHit: () => setLives(l => Math.max(0, l - 1)) }
        });

        const UserGameClass = new Function('MiniGameBase', `${gameData.generatedCode}\nreturn MiniGame;`)(MiniGameBase);
        const instance = new UserGameClass(canvasRef.current, {}, {});
        gameInstanceRef.current = instance;
        if (instance.start) instance.start();

        const tick = () => {
            if (instance.update) instance.update();
            if (instance._render) instance._render();
            if (instance.draw) instance.draw();
            frameIdRef.current = requestAnimationFrame(tick);
        };
        tick();

        return () => cancelAnimationFrame(frameIdRef.current);
    }, [engineStarted]);

    const handleAnswer = (idx) => {
        const isCorrect = questions[currentQIdx].a === idx;
        setFeedback(isCorrect ? 'GOOD' : 'BAD');
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);

        setTimeout(() => {
            setFeedback(null);
            if (isCorrect) {
                setScore(s => s + 100);
                if (currentQIdx + 1 < questions.length) setCurrentQIdx(q => q + 1);
                else triggerWin();
            } else {
                if (lives <= 1) triggerGameOver();
            }
        }, 1000);
    };

    const triggerWin = () => {
        alert("VICTOIRE !");
        saveAndExit(1);
    };

    const triggerGameOver = () => {
        alert("GAME OVER...");
        saveAndExit(0);
    };

    const saveAndExit = async (status) => {
        await fetch('/api/eleve/games/score', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ studentId: user._id || user.id, gameId: gameData._id, score, levelReached: status })
        });
        onExit();
    };

    const hasSheet = currentLevelData.intro?.sheetUrl;
    const hasVideo = currentLevelData.intro?.videoUrl;

    return (
        <div className="game-player-fullscreen bg-slate-950 flex flex-col items-center justify-center">
            {showIntro ? (
                <div className="flex flex-col items-center animate-in zoom-in">
                    <h1 className="text-4xl font-black text-white uppercase mb-8">{gameData.title}</h1>
                    <div className="flex gap-6 mb-10 h-[300px]">
                        {hasSheet && <img src={hasSheet.startsWith('/api/proxy') ? hasSheet : `/api/proxy/${hasSheet.split('/').pop()}`} className="h-full rounded-xl border-4 border-white shadow-2xl" />}
                        {hasVideo && <iframe src={hasVideo.replace("watch?v=", "embed/")} className="h-full aspect-video rounded-xl border-4 border-white shadow-2xl" />}
                    </div>
                    <button onClick={handleStartGame} disabled={loading} className="px-12 py-6 bg-white text-indigo-600 font-black text-3xl rounded-full shadow-2xl hover:scale-110 transition-all uppercase">
                        {loading ? 'Chargement...' : '🚀 C\'est parti !'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="absolute top-6 left-6 text-2xl">{"❤️".repeat(lives)}</div>
                    <div className="absolute top-6 right-6 text-white font-black">Score: {score}</div>
                    
                    <canvas ref={canvasRef} width={800} height={450} className="rounded-xl shadow-2xl bg-black border-4 border-slate-800" />

                    {questions[currentQIdx] && (
                        <div className="mt-10 w-full max-w-4xl px-10">
                            <div className="bg-white p-6 rounded-2xl text-center font-black text-xl mb-6 shadow-xl">
                                {feedback === 'GOOD' ? '✅ BRAVO !' : feedback === 'BAD' ? '❌ FAUX !' : questions[currentQIdx].q}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {questions[currentQIdx].options.map((o, i) => (
                                    <button key={i} onClick={() => handleAnswer(i)} className="bg-indigo-600 text-white py-4 rounded-xl font-black uppercase hover:bg-indigo-500 shadow-lg">
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
