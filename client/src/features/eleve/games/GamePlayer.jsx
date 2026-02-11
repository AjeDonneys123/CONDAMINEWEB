// @signatures: GamePlayer, initGame, handleAnswer
import React, { useState, useEffect, useRef } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

/**
 * 🕹️ LECTEUR MIROIR V105 (ZÉRO CRASH)
 * Fix : Si le code est absent, injecte un moteur de zombie par défaut.
 */
export default function GamePlayer({ user, gameData, onExit }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const projectRef = useRef(null);

    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [lives, setLives] = useState(4);
    const [score, setScore] = useState(0);
    const [feedback, setFeedback] = useState(null);

    const levels = gameData?.levels || [];
    const questions = levels[0]?.questions || [];

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    // 1. PRÉPARATION DU PROJET ET ASSETS
    useEffect(() => {
        const load = async () => {
            try {
                if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                
                // On s'assure d'avoir une structure de projet valide
                const p = { ...gameData };
                if (!p.scenes || p.scenes.length === 0) {
                    p.scenes = [{ name: "Default", actors: [
                        { id: "actor-hero", name: "HEROS", initialX: 15, initialY: 70, actions: [] },
                        { id: "actor-zombie", name: "ZOMBIE", initialX: 90, initialY: 70, actions: [] }
                    ], backdrops: [], globalSounds: [] }];
                }
                projectRef.current = p;

                const scene = p.scenes[0];
                const imgUrls = [...new Set(
                    (scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url)))
                    .concat((scene.backdrops || []).map(b => b.url))
                )].filter(Boolean);

                await Promise.all(imgUrls.map(url => new Promise(resolve => {
                    const img = new Image(); img.crossOrigin = "anonymous";
                    img.onload = () => { imageAssetsRef.current.set(resolveUrl(url), img); resolve(); };
                    img.onerror = resolve;
                    img.src = resolveUrl(url);
                })));

                setLoading(false);
                setEngineStarted(true);
            } catch (e) { console.error("Loader Error", e); }
        };
        load();
        return () => { if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [gameData]);

    // 2. DÉMARRAGE DU MOTEUR
    useEffect(() => {
        if (!engineStarted || !canvasRef.current || loading) return;

        try {
            const MiniGameBase = createGameBase({
                audioBuffers: audioBuffersRef.current,
                audioCtx: audioCtxRef.current,
                projectRef, sceneIdx: 0,
                imageAssets: imageAssetsRef.current,
                resolveUrl, canvas: canvasRef.current,
                ctx: canvasRef.current.getContext('2d'),
                callbacks: { onPlayerHit: () => setLives(l => Math.max(0, l - 1)) }
            });

            // Injection du code ou script de secours
            let userCode = gameData.generatedCode || "";
            if (userCode.length < 50) {
                userCode = `class MiniGame extends MiniGameBase { 
                    constructor(c,a,cb){ super(c,a,cb); this.zX=100; }
                    start(){ if(this.HEROS) this.HEROS.play("IDLE"); if(this.ZOMBIE) this.ZOMBIE.play("AVANCER"); }
                    update(){ this.zX -= 0.1; if(this.ZOMBIE) this.ZOMBIE.x = this.zX; if(this.zX < 20){ this.zX=100; this.callbacks.onPlayerHit(); } }
                }`;
            }

            const factory = new Function('MiniGameBase', `${userCode}\nreturn MiniGame;`);
            const GameClass = factory(MiniGameBase);
            const instance = new GameClass(canvasRef.current, {}, {});
            gameInstanceRef.current = instance;
            if (instance.start) instance.start();

            const tick = () => {
                if (!gameInstanceRef.current) return;
                gameInstanceRef.current.isBossPhase = (currentQIdx > 0 && currentQIdx % 3 === 0);
                if (instance.update) instance.update();
                if (instance._render) instance._render();
                if (instance.draw) instance.draw();
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (err) { console.error("Engine Crash", err); }

        return () => { if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
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
                if (currentQIdx + 1 < questions.length) setCurrentQIdx(q => q + 1);
                else { alert("VICTOIRE !"); onExit(); }
            } else {
                if (lives <= 1) { alert("GAME OVER"); onExit(); }
            }
        }, 800);
    };

    return (
        <div className="game-player-fullscreen bg-slate-950 flex flex-col items-center justify-center">
            <div className="absolute top-6 left-6 text-2xl">{"❤️".repeat(lives)}</div>
            <div className="absolute top-6 right-6 text-white font-black uppercase text-xs">Score: {score}</div>
            
            <canvas ref={canvasRef} width={800} height={450} className="rounded-xl shadow-2xl bg-black border-4 border-slate-800" />

            {questions[currentQIdx] && (
                <div className="mt-10 w-full max-w-4xl px-10 animate-in slide-in-from-bottom">
                    <div className="bg-white p-6 rounded-2xl text-center font-black text-xl mb-4 shadow-xl">
                        {feedback === 'GOOD' ? '✅ BRAVO !' : feedback === 'BAD' ? '❌ FAUX !' : questions[currentQIdx].q}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {questions[currentQIdx].options.map((o, i) => (
                            <button key={i} onClick={() => handleAnswer(i)} className="bg-indigo-600 text-white py-4 rounded-xl font-black uppercase hover:bg-indigo-50 shadow-lg">{o}</button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
