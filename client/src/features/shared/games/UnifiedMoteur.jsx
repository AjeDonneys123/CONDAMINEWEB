// @signatures: UnifiedMoteur, handleAnswerClick, triggerWinSequence, startCurrentLevel, handleRetry, performDeepReset, isCheatActive
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from '../../../services/SoundExpert';
import { api } from '../../../services/api';
import { createGameBase } from '../../../services/gameCore';

/**
 * 🧠 UNIFIED MOTEUR V8.2 (UI CONTROL)
 * CORRECTIF : 
 * - Ajout de state showAnswerUI contrôlable via le bridge.
 * - Possibilité de masquer les boutons de réponse pour les jeux 100% clavier/souris.
 */

const ZOMBIE_FALLBACK_CODE = `class MiniGame extends MiniGameBase {
    constructor(canvas, assets, callbacks) {
        super(canvas, assets, callbacks);
        this.resetInternalState();
    }
    resetInternalState() {
        this.projectiles = []; this.zombieX = 100; this.zombieState = "WALKING"; 
        this.heroState = "IDLE"; this.heroTimer = 0; this.hasDealtDamage = false;
        this.isStopped = false; this.baseSpeed = 0.15;
    }
    start() { 
        this.game.setUI(true); // On s'assure que Julian voit les réponses
        this.resetInternalState();
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
            this.HEROS.play("TIRER", false); this.heroState = "SHOOT"; this.heroTimer = 40;
            this.projectiles.push({ x: this.HEROS.x + 5, y: this.HEROS.y - 5 });
        } else if (!isCorrect) {
            this.zombieX -= 12; this.game.shake();
        }
    }
    update() {
        if (this.isStopped) return;
        if (this.isBossPhase && this.ZOMBIE) { this.ZOMBIE.scale = this.ZOMBIE.baseScale * 1.6; } 
        else if (this.ZOMBIE) { this.ZOMBIE.scale = this.ZOMBIE.baseScale; }
        if (this.heroState === "SHOOT" || this.heroState === "HIT") {
            this.heroTimer--; if (this.heroTimer <= 0) { this.heroState = "IDLE"; if(this.HEROS) this.HEROS.play("IDLE", true); }
        }
        if (this.zombieState === "WALKING") {
            let speed = this.isBossPhase ? this.baseSpeed * 0.5 : this.baseSpeed;
            this.zombieX -= speed;
            if (this.zombieX < 20) {
                this.zombieState = "ATTACKING"; this.hasDealtDamage = false;
                if (this.ZOMBIE) { this.ZOMBIE.x = 20; this.ZOMBIE.play("TAPER", false); }
            } else if(this.ZOMBIE) this.ZOMBIE.x = this.zombieX;
        } 
        else if (this.zombieState === "ATTACKING") {
            if (this.ZOMBIE && this.ZOMBIE.frameIdx >= 1 && !this.hasDealtDamage) {
                this.hasDealtDamage = true;
                if (this.HEROS) { this.HEROS.play("TOUCHE", false); this.heroState = "HIT"; this.heroTimer = 60; }
                this.game.damage(1); 
            }
            if (this.ZOMBIE && this.ZOMBIE.isAnimFinished) this.resetZombie();
        } 
        else if (this.zombieState === "HIT") {
            this.zombieX += 0.5; if(this.ZOMBIE) { this.ZOMBIE.x = this.zombieX; if (this.ZOMBIE.isAnimFinished) this.resetZombie(); }
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
}`;

export default function UnifiedMoteur({ gameData, onExit, isStudioTest = false }) {
    const [lives, setLives] = useState(4);
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [allLevels, setAllLevels] = useState([]);
    const [levelQuestions, setLevelQuestions] = useState([]);
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [showAnswerUI, setShowAnswerUI] = useState(true); // NOUVEAU
    
    const [isMuted, setIsMuted] = useState(false); 
    const isMutedRef = useRef(false);
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

    const [showLevelIntro, setShowLevelIntro] = useState(true);
    const [showLevelBanner, setShowLevelBanner] = useState(false);
    const [showStageClear, setShowStageClear] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [showGameComplete, setShowGameComplete] = useState(false);
    const [zoomMedia, setZoomMedia] = useState(null);
    const [activeBossVisual, setActiveBossVisual] = useState(false);
    const [isShake, setIsShake] = useState(false);
    
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [userInput, setUserInput] = useState("");

    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const keysPressed = useRef({});
    const projectRef = useRef(gameData || {});
    const bossModeRef = useRef(false);

    const liveData = useRef({ qStates: [], qIndex: 0, lives: 4 });

    const isCheatActive = () => keysPressed.current['KeyS'] && keysPressed.current['KeyT'];

    const bridgeProxy = useRef((type, value) => {
        switch(type) {
            case 'DAMAGE':
                setIsShake(true); setTimeout(() => setIsShake(false), 500);
                liveData.current.lives = Math.max(0, liveData.current.lives - (value || 1));
                setLives(liveData.current.lives);
                if (liveData.current.lives <= 0) { 
                    setShowGameOver(true); 
                    if (gameInstanceRef.current) gameInstanceRef.current.isStopped = true; 
                    triggerGlobalEvent("DEFAITE");
                }
                break;
            case 'WIN_ROUND': updateBarLogic(true); break;
            case 'FAIL_ROUND': updateBarLogic(false); break;
            case 'NEXT_Q': changeQuestionLogic(); break;
            case 'SET_BOSS': 
                setActiveBossVisual(!!value); bossModeRef.current = !!value;
                if(gameInstanceRef.current) gameInstanceRef.current.isBossPhase = !!value;
                break;
            case 'SET_UI': // NOUVEAU
                setShowAnswerUI(!!value);
                break;
            case 'SHAKE': setIsShake(true); setTimeout(() => setIsShake(false), 500); break;
            case 'AUDIO': triggerGlobalEvent(value); break;
            case 'VICTORY': triggerWinSequence(); break;
            case 'GAME_OVER': setShowGameOver(true); break;
        }
    });

    const updateBarLogic = (isCorrect) => {
        const idx = liveData.current.qIndex;
        const currentScore = liveData.current.qStates[idx] || 0;
        if (isCorrect) { liveData.current.qStates[idx] = Math.min(3, currentScore + 1); } 
        else { liveData.current.qStates[idx] = Math.max(0, currentScore - 1); }
        setQuestionStates([...liveData.current.qStates]);
    };

    const changeQuestionLogic = () => {
        setFeedback(null); setUserInput("");
        const states = liveData.current.qStates;
        const currentIdx = liveData.current.qIndex;
        const available = states.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        
        if (available.length > 0) {
            if (states[currentIdx] === 2) { bridgeProxy.current('SET_BOSS', true); } 
            else {
                const others = available.filter(idx => idx !== currentIdx);
                let nextIdx = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : available[0];
                liveData.current.qIndex = nextIdx;
                setCurrentQIndex(nextIdx);
                bridgeProxy.current('SET_BOSS', states[nextIdx] === 2);
            }
        } else { triggerWinSequence(); }
    };

    const triggerWinSequence = () => {
        const isGameFinished = !allLevels[currentLevelIdx + 1];
        if (isGameFinished) { triggerGlobalEvent("VICTOIRE"); setShowGameComplete(true); } 
        else {
            triggerGlobalEvent("UPLEVEL"); setShowStageClear(true);
            setTimeout(() => { setShowStageClear(false); setCurrentLevelIdx(p => p + 1); setEngineStarted(false); setShowLevelIntro(true); }, 3000);
        }
    };

    const handleHeartClick = () => { if (isCheatActive()) bridgeProxy.current('DAMAGE', 1); };
    const handleQuestionClick = () => { if (isCheatActive()) triggerWinSequence(); };
    const handleBarClick = (idx) => {
        if (!isCheatActive()) return;
        const current = liveData.current.qStates[idx] || 0;
        liveData.current.qStates[idx] = Math.min(3, current + 1);
        setQuestionStates([...liveData.current.qStates]);
        if (liveData.current.qStates.every(s => s >= 3)) triggerWinSequence();
    };

    const handleRetry = () => { setShowGameOver(false); performDeepReset(); };

    const performDeepReset = () => {
        setLives(4); setActiveBossVisual(false); bossModeRef.current = false;
        setShowAnswerUI(true); // Reset UI Visibility
        if (gameInstanceRef.current) { gameInstanceRef.current.isBossPhase = false; gameInstanceRef.current.isStopped = false; gameInstanceRef.current.start(); }
        const initialStates = new Array(levelQuestions.length).fill(0);
        liveData.current.qStates = initialStates; liveData.current.qIndex = 0; liveData.current.lives = 4;
        setQuestionStates(initialStates); setCurrentQIndex(0); setFeedback(null); setUserInput("");
        setShowLevelIntro(true); setEngineStarted(false);
    };

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
        return "/api/proxy/" + url.split('/').pop();
    }

    const playParallelSoundImpl = (url) => {
        if (isMutedRef.current || !url || !audioCtxRef.current) return;
        const buffer = audioBuffersRef.current.get(resolveUrl(url));
        if (buffer) {
            try {
                if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
                const source = audioCtxRef.current.createBufferSource();
                source.buffer = buffer; source.connect(audioCtxRef.current.destination); source.start(0);
            } catch(e) {}
        }
    };

    const triggerGlobalEvent = (eventName) => {
        const scene = projectRef.current.scenes?.[0];
        if (!scene || !scene.globalSounds) return;
        const cleanTarget = eventName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const event = scene.globalSounds.find(g => g.name && g.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() === cleanTarget);
        if (event && event.sounds) event.sounds.forEach(snd => playParallelSoundImpl(snd.url));
    };

    useEffect(() => {
        const initLevel = async () => {
            let levelsData = gameData?.levels || [];
            if (isStudioTest || levelsData.length === 0) {
                try { const res = await api.get('/games/test-data'); levelsData = res?.levels?.length > 0 ? res.levels : []; } catch(e) {}
            }
            if (levelsData.length === 0) levelsData = [{ name: "Niveau 1", questions: [{q:"?",options:["A","B"],a:0},{q:"?",options:["A","B"],a:0},{q:"?",options:["A","B"],a:0}] }];
            setAllLevels(levelsData);
            if (levelsData[currentLevelIdx]) {
                const qs = levelsData[currentLevelIdx].questions || [];
                setLevelQuestions(qs);
                liveData.current.qStates = new Array(qs.length).fill(0);
                liveData.current.qIndex = 0; liveData.current.lives = 4;
                setQuestionStates(new Array(qs.length).fill(0));
                setCurrentQIndex(0); setLives(4); setActiveBossVisual(false); bossModeRef.current = false;
                setShowLevelIntro(true);
            }
        };
        initLevel();
    }, [gameData, currentLevelIdx]);

    useEffect(() => {
        if (!gameData) return;
        projectRef.current = gameData; 
        const scene = gameData.scenes?.[0];
        if (scene) {
            const imgs = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
            const snds = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            imgs.forEach(url => { const rKey = resolveUrl(url); const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => imageAssetsRef.current.set(rKey, img); img.src = rKey; });
            snds.forEach(url => { SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => { if (buf) audioBuffersRef.current.set(resolveUrl(url), buf); }); });
            setIsReady(true);
        }
    }, [gameData]);

    const startCurrentLevel = async () => { 
        setEngineStarted(true); setShowLevelIntro(false); setShowLevelBanner(true); 
        if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
        triggerGlobalEvent("DEPART");
        setTimeout(() => setShowLevelBanner(false), 1500); 
    };

    const handleAnswerClick = (val) => {
        if (feedback || showLevelIntro || showStageClear || showGameOver) return;
        const currentQ = levelQuestions[currentQIndex];
        const isCorrect = (typeof val === 'number') ? currentQ.a === val : val === currentQ.options[currentQ.a];
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);
        setTimeout(() => { updateBarLogic(isCorrect); changeQuestionLogic(); }, 1200);
    };

    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;
        try {
            const MiniGameBase = createGameBase({ 
                audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, projectRef, sceneIdx: 0, imageAssets: imageAssetsRef.current, resolveUrl, canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'), 
                playParallelSound: playParallelSoundImpl, bridge: { trigger: (t, v) => bridgeProxy.current(t, v) }
            });
            const scriptToRun = projectRef.current.generatedCode || ZOMBIE_FALLBACK_CODE;
            const factory = new Function('MiniGameBase', scriptToRun + "\n return MiniGame;");
            const instance = new (factory(MiniGameBase))(canvasRef.current, {}, {});
            gameInstanceRef.current = instance; if (instance.start) instance.start();
            const tick = () => {
                if (instance && !instance.isStopped) {
                    if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                    instance.isBossPhase = bossModeRef.current;
                    if (instance.update) instance.update(); if (instance._render) instance._render(); if (instance.draw) instance.draw();
                }
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) { console.error("🔥 CRASH MOTEUR:", e); }
        return () => { if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted]);

    useEffect(() => {
        const hDown = (e) => keysPressed.current[e.code] = true;
        const hUp = (e) => keysPressed.current[e.code] = false;
        window.addEventListener('keydown', hDown); window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, []);

    const getYoutubeEmbed = (url) => {
        if (!url) return "";
        const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        return (m && m[2].length === 11) ? ("https://www.youtube.com/embed/" + m[2] + "?autoplay=1") : url;
    };

    const currentLvlData = allLevels[currentLevelIdx] || {};

    return (
        <div className={"fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans " + (isShake ? 'animate-shake' : '')}>
            <div className="absolute top-2 left-4 px-3 py-1 bg-black/50 text-[10px] font-black text-yellow-500 rounded-full border border-yellow-500/30 z-[5000]">MOTEUR V8.2 (UI CONTROL)</div>
            
            <div className="absolute top-2 right-4 flex gap-2 z-[6000]">
                <button onClick={() => setIsMuted(!isMuted)} className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-lg border-2 border-white/20 transition-all">{isMuted ? '🔇' : '🔊'}</button>
                <button onClick={onExit} className="w-10 h-10 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xl font-black border-2 border-white/20 transition-all">✕</button>
            </div>

            {showLevelBanner && <div className="fixed top-[20%] z-[5000] animate-in zoom-in"><span className="text-yellow-400 font-black text-6xl uppercase drop-shadow-lg">Niveau {currentLevelIdx + 1}</span></div>}
            {showStageClear && <div className="fixed top-[40%] z-[5000] animate-in zoom-in text-center"><span className="text-green-500 font-black text-8xl uppercase drop-shadow-lg block">STAGE CLEAR !</span></div>}
            
            {showLevelIntro && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-[6000] animate-in zoom-in p-8 text-center">
                    <h1 className="text-5xl text-white font-black mb-6 uppercase tracking-tighter">{currentLvlData.name || ("Niveau " + (currentLevelIdx+1))}</h1>
                    <div className="flex gap-10 mb-12 w-full max-w-4xl justify-center h-[280px]">
                        <div onClick={() => currentLvlData.intro?.sheetUrl && setZoomMedia('sheet')} className="h-full aspect-[3/4] bg-slate-800 rounded-3xl border-4 border-slate-700 overflow-hidden flex items-center justify-center shadow-2xl cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all">
                            {currentLvlData.intro?.sheetUrl ? <img src={resolveUrl(currentLvlData.intro.sheetUrl)} className="w-full h-full object-contain" alt="Fiche" /> : <span className="text-slate-500 font-bold uppercase text-[10px]">Fiche</span>}
                        </div>
                        <div onClick={() => currentLvlData.intro?.videoUrl && setZoomMedia('video')} className="h-full aspect-video bg-black rounded-3xl border-4 border-slate-700 overflow-hidden shadow-2xl flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all relative group">
                            {currentLvlData.intro?.videoUrl ? <span className="text-6xl">▶️</span> : <span className="text-slate-500 font-bold uppercase text-[10px]">Vidéo</span>}
                        </div>
                    </div>
                    <button onClick={startCurrentLevel} disabled={!isReady} className="px-16 py-6 rounded-full font-black text-3xl shadow-2xl border-4 bg-white text-indigo-900 border-indigo-500 hover:scale-110">DÉMARRER 🚀</button>
                </div>
            )}

            {zoomMedia && (
                <div className="fixed inset-0 z-[7000] bg-black flex items-center justify-center p-0 animate-in fade-in" onClick={() => setZoomMedia(null)}>
                    <button className="absolute top-4 right-4 w-12 h-12 bg-white text-black rounded-full flex items-center justify-center text-3xl font-black z-[7001]">✕</button>
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {zoomMedia === 'sheet' ? <img src={resolveUrl(currentLvlData.intro?.sheetUrl)} className="h-[90vh] object-contain shadow-2xl" alt="Zoom" /> : <div className="h-[90vh] aspect-video"><iframe className="w-full h-full" src={getYoutubeEmbed(currentLvlData.intro?.videoUrl)} frameBorder="0" allowFullScreen></iframe></div>}
                    </div>
                </div>
            )}

            {engineStarted && !showLevelIntro && (
                <>
                    <div className="absolute top-6 w-full flex justify-between px-10 pointer-events-none z-30">
                        <div onClick={handleHeartClick} className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-lg pointer-events-auto cursor-pointer active:scale-95 transition-transform">{"❤️".repeat(lives)}</div>
                        {levelQuestions[currentQIndex] && (
                            <div onClick={handleQuestionClick} className="flex-1 mx-10 pointer-events-auto cursor-pointer">
                                <div className={"bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 shadow-2xl text-xl text-center border-slate-600 " + (activeBossVisual ? 'border-red-500 ring-2 ring-red-500/50' : '')}>
                                    {feedback === 'CORRECT' ? "✅ BIEN JOUÉ !" : feedback === 'WRONG' ? "❌ MAUVAISE RÉPONSE" : levelQuestions[currentQIndex].q}
                                    {activeBossVisual && !feedback && <div className="text-[10px] text-red-500 mt-1 animate-pulse uppercase tracking-widest">⚠️ Boss Final : Saisis la réponse !</div>}
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2 pointer-events-auto">
                            {questionStates.map((s, i) => (
                                <div key={i} onClick={() => handleBarClick(i)} className={"w-6 h-16 rounded-lg border-2 cursor-pointer transition-all " + (currentQIndex === i ? 'border-white scale-110 shadow-lg' : 'border-slate-600 opacity-60') + " bg-slate-800 overflow-hidden relative"}>
                                    <div className={"absolute bottom-0 w-full transition-all duration-500 " + (s >= 3 ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : s >= 2 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-yellow-500')} style={{height: (s/3*100) + "%" }}></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <canvas ref={canvasRef} width={800} height={450} className={"aspect-video shadow-2xl bg-black border-4 " + (activeBossVisual ? 'border-red-600 shadow-[0_0_50px_red]' : 'border-slate-800') + " rounded-lg"} />
                    
                    {/* MODIFICATION CRITIQUE : MASQUAGE DES RÉPONSES SI DEMANDÉ */}
                    {showAnswerUI && levelQuestions[currentQIndex] && !showStageClear && !showGameComplete && !showGameOver && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            {activeBossVisual && !feedback ? (
                                <div className="flex gap-4 w-full max-w-2xl animate-in slide-in-from-bottom">
                                    <input autoFocus className="flex-1 bg-slate-900 border-4 border-red-600 text-white text-3xl font-black py-4 px-8 rounded-2xl text-center outline-none focus:ring-4 ring-red-500/30" value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnswerClick(userInput)} placeholder="TAPE TA RÉPONSE..." />
                                    <button onClick={() => handleAnswerClick(userInput)} className="bg-red-600 text-white px-10 rounded-2xl font-black text-xl border-b-8 border-red-800">ATTAQUER ⚔️</button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl">
                                    {levelQuestions[currentQIndex].options.map((o, i) => (
                                        <button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2 shadow-lg">{o}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {showGameComplete && (
                <div className="absolute inset-0 z-[7000] bg-gradient-to-br from-yellow-500 to-purple-600 flex flex-col items-center justify-center animate-in zoom-in">
                    <h1 className="text-9xl mb-4 animate-bounce">🏆</h1>
                    <h1 className="text-8xl font-black text-white drop-shadow-lg uppercase tracking-tighter">VICTOIRE TOTALE !</h1>
                    <button onClick={onExit} className="mt-10 px-12 py-5 bg-white text-purple-700 font-black text-2xl rounded-2xl shadow-2xl hover:scale-110 transition-transform uppercase">RETOURNER AU MENU</button>
                </div>
            )}

            {showGameOver && (
                <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[8000] animate-in zoom-in">
                    <h1 className="text-8xl font-black text-red-600 mb-8 uppercase tracking-widest">GAME OVER</h1>
                    <button onClick={handleRetry} className="bg-white text-black px-12 py-5 rounded-2xl font-black text-2xl hover:bg-red-500 hover:text-white transition-all uppercase shadow-2xl">RÉESSAYER 🔄</button>
                </div>
            )}
        </div>
    );
}
