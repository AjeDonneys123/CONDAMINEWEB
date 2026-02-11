// @signatures: GameEngine, handleBarCheat, handleMuteToggle, initLevel, handleAnswerClick, triggerWinSequence, handleStartGame
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';
import { api } from '../../../../services/api';
import { createGameBase } from '../../../../services/gameCore';

// --- ZOMBIE V9.9 : LOGIQUE CORRIGÉE (DÉGÂTS + SONS) ---
const ZOMBIE_GAME_CODE = `
class MiniGame extends MiniGameBase {
    constructor(canvas, assets, callbacks) {
        super(canvas, assets, callbacks);
        this.projectiles = [];
        this.zombieX = 100;
        this.zombieState = "WALKING"; 
        this.heroState = "IDLE";
        this.heroTimer = 0;
        this.hasDealtDamage = false; // ANTI-SPAM DÉGÂTS
        this.isStopped = false;
        this.baseSpeed = 0.15;
    }

    start() { 
        this.isStopped = false;
        if(this.HEROS) { 
            this.HEROS.x = 15; 
            this.HEROS.y = 70; 
            this.HEROS.play("IDLE", true); 
        } 
        this.resetZombie();
    }

    resetZombie() {
        this.zombieX = 100;
        this.zombieState = "WALKING";
        this.hasDealtDamage = false; // RESET DÉGÂTS
        if(this.ZOMBIE) {
            this.ZOMBIE.x = 100;
            this.ZOMBIE.play("AVANCER", true);
        }
    }

    onResult(isCorrect) {
        if (this.heroState === "HIT") return;
        if (isCorrect && this.HEROS) {
            this.HEROS.play("TIRER", false);
            this.heroState = "SHOOT";
            this.heroTimer = 40;
            this.projectiles.push({ x: this.HEROS.x + 5, y: this.HEROS.y - 5 });
        }
    }

    update() {
        if (this.isStopped) return;

        // BOSS SCALING
        if (this.ZOMBIE) this.ZOMBIE.scale = this.isBossPhase ? this.ZOMBIE.baseScale * 1.6 : this.ZOMBIE.baseScale;

        // HERO LOGIC
        if (this.heroState === "SHOOT" || this.heroState === "HIT") {
            this.heroTimer--;
            if (this.heroTimer <= 0) {
                this.heroState = "IDLE";
                if(this.HEROS) this.HEROS.play("IDLE", true);
            }
        }

        // ZOMBIE LOGIC
        if (this.zombieState === "WALKING") {
            let speed = this.isBossPhase ? this.baseSpeed * 0.5 : this.baseSpeed;
            this.zombieX -= speed;
            
            // DÉCLENCHEMENT ATTAQUE
            if (this.zombieX < 20) {
                this.zombieState = "ATTACKING";
                this.hasDealtDamage = false; // PRÊT À FRAPPER
                if (this.ZOMBIE) {
                    this.ZOMBIE.x = 20;
                    this.ZOMBIE.play("TAPER", false);
                }
            } else if (this.ZOMBIE) {
                this.ZOMBIE.x = this.zombieX;
            }
        } 
        else if (this.zombieState === "ATTACKING") {
            // COUP AU MOMENT DE L'IMPACT (Frame 1)
            if (this.ZOMBIE && this.ZOMBIE.frameIdx >= 1 && !this.hasDealtDamage) {
                this.hasDealtDamage = true;
                if (this.heroState !== "HIT") {
                    if (this.HEROS) {
                        this.HEROS.play("TOUCHE", false);
                        this.heroState = "HIT";
                        this.heroTimer = 60;
                    }
                    // SIGNAL AU MOTEUR REACT
                    if (this.callbacks.onPlayerHit) this.callbacks.onPlayerHit();
                }
            }
            if (this.ZOMBIE && this.ZOMBIE.isAnimFinished) this.resetZombie();
        } 
        else if (this.zombieState === "HIT") {
            this.zombieX += 0.5;
            if (this.ZOMBIE) {
                this.ZOMBIE.x = this.zombieX;
                if (this.ZOMBIE.isAnimFinished) this.resetZombie();
            }
        }

        // PROJECTILES
        for (let i = this.projectiles.length - 1; i >= 0; i--) { 
            let p = this.projectiles[i]; 
            p.x += 3;
            if (this.zombieState === "WALKING" && p.x > this.zombieX - 5 && p.x < this.zombieX + 5) {
                this.projectiles.splice(i, 1);
                this.zombieState = "HIT";
                if (this.ZOMBIE) this.ZOMBIE.play("TOUCHE", false); 
            } 
            else if (p.x > 110) { this.projectiles.splice(i, 1); }
        }
    }

    draw() {
        if (this.isStopped) return;
        const ctx = this.ctx;
        this.projectiles.forEach(p => { 
            if (this.isBossPhase) {
                ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = "#f59e0b"; ctx.font = "50px Arial";
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("🔥", (p.x/100)*this.canvas.width, (p.y/100)*this.canvas.height);
                ctx.restore();
            } else {
                ctx.fillStyle = "#f97316"; ctx.beginPath(); 
                ctx.arc((p.x/100)*this.canvas.width, (p.y/100)*this.canvas.height, 10, 0, Math.PI*2); 
                ctx.fill(); 
            }
        });
    }
}
`;

export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState("");
    const [debugLogs, setDebugLogs] = useState([]);
    
    // Etats Quiz
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(-1);
    const [lives, setLives] = useState(4);
    const [feedback, setFeedback] = useState(null);
    const [isMuted, setIsMuted] = useState(false);

    // Etats Visuels
    const [isLevelWon, setIsLevelWon] = useState(false);
    const isLevelWonRef = useRef(false);
    const [isPowerOff, setIsPowerOff] = useState(false);
    
    // Refs Engine
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const keysPressed = useRef({});
    
    const projectRef = useRef(project);
    const bossModeRef = useRef(false);
    const isMutedRef = useRef(false);

    useEffect(() => { projectRef.current = project; }, [project]);

    // 1. INIT QUIZ & EVENTS
    useEffect(() => {
        api.get('/games/test-data').then(data => {
            const levelsData = data?.levels?.length > 0 ? data.levels : [{ 
                name: "Test Default", 
                questions: [{ q: "Quelle est la capitale ?", options: ["Lyon", "Paris", "Marseille", "Lille"], a: 1 }] 
            }];
            setAllLevels(levelsData);
            initLevel(0, levelsData);
        });

        const handleKeyDown = (e) => { keysPressed.current[e.code] = true; };
        const handleKeyUp = (e) => { keysPressed.current[e.code] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    const initLevel = (idx, sourceData) => {
        if (!sourceData[idx]) return;
        const questions = sourceData[idx].questions || [];
        setCurrentLevelIdx(idx);
        setLevelQuestions(questions);
        setQuestionStates(new Array(questions.length).fill(0));
        setIsLevelWon(false);
        isLevelWonRef.current = false;
        setIsPowerOff(false);
        if (questions.length > 0) setCurrentQIndex(0);
    };

    // 2. ASSET LOADING
    useEffect(() => {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        const scene = project.scenes?.[activeSceneIdx];
        if (!scene) { setIsReady(true); return; }

        const imgUrls = [...new Set(
            (scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url)))
            .concat((scene.backdrops || []).map(b => b.url))
        )].filter(Boolean);

        let loaded = 0;
        const total = imgUrls.length;

        if (total === 0) setIsReady(true);

        imgUrls.forEach(url => {
            const img = new Image(); 
            img.crossOrigin = "anonymous";
            const resolvedKey = resolveUrl(url); // CLÉ HARMONISÉE

            img.onload = () => {
                imageAssetsRef.current.set(resolvedKey, img);
                loaded++;
                setLoadProgress(`${Math.round(loaded/total*100)}%`);
                if (loaded >= total) setIsReady(true);
            };
            img.onerror = () => {
                console.error("❌ Img error:", resolvedKey);
                loaded++;
                if (loaded >= total) setIsReady(true);
            };
            img.src = resolvedKey;
        });

        const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
        sndUrls.forEach(url => {
            SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                if (buf) audioBuffersRef.current.set(resolveUrl(url), buf);
            });
        });

        return () => { if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [project]);

    // 3. LOGIQUE JEU
    useEffect(() => {
        const isBoss = (currentQIndex !== -1 && (questionStates[currentQIndex] || 0) >= 2);
        bossModeRef.current = isBoss;
        if (gameInstanceRef.current) gameInstanceRef.current.isBossPhase = isBoss;
    }, [currentQIndex, questionStates]);

    const handleAnswerClick = (choiceIdx) => {
        if (feedback || currentQIndex === -1 || isLevelWonRef.current) return;
        const isCorrect = levelQuestions[currentQIndex].a === choiceIdx;
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');

        const newStates = [...questionStates];
        if (isCorrect) {
            newStates[currentQIndex] = Math.min(3, newStates[currentQIndex] + 1);
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(true);
        } else {
            newStates[currentQIndex] = Math.max(0, newStates[currentQIndex] - 1);
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(false);
            setLives(l => Math.max(0, l - 1));
        }
        setQuestionStates(newStates);

        setTimeout(() => {
            setFeedback(null);
            const available = newStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
            if (available.length > 0) {
                const others = available.filter(idx => idx !== currentQIndex);
                setCurrentQIndex(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : available[0]);
            } else {
                triggerWinSequence();
            }
        }, 1000);
    };

    // --- CHEAT CODE (CLICK BAR) ---
    const handleBarCheat = (qIdx) => {
        const newStates = [...questionStates];
        newStates[qIdx] = (newStates[qIdx] + 1) % 4; // Cycle 0 -> 1 -> 2 -> 3 -> 0
        setQuestionStates(newStates);
        // Si on passe à 3, on vérifie la victoire
        if (newStates.every(s => s >= 3)) triggerWinSequence();
        else if (newStates[qIdx] < 3) setCurrentQIndex(qIdx);
    };

    // --- MUTE ---
    const handleMuteToggle = () => {
        const newVal = !isMuted;
        setIsMuted(newVal);
        isMutedRef.current = newVal;
        if (newVal && audioCtxRef.current) audioCtxRef.current.suspend();
        if (!newVal && audioCtxRef.current) audioCtxRef.current.resume();
    };

    // --- PLAY SOUND (RÉPARÉ) ---
    const playParallelSoundImpl = (url) => {
        if (isMutedRef.current || !audioCtxRef.current) return;
        const buffer = audioBuffersRef.current.get(resolveUrl(url)); // Clé harmonisée
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

    const triggerWinSequence = () => {
        setIsLevelWon(true);
        isLevelWonRef.current = true;
        setTimeout(() => setIsPowerOff(true), 1500);
        setTimeout(() => {
            if (allLevels[currentLevelIdx + 1]) initLevel(currentLevelIdx + 1, allLevels);
            else { alert("🎉 JEU TERMINÉ !"); onStop(); }
        }, 4000);
    };

    const handleStartGame = async () => {
        if (audioCtxRef.current) await audioCtxRef.current.resume();
        setEngineStarted(true);
    };

    // 4. INSTANCIATION MOTEUR
    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;

        try {
            const MiniGameBase = createGameBase({ 
                audioBuffers: audioBuffersRef.current, 
                audioCtx: audioCtxRef.current, 
                projectRef, 
                sceneIdx: activeSceneIdx, 
                imageAssets: imageAssetsRef.current, 
                resolveUrl, 
                canvas: canvasRef.current, 
                ctx: canvasRef.current.getContext('2d'), 
                isMutedRef, 
                playParallelSound: playParallelSoundImpl, // Foncteur passé au service
                callbacks: {
                    onPlayerHit: () => { 
                        if (!isLevelWonRef.current) setLives(l => Math.max(0, l - 1)); 
                    }
                }
            });

            const actualCode = code && code.length > 50 ? code : ZOMBIE_GAME_CODE;
            const UserCodeFactory = new Function('MiniGameBase', `${actualCode}\nreturn MiniGame;`);
            const UserGameClass = UserCodeFactory(MiniGameBase);
            
            const instance = new UserGameClass(canvasRef.current, {}, {});
            gameInstanceRef.current = instance;

            if (instance.start) instance.start();
            
            const tick = () => {
                if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                instance.isBossPhase = bossModeRef.current;
                
                if (instance.update) instance.update();
                if (instance._render) instance._render(); 
                if (instance.draw) instance.draw(); 
                
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();

        } catch (e) {
            console.error("CRASH MOTEUR:", e);
            alert("Erreur dans le code du jeu. Vérifiez la console.");
        }
        return () => { if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted]);

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
             <button onClick={onStop} className="absolute top-6 right-6 bg-red-600 text-white w-12 h-12 rounded-full font-black text-2xl shadow-xl border-4 border-white hover:scale-110 transition-all flex items-center justify-center pointer-events-auto z-50">✕</button>

             {!engineStarted ? (
                 <button 
                    onClick={handleStartGame} 
                    disabled={!isReady}
                    className={`px-20 py-10 rounded-full font-black text-5xl shadow-2xl border-8 transition-all ${isReady ? 'bg-white text-indigo-600 border-indigo-200 hover:scale-110 animate-pulse' : 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed'}`}
                 >
                    {isReady ? "🚀 JOUER" : `CHARGEMENT ${loadProgress}...`}
                 </button>
             ) : (
                <>
                    <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                        
                        {/* VIES + MUTE */}
                        <div className="flex gap-4 pointer-events-auto">
                            <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl flex gap-1">
                                {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                            </div>
                            <button onClick={handleMuteToggle} className="bg-slate-900/80 w-14 h-14 rounded-2xl border-2 border-slate-700 text-2xl flex items-center justify-center text-white hover:bg-slate-800">
                                {isMuted ? '🔇' : '🔊'}
                            </button>
                        </div>

                        <div className="flex-1 flex justify-center px-4">
                            {levelQuestions[currentQIndex] && !isLevelWon && (
                                <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto animate-in slide-in-from-top">
                                    {feedback === 'CORRECT' ? "✅ BRAVO !" : feedback === 'WRONG' ? "❌ RATÉ..." : levelQuestions[currentQIndex].q}
                                </div>
                            )}
                        </div>

                        {/* BARRES DE PROGRESSION (CLIQUABLES POUR CHEAT) */}
                        <div className="flex gap-2 items-center pointer-events-auto mr-20">
                            {questionStates.map((mastery, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => handleBarCheat(idx)}
                                    className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden transition-all cursor-pointer hover:border-white ${currentQIndex === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-60'}`}
                                >
                                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in">
                        <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 border-slate-800 rounded-xl transition-opacity duration-1000 ${isPowerOff ? 'opacity-0' : 'opacity-100'}`} />
                        {isLevelWon && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-xl animate-in zoom-in z-40">
                                <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center border-8 border-green-500">
                                    <span className="text-6xl block mb-4">🏆</span>
                                    <h2 className="text-4xl font-black text-slate-800 uppercase">Niveau Réussi !</h2>
                                </div>
                            </div>
                        )}
                    </div>

                    {!isLevelWon && !isPowerOff && levelQuestions[currentQIndex] && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                                {levelQuestions[currentQIndex].options.map((o, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => handleAnswerClick(i)} 
                                        className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-indigo-500 hover:scale-105 transition-all border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2"
                                    >
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
