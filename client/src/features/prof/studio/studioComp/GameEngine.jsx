// @signatures: GameEngine, initLevel, handleAnswerClick, handleInputSubmit, handleGameOver, retryLevel, nextLevel, preloadAssets, getYoutubeEmbedUrl
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';
import { api } from '../../../../services/api';

export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    
    const [isReady, setIsReady] = useState(false);
    const [engineStarted, setEngineStarted] = useState(false);
    const [loadProgress, setLoadProgress] = useState("0%");
    const [hitFlash, setHitFlash] = useState(false);
    
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(-1);
    const [lives, setLives] = useState(4);
    const [feedback, setFeedback] = useState(null);

    // --- BOSS MODE & INPUT ---
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef(null);

    // --- AUDIO CONTROL ---
    const [isMuted, setIsMuted] = useState(false);
    const isMutedRef = useRef(false);

    const [isStudyPhase, setIsStudyPhase] = useState(false);
    const [activeFocus, setActiveFocus] = useState(null); 
    const [showLevelTitle, setShowLevelTitle] = useState(false);
    const [isLevelWon, setIsLevelWon] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isGameCompleted, setIsGameCompleted] = useState(false);
    
    const isPausedRef = useRef(false);
    const activeTimeoutsRef = useRef([]);

    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const keysPressed = useRef({}); 
    const activeSourcesRef = useRef([]);

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

    const getYoutubeEmbedUrl = (url) => {
        if (!url) return null;
        let videoId = "";
        if (url.includes("v=")) videoId = url.split("v=")[1]?.split("&")[0];
        else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1]?.split("?")[0];
        else if (url.includes("embed/")) videoId = url.split("embed/")[1]?.split("?")[0];
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
    };

    const safeTimeout = (fn, delay) => {
        const id = setTimeout(fn, delay);
        activeTimeoutsRef.current.push(id);
        return id;
    };

    const clearAllTimeouts = () => {
        activeTimeoutsRef.current.forEach(clearTimeout);
        activeTimeoutsRef.current = [];
    };

    const stopAllSounds = () => {
        activeSourcesRef.current.forEach(src => { try { src.stop(); } catch(e){} });
        activeSourcesRef.current.length = 0; 
    };

    const playSystemSound = (soundName) => {
        if (isMutedRef.current || !project || !audioCtxRef.current) return;
        const scene = project.scenes[activeSceneIdx];
        const soundEvent = scene?.globalSounds?.find(gs => gs.name.toUpperCase().trim() === soundName.toUpperCase().trim());
        if (!soundEvent || !soundEvent.sounds || soundEvent.sounds.length === 0) return;
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
        soundEvent.sounds.forEach(snd => {
            const buffer = audioBuffersRef.current.get(snd.url);
            if (buffer) {
                try {
                    const source = audioCtxRef.current.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioCtxRef.current.destination);
                    source.start(0);
                    activeSourcesRef.current.push(source);
                } catch (e) {}
            }
        });
    };

    // --- LOGIQUE DE VALIDATION TOLÉRANTE ---
    const normalize = (str) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    useEffect(() => {
        const preloadAssets = async () => {
            if (!project) return;
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const scene = project.scenes?.[activeSceneIdx];
            if (!scene) { setIsReady(true); return; }
            const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
            const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
            const total = imgUrls.length + sndUrls.length;
            let loaded = 0;
            const updateProgress = () => { loaded++; setLoadProgress(`${Math.round((loaded / total) * 100)}%`); };
            imageAssetsRef.current.clear();
            const imgPromises = imgUrls.map(url => new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                const finalUrl = resolveUrl(url);
                img.onload = () => { imageAssetsRef.current.set(finalUrl, img); updateProgress(); resolve(); };
                img.onerror = () => { updateProgress(); resolve(); };
                img.src = finalUrl;
            }));
            const sndPromises = sndUrls.map(url => new Promise(resolve => {
                SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                    if (buf) audioBuffersRef.current.set(url, buf);
                    updateProgress();
                    resolve();
                });
            }));
            await Promise.all([...imgPromises, ...sndPromises]);
            setIsReady(true);
        };

        api.get('/games/test-data').then(data => {
            let levelsData = data?.levels?.length > 0 ? data.levels : [{ name: "Defaut", questions: [{ q: "Q1", options:["A","B"], a:0 }] }];
            setAllLevels(levelsData);
            preloadAssets();
        });

        const handleKeyDown = (e) => { 
            // Si on est dans l'input, on ne capture pas les touches pour le jeu
            if (e.target.tagName !== 'INPUT') keysPressed.current[e.code] = true; 
        };
        const handleKeyUp = (e) => { keysPressed.current[e.code] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { 
            window.removeEventListener('keydown', handleKeyDown); 
            window.removeEventListener('keyup', handleKeyUp);
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
            stopAllSounds();
            clearAllTimeouts();
        };
    }, [project]);

    const initLevel = (idx, sourceData) => {
        if (!sourceData[idx]) return;
        stopAllSounds(); clearAllTimeouts(); 
        const lvl = sourceData[idx];
        setCurrentLevelIdx(idx);
        setLevelQuestions(lvl.questions || []);
        setQuestionStates(new Array((lvl.questions || []).length).fill(0));
        setCurrentQIndex(0);
        setIsLevelWon(false); setIsGameOver(false); setIsGameCompleted(false);
        setIsStudyPhase(true);
        isPausedRef.current = true;
    };

    const startLevelAfterStudy = () => {
        setIsStudyPhase(false);
        setShowLevelTitle(true);
        safeTimeout(() => {
            setShowLevelTitle(false);
            isPausedRef.current = false; 
            if (gameInstanceRef.current && gameInstanceRef.current.start) {
                gameInstanceRef.current.start();
            }
            playSystemSound("DÉPART");
        }, 1500);
    };

    const handleGameOver = () => {
        stopAllSounds(); setIsGameOver(true); isPausedRef.current = true;
        safeTimeout(() => { playSystemSound("DÉFAITE"); }, 500);
    };

    const retryLevel = () => { setLives(4); initLevel(currentLevelIdx, allLevels); };

    const nextLevel = () => {
        const nextIdx = currentLevelIdx + 1;
        if (allLevels[nextIdx]) initLevel(nextIdx, allLevels);
        else {
            stopAllSounds(); setIsGameCompleted(true);
            safeTimeout(() => { playSystemSound("VICTOIRE"); }, 500);
        }
    };

    const triggerPlayerHit = () => {
        if (isPausedRef.current) return;
        setHitFlash(true);
        setTimeout(() => setHitFlash(false), 200);
        setLives(prev => {
            const newVal = Math.max(0, prev - 1);
            if (newVal === 0) { isPausedRef.current = true; safeTimeout(handleGameOver, 1000); }
            return newVal;
        });
    };

    const handleAnswerLogic = (isCorrect) => {
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        const newStates = [...questionStates];
        if (isCorrect) {
            newStates[currentQIndex] = Math.min(3, newStates[currentQIndex] + 1);
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(true);
        } else {
            newStates[currentQIndex] = Math.max(0, newStates[currentQIndex] - 1);
            if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(false);
            triggerPlayerHit();
        }
        setQuestionStates(newStates);
        
        // Reset input
        setInputValue("");

        safeTimeout(() => {
            setFeedback(null);
            if (lives > 0) {
                // On cherche une question non finie
                const available = newStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
                
                // Si la question courante n'est pas finie, on y reste (avec un petit délai pour la feedback)
                // Sinon on change
                if (available.length > 0) {
                    if (newStates[currentQIndex] < 3) {
                        // On reste sur la même question si pas finie
                        setCurrentQIndex(currentQIndex);
                        // On re-focus l'input si boss phase
                        if (newStates[currentQIndex] >= 2) {
                            setTimeout(() => inputRef.current?.focus(), 50);
                        }
                    } else {
                        // Question finie, on passe à une autre
                        setCurrentQIndex(available[Math.floor(Math.random() * available.length)]);
                    }
                } else {
                    setIsLevelWon(true); isPausedRef.current = true;
                    if (gameInstanceRef.current?.onLevelWin) gameInstanceRef.current.onLevelWin();
                    safeTimeout(nextLevel, 4000);
                }
            }
        }, 1000);
    };

    const handleAnswerClick = (choiceIdx) => {
        if (feedback || currentQIndex === -1 || isPausedRef.current) return;
        const currentQ = levelQuestions[currentQIndex];
        const isCorrect = currentQ.a === choiceIdx;
        handleAnswerLogic(isCorrect);
    };

    const handleInputSubmit = (e) => {
        if (e) e.preventDefault();
        if (feedback || currentQIndex === -1 || isPausedRef.current) return;
        const currentQ = levelQuestions[currentQIndex];
        const correctText = currentQ.options[currentQ.a];
        
        const isCorrect = normalize(inputValue) === normalize(correctText);
        handleAnswerLogic(isCorrect);
    };

    const handleStartGame = async () => {
        if (audioCtxRef.current) { try { await audioCtxRef.current.resume(); } catch (e) {} }
        setEngineStarted(true);
        initLevel(0, allLevels);
    };

    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;
        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const gameCallbacks = { onPlayerHit: triggerPlayerHit, playSound: (name) => {} };
            const BaseFactory = new Function('params', `
                const { audioBuffers, audioCtx, project, sceneIdx, imageAssets, resolveUrl, canvas, ctx, activeSources, isMutedRef } = params;
                class ActorProxy {
                    constructor(data, engine) { 
                        this.id = data.id; this.name = data.name; this.engine = engine;
                        this.initialX = data.initialX || 50; this.initialY = data.initialY || 50;
                        this.x = this.initialX; this.y = this.initialY;
                        this.baseScale = data.scale || 1; 
                        this.scale = this.baseScale; // Scale dynamique
                        this.visible = true;
                        this.direction = data.direction || 0;
                        this.rotationStyle = data.rotationStyle || 'all';
                        this.currentAction = data.actions?.[0]?.name || 'IDLE';
                        this.frameIdx = 0; this.lastAnimTime = 0;
                    }
                    play(name) { 
                        if(this.currentAction.toUpperCase() !== name.toUpperCase()) { 
                            this.currentAction = name; this.frameIdx = 0;
                            this.engine._triggerActionSounds(this.id, name);
                        } 
                    }
                }
                return class MiniGameBase {
                    constructor(c, a, cb) {
                        this.canvas = c || canvas; this.ctx = ctx; this.keys = {};
                        this.callbacks = cb; this.assets = a || {};
                        this.currentLevel = 1; 
                        this.isBossPhase = false; // FLAG POUR LE JEU
                        const s = project.scenes[sceneIdx];
                        if(s && s.actors) s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a, this); });
                        // Ne pas écraser les listeners globaux React
                    }
                    _triggerActionSounds(actorId, actionName) {
                        const actor = project.scenes[sceneIdx].actors.find(a => a.id === actorId);
                        const action = actor?.actions.find(act => act.name.toUpperCase() === actionName.toUpperCase());
                        if(action && action.sounds) action.sounds.forEach(snd => this._playSound(snd.url));
                    }
                    _playSound(url) {
                        if (isMutedRef.current) return;
                        try {
                            const buffer = audioBuffers.get(url);
                            if(buffer && audioCtx) {
                                if (audioCtx.state === 'suspended') audioCtx.resume();
                                const source = audioCtx.createBufferSource();
                                source.buffer = buffer; source.connect(audioCtx.destination); source.start(0);
                                activeSources.push(source);
                            }
                        } catch(e) {}
                    }
                    _render() {
                        const s = project.scenes[sceneIdx];
                        ctx.fillStyle = "#0f172a"; ctx.fillRect(0,0,canvas.width, canvas.height);
                        const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
                        if(bd) {
                            const key = resolveUrl(bd.url);
                            const img = imageAssets.get(key);
                            if(img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        }
                        for(let key in this) {
                            const p = this[key];
                            if(p instanceof ActorProxy && p.visible) {
                                const aData = project.scenes[sceneIdx].actors.find(ac => ac.id === p.id);
                                if(!aData) continue;
                                const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                                if(act && act.frames && act.frames.length > 0) {
                                    const now = Date.now();
                                    if (now - p.lastAnimTime > (act.speed || 100)) { p.frameIdx = (p.frameIdx+1)%act.frames.length; p.lastAnimTime=now; }
                                    const assetKey = resolveUrl(act.frames[p.frameIdx].url);
                                    const spr = imageAssets.get(assetKey);
                                    if(spr) {
                                        const xPx = (p.x/100)*canvas.width; const yPx = (p.y/100)*canvas.height; 
                                        let sz = 150 * p.scale; // Utilise l'échelle dynamique
                                        this.ctx.save(); this.ctx.translate(xPx, yPx);
                                        if(p.rotationStyle === 'left-right' && Math.abs(p.scale) !== p.scale) this.ctx.scale(Math.sign(p.scale), 1);
                                        else if (p.direction) this.ctx.rotate(p.direction * Math.PI / 180);
                                        // Filtre Rouge pour Boss
                                        if (this.isBossPhase && p.name === 'ZOMBIE') {
                                            this.ctx.filter = "drop-shadow(0 0 10px red) hue-rotate(-50deg)";
                                        }
                                        this.ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); 
                                        this.ctx.filter = "none";
                                        this.ctx.restore();
                                    }
                                }
                            }
                        }
                    }
                }
            `);
            const MiniGameBase = BaseFactory({ audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, imageAssets: imageAssetsRef.current, resolveUrl, project, sceneIdx: activeSceneIdx, canvas, ctx, activeSources: activeSourcesRef.current, isMutedRef: isMutedRef });
            const UserCodeFactory = new Function('MiniGameBase', `${code}\nreturn MiniGame;`);
            const UserGameClass = UserCodeFactory(MiniGameBase);
            const instance = new UserGameClass(canvas, {}, gameCallbacks);
            gameInstanceRef.current = instance;
            const tick = () => {
                if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                instance.currentLevel = currentLevelIdx + 1;
                
                // INJECTION ÉTAT BOSS
                if (currentQIndex !== -1 && questionStates[currentQIndex] >= 2) {
                    instance.isBossPhase = true;
                } else {
                    instance.isBossPhase = false;
                }

                if (!isPausedRef.current && instance.update) instance.update();
                if (instance._render) instance._render();
                if (instance.draw) instance.draw();
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) { console.error("Crash Game", e); }
    }, [engineStarted]);

    const currentLvlData = allLevels[currentLevelIdx];
    const embedUrl = getYoutubeEmbedUrl(currentLvlData?.intro?.videoUrl);
    
    // Détection Boss Phase pour l'UI
    const isBossUI = currentQIndex !== -1 && questionStates[currentQIndex] >= 2;

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
             
             {activeFocus && (
                 <div className="fixed inset-0 z-[100000] bg-slate-950/98 backdrop-blur-2xl flex flex-col items-center justify-center p-10 animate-in zoom-in duration-300">
                    <button 
                        onClick={() => setActiveFocus(null)}
                        className="absolute top-10 right-10 w-16 h-16 bg-white rounded-full font-black text-2xl shadow-2xl hover:scale-110 transition-transform flex items-center justify-center"
                    >
                        ✕
                    </button>
                    
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        {activeFocus === 'SHEET' ? (
                            <img src={resolveUrl(currentLvlData.intro.sheetUrl)} className="max-w-full max-h-full object-contain shadow-2xl rounded-2xl border-4 border-white/10" />
                        ) : (
                            <iframe 
                                className="w-full max-w-6xl aspect-video rounded-3xl shadow-2xl border-4 border-white/10" 
                                src={embedUrl} 
                                frameBorder="0" 
                                allow="autoplay; encrypted-media" 
                                allowFullScreen
                            ></iframe>
                        )}
                        <h2 className="text-white font-black text-2xl uppercase mt-8 tracking-widest opacity-50">Appuyez sur la croix pour revenir à la préparation</h2>
                    </div>
                 </div>
             )}

             {hitFlash && <div className="absolute inset-0 bg-red-500/30 z-[100] pointer-events-none animate-ping"></div>}
             <button onClick={onStop} className="absolute top-6 right-6 bg-red-600 text-white w-12 h-12 rounded-full font-black text-2xl shadow-xl border-4 border-white hover:scale-110 transition-all flex items-center justify-center pointer-events-auto z-50">✕</button>

             {!engineStarted ? (
                 <button onClick={handleStartGame} disabled={!isReady} className={`px-20 py-10 rounded-full font-black text-5xl shadow-2xl border-8 transition-all ${isReady ? 'bg-white text-indigo-600 border-indigo-200 hover:scale-110 animate-pulse' : 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed'}`}>
                    {isReady ? "🚀 JOUER" : `CHARGEMENT ${loadProgress}...`}
                 </button>
             ) : (
                <>
                    <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                        <div className="flex gap-4 pointer-events-auto">
                            <div 
                                className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl flex gap-1 cursor-pointer hover:border-red-500 transition-colors"
                                onClick={() => { if (keysPressed.current['KeyF']) triggerPlayerHit(); }}
                            >
                                {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                            </div>

                            <button 
                                onClick={() => setIsMuted(!isMuted)}
                                className={`w-16 h-16 rounded-2xl border-2 shadow-xl flex items-center justify-center text-2xl transition-all ${isMuted ? 'bg-red-900/80 border-red-500 text-red-200' : 'bg-slate-900/80 border-slate-700 text-white hover:border-indigo-500'}`}
                            >
                                {isMuted ? '🔇' : '🔊'}
                            </button>
                        </div>

                        <div className="flex-1 flex justify-center px-4">
                            {levelQuestions[currentQIndex] && !isStudyPhase && !isLevelWon && !isGameOver && !showLevelTitle && (
                                <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto animate-in slide-in-from-top">
                                    {feedback === 'CORRECT' ? "✅ BRAVO !" : feedback === 'WRONG' ? "❌ RATÉ..." : levelQuestions[currentQIndex].q}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 items-center pointer-events-auto mr-20">
                            {questionStates.map((mastery, idx) => (
                                <div key={idx} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden cursor-pointer ${currentQIndex === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-60'}`}>
                                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in">
                        <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 rounded-xl transition-colors duration-500 ${isBossUI ? 'border-red-600 shadow-red-900/50' : 'border-slate-800'}`} />
                        
                        {isStudyPhase && currentLvlData && (
                            <div className="absolute inset-4 bg-slate-900/95 backdrop-blur-xl rounded-xl z-50 flex flex-col p-6 border-2 border-indigo-500 animate-in fade-in duration-300">
                                <h2 className="text-3xl font-black text-indigo-400 uppercase text-center mb-4">Préparation : {currentLvlData.name}</h2>
                                <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
                                    
                                    <div 
                                        className="flex-1 bg-white rounded-lg overflow-hidden border-4 border-slate-800 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors group relative"
                                        onClick={() => currentLvlData.intro?.sheetUrl && setActiveFocus('SHEET')}
                                    >
                                        {currentLvlData.intro?.sheetUrl ? (
                                            <>
                                                <img src={resolveUrl(currentLvlData.intro.sheetUrl)} className="max-w-full max-h-full object-contain" />
                                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="text-white font-black text-lg uppercase tracking-tighter shadow-lg">🔍 CLIQUE POUR AGRANDIR</span>
                                                </div>
                                            </>
                                        ) : <div className="text-slate-300 font-bold uppercase">Aucune fiche niveau</div>}
                                    </div>

                                    <div 
                                        className="flex-1 bg-black rounded-lg overflow-hidden border-4 border-slate-800 flex items-center justify-center cursor-pointer hover:border-red-500 transition-colors group relative"
                                        onClick={() => embedUrl && setActiveFocus('VIDEO')}
                                    >
                                        {embedUrl ? (
                                            <>
                                                <iframe className="w-full h-full pointer-events-none" src={embedUrl} frameBorder="0"></iframe>
                                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="text-white font-black text-lg uppercase tracking-tighter shadow-lg">🎬 CLIQUE POUR PLEIN ÉCRAN</span>
                                                </div>
                                            </>
                                        ) : <div className="text-slate-600 font-bold uppercase">Aucune vidéo niveau</div>}
                                    </div>

                                </div>
                                <button onClick={startLevelAfterStudy} className="mt-6 bg-indigo-600 text-white py-4 rounded-2xl font-black text-2xl hover:scale-105 transition-transform shadow-xl border-b-8 border-indigo-900 active:border-b-0 active:translate-y-2 uppercase">J'ai compris, on commence !</button>
                            </div>
                        )}

                        {showLevelTitle && (
                            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center rounded-xl z-40 animate-in fade-in">
                                <h1 className="text-6xl font-black text-yellow-400 drop-shadow-lg mb-4">NIVEAU {currentLevelIdx + 1}</h1>
                            </div>
                        )}
                        {isLevelWon && (
                            <div className="absolute inset-0 flex items-center justify-center bg-green-900/80 backdrop-blur-sm rounded-xl animate-in zoom-in z-40">
                                <h2 className="text-5xl font-black text-white uppercase">Niveau Réussi !</h2>
                            </div>
                        )}
                        {isGameOver && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 backdrop-blur-md rounded-xl z-50">
                                <h2 className="text-6xl font-black text-white uppercase mb-8">💀 GAME OVER</h2>
                                <button onClick={retryLevel} className="bg-white text-red-600 px-8 py-4 rounded-full font-black text-xl uppercase">🔄 Réessayer</button>
                            </div>
                        )}
                        {isGameCompleted && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-500/90 backdrop-blur-md rounded-xl z-50">
                                <h2 className="text-6xl font-black text-white uppercase mb-4">VICTOIRE TOTALE !</h2>
                                <button onClick={onStop} className="mt-8 bg-white text-yellow-600 px-8 py-4 rounded-full font-black text-xl uppercase">QUITTER</button>
                            </div>
                        )}
                    </div>

                    {!isLevelWon && !isGameOver && !isGameCompleted && !showLevelTitle && !isStudyPhase && levelQuestions[currentQIndex] && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            {isBossUI ? (
                                <form onSubmit={handleInputSubmit} className="flex gap-4 w-full max-w-2xl bg-white/10 backdrop-blur-md p-4 rounded-2xl border-2 border-red-500 animate-pulse">
                                    <input 
                                        ref={inputRef}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="flex-1 bg-white/90 text-red-600 font-black text-2xl uppercase text-center rounded-xl outline-none placeholder-red-200 border-2 border-red-200 focus:border-red-600"
                                        placeholder="TAPEZ LA RÉPONSE..."
                                        autoFocus
                                    />
                                    <button type="submit" className="bg-red-600 text-white px-8 rounded-xl font-black uppercase shadow-lg hover:scale-105 transition-transform">
                                        TIRER 🔫
                                    </button>
                                </form>
                            ) : (
                                <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                                    {levelQuestions[currentQIndex].options.map((o, i) => (
                                        <button key={i} onClick={() => handleAnswerClick(i)} className="bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-lg shadow-xl hover:bg-indigo-500 border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2">{o}</button>
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
