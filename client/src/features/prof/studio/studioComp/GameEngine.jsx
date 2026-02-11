// @signatures: GameEngine, handleBarCheat, handleHeartClick, handleMuteToggle, initLevel, handleAnswerClick, triggerWinSequence, triggerGameOver, handleStartGame, triggerGlobalEvent, handleRetry, checkAnswerPermissive, getEmbedUrl
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from '../../../../services/SoundExpert';
import { api } from '../../../../services/api';
import { createGameBase } from '../../../../services/gameCore';

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
        if (this.ZOMBIE) this.ZOMBIE.scale = this.isBossPhase ? this.ZOMBIE.baseScale * 1.6 : this.ZOMBIE.baseScale;
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
                    if (this.callbacks.onPlayerHit) this.callbacks.onPlayerHit();
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

export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState("");
    
    // Etats Quiz
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(-1);
    const [lives, setLives] = useState(4);
    const [feedback, setFeedback] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [userInput, setUserInput] = useState("");

    // Etats Visuels
    const [isLevelWon, setIsLevelWon] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [showLevelIntro, setShowLevelIntro] = useState(false);
    const [showLevelBanner, setShowLevelBanner] = useState(false);
    const [zoomMedia, setZoomMedia] = useState(null);
    const [isPowerOff, setIsPowerOff] = useState(false);
    
    const isLevelWonRef = useRef(false);
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const keysPressed = useRef({});
    const gameHasStartedRef = useRef(false);
    const projectRef = useRef(project);
    const bossModeRef = useRef(false);
    const isMutedRef = useRef(false);

    useEffect(() => { projectRef.current = project; }, [project]);

    useEffect(() => {
        api.get('/games/test-data').then(data => {
            const levelsData = data?.levels?.length > 0 ? data.levels : [{ name: "Test Default", questions: [{ q: "Quelle est la capitale ?", options: ["Lyon", "Paris", "Marseille", "Lille"], a: 1 }] }];
            setAllLevels(levelsData);
            initLevel(0, levelsData, true); 
        });
        const hDown = (e) => { keysPressed.current[e.code] = true; };
        const hUp = (e) => { keysPressed.current[e.code] = false; };
        window.addEventListener('keydown', hDown);
        window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, []);

    const getEmbedUrl = (url) => {
        if (!url) return null;
        let videoId = "";
        if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        else if (url.includes('embed/')) videoId = url.split('embed/')[1].split('?')[0];
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : url;
    };

    const checkAnswerPermissive = (input, target) => {
        if (!input || !target) return false;
        const clean = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '').trim();
        return clean(input) === clean(target);
    };

    const playParallelSoundImpl = (url) => {
        if (!gameHasStartedRef.current || isMutedRef.current || !audioCtxRef.current) return;
        const buffer = audioBuffersRef.current.get(resolveUrl(url));
        if (buffer) {
            if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
            try {
                const source = audioCtxRef.current.createBufferSource();
                source.buffer = buffer; source.connect(audioCtxRef.current.destination);
                source.start(0);
            } catch(e) {}
        }
    };

    const triggerGlobalEvent = (eventName) => {
        const scene = projectRef.current.scenes?.[activeSceneIdx];
        if (!scene || !scene.globalSounds) return;
        const event = scene.globalSounds.find(g => g.name.toUpperCase().trim() === eventName.toUpperCase().trim());
        if (event && event.sounds) event.sounds.forEach(snd => playParallelSoundImpl(snd.url));
    };

    const initLevel = (idx, sourceData, silent = false) => {
        if (!sourceData[idx]) return;
        const questions = sourceData[idx].questions || [];
        setCurrentLevelIdx(idx);
        setLevelQuestions(questions);
        setQuestionStates(new Array(questions.length).fill(0));
        setIsLevelWon(false); setShowGameOver(false); isLevelWonRef.current = false; setIsPowerOff(false);
        if (questions.length > 0) {
            setCurrentQIndex(0);
            if (!silent) { setShowLevelIntro(true); triggerGlobalEvent("UPLEVEL"); }
        }
    };

    useEffect(() => {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const scene = project.scenes?.[activeSceneIdx];
        if (!scene) { setIsReady(true); return; }
        const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
        let loaded = 0; const total = imgUrls.length;
        if (total === 0) setIsReady(true);
        imgUrls.forEach(url => {
            const img = new Image(); img.crossOrigin = "anonymous";
            const rKey = resolveUrl(url);
            img.onload = () => { imageAssetsRef.current.set(rKey, img); loaded++; setLoadProgress(`${Math.round(loaded/total*100)}%`); if (loaded >= total) setIsReady(true); };
            img.onerror = () => { loaded++; if (loaded >= total) setIsReady(true); };
            img.src = rKey;
        });
        const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
        sndUrls.forEach(url => { SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => { if (buf) audioBuffersRef.current.set(resolveUrl(url), buf); }); });
    }, [project]);

    useEffect(() => {
        const isBoss = (currentQIndex !== -1 && (questionStates[currentQIndex] || 0) >= 2);
        bossModeRef.current = isBoss;
        if (gameInstanceRef.current) gameInstanceRef.current.isBossPhase = isBoss;
    }, [currentQIndex, questionStates]);

    const handleAnswerClick = (val) => {
        if (feedback || currentQIndex === -1 || isLevelWonRef.current || showGameOver || showLevelIntro) return;
        const currentQ = levelQuestions[currentQIndex];
        if (!currentQ) return;

        let isCorrect = false;
        if (typeof val === 'number') isCorrect = currentQ.a === val;
        else isCorrect = checkAnswerPermissive(val, currentQ.options[currentQ.a]);
        
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        const nextStates = [...questionStates];
        if (isCorrect) {
            nextStates[currentQIndex] = Math.min(3, nextStates[currentQIndex] + 1);
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(true);
        } else {
            nextStates[currentQIndex] = Math.max(0, nextStates[currentQIndex] - 1);
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(false);
            setLives(l => Math.max(0, l - 1));
        }
        setQuestionStates(nextStates);
        setUserInput("");

        setTimeout(() => {
            setFeedback(null);
            const available = nextStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
            if (available.length > 0) {
                // LOGIQUE STABLE : On cherche une autre question ou on reste sur la même si seule dispo
                const others = available.filter(idx => idx !== currentQIndex);
                setCurrentQIndex(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : available[0]);
            } else triggerWinSequence();
        }, 1000);
    };

    const triggerWinSequence = () => {
        setIsLevelWon(true); isLevelWonRef.current = true;
        triggerGlobalEvent("LEVEL_WIN");
        setTimeout(() => setIsPowerOff(true), 1500);
        setTimeout(() => {
            if (allLevels[currentLevelIdx + 1]) initLevel(currentLevelIdx + 1, allLevels, false);
            else { alert("🎉 JEU TERMINÉ !"); triggerGlobalEvent("GAME_WIN"); onStop(); }
        }, 4000);
    };

    const handleBarCheat = (idx) => {
        if (keysPressed.current['KeyF']) {
            const newStates = [...questionStates];
            newStates[idx] = 3;
            setQuestionStates(newStates);
            if (newStates.every(s => s >= 3)) triggerWinSequence();
        } else {
            const newStates = [...questionStates];
            newStates[idx] = (newStates[idx] + 1) % 4; 
            setQuestionStates(newStates);
            if (newStates.every(s => s >= 3)) triggerWinSequence();
            else if (newStates[idx] < 3) setCurrentQIndex(idx);
        }
    };

    const triggerGameOver = () => { triggerGlobalEvent("DÉFAITE"); setShowGameOver(true); };
    const handleRetry = () => { setShowGameOver(false); setLives(4); initLevel(currentLevelIdx, allLevels, false); };
    const handleStartGame = async () => { if (audioCtxRef.current) await audioCtxRef.current.resume(); gameHasStartedRef.current = true; setEngineStarted(true); setShowLevelIntro(true); triggerGlobalEvent("UPLEVEL"); };

    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;
        try {
            const MiniGameBase = createGameBase({ audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, projectRef, sceneIdx: activeSceneIdx, imageAssets: imageAssetsRef.current, resolveUrl, canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'), isMutedRef, playParallelSound: playParallelSoundImpl, callbacks: { onPlayerHit: () => { if (!isLevelWonRef.current) { setLives(prev => { const n = Math.max(0, prev - 1); if (n === 0) triggerGameOver(); return n; }); } } } });
            const actualCode = code && code.length > 50 ? code : ZOMBIE_GAME_CODE;
            const factory = new Function('MiniGameBase', `${actualCode}\nreturn MiniGame;`);
            const GameClass = factory(MiniGameBase);
            const instance = new GameClass(canvasRef.current, {}, { onPlayerHit: () => { if (!isLevelWonRef.current) setLives(l => { const n = Math.max(0, l - 1); if (n === 0) triggerGameOver(); return n; }); } });
            gameInstanceRef.current = instance; if (instance.start) instance.start();
            const tick = () => {
                if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                instance.isBossPhase = bossModeRef.current;
                if (instance.update) instance.update(); if (instance._render) instance._render(); if (instance.draw) instance.draw();
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) { console.error("CRASH MOTEUR:", e); }
        return () => { if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted]);

    const currentLevelData = allLevels[currentLevelIdx] || {};
    const isBossPhase = bossModeRef.current;

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
            <button onClick={onStop} className="absolute top-6 right-6 w-14 h-14 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-2xl font-black transition-all z-[3500] border-2 border-white/20 hover:scale-110 active:scale-95">✕</button>

            {showLevelBanner && (
                <div className="fixed top-[20%] left-0 right-0 z-[5000] flex justify-center pointer-events-none animate-in fade-in zoom-in duration-300">
                    <span className="text-yellow-400 font-black text-6xl uppercase tracking-tighter italic drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">Niveau {currentLevelIdx + 1}</span>
                </div>
            )}

            {zoomMedia && (
                <div className="fixed inset-0 z-[4000] bg-black flex items-center justify-center p-0 animate-in fade-in duration-300" onClick={() => setZoomMedia(null)}>
                    <button className="absolute top-8 right-8 w-16 h-16 bg-white hover:bg-red-600 hover:text-white text-black rounded-full flex items-center justify-center text-3xl font-black shadow-2xl transition-all z-[4001] hover:scale-110 active:scale-95">✕</button>
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {zoomMedia === 'sheet' ? (
                            <img src={resolveUrl(currentLevelData.intro?.sheetUrl)} className="h-[90vh] w-auto max-w-[95vw] object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300" />
                        ) : (
                            <div className="h-[90vh] aspect-video max-w-[95vw] bg-black rounded-2xl overflow-hidden border-4 border-white/10 shadow-2xl animate-in zoom-in duration-300">
                                <iframe className="w-full h-full" src={getEmbedUrl(currentLevelData.intro?.videoUrl)} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen></iframe>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!engineStarted ? (
                <button onClick={handleStartGame} disabled={!isReady} className={`px-20 py-10 rounded-full font-black text-5xl shadow-2xl border-8 transition-all ${isReady ? 'bg-white text-indigo-600 border-indigo-200 hover:scale-110 animate-pulse' : 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed'}`}>
                    {isReady ? "🚀 JOUER" : `CHARGEMENT ${loadProgress}...`}
                </button>
            ) : (
                <>
                    {!showGameOver && !showLevelIntro && (
                        <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                            <div className="flex gap-4 pointer-events-auto">
                                <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl flex gap-1 cursor-pointer active:scale-95 transition-transform" onClick={() => keysPressed.current['KeyF'] && setLives(4)}>
                                    {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                                </div>
                                <button onClick={() => setIsMuted(!isMuted)} className="bg-slate-900/80 w-14 h-14 rounded-2xl border-2 border-slate-700 text-2xl flex items-center justify-center text-white hover:bg-slate-800">{isMuted ? '🔇' : '🔊'}</button>
                            </div>
                            <div className="flex-1 flex flex-col items-center px-4 gap-2">
                                <div className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-lg border border-indigo-400">{allLevels[currentLevelIdx]?.name || `NIVEAU ${currentLevelIdx + 1}`}</div>
                                {levelQuestions[currentQIndex] && !isLevelWon && (
                                    <div className={`bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 shadow-2xl text-xl pointer-events-auto text-center max-w-2xl ${isBossPhase ? 'border-red-500 ring-2 ring-red-500/50' : 'border-slate-600'}`}>
                                        {feedback === 'CORRECT' ? "✅ BIEN JOUÉ !" : feedback === 'WRONG' ? "❌ MAUVAISE RÉPONSE" : levelQuestions[currentQIndex].q}
                                        {isBossPhase && !feedback && <div className="text-[10px] text-red-500 mt-1 animate-pulse uppercase">⚠️ Phase Finale : Saisis la réponse !</div>}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 items-center pointer-events-auto mr-20">
                                {questionStates.map((mastery, idx) => (
                                    <div key={idx} onClick={() => { handleBarCheat(idx); }} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden transition-all cursor-pointer ${currentQIndex === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-40'}`}>
                                        <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery >= 3 ? 'bg-green-500 shadow-[0_0_10px_green]' : mastery >= 2 ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="relative animate-in zoom-in">
                        <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 transition-all duration-1000 ${isPowerOff ? 'opacity-0' : 'opacity-100'} ${isBossPhase ? 'border-red-900 shadow-[0_0_50px_rgba(255,0,0,0.2)]' : 'border-slate-800'}`} />
                        {isLevelWon && (<div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-xl animate-in zoom-in z-40"><div className="bg-white p-10 rounded-[40px] shadow-2xl text-center border-8 border-green-500"><span className="text-6xl block mb-4">🏆</span><h2 className="text-4xl font-black text-slate-800 uppercase">Niveau Réussi !</h2></div></div>)}
                        {showLevelIntro && !isLevelWon && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md rounded-xl z-50 animate-in zoom-in p-8">
                                <h1 className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 font-black uppercase tracking-tighter drop-shadow-2xl mb-6">{currentLevelIdx + 1} {currentLevelData.name}</h1>
                                <div className="flex gap-10 mb-12 w-full max-w-4xl justify-center h-[280px]">
                                    <div onClick={() => currentLevelData.intro?.sheetUrl && setZoomMedia('sheet')} className="h-full aspect-[3/4] bg-slate-800 rounded-3xl border-4 border-slate-700 overflow-hidden flex items-center justify-center shadow-2xl cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all">
                                        {currentLevelData.intro?.sheetUrl ? <img src={resolveUrl(currentLevelData.intro.sheetUrl)} className="w-full h-full object-contain" /> : "Fiche"}
                                    </div>
                                    <div onClick={() => currentLevelData.intro?.videoUrl && setZoomMedia('video')} className="h-full aspect-video bg-black rounded-3xl border-4 border-slate-700 overflow-hidden shadow-2xl flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all text-white text-4xl">▶</div>
                                </div>
                                <button onClick={() => { setShowLevelIntro(false); setShowLevelBanner(true); setTimeout(() => setShowLevelBanner(false), 1500); }} className="px-16 py-6 bg-white text-indigo-900 font-black text-3xl rounded-full shadow-2xl border-4 border-indigo-500 animate-pulse">C'EST PARTI ! 🚀</button>
                            </div>
                        )}
                    </div>

                    {showGameOver && (<div className="absolute inset-0 z-[60] bg-red-900/95 flex flex-col items-center justify-center animate-in zoom-in"><h1 className="text-8xl font-black text-white mb-8 tracking-tighter drop-shadow-lg">💀 GAME OVER</h1><button onClick={handleRetry} className="px-10 py-5 bg-white text-red-900 font-black text-2xl rounded-2xl shadow-2xl hover:scale-105 transition-transform uppercase tracking-widest">RÉESSAYER</button></div>)}

                    {!isLevelWon && !isPowerOff && !showGameOver && !showLevelIntro && levelQuestions[currentQIndex] && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            {isBossPhase ? (
                                <div className="flex flex-row items-stretch gap-4 w-full max-w-2xl animate-in slide-in-from-bottom-5">
                                    <input autoFocus className="flex-1 bg-slate-900 border-4 border-red-600 text-white text-3xl font-black py-6 px-10 rounded-3xl text-center outline-none focus:ring-4 ring-red-500/30 uppercase placeholder:text-slate-700" placeholder="TAPE LA RÉPONSE..." value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnswerClick(userInput)} />
                                    <button onClick={() => handleAnswerClick(userInput)} className="bg-red-600 hover:bg-red-500 text-white px-10 rounded-3xl font-black text-xl shadow-xl transition-all active:scale-95 border-b-8 border-red-800 active:border-b-0 uppercase">ATTAQUER ⚔️</button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                                    {levelQuestions[currentQIndex].options.map((o, i) => (
                                        <button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-white hover:text-indigo-600 hover:scale-105 transition-all border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2">{o}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
             )}
        </div>
    );
}
