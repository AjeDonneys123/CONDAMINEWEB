// @signatures: GamePlayer, initGame, stopLoop
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
    const isRunningRef = useRef(true); // Sécurité pour arrêter la boucle

    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(4);

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    // 1. CHARGEMENT ASSETS
    useEffect(() => {
        isRunningRef.current = true;
        const load = async () => {
            try {
                if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                
                const scene = gameData.scenes?.[0] || { actors: [], backdrops: [] };
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
        return () => {
            isRunningRef.current = false;
            if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
        };
    }, [gameData]);

    // 2. DÉMARRAGE MOTEUR (BOUCLE CORRIGÉE)
    useEffect(() => {
        if (!engineStarted || !canvasRef.current || loading) return;

        try {
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

            // Fallback si pas de code
            let code = gameData.generatedCode || `class MiniGame extends MiniGameBase { start(){} update(){} }`;
            
            const factory = new Function('MiniGameBase', `${code}\nreturn MiniGame;`);
            const GameClass = factory(MiniGameBase);
            const instance = new GameClass(canvasRef.current, {}, {});
            gameInstanceRef.current = instance;
            if (instance.start) instance.start();

            // BOUCLE DE RENDU SÉCURISÉE
            const tick = () => {
                if (!isRunningRef.current || !gameInstanceRef.current) return;
                
                try {
                    if (instance.update) instance.update();
                    if (instance._render) instance._render();
                    if (instance.draw) instance.draw();
                } catch (loopErr) {
                    console.error("Runtime Error in Game Loop:", loopErr);
                    isRunningRef.current = false;
                    return;
                }
                
                frameIdRef.current = requestAnimationFrame(tick);
            };
            
            frameIdRef.current = requestAnimationFrame(tick);
        } catch (err) { console.error("Engine Crash", err); }

        return () => {
            isRunningRef.current = false;
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
        };
    }, [engineStarted, loading]);

    return (
        <div className="game-player-fullscreen bg-slate-950 flex flex-col items-center justify-center">
            <div className="absolute top-6 left-6 text-2xl">{"❤️".repeat(lives)}</div>
            <div className="absolute top-6 right-6 text-white font-black uppercase text-xs">Test Studio • Score: {score}</div>
            
            <canvas ref={canvasRef} width={800} height={450} className="rounded-xl shadow-2xl bg-black border-4 border-slate-800" />
            
            <button onClick={onExit} className="mt-8 px-10 py-4 bg-white text-slate-900 font-black rounded-2xl hover:bg-red-500 hover:text-white transition-colors uppercase">
                Terminer le test
            </button>
        </div>
    );
}
