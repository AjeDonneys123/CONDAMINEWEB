// @signatures: GamePlayer, handleStartGame
import React, { useState, useEffect, useRef } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

export default function GamePlayer({ user, gameData, onExit }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const projectRef = useRef(gameData);

    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [lives, setLives] = useState(4);
    const [score, setScore] = useState(0);
    const questions = gameData.levels?.[0]?.questions || [];

    useEffect(() => {
        const loadAssets = async () => {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const scene = gameData.scenes?.[0] || { actors: [], backdrops: [] };
            
            // IMAGES
            const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
            await Promise.all(imgUrls.map(url => new Promise(resolve => {
                const img = new Image(); img.crossOrigin = "anonymous";
                const rUrl = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
                img.onload = () => { imageAssetsRef.current.set(rUrl, img); resolve(); };
                img.onerror = resolve; img.src = rUrl;
            })));

            // SONS
            const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
            await Promise.all(sndUrls.map(async url => {
                const rUrl = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
                const buf = await SoundExpert.decodeAudio(rUrl, audioCtxRef.current);
                if (buf) audioBuffersRef.current.set(rUrl, buf);
            }));
            setLoading(false);
            setEngineStarted(true); // On lance le moteur direct
        };
        loadAssets();
    }, [gameData]);

    useEffect(() => {
        if (!engineStarted || !canvasRef.current || loading) return;

        const MiniGameBase = createGameBase({
            audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current,
            projectRef, sceneIdx: 0, imageAssets: imageAssetsRef.current,
            resolveUrl: (u) => u.startsWith('/api/proxy') ? u : `/api/proxy/${u.split('/').pop()}`,
            canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'),
            callbacks: { onPlayerHit: () => setLives(l => Math.max(0, l - 1)) }
        });

        try {
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
        } catch (e) { console.error("Erreur script miroir", e); }

        return () => cancelAnimationFrame(frameIdRef.current);
    }, [engineStarted, loading]);

    const handleAnswer = (idx) => {
        const isCorrect = questions[currentQIdx].a === idx;
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);

        if (isCorrect) {
            setScore(s => s + 100);
            if (currentQIdx + 1 < questions.length) setCurrentQIdx(q => q + 1);
            else { alert("VICTOIRE !"); onExit(); }
        } else {
            if (lives <= 1) { alert("PERDU..."); onExit(); }
        }
    };

    return (
        <div className="game-player-fullscreen bg-slate-950 flex flex-col items-center justify-center">
            <div className="absolute top-6 left-6 text-2xl">{"❤️".repeat(lives)}</div>
            <div className="absolute top-6 right-6 text-white font-black uppercase text-xs">Score: {score}</div>
            
            <canvas ref={canvasRef} width={800} height={450} className="rounded-xl shadow-2xl bg-black border-4 border-slate-800 mb-8" />

            {questions[currentQIdx] && (
                <div className="w-full max-w-4xl px-10 animate-in slide-in-from-bottom">
                    <div className="bg-white p-6 rounded-2xl text-center font-black text-xl mb-4 shadow-xl">{questions[currentQIdx].q}</div>
                    <div className="grid grid-cols-2 gap-4">
                        {questions[currentQIdx].options.map((o, i) => (
                            <button key={i} onClick={() => handleAnswer(i)} className="bg-indigo-600 text-white py-4 rounded-xl font-black uppercase hover:bg-indigo-500 shadow-lg">{o}</button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
