// @signatures: UnifiedMoteur, handleAnswerClick, triggerWinSequence, startCurrentLevel, getEmbedUrl, checkAnswerPermissive, triggerGlobalEvent, playParallelSoundImpl, normalize, getYoutubeEmbed
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from '../../../services/SoundExpert';
import { api } from '../../../services/api';
import { createGameBase } from '../../../services/gameCore';

/**
 * 🧠 LE MAITRE UNIFIÉ V.3.02 (ASSET LOADING REVERT)
 * VERSION : V.3.02
 * CORRECTIF : Simplification radicale du chargement des assets pour éviter l'écran noir.
 * Suppression du hash d'assets qui pouvait bloquer le chargement initial.
 */

const ZOMBIE_GAME_CODE = `
class MiniGame extends MiniGameBase {
    constructor(canvas, assets, callbacks) {
        super(canvas, assets, callbacks);
        this.projectiles = [];
        this.zombieX = 100;
        this.zombieState = "WALKING"; 
        this.heroState = "IDLE";
        this.heroTimer = 0;
        this.hasDealtDamage = false;
        this.isStopped = false;
        this.baseSpeed = 0.15;
    }
    start() { 
        this.isStopped = false;
        if(this.HEROS) { this.HEROS.x = 15; this.HEROS.y = 70; this.HEROS.play("IDLE", true); } 
        this.resetZombie();
    }
    resetZombie() {
        this.zombieX = 100; this.zombieState = "WALKING"; this.hasDealtDamage = false;
        if(this.ZOMBIE) { this.ZOMBIE.x = 100; this.ZOMBIE.play("AVANCER", true); }
    }
    onResult(isCorrect) {
        if (this.heroState === "HIT") return;
        if (isCorrect && this.HEROS) {
            this.HEROS.play("TIRER", false);
            this.heroState = "SHOOT"; this.heroTimer = 40;
            this.projectiles.push({ x: this.HEROS.x + 5, y: this.HEROS.y - 5 });
        }
    }
    update() {
        if (this.isStopped) return;
        if (this.ZOMBIE) {
            const targetScale = this.isBossPhase ? this.ZOMBIE.baseScale * 1.6 : this.ZOMBIE.baseScale;
            this.ZOMBIE.scale += (targetScale - this.ZOMBIE.scale) * 0.1;
        }

        if (this.heroState === "SHOOT" || this.heroState === "HIT") {
            this.heroTimer--;
            if (this.heroTimer <= 0) { this.heroState = "IDLE"; if(this.HEROS) this.HEROS.play("IDLE", true); }
        }
        if (this.zombieState === "WALKING") {
            let speed = this.isBossPhase ? this.baseSpeed * 0.5 : this.baseSpeed;
            this.zombieX -= speed;
            if (this.zombieX < 20) {
                this.zombieState = "ATTACKING"; this.hasDealtDamage = false;
                if (this.ZOMBIE) { this.ZOMBIE.x = 20; this.ZOMBIE.play("TAPER", false); }
            } else if (this.ZOMBIE) { this.ZOMBIE.x = this.zombieX; }
        } 
        else if (this.zombieState === "ATTACKING") {
            if (this.ZOMBIE && this.ZOMBIE.frameIdx >= 1 && !this.hasDealtDamage) {
                this.hasDealtDamage = true;
                if (this.heroState !== "HIT") {
                    if (this.HEROS) { this.HEROS.play("TOUCHE", false); this.heroState = "HIT"; this.heroTimer = 60; }
                    if (this.callbacks && this.callbacks.onPlayerHit) this.callbacks.onPlayerHit();
                }
            }
            if (this.ZOMBIE && this.ZOMBIE.isAnimFinished) this.resetZombie();
        } 
        else if (this.zombieState === "HIT") {
            this.zombieX += 0.5;
            if (this.ZOMBIE) { this.ZOMBIE.x = this.zombieX; if (this.ZOMBIE.isAnimFinished) this.resetZombie(); }
        }
        for (let i = this.projectiles.length - 1; i >= 0; i--) { 
            let p = this.projectiles[i]; p.x += 3;
            if (this.zombieState === "WALKING" && p.x > this.zombieX - 5 && p.x < this.zombieX + 5) {
                this.projectiles.splice(i, 1); this.zombieState = "HIT";
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

export default function UnifiedMoteur({ gameData, onExit, isStudioTest = false }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState("");
    
    // --- ÉTATS ---
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(-1);
    const [lives, setLives] = useState(4);
    const [feedback, setFeedback] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [userInput, setUserInput] = useState("");

    // --- VISUELS ---
    const [showLevelIntro, setShowLevelIntro] = useState(true);
    const [showLevelBanner, setShowLevelBanner] = useState(false);
    const [showStageClear, setShowStageClear] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [showGameComplete, setShowGameComplete] = useState(false);
    const [zoomMedia, setZoomMedia] = useState(null);
    const [isPowerOff, setIsPowerOff] = useState(false);
    
    const [activeBossVisual, setActiveBossVisual] = useState(false);

    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const keysPressed = useRef({});
    const projectRef = useRef(gameData);
    const bossModeRef = useRef(false);

    // --- HELPER YOUTUBE ROBUSTE ---
    const getYoutubeEmbed = (url) => {
        if (!url) return "";
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        const id = (match && match[2].length === 11) ? match[2] : null;
        if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
        return url;
    };

    // --- EFFET DE SON : DÉPART DU NIVEAU ---
    useEffect(() => {
        if (showLevelBanner) {
            triggerGlobalEvent("DEPART"); 
        }
    }, [showLevelBanner]);

    // SYNC REF
    useEffect(() => { 
        projectRef.current = gameData; 
    }, [gameData]);

    useEffect(() => {
        const isBossNow = (currentQIndex !== -1 && (questionStates[currentQIndex] || 0) === 2);
        setActiveBossVisual(isBossNow);
        bossModeRef.current = isBossNow;
        if (gameInstanceRef.current) gameInstanceRef.current.isBossPhase = isBossNow;
    }, [currentQIndex, questionStates]);

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    const isCheatMode = () => keysPressed.current['KeyS'] && keysPressed.current['KeyT'];

    // 1. DATA LOADING
    useEffect(() => {
        const loadLogic = async () => {
            let levelsData = gameData?.levels || [];
            if (isStudioTest || levelsData.length === 0) {
                const res = await api.get('/games/test-data');
                levelsData = res?.levels?.length > 0 ? res.levels : [];
            }
            setAllLevels(levelsData);
            if (levelsData[currentLevelIdx]) {
                const qs = levelsData[currentLevelIdx].questions || [];
                setLevelQuestions(qs);
                setQuestionStates(new Array(qs.length).fill(0));
                setCurrentQIndex(0);
            }
        };
        loadLogic();
        const hDown = (e) => { keysPressed.current[e.code] = true; };
        const hUp = (e) => { keysPressed.current[e.code] = false; };
        window.addEventListener('keydown', hDown);
        window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, [gameData, currentLevelIdx]);

    // 2. ASSETS LOADING (METHODE SIMPLE ET ROBUSTE)
    useEffect(() => {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        console.log("📥 [MOTEUR] Analyse des assets...");
        const scene = projectRef.current?.scenes?.[0];
        
        // Si pas de scène, on considère que c'est prêt (mode dégradé)
        if (!scene) { setIsReady(true); return; }
        
        // 1. IMAGES
        const imgs = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
        
        let loadedImgs = 0;
        if (imgs.length === 0) {
            setIsReady(true);
        } else {
            imgs.forEach(url => {
                const img = new Image(); 
                img.crossOrigin = "anonymous"; 
                const rKey = resolveUrl(url);
                
                img.onload = () => { 
                    imageAssetsRef.current.set(rKey, img); 
                    loadedImgs++; 
                    setLoadProgress(`${Math.round(loadedImgs/imgs.length*100)}%`); 
                    if (loadedImgs >= imgs.length) setIsReady(true); 
                };
                
                img.onerror = () => { 
                    console.warn("Image error:", url); 
                    loadedImgs++; 
                    if (loadedImgs >= imgs.length) setIsReady(true); 
                };
                
                img.src = rKey;
            });
        }

        // 2. SONS
        const snds = [
            ...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))
        ].filter(Boolean);
        
        snds.forEach(url => { 
            SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => { 
                if (buf) audioBuffersRef.current.set(resolveUrl(url), buf); 
            }); 
        });
        
    }, [gameData]); // On recharge si gameData change complètement

    const playParallelSoundImpl = (url, forceAlways = false) => {
        if ((!engineStarted && !forceAlways) || isMuted || !audioCtxRef.current) return;
        const buffer = audioBuffersRef.current.get(resolveUrl(url));
        if (buffer) {
            try {
                if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
                const source = audioCtxRef.current.createBufferSource();
                source.buffer = buffer; 
                source.connect(audioCtxRef.current.destination);
                source.start(0);
            } catch(e) { console.error("Sound Play Error:", e); }
        }
    };

    const triggerGlobalEvent = (eventName) => {
        const scene = projectRef.current.scenes?.[0];
        if (!scene || !scene.globalSounds) return;
        const cleanTarget = eventName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const event = scene.globalSounds.find(g => 
            g.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() === cleanTarget
        );
        if (event && event.sounds) {
            event.sounds.forEach(snd => playParallelSoundImpl(snd.url, true));
        }
    };

    // 3. LOGIQUE QUIZ
    const handleAnswerClick = (val) => {
        if (feedback || currentQIndex === -1 || showLevelIntro || showStageClear) return;
        const currentQ = levelQuestions[currentQIndex];
        const clean = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '').trim();
        let isCorrect = (typeof val === 'number') ? currentQ.a === val : clean(val) === clean(currentQ.options[currentQ.a]);
        
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);

        const nextStates = [...questionStates];
        if (isCorrect) {
            nextStates[currentQIndex] = Math.min(3, nextStates[currentQIndex] + 1);
        } else {
            nextStates[currentQIndex] = Math.max(0, nextStates[currentQIndex] - 1);
            setLives(l => Math.max(0, l - 1));
        }
        
        setQuestionStates(nextStates);
        setUserInput("");

        setTimeout(() => {
            setFeedback(null);
            const available = nextStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
            if (available.length > 0) {
                if (isCorrect && nextStates[currentQIndex] === 2) {
                    const bossNow = true;
                    setActiveBossVisual(bossNow);
                    bossModeRef.current = bossNow;
                    if (gameInstanceRef.current) gameInstanceRef.current.isBossPhase = bossNow;
                } else {
                    const others = available.filter(idx => idx !== currentQIndex);
                    setCurrentQIndex(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : available[0]);
                }
            } else {
                triggerGlobalEvent("UPLEVEL");
                triggerWinSequence(); 
            }
        }, 1000);
    };

    const triggerWinSequence = () => {
        setShowStageClear(true);
        setTimeout(() => setIsPowerOff(true), 1500);
        setTimeout(() => {
            setEngineStarted(false); 
            setIsPowerOff(false); 
            setShowStageClear(false);
            if (allLevels[currentLevelIdx + 1]) {
                setCurrentLevelIdx(prev => prev + 1); 
                setShowLevelIntro(true); 
            } else { 
                triggerGlobalEvent("VICTOIRE");
                setShowGameComplete(true);
            }
        }, 3000);
    };

    const handleHeartClick = () => { if (isCheatMode()) setLives(l => Math.max(0, l - 1)); };
    const handleQuestionClick = () => { if (isCheatMode()) { triggerGlobalEvent("UPLEVEL"); triggerWinSequence(); } };
    const handleBarClick = (idx) => {
        if (isCheatMode()) {
            const nextStates = [...questionStates];
            nextStates[idx] = Math.min(3, nextStates[idx] + 1);
            setQuestionStates(nextStates);
            if (nextStates.every(s => s >= 3)) {
                triggerGlobalEvent("UPLEVEL");
                triggerWinSequence();
            }
        }
    };

    const handleRetry = () => { setShowGameOver(false); setLives(4); setEngineStarted(false); setShowLevelIntro(true); };
    
    const startCurrentLevel = async () => { 
        if (!isReady) return; 
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
        }
        setEngineStarted(true); 
        setShowLevelIntro(false); 
        setShowLevelBanner(true); 
        setTimeout(() => setShowLevelBanner(false), 1500); 
    };

    // 4. RENDU MOTEUR
    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;
        try {
            const MiniGameBase = createGameBase({ 
                audioBuffers: audioBuffersRef.current, 
                audioCtx: audioCtxRef.current, 
                projectRef, 
                sceneIdx: 0, 
                imageAssets: imageAssetsRef.current, 
                resolveUrl, 
                canvas: canvasRef.current, 
                ctx: canvasRef.current.getContext('2d'), 
                playParallelSound: playParallelSoundImpl, 
                callbacks: { 
                    onPlayerHit: () => { 
                        setLives(l => { 
                            const n = Math.max(0, l - 1); 
                            if (n === 0) {
                                setShowGameOver(true); 
                                triggerGlobalEvent("DEFAITE");
                            }
                            return n; 
                        }); 
                    } 
                } 
            });
            const factory = new Function('MiniGameBase', `${projectRef.current.generatedCode || ZOMBIE_GAME_CODE}\nreturn MiniGame;`);
            const instance = new (factory(MiniGameBase))(canvasRef.current, {}, null);
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
        } catch (e) { console.error("Moteur Crash:", e); }
        return () => { if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted]);

    const currentLevelData = allLevels[currentLevelIdx] || {};
    const safeQ = (levelQuestions && currentQIndex >= 0) ? levelQuestions[currentQIndex] : null;

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
            <div className="absolute top-2 left-4 px-3 py-1 bg-black/50 text-[10px] font-black text-yellow-500 rounded-full border border-yellow-500/30 z-[5000]">VERSION V.3.02 (ASSET SIMPLE)</div>
            <button onClick={onExit} className="absolute top-6 right-6 w-14 h-14 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-2xl font-black z-[4000] border-2 border-white/20">✕</button>

            {showLevelBanner && (
                <div className="fixed top-[20%] left-0 right-0 z-[5000] flex justify-center pointer-events-none animate-in fade-in zoom-in duration-300">
                    <span className="text-yellow-400 font-black text-6xl uppercase tracking-tighter italic drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">Niveau {currentLevelIdx + 1}</span>
                </div>
            )}

            {showStageClear && (
                <div className="fixed top-[40%] left-0 right-0 z-[5000] flex justify-center pointer-events-none animate-in zoom-in">
                    <span className="text-green-500 font-black text-8xl uppercase tracking-tighter italic drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]">STAGE CLEAR !</span>
                </div>
            )}

            {zoomMedia && (
                <div className="fixed inset-0 z-[6000] bg-black flex items-center justify-center p-0 animate-in fade-in duration-300" onClick={() => setZoomMedia(null)}>
                    <button className="absolute top-8 right-8 w-16 h-16 bg-white hover:bg-red-600 hover:text-white text-black rounded-full flex items-center justify-center text-3xl font-black shadow-2xl transition-all z-[6001] hover:scale-110 active:scale-95">✕</button>
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {zoomMedia === 'sheet' ? <img src={resolveUrl(currentLevelData.intro?.sheetUrl)} className="h-[90vh] object-contain" alt="Zoom" /> : <div className="h-[90vh] aspect-video"><iframe className="w-full h-full" src={getYoutubeEmbed(currentLevelData.intro?.videoUrl)} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen></iframe></div>}
                    </div>
                </div>
            )}

            {showGameComplete && (
                <div className="absolute inset-0 z-[7000] bg-gradient-to-br from-yellow-500 to-purple-600 flex flex-col items-center justify-center animate-in zoom-in p-10 text-center">
                    <div className="text-[150px] mb-4 animate-bounce">🏆</div>
                    <h1 className="text-8xl font-black text-white uppercase tracking-tighter drop-shadow-xl mb-4">VICTOIRE !</h1>
                    <p className="text-2xl font-bold text-yellow-100 uppercase tracking-widest mb-10">Tu as terminé tous les niveaux !</p>
                    <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 border-4 border-white/40 mb-10 min-w-[300px]">
                        <span className="block text-sm font-black text-white/60 uppercase mb-2">Score Final</span>
                        <span className="block text-6xl font-black text-white">{lives * 100 + (allLevels.length * 50)} PTS</span>
                    </div>
                    <button onClick={onExit} className="px-12 py-5 bg-white text-purple-700 font-black text-2xl rounded-2xl shadow-2xl hover:scale-105 hover:bg-purple-50 transition-all uppercase tracking-widest">RETOURNER AU MENU</button>
                </div>
            )}

            {engineStarted && !showLevelIntro && (
                <>
                    <div className="absolute top-6 w-full flex justify-between px-10 pointer-events-none z-30">
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl pointer-events-auto cursor-pointer active:scale-95 transition-transform" onClick={handleHeartClick}>
                            {"❤️".repeat(lives)}
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-2">
                            <div className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">{currentLevelData.name || `NIVEAU ${currentLevelIdx + 1}`}</div>
                            {safeQ && !showStageClear && (
                                <div onClick={handleQuestionClick} className={`bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 shadow-2xl text-xl pointer-events-auto text-center max-w-2xl cursor-pointer ${activeBossVisual ? 'border-red-500 ring-2 ring-red-500/50' : 'border-slate-600'}`}>
                                    {feedback === 'CORRECT' ? "✅ BIEN JOUÉ !" : feedback === 'WRONG' ? "❌ MAUVAISE RÉPONSE" : safeQ.q}
                                    {activeBossVisual && !feedback && <div className="text-[10px] text-red-500 mt-1 animate-pulse uppercase tracking-widest">⚠️ Boss Final : Saisis la réponse !</div>}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 pointer-events-auto mr-20">
                            {questionStates.map((s, i) => (
                                <div key={i} onClick={() => handleBarClick(i)} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden cursor-pointer ${currentQIndex === i ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-40'}`}>
                                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${s >= 3 ? 'bg-green-500 shadow-[0_0_10px_green]' : s >= 2 ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-yellow-500'}`} style={{ height: `${(s/3)*100}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="relative animate-in zoom-in">
                        <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 transition-all duration-1000 ${isPowerOff ? 'opacity-0' : 'opacity-100'} ${activeBossVisual ? 'border-red-900 shadow-[0_0_50px_rgba(255,0,0,0.2)]' : 'border-slate-800'}`} />
                    </div>
                </>
            )}

            {showLevelIntro && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-50 animate-in zoom-in p-8 text-center">
                    <h1 className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 font-black uppercase tracking-tighter drop-shadow-2xl mb-6">{currentLevelIdx + 1} {currentLevelData.name}</h1>
                    <div className="flex gap-10 mb-12 w-full max-w-4xl justify-center h-[280px]">
                        <div onClick={() => currentLevelData.intro?.sheetUrl && setZoomMedia('sheet')} className="h-full aspect-[3/4] bg-slate-800 rounded-3xl border-4 border-slate-700 overflow-hidden flex items-center justify-center shadow-2xl cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all">
                            {currentLevelData.intro?.sheetUrl ? <img src={resolveUrl(currentLevelData.intro.sheetUrl)} className="w-full h-full object-contain" alt="Fiche" /> : "Fiche"}
                        </div>
                        <div onClick={() => currentLevelData.intro?.videoUrl && setZoomMedia('video')} className="h-full aspect-video bg-black rounded-3xl border-4 border-slate-700 overflow-hidden shadow-2xl flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all text-white text-4xl">▶</div>
                    </div>
                    <button onClick={startCurrentLevel} disabled={!isReady} className={`px-16 py-6 rounded-full font-black text-3xl shadow-2xl border-4 transition-all ${isReady ? 'bg-white text-indigo-900 border-indigo-500 animate-pulse hover:scale-110' : 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed'}`}>
                        {isReady ? "C'EST PARTI ! 🚀" : `CHARGEMENT ${loadProgress}...`}
                    </button>
                </div>
            )}

            {showGameOver && (<div className="absolute inset-0 z-[60] bg-red-900/95 flex flex-col items-center justify-center animate-in zoom-in"><h1 className="text-8xl font-black text-white mb-8 tracking-tighter drop-shadow-lg">💀 GAME OVER</h1><button onClick={handleRetry} className="px-10 py-5 bg-white text-red-900 font-black text-2xl rounded-2xl shadow-2xl hover:scale-105 transition-transform uppercase tracking-widest">RÉESSAYER</button></div>)}

            {engineStarted && !showLevelIntro && safeQ && !showStageClear && !showGameComplete && (
                <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                    {activeBossVisual ? (
                        <div className="flex row gap-4 w-full max-w-2xl">
                            <input autoFocus className="flex-1 bg-slate-900 border-4 border-red-600 text-white text-3xl font-black py-6 px-10 rounded-3xl text-center outline-none" value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnswerClick(userInput)} />
                            <button onClick={() => handleAnswerClick(userInput)} className="bg-red-600 text-white px-10 rounded-3xl font-black text-xl border-b-8 border-red-800 uppercase">ATTAQUER ⚔️</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                            {safeQ.options.map((o, i) => (
                                <button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2">{o}</button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
