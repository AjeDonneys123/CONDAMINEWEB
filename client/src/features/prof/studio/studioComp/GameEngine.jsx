// @signatures: GameEngine
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';
import { api } from '../../../../services/api';

export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const livesRef = useRef(4);
    const inputRef = useRef(null);
    const bossModeRef = useRef(false);
    const lastInteractionRef = useRef(0);
    const loopIdRef = useRef(0);
    const projectRef = useRef(project);
    const frameIdRef = useRef(null);
    const gameInstanceRef = useRef(null);
    const isMutedRef = useRef(false);
    const isPausedRef = useRef(false);
    
    const activeTimeoutsRef = useRef([]);
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const activeSourcesRef = useRef([]);
    const keysPressed = useRef({}); 

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
    const [inputValue, setInputValue] = useState("");
    const [isMuted, setIsMuted] = useState(false);
    const [isStudyPhase, setIsStudyPhase] = useState(false);
    const [activeFocus, setActiveFocus] = useState(null); 
    const [showLevelTitle, setShowLevelTitle] = useState(false);
    const [isLevelWon, setIsLevelWon] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isGameCompleted, setIsGameCompleted] = useState(false);

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { livesRef.current = lives; }, [lives]);
    useEffect(() => { projectRef.current = project; }, [project]);

    // SURVEILLANCE DES VIES POUR GAME OVER (VÉGÉ : AJOUT DÉLAI)
    useEffect(() => {
        if (lives === 0 && !isGameOver) {
            // On laisse le temps à l'animation "TOUCHE" de se faire (1.5s)
            safeTimeout(() => {
                handleGameOver();
            }, 1500);
        }
    }, [lives]);

    useEffect(() => {
        const isBoss = (currentQIndex !== -1 && questionStates[currentQIndex] >= 2);
        bossModeRef.current = isBoss;
        if (gameInstanceRef.current) gameInstanceRef.current.isBossPhase = isBoss;
    }, [currentQIndex, questionStates]);

    const normalize = (str) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    
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

    const getYoutubeEmbedUrl = (url) => {
        if (!url) return null;
        let v = "";
        if (url.includes("v=")) v = url.split("v=")[1]?.split("&")[0];
        else if (url.includes("youtu.be/")) v = url.split("youtu.be/")[1]?.split("?")[0];
        else if (url.includes("embed/")) v = url.split("embed/")[1]?.split("?")[0];
        return v ? `https://www.youtube.com/embed/${v}?autoplay=1` : null;
    };

    const playSystemSound = (soundName) => {
        if (isMutedRef.current || !project || !audioCtxRef.current) return;
        const scene = project.scenes[activeSceneIdx];
        const soundEvent = scene?.globalSounds?.find(gs => gs.name.toUpperCase().trim() === soundName.toUpperCase().trim());
        if (!soundEvent || !soundEvent.sounds) return;
        
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
        
        soundEvent.sounds.forEach(snd => {
            const buffer = audioBuffersRef.current.get(snd.url);
            if (buffer) {
                try {
                    const s = audioCtxRef.current.createBufferSource();
                    s.buffer = buffer;
                    s.connect(audioCtxRef.current.destination);
                    s.start(0);
                    activeSourcesRef.current.push(s);
                } catch (e) {}
            }
        });
    };

    const handleGameOver = () => {
        stopAllSounds();
        setIsGameOver(true);
        isPausedRef.current = true;
        playSystemSound("DÉFAITE");
    };

    const triggerPlayerHit = () => {
        const now = Date.now();
        // Cooldown pour éviter de perdre 4 vies en une frame de collision
        if (now - lastInteractionRef.current < 1000) return;
        lastInteractionRef.current = now;

        setHitFlash(true); 
        setTimeout(() => setHitFlash(false), 200);
        
        setLives(prev => Math.max(0, prev - 1));
    };

    const initLevel = (idx, data) => {
        if (!data[idx]) return;
        stopAllSounds(); 
        clearAllTimeouts();
        setCurrentLevelIdx(idx);
        setLevelQuestions(data[idx].questions || []);
        setQuestionStates(new Array((data[idx].questions || []).length).fill(0));
        setCurrentQIndex(0);
        setIsLevelWon(false); 
        setIsGameOver(false); 
        setIsGameCompleted(false);
        setIsStudyPhase(true); 
        isPausedRef.current = true;
    };

    const handleAnswerLogic = (isCorrect) => {
        if (livesRef.current <= 0 || isGameOver) return;

        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        const newStates = [...questionStates];
        
        if (isCorrect) {
            newStates[currentQIndex] = Math.min(3, newStates[currentQIndex] + 1);
            if (gameInstanceRef.current && typeof gameInstanceRef.current.onResult === 'function') {
                gameInstanceRef.current.onResult(true);
            }
        } else {
            if (newStates[currentQIndex] > 0) newStates[currentQIndex] -= 1;
            if (gameInstanceRef.current && typeof gameInstanceRef.current.onResult === 'function') {
                gameInstanceRef.current.onResult(false);
            }
            triggerPlayerHit();
        }
        
        setQuestionStates(newStates);
        setInputValue("");

        safeTimeout(() => {
            setFeedback(null);
            
            if (livesRef.current > 0 && !isGameOver) {
                const available = newStates.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
                
                if (available.length > 0) {
                    if (newStates[currentQIndex] < 3) {
                        setCurrentQIndex(currentQIndex);
                        if (newStates[currentQIndex] >= 2) setTimeout(() => inputRef.current?.focus(), 50);
                    } else {
                        setCurrentQIndex(available[Math.floor(Math.random() * available.length)]);
                    }
                } else {
                    setIsLevelWon(true);
                    isPausedRef.current = true;
                    playSystemSound("UPLEVEL");
                    safeTimeout(() => {
                        setLives(4);
                        if (allLevels[currentLevelIdx + 1]) initLevel(currentLevelIdx + 1, allLevels);
                        else setIsGameCompleted(true);
                    }, 4000);
                }
            }
        }, 1000);
    };

    const handleBarClick = (idx) => {
        if (keysPressed.current['KeyF'] || keysPressed.current['Keyf']) {
            const ns = [...questionStates]; ns[idx] = Math.min(3, ns[idx] + 1); setQuestionStates(ns);
            if (idx === currentQIndex && ns[idx] >= 2) setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const handleForceWin = () => {
        if (keysPressed.current['KeyF'] || keysPressed.current['Keyf']) {
            setIsLevelWon(true); 
            isPausedRef.current = true;
            playSystemSound("UPLEVEL");
            safeTimeout(() => {
                setLives(4);
                if (allLevels[currentLevelIdx + 1]) initLevel(currentLevelIdx + 1, allLevels);
                else setIsGameCompleted(true);
            }, 1000);
        }
    };

    const handleAnswerClick = (idx) => {
        if (!feedback && currentQIndex !== -1 && !isGameOver) {
            const isCorrect = levelQuestions[currentQIndex].a === idx;
            handleAnswerLogic(isCorrect);
        }
    };

    const handleInputSubmit = (e) => {
        e.preventDefault();
        if (!feedback && currentQIndex !== -1 && !isGameOver) {
            const correct = levelQuestions[currentQIndex].options[levelQuestions[currentQIndex].a];
            handleAnswerLogic(normalize(inputValue) === normalize(correct));
        }
    };

    const handleStartGame = async () => {
        if (audioCtxRef.current) { try { await audioCtxRef.current.resume(); } catch (e) {} }
        setEngineStarted(true);
        initLevel(0, allLevels);
    };

    const retryLevel = () => { setLives(4); initLevel(currentLevelIdx, allLevels); };

    useEffect(() => {
        const load = async () => {
            if (!project) return;
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const scene = project.scenes?.[activeSceneIdx];
            if (!scene) { setIsReady(true); return; }
            
            const imgUrls = [...new Set((scene.actors||[]).flatMap(a=>(a.actions||[]).flatMap(ac=>(ac.frames||[]).map(f=>f.url))).concat((scene.backdrops||[]).map(b=>b.url)))].filter(Boolean);
            const sndUrls = [...new Set((scene.actors||[]).flatMap(a=>(a.actions||[]).flatMap(ac=>(ac.sounds||[]).map(s=>s.url))).concat((scene.globalSounds||[]).flatMap(g=>(g.sounds||[]).map(s=>s.url))))].filter(Boolean);
            
            let c = 0, tot = imgUrls.length;
            imageAssetsRef.current.clear();
            
            await Promise.all(imgUrls.map(u => new Promise(r => { 
                const i=new Image(); i.crossOrigin="anonymous"; 
                i.onload=()=>{imageAssetsRef.current.set(resolveUrl(u),i); c++; setLoadProgress(Math.round(c/tot*100)+"%"); r();}; 
                i.onerror=r; i.src=resolveUrl(u); 
            })));
            
            await Promise.all(sndUrls.map(u => SoundExpert.decodeAudio(resolveUrl(u), audioCtxRef.current).then(b => { if(b) audioBuffersRef.current.set(u, b); })));
            setIsReady(true);
        };

        api.get('/games/test-data').then(d => { 
            setAllLevels(d?.levels?.length > 0 ? d.levels : [{name:"Defaut", questions:[{q:"Q1",options:["A","B"],a:0}]}]); 
            load(); 
        });

        const kd = (e) => { if(e.code === 'KeyF' || e.target.tagName !== 'INPUT') keysPressed.current[e.code]=true; };
        const ku = (e) => { keysPressed.current[e.code]=false; };
        window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
        return () => { 
            window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); 
            if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
            stopAllSounds();
        };
    }, [project]);

    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;

        const myLoopId = Date.now();
        loopIdRef.current = myLoopId;

        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            const callbacks = {
                onPlayerHit: () => triggerPlayerHit(),
                onResult: (res) => {} 
            };

            const BaseFactory = new Function('params', `
                const { audioBuffers, audioCtx, projectRef, sceneIdx, imageAssets, resolveUrl, canvas, ctx, activeSources, isMutedRef, bossModeRef } = params;
                
                class ActorProxy {
                    constructor(data, engine) { 
                        this.id = data.id; this.name = data.name; this.engine = engine;
                        this.initialX = data.initialX||50; this.initialY = data.initialY||50;
                        this.x = this.initialX; this.y = this.initialY;
                        this.baseScale = data.scale||1; this.scale = this.baseScale;
                        this.visible = true;
                        this.direction = data.direction||0; this.rotationStyle = data.rotationStyle||'all';
                        
                        this.currentAction = data.actions?.[0]?.name || 'IDLE';
                        this.frameIdx = 0; 
                        this.lastAnimTime = 0;
                        this.isAnimFinished = false; 
                        this.loop = true;
                    }
                    play(name, loop = true) { 
                        if(this.currentAction.toUpperCase() !== name.toUpperCase()) { 
                            this.currentAction = name; 
                            this.frameIdx = 0;
                            this.loop = loop; 
                            this.isAnimFinished = false;
                            this.engine._triggerActionSounds(this.id, name);
                        } 
                    }
                }

                return class MiniGameBase {
                    constructor(c, a, cb) {
                        this.canvas = c || canvas; this.ctx = ctx; this.keys = {};
                        this.callbacks = cb; this.assets = a || {};
                        this.isBossPhase = false; 
                        const s = projectRef.current.scenes[sceneIdx];
                        if(s && s.actors) s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a, this); });
                    }
                    _triggerActionSounds(actorId, actionName) {
                        const s = projectRef.current.scenes[sceneIdx];
                        const actor = s.actors.find(a => a.id === actorId);
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
                        const s = projectRef.current.scenes[sceneIdx];
                        if (!this.ctx || !this.canvas) return;

                        this.ctx.fillStyle = "#0f172a"; 
                        this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
                        
                        const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
                        if(bd) {
                            const img = imageAssets.get(resolveUrl(bd.url));
                            if(img) this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                        }
                        
                        for(let key in this) {
                            const p = this[key];
                            if(p instanceof ActorProxy && p.visible) {
                                const aData = s.actors.find(ac => ac.id === p.id);
                                if(!aData) continue;
                                const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                                
                                if(act && act.frames && act.frames.length > 0) {
                                    const now = Date.now();
                                    const speed = parseInt(act.speed) || 100;
                                    const totalFrames = act.frames.length;

                                    if (now - p.lastAnimTime > speed) { 
                                        if (!p.isAnimFinished) {
                                            p.frameIdx++;
                                            if (p.frameIdx >= totalFrames) {
                                                if (p.loop) { p.frameIdx = 0; } 
                                                else { p.frameIdx = totalFrames - 1; p.isAnimFinished = true; }
                                            }
                                            p.lastAnimTime = now; 
                                        }
                                    }
                                    
                                    const safeIdx = Math.min(p.frameIdx, totalFrames - 1);
                                    const assetKey = resolveUrl(act.frames[safeIdx].url);
                                    
                                    const spr = imageAssets.get(assetKey);
                                    if(spr) {
                                        const xPx = (p.x/100)*this.canvas.width; 
                                        const yPx = (p.y/100)*this.canvas.height; 
                                        let sz = 150 * p.scale; 
                                        
                                        this.ctx.save(); 
                                        this.ctx.translate(xPx, yPx);
                                        if(p.rotationStyle === 'left-right' && Math.abs(p.scale) !== p.scale) this.ctx.scale(Math.sign(p.scale), 1);
                                        else if (p.direction) this.ctx.rotate(p.direction * Math.PI / 180);
                                        
                                        if (this.isBossPhase && p.name === 'ZOMBIE') {
                                            this.ctx.filter = "drop-shadow(0 0 15px red) hue-rotate(-50deg)";
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

            const MiniGameBase = BaseFactory({ audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, imageAssets: imageAssetsRef.current, resolveUrl, projectRef, sceneIdx: activeSceneIdx, canvas, ctx, activeSources: activeSourcesRef.current, isMutedRef: isMutedRef, bossModeRef: bossModeRef });
            const UserCodeFactory = new Function('MiniGameBase', `${code}\nreturn MiniGame;`);
            const UserGameClass = UserCodeFactory(MiniGameBase);
            
            const instance = new UserGameClass(canvas, {}, callbacks);
            gameInstanceRef.current = instance;
            
            if (instance.start) instance.start();

            const tick = () => {
                if (loopIdRef.current !== myLoopId) return;

                if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                instance.currentLevel = currentLevelIdx + 1;
                instance.isBossPhase = bossModeRef.current;

                if (isPausedRef.current === false) {
                    if (instance.update) instance.update();
                }
                
                if (instance._render) instance._render();
                if (instance.draw) instance.draw();
                
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();

        } catch (e) { console.error("Crash Game Engine:", e); }
        
        return () => {
             if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
        };

    }, [engineStarted]);

    const isBossUI = currentQIndex !== -1 && questionStates[currentQIndex] >= 2;

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
             
             {activeFocus && (
                 <div className="fixed inset-0 z-[100000] bg-slate-950/98 backdrop-blur-2xl flex flex-col items-center justify-center p-10 animate-in zoom-in duration-300">
                    <button onClick={() => setActiveFocus(null)} className="absolute top-10 right-10 w-16 h-16 bg-white rounded-full font-black text-2xl shadow-2xl hover:scale-110 transition-transform flex items-center justify-center">✕</button>
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        {activeFocus === 'SHEET' ? <img src={resolveUrl(allLevels[currentLevelIdx].intro.sheetUrl)} className="max-w-full max-h-full object-contain shadow-2xl rounded-2xl border-4 border-white/10" /> : <div className="text-white">VIDEO</div>}
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
                            <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl flex gap-1 cursor-pointer hover:border-red-500 transition-colors" onClick={() => { if (keysPressed.current['KeyF']) triggerPlayerHit(); }}>
                                {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                            </div>
                            <button onClick={() => setIsMuted(!isMuted)} className={`w-16 h-16 rounded-2xl border-2 shadow-xl flex items-center justify-center text-2xl transition-all ${isMuted ? 'bg-red-900/80 border-red-500 text-red-200' : 'bg-slate-900/80 border-slate-700 text-white hover:border-indigo-500'}`}>{isMuted ? '🔇' : '🔊'}</button>
                        </div>
                        <div className="flex-1 flex justify-center px-4">
                            {levelQuestions[currentQIndex] && !isStudyPhase && !isLevelWon && !isGameOver && !showLevelTitle && (
                                <div onClick={handleForceWin} className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto animate-in slide-in-from-top cursor-pointer hover:border-indigo-500 transition-colors">
                                    {feedback === 'CORRECT' ? "✅ BRAVO !" : feedback === 'WRONG' ? "❌ RATÉ..." : levelQuestions[currentQIndex].q}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 items-center pointer-events-auto mr-20">
                            {questionStates.map((mastery, idx) => (
                                <div key={idx} onClick={() => handleBarClick(idx)} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden cursor-pointer ${currentQIndex === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-60'}`}>
                                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in">
                        <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 rounded-xl transition-all duration-500 ${isBossUI ? 'border-red-600 shadow-red-900/50 scale-[1.02]' : 'border-slate-800'}`} />
                        
                        {isStudyPhase && allLevels[currentLevelIdx] && (
                            <div className="absolute inset-4 bg-slate-900/95 backdrop-blur-xl rounded-xl z-50 flex flex-col p-6 border-2 border-indigo-500 animate-in fade-in duration-300">
                                <h2 className="text-3xl font-black text-indigo-400 uppercase text-center mb-4">Préparation : {allLevels[currentLevelIdx].name}</h2>
                                <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
                                    <div className="flex-1 bg-white rounded-lg overflow-hidden border-4 border-slate-800 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors group relative" onClick={() => allLevels[currentLevelIdx].intro?.sheetUrl && setActiveFocus('SHEET')}>
                                        {allLevels[currentLevelIdx].intro?.sheetUrl ? <img src={resolveUrl(allLevels[currentLevelIdx].intro.sheetUrl)} className="max-w-full max-h-full object-contain" /> : <div className="text-slate-300 font-bold uppercase">Aucune fiche</div>}
                                    </div>
                                    <div className="flex-1 bg-black rounded-lg overflow-hidden border-4 border-slate-800 flex items-center justify-center cursor-pointer hover:border-red-500 transition-colors group relative" onClick={() => getYoutubeEmbedUrl(allLevels[currentLevelIdx]?.intro?.videoUrl) && setActiveFocus('VIDEO')}>
                                        {getYoutubeEmbedUrl(allLevels[currentLevelIdx]?.intro?.videoUrl) ? <iframe className="w-full h-full pointer-events-none" src={getYoutubeEmbedUrl(allLevels[currentLevelIdx].intro.videoUrl)} frameBorder="0"></iframe> : <div className="text-slate-600 font-bold uppercase">Aucune vidéo</div>}
                                    </div>
                                </div>
                                <button onClick={() => { setIsStudyPhase(false); setShowLevelTitle(true); setTimeout(() => { setShowLevelTitle(false); isPausedRef.current = false; playSystemSound("DÉPART"); }, 1500); }} className="mt-6 bg-indigo-600 text-white py-4 rounded-2xl font-black text-2xl hover:scale-105 transition-transform shadow-xl border-b-8 border-indigo-900 active:border-b-0 active:translate-y-2 uppercase">J'ai compris, on commence !</button>
                            </div>
                        )}

                        {showLevelTitle && <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center rounded-xl z-40 animate-in fade-in"><h1 className="text-6xl font-black text-yellow-400 drop-shadow-lg mb-4">NIVEAU {currentLevelIdx + 1}</h1></div>}
                        {isLevelWon && <div className="absolute inset-0 flex items-center justify-center bg-green-900/80 backdrop-blur-sm rounded-xl animate-in zoom-in z-40"><h2 className="text-5xl font-black text-white uppercase">Niveau Réussi !</h2></div>}
                        {isGameOver && <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 backdrop-blur-md rounded-xl z-50"><h2 className="text-6xl font-black text-white uppercase mb-8">💀 GAME OVER</h2><button onClick={retryLevel} className="bg-white text-red-600 px-8 py-4 rounded-full font-black text-xl uppercase">🔄 Réessayer</button></div>}
                        {isGameCompleted && <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-500/90 backdrop-blur-md rounded-xl z-50"><h2 className="text-6xl font-black text-white uppercase mb-4">VICTOIRE TOTALE !</h2><button onClick={onStop} className="mt-8 bg-white text-yellow-600 px-8 py-4 rounded-full font-black text-xl uppercase">QUITTER</button></div>}
                    </div>

                    {!isLevelWon && !isGameOver && !isGameCompleted && !showLevelTitle && !isStudyPhase && levelQuestions[currentQIndex] && (
                        <div className="absolute bottom-10 w-full flex justify-center px-10 pointer-events-auto z-30">
                            {isBossUI ? (
                                <form onSubmit={handleInputSubmit} className="flex gap-4 w-full max-w-2xl bg-white/10 backdrop-blur-md p-4 rounded-2xl border-2 border-red-500 animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.5)]">
                                    <input ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="flex-1 bg-white/90 text-red-600 font-black text-2xl uppercase text-center rounded-xl outline-none placeholder-red-200 border-2 border-red-200 focus:border-red-600" placeholder="TAPEZ LA RÉPONSE..." autoFocus />
                                    <button type="submit" className="bg-red-600 text-white px-8 rounded-xl font-black uppercase shadow-lg hover:scale-105 transition-transform border-b-4 border-red-800 active:border-b-0 active:translate-y-1">ATTAQUER</button>
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
