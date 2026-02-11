// @signatures: GamePlayer, handleStartGame, triggerWin, triggerGameOver, FALLBACK_SCRIPT
import React, { useState, useEffect, useRef } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

/**
 * 🛡️ SCRIPT DE SÉCURITÉ (ZOMBIE STANDBY)
 * Utilisé si le code du prof est manquant ou corrompu.
 */
const FALLBACK_SCRIPT = `
class MiniGame extends MiniGameBase {
    constructor(canvas, assets, callbacks) {
        super(canvas, assets, callbacks);
        this.zombieX = 100;
        this.projectiles = [];
    }
    start() {
        if(this.HEROS) { this.HEROS.x = 15; this.HEROS.y = 70; this.HEROS.play("IDLE"); }
        if(this.ZOMBIE) { this.ZOMBIE.x = 100; this.ZOMBIE.y = 70; this.ZOMBIE.play("AVANCER"); }
    }
    onResult(isCorrect) {
        if(isCorrect && this.HEROS) {
            this.HEROS.play("TIRER", false);
            this.projectiles.push({ x: 20, y: 65 });
        }
    }
    update() {
        this.zombieX -= 0.15;
        if(this.ZOMBIE) this.ZOMBIE.x = this.zombieX;
        if(this.zombieX < 20) {
            if(this.callbacks.onPlayerHit) this.callbacks.onPlayerHit();
            this.zombieX = 100;
        }
        this.projectiles.forEach(p => p.x += 2);
    }
    draw() {
        this.ctx.fillStyle = "white";
        this.ctx.font = "12px Arial";
        if (this.projectiles.length === 0) {
            this.ctx.fillText("SYSTÈME PRÊT : EN ATTENTE DE RÉPONSE", 10, 20);
        }
    }
}
`;

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
    const projectRef = useRef(gameData);

    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [lives, setLives] = useState(4);
    const [score, setScore] = useState(0);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [feedback, setFeedback] = useState(null);

    const levels = gameData.levels || [];
    const currentLevelData = levels[currentLevelIdx] || {};
    const questions = currentLevelData.questions || [];

    useEffect(() => {
        const loadAssets = async () => {
            try {
                if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                
                // Préparation d'une scène par défaut si vide
                const project = { ...gameData };
                if (!project.scenes || project.scenes.length === 0) {
                    project.scenes = [{ 
                        name: "Default", actors: [
                            { id: "actor-hero", name: "HEROS", initialX: 15, initialY: 70, actions: [] },
                            { id: "actor-zombie", name: "ZOMBIE", initialX: 90, initialY: 70, actions: [] }
                        ], backdrops: [], globalSounds: [] 
                    }];
                    projectRef.current = project;
                }

                const scene = project.scenes[0];
                
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
            } catch (e) {
                console.error("Asset Load Error", e);
                setLoading(false);
            }
        };
        loadAssets();
    }, [gameData]);

    const handleStartGame = () => {
        setShowIntro(false);
        setEngineStarted(true);
    };

    useEffect(() => {
        if (!engineStarted || !canvasRef.current || loading) return;

        try {
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

            // 🛡️ INJECTION SÉCURISÉE V2
            const rawCode = (gameData.generatedCode && gameData.generatedCode.trim().length > 50) 
                ? gameData.generatedCode 
                : FALLBACK_SCRIPT;

            const safeInjectedCode = `
                ${rawCode}
                if (typeof MiniGame === 'undefined') {
                    ${FALLBACK_SCRIPT}
                }
                return MiniGame;
            `;

            const UserGameClass = new Function('MiniGameBase', safeInjectedCode)(MiniGameBase);
            const instance = new UserGameClass(canvasRef.current, {}, {});
            gameInstanceRef.current = instance;
            if (instance.start) instance.start();

            const tick = () => {
                if (!gameInstanceRef.current) return;
                if (instance.update) instance.update();
                if (instance._render) instance._render();
                if (instance.draw) instance.draw();
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (err) {
            console.error("Critical Engine Boot Failure:", err);
        }

        return () => {
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
        };
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
                else triggerWin();
            } else {
                if (lives <= 1) triggerGameOver();
            }
        }, 1000);
    };

    const triggerWin = () => { alert("VICTOIRE !"); saveAndExit(1); };
    const triggerGameOver = () => { alert("GAME OVER..."); saveAndExit(0); };

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
                    <h1 className="text-4xl font-black text-white uppercase mb-8">{gameData.title || "DÉFI CONDAMINE"}</h1>
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
                                    <button key={i} onClick={() => handleAnswer(i)} className="bg-indigo-600 text-white py-4 rounded-xl font-black uppercase hover:bg-indigo-50 shadow-lg">
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
