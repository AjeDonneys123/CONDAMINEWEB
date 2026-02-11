// @signatures: GamePlayer, initGame, loadSounds
import React, { useEffect, useRef, useState } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert'; // ✅ IMPORT RESTAURÉ

export default function GamePlayer({ user, gameData, onExit }) {
    const canvasRef = useRef(null);
    const gameInstance = useRef(null);
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const isMutedRef = useRef(false);

    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [gameOver, setGameOver] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Extraction des niveaux/questions
    const allQuestions = gameData.levels?.flatMap(l => l.questions) || [];

    useEffect(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (canvasRef.current && !gameInstance.current) {
            initGame();
        }
        return () => {
            if (gameInstance.current) {
                // Nettoyage si besoin
                if(gameInstance.current.stop) gameInstance.current.stop();
            }
            if(audioCtxRef.current) audioCtxRef.current.suspend();
        };
    }, []);

    const playParallelSoundImpl = (url) => {
        if (isMutedRef.current || !audioCtxRef.current) return;
        
        // Résolution URL
        const fullUrl = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
        
        const buffer = audioBuffersRef.current.get(fullUrl);
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

    const initGame = async () => {
        setLoading(true);
        try {
            // 1. Préparation des Images
            const scene = gameData.scenes?.[0];
            if (scene) {
                const imgResources = (scene.actors || []).flatMap(a => 
                    (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))
                ).concat((scene.backdrops || []).map(b => b.url));

                await Promise.all([...new Set(imgResources)].filter(Boolean).map(url => new Promise(resolve => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    const fullUrl = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
                    img.src = fullUrl;
                    img.onload = () => { imageAssetsRef.current.set(fullUrl, img); resolve(); };
                    img.onerror = resolve;
                })));

                // 2. Préparation des Sons (NOUVEAU)
                const sndResources = (scene.actors || []).flatMap(a => 
                    (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))
                ).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url)));

                await Promise.all([...new Set(sndResources)].filter(Boolean).map(async url => {
                    const fullUrl = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
                    const buffer = await SoundExpert.decodeAudio(fullUrl, audioCtxRef.current);
                    if(buffer) audioBuffersRef.current.set(fullUrl, buffer);
                }));
            }

            // 3. Injection du Code Studio (Moteur V8.1)
            const gameCallbacks = {
                onPlayerHit: handleLifeLost,
                onLevelWin: () => {} 
            };

            // Création de la classe de base via le noyau partagé
            const MiniGameBase = createGameBase({
                audioBuffers: audioBuffersRef.current,
                audioCtx: audioCtxRef.current,
                projectRef: { current: gameData }, // Mock de la ref projet
                sceneIdx: 0,
                imageAssets: imageAssetsRef.current,
                resolveUrl: (u) => u.startsWith('/api/proxy') ? u : `/api/proxy/${u.split('/').pop()}`,
                canvas: canvasRef.current,
                ctx: canvasRef.current.getContext('2d'),
                isMutedRef,
                playParallelSound: playParallelSoundImpl,
                callbacks: gameCallbacks
            });

            // Instanciation de la classe enfant (le code généré par l'IA ou le prof)
            const code = gameData.generatedCode;
            const UserGameClass = new Function('MiniGameBase', `${code}\nreturn MiniGame;`)(MiniGameBase);

            // Démarrage
            gameInstance.current = new UserGameClass(canvasRef.current, {}, gameCallbacks);
            if (gameInstance.current.start) gameInstance.current.start();

            // Boucle de jeu
            const tick = () => {
                if(!gameInstance.current) return;
                
                // Mettre à jour les inputs si on avait des touches (ici simplifié)
                // gameInstance.current.keys = ...
                
                if (gameInstance.current.update) gameInstance.current.update();
                if (gameInstance.current._render) gameInstance.current._render(); // Rendu Moteur (Images)
                if (gameInstance.current.draw) gameInstance.current.draw(); // Rendu HUD (Texte)
                
                requestAnimationFrame(tick);
            };
            tick();

            // Premier round
            /* Le jeu démarre, on attend l'interaction */

        } catch (e) {
            console.error("❌ Erreur démarrage jeu élève :", e);
            alert("Erreur de chargement du jeu.");
            onExit();
        }
        setLoading(false);
    };

    // --- LOGIQUE MÉTIER ---

    const handleAnswer = (selectedIndex) => {
        if (gameOver) return;
        
        // Déclenchement Audio Context au premier clic (Anti-block browser)
        if(audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }

        const correctIndex = allQuestions[currentQIdx].a;
        const isCorrect = parseInt(selectedIndex) === parseInt(correctIndex);

        // 📡 ENVOI AU JEU
        if (gameInstance.current && gameInstance.current.onResult) {
            gameInstance.current.onResult(isCorrect);
        }

        if (isCorrect) {
            setScore(s => s + 100);
            setTimeout(() => {
                if (currentQIdx + 1 < allQuestions.length) {
                    setCurrentQIdx(prev => prev + 1);
                } else {
                    handleWin();
                }
            }, 1000);
        } else {
            handleLifeLost();
        }
    };

    const handleLifeLost = () => {
        setLives(prev => {
            const newLives = prev - 1;
            if (newLives <= 0) {
                setGameOver(true);
                saveResult(0);
            }
            return newLives;
        });
    };

    const handleWin = () => {
        setGameOver(true);
        saveResult(1);
        alert(`VICTOIRE ! Score: ${score}`);
        onExit();
    };

    const saveResult = async (successLvl) => {
        await fetch('/api/games/save-progress', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ 
                studentId: user._id || user.id, 
                gameId: gameData._id, 
                score: score,
                levelReached: successLvl 
            })
        });
        if(successLvl === 0) alert("GAME OVER...");
        onExit();
    };

    // --- UI ÉLÈVE (Boutons Quiz) ---
    const currentQ = allQuestions[currentQIdx];

    return (
        <div className="game-player-fullscreen">
            {loading && <div className="absolute inset-0 bg-black flex items-center justify-center text-white font-black z-50">CHARGEMENT...</div>}
            
            <canvas ref={canvasRef} width={800} height={450} className="game-canvas" />
            
            {/* UI HUD (Vies/Score) */}
            <div className="game-hud-overlay">
                <div className="hud-lives">❤️ {lives}</div>
                <div className="hud-score">🏆 {score}</div>
                <button onClick={onExit} className="hud-quit-btn">QUITTER</button>
            </div>

            {/* UI QUIZ (Questions) */}
            {!gameOver && currentQ && (
                <div className="game-quiz-ui">
                    <div className="quiz-question-box">{currentQ.q}</div>
                    <div className="quiz-options-grid">
                        {currentQ.options.map((opt, i) => (
                            <button key={i} onClick={() => handleAnswer(i)} className="quiz-option-btn">
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
