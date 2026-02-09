// @signatures: GameEngine, initLevel, handleAnswerClick, triggerWinSequence, handleBarCheat
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';
import { api } from '../../../../services/api';

/**
 * 🎮 MOTEUR STUDIO V870 (RESTAURATION HUD + SON)
 * Combine le chargement audio sécurisé ET l'interface visuelle du Quiz.
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState("");
    const [debugLogs, setDebugLogs] = useState([]);
    
    // --- ÉTATS DU QUIZ (RESTAURÉS) ---
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(-1);
    const [lives, setLives] = useState(4);
    const [feedback, setFeedback] = useState(null);

    // --- ÉTATS VISUELS ---
    const [isLevelWon, setIsLevelWon] = useState(false);
    const isLevelWonRef = useRef(false);
    const [isPowerOff, setIsPowerOff] = useState(false);

    // Références persistantes
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const gameInstanceRef = useRef(null);
    const frameIdRef = useRef(null);
    const keysPressed = useRef({}); // Utilisation Ref pour éviter re-render

    const logSonde = (msg, type = 'info') => {
        const id = Math.random();
        setDebugLogs(prev => [...prev, { id, text: msg, type }].slice(-6));
    };

    // 1. INIT DONNÉES QUIZ
    useEffect(() => {
        api.get('/games/test-data').then(data => {
            // Fallback si pas de données de test
            const levelsData = data?.levels?.length > 0 ? data.levels : [{ 
                name: "Test Default", 
                questions: [
                    { q: "Quelle est la capitale de la France ?", options: ["Lyon", "Paris", "Marseille", "Lille"], a: 1 },
                    { q: "Combien font 2 + 2 ?", options: ["3", "4", "5", "22"], a: 1 }
                ] 
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
        const lvl = sourceData[idx];
        setCurrentLevelIdx(idx);
        const questions = lvl.questions || [];
        setLevelQuestions(questions);
        setQuestionStates(new Array(questions.length).fill(0));
        setIsLevelWon(false);
        isLevelWonRef.current = false;
        setIsPowerOff(false);
        if (questions.length > 0) setCurrentQIndex(0);
    };

    // 2. PRÉ-CHARGEMENT DES RESSOURCES
    useEffect(() => {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        const scene = project.scenes?.[activeSceneIdx];
        if (!scene) { setIsReady(true); return; }

        const imgUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
        imgUrls.forEach(url => {
            const img = new Image(); img.crossOrigin = "anonymous";
            img.onload = () => imageAssetsRef.current.set(resolveUrl(url), img);
            img.src = resolveUrl(url);
        });

        const sndUrls = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
        
        if (sndUrls.length === 0) {
            setIsReady(true);
        } else {
            setLoadProgress(`0/${sndUrls.length}`);
            let loaded = 0;
            sndUrls.forEach(url => {
                SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                    if (buf) audioBuffersRef.current.set(url, buf);
                    loaded++;
                    setLoadProgress(`${loaded}/${sndUrls.length}`);
                    if (loaded === sndUrls.length) {
                        setIsReady(true);
                        logSonde("✅ SONS PRÊTS", "success");
                    }
                });
            });
        }
        return () => {
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
            if (gameInstanceRef.current?.stop) gameInstanceRef.current.stop();
        };
    }, [project]);

    // 3. LOGIQUE JEU (RÉPONSES)
    const handleAnswerClick = (choiceIdx) => {
        if (feedback || currentQIndex === -1 || isLevelWonRef.current) return;
        const currentQ = levelQuestions[currentQIndex];
        const isCorrect = currentQ.a === choiceIdx;
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
                const nIdx = available[Math.floor(Math.random() * available.length)];
                setCurrentQIndex(nIdx);
            } else {
                triggerWinSequence();
            }
        }, 1000);
    };

    const triggerWinSequence = () => {
        setIsLevelWon(true);
        isLevelWonRef.current = true;
        if (gameInstanceRef.current?.onLevelWin) gameInstanceRef.current.onLevelWin();
        setTimeout(() => setIsPowerOff(true), 1500);
        setTimeout(() => {
            const nextLvlIdx = currentLevelIdx + 1;
            if (allLevels[nextLvlIdx]) initLevel(nextLvlIdx, allLevels);
            else { alert("🎉 JEU TERMINÉ !"); onStop(); }
        }, 4000);
    };

    // 4. DÉMARRAGE
    const handleStartGame = async () => {
        if (audioCtxRef.current) {
            try {
                await audioCtxRef.current.resume();
                const buffer = audioCtxRef.current.createBuffer(1, 1, 22050);
                const source = audioCtxRef.current.createBufferSource();
                source.buffer = buffer; source.connect(audioCtxRef.current.destination); source.start(0);
            } catch (e) {}
        }
        setEngineStarted(true);
    };

    // 5. ENGINE LOOP
    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;

        try {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Contexte 2D introuvable");

            // --- FACTORY ---
            const BaseFactory = new Function('params', `
                const { audioBuffers, audioCtx, logSonde, project, sceneIdx, imageAssets, resolveUrl, canvas, ctx } = params;
                
                class ActorProxy {
                    constructor(data, engine) { 
                        this.id = data.id; this.name = data.name; this.engine = engine;
                        this.x = data.initialX || 50; this.y = data.initialY || 50;
                        this.scale = data.scale || 1; this.visible = true;
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
                    constructor() {
                        this.canvas = canvas; this.ctx = ctx; this.keys = {};
                        const s = project.scenes[sceneIdx];
                        if(s && s.actors) s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a, this); });
                        
                        document.onkeydown = e => this.keys[e.code] = true;
                        document.onkeyup = e => this.keys[e.code] = false;
                    }

                    _triggerActionSounds(actorId, actionName) {
                        const actor = project.scenes[sceneIdx].actors.find(a => a.id === actorId);
                        const action = actor?.actions.find(act => act.name.toUpperCase() === actionName.toUpperCase());
                        if(action && action.sounds) action.sounds.forEach(snd => this._playSound(snd.url));
                    }

                    _playSound(url) {
                        const buffer = audioBuffers.get(url);
                        if(buffer && audioCtx) {
                            if (audioCtx.state === 'suspended') audioCtx.resume();
                            try {
                                const source = audioCtx.createBufferSource();
                                source.buffer = buffer; source.connect(audioCtx.destination); source.start(0);
                            } catch(e) { console.error(e); }
                        }
                    }

                    playGlobal(name) {
                        const s = project.scenes[sceneIdx];
                        const cleanName = name.toUpperCase().trim();
                        const gs = s.globalSounds?.find(g => g.name.toUpperCase().trim() === cleanName);
                        if (gs && gs.sounds) gs.sounds.forEach(snd => this._playSound(snd.url));
                    }

                    _render() {
                        const s = project.scenes[sceneIdx];
                        ctx.fillStyle = "#0f172a"; ctx.fillRect(0,0,canvas.width, canvas.height);
                        
                        const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
                        if(bd) {
                            const img = imageAssets.get(resolveUrl(bd.url));
                            if(img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        }

                        for(let key in this) {
                            const p = this[key];
                            if(p instanceof ActorProxy && p.visible) {
                                const aData = project.scenes[sceneIdx].actors.find(ac => ac.id === p.id);
                                if(!aData) continue;
                                const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                                if(act && act.frames?.length > 0) {
                                    const now = Date.now();
                                    if (now - p.lastAnimTime > (act.speed || 100)) { p.frameIdx = (p.frameIdx+1)%act.frames.length; p.lastAnimTime=now; }
                                    const spr = imageAssets.get(resolveUrl(act.frames[p.frameIdx].url));
                                    if(spr) {
                                        const xPx = (p.x/100)*canvas.width; const yPx = (p.y/100)*canvas.height; let sz = 150*p.scale;
                                        ctx.save(); ctx.translate(xPx, yPx);
                                        // Gestion Rotation/Miroir
                                        if(p.rotationStyle === 'left-right' && Math.abs(p.scale) !== p.scale) ctx.scale(Math.sign(p.scale), 1); // Fix Miroir
                                        else if (p.direction) ctx.rotate(p.direction * Math.PI / 180);
                                        ctx.drawImage(spr, -sz/2, -sz/2, sz, sz); ctx.restore();
                                    }
                                }
                            }
                        }
                    }
                }
            `);

            const MiniGameBase = BaseFactory({ 
                audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, 
                imageAssets: imageAssetsRef.current, resolveUrl, logSonde, project, sceneIdx: activeSceneIdx, canvas, ctx
            });

            const UserCodeFactory = new Function('MiniGameBase', `${code}\nreturn MiniGame;`);
            const UserGameClass = UserCodeFactory(MiniGameBase);
            const instance = new UserGameClass();
            gameInstanceRef.current = instance;

            if (instance.start) instance.start();
            
            const tick = () => {
                // Update keys from Ref
                if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                
                if (instance.update) instance.update();
                if (instance._render) instance._render();
                if (instance.draw) instance.draw();
                frameIdRef.current = requestAnimationFrame(tick);
            };
            tick();

        } catch (e) {
            logSonde("CRASH: " + e.message, "error");
            console.error(e);
        }
    }, [engineStarted]);

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
             
             {/* 🛑 BOUTON QUITTER 🛑 */}
             <button onClick={onStop} className="absolute top-6 right-6 bg-red-600 text-white w-12 h-12 rounded-full font-black text-2xl shadow-xl border-4 border-white hover:scale-110 transition-all flex items-center justify-center pointer-events-auto z-50">✕</button>

             {/* LOGS FLOTTANTS */}
             <div className="absolute top-20 left-4 flex flex-col gap-1 pointer-events-none z-40">
                {debugLogs.map(log => (
                    <div key={log.id} className={`px-3 py-1 rounded text-[9px] font-black shadow-lg border-l-4 ${log.type === 'error' ? 'bg-red-500 text-white' : log.type === 'success' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>
                        {log.text}
                    </div>
                ))}
             </div>

             {!engineStarted ? (
                 <button 
                    onClick={handleStartGame} 
                    disabled={!isReady}
                    className={`px-20 py-10 rounded-full font-black text-5xl shadow-2xl border-8 transition-all ${isReady ? 'bg-white text-indigo-600 border-indigo-200 hover:scale-110 animate-pulse' : 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed'}`}
                 >
                    {isReady ? "🚀 JOUER" : `CHARGEMENT (${loadProgress})...`}
                 </button>
             ) : (
                <>
                    {/* --- HUD DE JEU (RESTAURÉ) --- */}
                    <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-30">
                        {/* Vies */}
                        <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl pointer-events-auto flex gap-1">
                            {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                        </div>
                        
                        {/* Question */}
                        <div className="flex-1 flex justify-center px-4">
                            {levelQuestions[currentQIndex] && !isLevelWon && (
                                <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto animate-in slide-in-from-top">
                                    {feedback === 'CORRECT' ? "✅ BRAVO !" : feedback === 'WRONG' ? "❌ RATÉ..." : levelQuestions[currentQIndex].q}
                                </div>
                            )}
                        </div>

                        {/* Barres Progression */}
                        <div className="flex gap-2 items-center pointer-events-auto mr-20">
                            {questionStates.map((mastery, idx) => (
                                <div key={idx} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden transition-all ${currentQIndex === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-60'}`}>
                                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CANVAS */}
                    <div className="relative animate-in zoom-in">
                        <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 border-slate-800 rounded-xl transition-opacity duration-1000 ${isPowerOff ? 'opacity-0' : 'opacity-100'}`} />
                        
                        {/* Overlay Victoire */}
                        {isLevelWon && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-xl animate-in zoom-in z-40">
                                <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center border-8 border-green-500">
                                    <span className="text-6xl block mb-4">🏆</span>
                                    <h2 className="text-4xl font-black text-slate-800 uppercase">Niveau Réussi !</h2>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* BOUTONS RÉPONSES */}
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
