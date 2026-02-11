// @signatures: GamePlayer, handleStartGame, handleAnswer, playSound
import React, { useState, useEffect, useRef } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

export default function GamePlayer({ user, gameData, onExit }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [loading, setLoading] = useState(true);
    
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const isRunningRef = useRef(true);

    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [lives, setLives] = useState(4);
    const [score, setScore] = useState(0);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [feedback, setFeedback] = useState(null);

    const levels = gameData?.levels || [];
    const currentLevelData = levels[currentLevelIdx] || {};
    const questions = currentLevelData.questions || [];

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    // 1. CHARGEMENT ASSETS (IMAGES + SONS)
    useEffect(() => {
        isRunningRef.current = true;
        const load = async () => {
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

                // SONS (Indispensable pour corriger l'absence de son)
                const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
                await Promise.all(sndUrls.map(async url => {
                    const rUrl = resolveUrl(url);
                    const buf = await SoundExpert.decodeAudio(rUrl, audioCtxRef.current);
                    if (buf) audioBuffersRef.current.set(rUrl, buf);
                }));

                setLoading(false);
            } catch (e) { console.error("Loader Error", e); }
        };
        load();
        return () => { isRunningRef.current = false; if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [gameData]);

    const handleStartGame = () => {
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        setShowIntro(false);
        setEngineStarted(true);
    };

    // 2. DÉMARRAGE DU MOTEUR
    useEffect(() => {
        if (!engineStarted || !canvasRef.current || loading) return;

        const MiniGameBase = createGameBase({
            audioBuffers: audioBuffersRef.current,
            audioCtx: audioCtxRef.current,
            projectRef: { current: gameData }, 
            sceneIdx: 0,
            imageAssets: imageAssetsRef.current,
            resolveUrl, canvas: canvasRef.current,
            ctx: canvasRef.current.getContext('2d'),
            callbacks: { onPlayerHit: () => setLives(l => Math.max(0, l - 1)) }
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
                    gameInstanceRef.current.isBossPhase = (currentQIdx > 0 && (currentQIdx + 1) % 3 === 0);
                    if (instance.update) instance.update();
                    if (instance._render) instance._render();
                    if (instance.draw) instance.draw();
                } catch (e) { isRunningRef.current = false; }
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (err) { console.error("Engine Crash", err); }

        return () => { isRunningRef.current = false; if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted, loading]);

    const handleAnswer = (idx) => {
        if (!questions[currentQIdx]) return;
        const isCorrect = questions[currentQIdx].a === idx;
        setFeedback(isCorrect ? 'GOOD' : 'BAD');
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);

        setTimeout(() => {
            setFeedback(null);
            if (isCorrect) {
                setScore(s => s + 100);
                if (currentQIdx + 1 < questions.length) {
                    setCurrentQIdx(q => q + 1);
                } else {
                    if (levels[currentLevelIdx + 1]) {
                        setCurrentLevelIdx(l => l + 1);
                        setCurrentQIdx(0);
                        setShowIntro(true);
                        setEngineStarted(false);
                    } else {
                        alert("VICTOIRE FINALE !");
                        onExit();
                    }
                }
            } else {
                if (lives <= 1) { alert("GAME OVER"); onExit(); }
            }
        }, 1000);
    };

    const hasSheet = currentLevelData.intro?.sheetUrl;
    const hasVideo = currentLevelData.intro?.videoUrl;

    return (
        <div className="game-player-fullscreen bg-slate-950 flex flex-col items-center justify-center">
            {showIntro ? (
                <div className="flex flex-col items-center animate-in zoom-in max-w-4xl px-6">
                    <h1 className="text-4xl font-black text-white uppercase mb-8 text-center">{gameData.title}</h1>
                    <div className="flex gap-6 mb-10 h-[320px] w-full justify-center">
                        {hasSheet && <img src={resolveUrl(hasSheet)} className="h-full rounded-2xl border-4 border-white shadow-2xl object-contain bg-white" />}
                        {hasVideo && <iframe src={hasVideo.replace("watch?v=", "embed/")} className="h-full aspect-video rounded-2xl border-4 border-white shadow-2xl" />}
                        {!hasSheet && !hasVideo && <div className="h-full flex items-center text-slate-500 font-black uppercase text-xl">Prêt pour le défi ?</div>}
                    </div>
                    <button onClick={handleStartGame} disabled={loading} className="px-16 py-6 bg-white text-indigo-600 font-black text-3xl rounded-full shadow-2xl hover:scale-110 transition-all uppercase tracking-tighter">
                        {loading ? 'Chargement...' : '🚀 C\'est parti !'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="absolute top-6 left-6 flex gap-2">
                        {Array.from({length: 4}).map((_, i) => (
                            <span key={i} className="text-3xl">{i < lives ? '❤️' : '🖤'}</span>
                        ))}
                    </div>
                    <div className="absolute top-6 right-6 bg-white/10 px-4 py-2 rounded-xl text-white font-black uppercase text-xs tracking-widest border border-white/20">
                        Score: {score}
                    </div>
                    
                    <canvas ref={canvasRef} width={800} height={450} className="rounded-xl shadow-2xl bg-black border-4 border-slate-800" />

                    {questions[currentQIdx] && (
                        <div className="mt-8 w-full max-w-4xl px-10 animate-in slide-in-from-bottom">
                            <div className="bg-white p-6 rounded-2xl text-center font-black text-xl mb-4 shadow-xl border-b-4 border-slate-200">
                                {feedback === 'GOOD' ? '✅ EXCELLENT !' : feedback === 'BAD' ? '❌ OUPS !' : questions[currentQIdx].q}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {questions[currentQIdx].options.map((o, i) => (
                                    <button key={i} onClick={() => handleAnswer(i)} className="bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase hover:bg-indigo-500 shadow-lg border-b-4 border-indigo-900 active:border-b-0 active:translate-y-1 transition-all">
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
