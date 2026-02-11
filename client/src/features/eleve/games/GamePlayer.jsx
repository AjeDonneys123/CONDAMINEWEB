// @signatures: GamePlayer, initGame, loadAssets
import React, { useEffect, useRef, useState } from 'react';
import './GamePlayer.css';
import { createGameBase } from '../../../services/gameCore';
import SoundExpert from '../../../services/SoundExpert';

// SCRIPT DE SECOURS (ZOMBIE STANDARD) SI LE CODE BDD EST VIDE
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
        this.zombieX -= this.isBossPhase ? 0.05 : 0.15;
        if(this.ZOMBIE) this.ZOMBIE.x = this.zombieX;
        if(this.zombieX < 20) {
            if(this.callbacks.onPlayerHit) this.callbacks.onPlayerHit();
            this.zombieX = 100;
        }
        this.projectiles.forEach(p => p.x += 2);
    }
    draw() {
        this.ctx.fillStyle = "orange";
        this.projectiles.forEach(p => this.ctx.fillRect((p.x/100)*this.canvas.width, (p.y/100)*this.canvas.height, 10, 5));
    }
}
`;

export default function GamePlayer({ user, gameData, onExit }) {
    const canvasRef = useRef(null);
    const gameInstance = useRef(null);
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const isMutedRef = useRef(false);
    const frameIdRef = useRef(null);

    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(4);
    const [gameOver, setGameOver] = useState(false);
    const [loading, setLoading] = useState(true);
    
    const allQuestions = gameData.levels?.flatMap(l => l.questions) || gameData.questions || [];

    useEffect(() => {
        if (canvasRef.current && !gameInstance.current) {
            initGame();
        }
        return () => {
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
            if (audioCtxRef.current) audioCtxRef.current.suspend();
        };
    }, []);

    const initGame = async () => {
        setLoading(true);
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }

            // 1. CHARGEMENT DES IMAGES (Même logique que le Studio)
            const scene = gameData.scenes?.[0] || { actors: [], backdrops: [] };
            const imgResources = [...new Set(
                (scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url)))
                .concat((scene.backdrops || []).map(b => b.url))
            )].filter(Boolean);

            await Promise.all(imgResources.map(url => new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                const fullUrl = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
                img.src = fullUrl;
                img.onload = () => { imageAssetsRef.current.set(fullUrl, img); resolve(); };
                img.onerror = resolve;
            })));

            // 2. CHARGEMENT DES SONS
            const sndResources = [...new Set(
                (scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url)))
                .concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url)))
            )].filter(Boolean);

            await Promise.all(sndResources.map(async url => {
                const fullUrl = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
                const buffer = await SoundExpert.decodeAudio(fullUrl, audioCtxRef.current);
                if(buffer) audioBuffersRef.current.set(fullUrl, buffer);
            }));

            // 3. INITIALISATION MOTEUR SHARED V8.1
            const MiniGameBase = createGameBase({
                audioBuffers: audioBuffersRef.current,
                audioCtx: audioCtxRef.current,
                projectRef: { current: gameData }, 
                sceneIdx: 0,
                imageAssets: imageAssetsRef.current,
                resolveUrl: (u) => u.startsWith('/api/proxy') ? u : `/api/proxy/${u.split('/').pop()}`,
                canvas: canvasRef.current,
                ctx: canvasRef.current.getContext('2d'),
                isMutedRef,
                callbacks: { onPlayerHit: () => setLives(prev => prev - 1) }
            });

            // 4. INJECTION DU CODE (SÉCURISÉ)
            const codeToInject = (gameData.generatedCode && gameData.generatedCode.length > 50) 
                ? gameData.generatedCode 
                : FALLBACK_SCRIPT;

            try {
                const UserGameClass = new Function('MiniGameBase', `${codeToInject}\nreturn MiniGame;`)(MiniGameBase);
                gameInstance.current = new UserGameClass(canvasRef.current, {}, {});
                if (gameInstance.current.start) gameInstance.current.start();
            } catch (evalErr) {
                console.error("❌ Erreur Eval Script:", evalErr);
                // Si le code custom crash, on force le fallback
                const FallbackClass = new Function('MiniGameBase', `${FALLBACK_SCRIPT}\nreturn MiniGame;`)(MiniGameBase);
                gameInstance.current = new FallbackClass(canvasRef.current, {}, {});
                if (gameInstance.current.start) gameInstance.current.start();
            }

            // 5. BOUCLE
            const tick = () => {
                if(!gameInstance.current) return;
                gameInstance.current.isBossPhase = (currentQIdx !== -1 && (currentQIdx % 3 === 0 && currentQIdx !== 0)); 
                if (gameInstance.current.update) gameInstance.current.update();
                if (gameInstance.current._render) gameInstance.current._render();
                if (gameInstance.current.draw) gameInstance.current.draw();
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();

        } catch (e) {
            console.error("❌ Erreur démarrage jeu élève :", e);
            alert("Problème technique avec ce jeu.");
            onExit();
        }
        setLoading(false);
    };

    // --- LOGIQUE QUIZ ---
    const handleAnswer = (idx) => {
        if (gameOver) return;
        const isCorrect = idx === allQuestions[currentQIdx]?.a;
        
        if (gameInstance.current?.onResult) gameInstance.current.onResult(isCorrect);

        if (isCorrect) {
            setScore(s => s + 100);
            if (currentQIdx + 1 < allQuestions.length) {
                setTimeout(() => setCurrentQIdx(prev => prev + 1), 1000);
            } else {
                alert("VICTOIRE !");
                saveResult(1);
            }
        } else {
            setLives(l => {
                if (l <= 1) { saveResult(0); return 0; }
                return l - 1;
            });
        }
    };

    const saveResult = async (status) => {
        await fetch('/api/eleve/games/score', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ 
                studentId: user._id || user.id, 
                gameId: gameData._id, 
                score: score,
                levelReached: status 
            })
        });
        onExit();
    };

    const currentQ = allQuestions[currentQIdx];

    return (
        <div className="game-player-fullscreen">
            {loading && <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-white font-black z-50">CHARGEMENT...</div>}
            
            <canvas ref={canvasRef} width={800} height={450} className="game-canvas" />
            
            <div className="game-hud-overlay">
                <div className="hud-lives">{"❤️".repeat(lives)}</div>
                <div className="hud-score">🏆 {score}</div>
                <button onClick={onExit} className="hud-quit-btn">✕</button>
            </div>

            {!loading && currentQ && (
                <div className="game-quiz-ui animate-in slide-in-from-bottom">
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
