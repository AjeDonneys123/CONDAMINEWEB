// @signatures: GameEngine, initLevel, handleAnswerClick, triggerWinSequence, handleBarCheat, handleCanvasCheat
import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../../services/api';

/**
 * 🎮 MOTEUR DE JEU DÉDIÉ (VERSION UX FIX V479)
 * RÔLE : Arbitre JSX avec séparation stricte des Cheat Codes (Barre vs Reset).
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const gameInstanceRef = useRef(null);
    const [crash, setCrash] = useState(null);
    const [feedback, setFeedback] = useState(null);
    
    // --- ÉTATS DU QUIZ ---
    const [allLevels, setAllLevels] = useState([]); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [levelQuestions, setLevelQuestions] = useState([]); 
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(-1);
    const [lives, setLives] = useState(4);

    // --- ÉTATS DE STRUCTURE ---
    const [isLevelWon, setIsLevelWon] = useState(false);
    const isLevelWonRef = useRef(false); 
    const [isPowerOff, setIsPowerOff] = useState(false);
    const [keysPressed, setKeysPressed] = useState({});
    
    // CHEAT STATES
    const sPressed = keysPressed['KeyS'];
    const tPressed = keysPressed['KeyT'];
    const cheatReady = sPressed && tPressed;

    useEffect(() => {
        api.get('/games/test-data').then(data => {
            const levelsData = data?.levels?.length > 0 ? data.levels : [{ name: "Test", questions: [{ q: "Prêt ?", options: ["OUI", "NON"], a: 0 }] }];
            setAllLevels(levelsData);
            initLevel(0, levelsData);
        });
        
        const handleKeyDown = (e) => setKeysPressed(prev => ({ ...prev, [e.code]: true }));
        const handleKeyUp = (e) => setKeysPressed(prev => ({ ...prev, [e.code]: false }));
        
        // Focus automatique pour capter le clavier
        window.focus();
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    const initLevel = (idx, sourceData) => {
        if (!sourceData[idx]) { onStop(); return; }
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
                if (gameInstanceRef.current?.onQuestion) gameInstanceRef.current.onQuestion(levelQuestions[nIdx]);
            } else {
                triggerWinSequence();
            }
        }, 1000);
    };

    const triggerWinSequence = () => {
        setIsLevelWon(true);
        isLevelWonRef.current = true; 
        if (gameInstanceRef.current?.onLevelWin) {
            gameInstanceRef.current.onLevelWin();
        }
        setTimeout(() => setIsPowerOff(true), 1500);
        setTimeout(() => {
            const nextLvlIdx = currentLevelIdx + 1;
            if (allLevels[nextLvlIdx]) initLevel(nextLvlIdx, allLevels);
            else { alert("🎉 JEU TERMINÉ !"); onStop(); }
        }, 4000);
    };

    // --- CHEAT LOGIC ---
    
    // S+T + Clic sur une barre : Valide la question (SANS RESET ZOMBIE)
    const handleBarCheat = (idx) => {
        if (cheatReady) {
            const next = [...questionStates];
            next[idx] = 3;
            setQuestionStates(next);
            if (next.every(s => s === 3)) triggerWinSequence();
        }
    };

    const executeReset = (e) => {
        if(e) e.stopPropagation(); // Empêche la propagation pour éviter les doubles déclenchements
        console.log("⚡ EXECUTE RESET ZOMBIE !");

        // 1. REINITIALISATION INTERFACE
        setLives(4);
        setIsLevelWon(false);
        isLevelWonRef.current = false;
        setIsPowerOff(false);

        // 2. REINITIALISATION MOTEUR
        if (gameInstanceRef.current) {
            gameInstanceRef.current.isStopped = false;
            
            // Reset Variables Spécifiques (Zombie V445+)
            if (typeof gameInstanceRef.current.zombieX !== 'undefined') {
                gameInstanceRef.current.zombieX = 90;
            }
            if (typeof gameInstanceRef.current.projectiles !== 'undefined') {
                gameInstanceRef.current.projectiles = [];
            }

            // Relance standard
            if (gameInstanceRef.current.start) {
                gameInstanceRef.current.start();
            }
        }
    };

    // S+T + Clic sur le Fond/Canvas : Reset Zombie
    const handleCanvasCheat = (e) => {
        if (cheatReady) executeReset(e);
    };

    useEffect(() => {
        if (!code || !project || !canvasRef.current) return;
        let isMounting = true;
        let animationFrameId = null;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const assets = {};

        async function startEngine() {
            try {
                const scene = project.scenes[activeSceneIdx];
                if (!scene) return;
                const resources = (scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url));
                await Promise.all([...new Set(resources)].filter(Boolean).map(url => new Promise(resolve => {
                    const img = new Image(); img.crossOrigin = "anonymous";
                    img.onload = () => { assets[resolveUrl(url)] = img; resolve(); };
                    img.onerror = () => resolve();
                    img.src = resolveUrl(url);
                })));
                if (!isMounting) return;

                let userCode = code;
                if (userCode.includes('class MiniGame') && !userCode.includes('extends MiniGameBase')) {
                    userCode = userCode.replace('class MiniGame', 'class MiniGame extends MiniGameBase');
                }

                const headerCode = `
                    const { canvas, ctx, assets, project, sceneIdx, resolveUrl, callbacks } = params;
                    class ActorProxy {
                        constructor(data) {
                            this.id = data.id; this.name = data.name;
                            this.x = data.initialX || 50; this.y = data.initialY || 50;
                            this.dir = data.direction || 0; this.scale = data.scale || 1;
                            this.visible = true; this.currentAction = data.actions?.[0]?.name || 'IDLE';
                            this.rotationStyle = data.rotationStyle || 'all';
                            this.frameIdx = 0; this.lastAnimTime = 0;
                        }
                        play(name) { if(this.currentAction.toUpperCase() !== name.toUpperCase()) { this.currentAction = name; this.frameIdx = 0; this.lastAnimTime = 0; } }
                    }
                    class MiniGameBase {
                        constructor(c, a, cb) {
                            this.canvas = c || canvas; this.ctx = ctx; this.assets = a || assets; this.callbacks = cb || callbacks; this.keys = {};
                            const s = project.scenes[sceneIdx];
                            if(s && s.actors) { s.actors.forEach(a => { this[a.name.toUpperCase()] = new ActorProxy(a); }); }
                        }
                        _system_render() {
                            const s = project.scenes[sceneIdx];
                            const bd = s?.backdrops?.[s.currentBackdropIdx || 0];
                            if(bd && this.assets[resolveUrl(bd.url)]) this.ctx.drawImage(this.assets[resolveUrl(bd.url)], 0, 0, this.canvas.width, this.canvas.height);
                            else { this.ctx.fillStyle = "#000"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }
                            for(let key in this) {
                                const p = this[key];
                                if(p instanceof ActorProxy && p.visible) {
                                    const aData = project.scenes[sceneIdx].actors.find(ac => ac.id === p.id);
                                    if(!aData) continue;
                                    const act = (aData.actions || []).find(x => x.name.toUpperCase() === p.currentAction.toUpperCase()) || aData.actions?.[0];
                                    if(act && act.frames?.length > 0) {
                                        const now = Date.now();
                                        if (now - p.lastAnimTime > (act.speed || 100)) { p.frameIdx = (p.frameIdx+1)%act.frames.length; p.lastAnimTime=now; }
                                        const img = this.assets[resolveUrl(act.frames[p.frameIdx].url)];
                                        if(img) {
                                            const xPx = (p.x/100)*this.canvas.width; const yPx = (p.y/100)*this.canvas.height; let sz = 150*p.scale;
                                            this.ctx.save(); this.ctx.translate(xPx, yPx);
                                            if(p.rotationStyle==='left-right' && (((p.dir%360)+360)%360)>90 && (((p.dir%360)+360)%360)<270) this.ctx.scale(-1,1);
                                            else if(p.rotationStyle==='all') this.ctx.rotate(p.dir*Math.PI/180);
                                            this.ctx.drawImage(img, -sz/2, -sz/2, sz, sz); this.ctx.restore();
                                        }
                                    }
                                }
                            }
                        }
                    }
                `;

                const finalScript = headerCode + "\n" + userCode + "\n return MiniGame;";
                
                const FinalClass = new Function('params', finalScript)({ 
                    canvas, ctx, assets, project, sceneIdx: activeSceneIdx, resolveUrl, 
                    callbacks: { 
                        onPlayerHit: () => {
                            if (!isLevelWonRef.current) {
                                setLives(l => Math.max(0, l - 1));
                            }
                        } 
                    } 
                });
                const instance = new FinalClass();
                gameInstanceRef.current = instance;

                const loop = () => {
                    if (!isMounting) return;
                    if (instance.update) instance.update();
                    if (instance._system_render) instance._system_render();
                    if (instance.draw) instance.draw();
                    animationFrameId = requestAnimationFrame(loop);
                };
                loop();
            } catch(e) { setCrash(e.message); }
        }
        startEngine();
        return () => { isMounting = false; if (animationFrameId) cancelAnimationFrame(animationFrameId); };
    }, [code, project, activeSceneIdx]);

    return (
        // UTILISATION DE ONCLICK STANDARD (Bubbling) POUR LAISSER LA PRIORITÉ AUX ENFANTS (BARRES)
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center font-sans" onClick={handleCanvasCheat}>
             
             {/* HUD DEBUG CLAVIER */}
             <div className="absolute top-2 left-2 z-[100000] bg-black/80 text-white font-mono text-xs p-2 rounded pointer-events-none">
                KEYS: {sPressed ? 'S' : '_'} + {tPressed ? 'T' : '_'}
             </div>

             {/* BOUTON RESET EXPLICITE (VISIBLE SI CHEAT READY) */}
             {cheatReady && (
                 <button 
                    onClick={executeReset}
                    className="absolute top-20 left-1/2 -translate-x-1/2 z-[100000] bg-red-600 text-white font-black px-6 py-3 rounded-full shadow-2xl border-4 border-white animate-pulse uppercase tracking-widest text-lg cursor-pointer pointer-events-auto"
                 >
                    🔴 RESET ZOMBIE NOW
                 </button>
             )}

             <div className="absolute top-6 w-full flex justify-between items-start px-10 pointer-events-none z-20">
                <div className="bg-slate-900/80 p-3 px-6 rounded-2xl border-2 border-slate-700 text-3xl shadow-xl pointer-events-auto flex gap-1">
                    {"❤️".repeat(lives)}{"🖤".repeat(Math.max(0, 4 - lives))}
                </div>
                <div className="flex-1 flex justify-center px-4">
                    {levelQuestions[currentQIndex] && !isLevelWon && (
                        <div className="bg-slate-900/95 text-white font-black py-4 px-10 rounded-2xl border-2 border-slate-600 shadow-2xl text-xl pointer-events-auto">
                            {feedback === 'CORRECT' ? "✅ BRAVO !" : feedback === 'WRONG' ? "❌ RATÉ..." : levelQuestions[currentQIndex].q}
                        </div>
                    )}
                </div>
                <div className="flex gap-2 items-center pointer-events-auto mr-16">
                    {questionStates.map((mastery, idx) => (
                        <div key={idx} onClick={(e) => { e.stopPropagation(); handleBarCheat(idx); }} className={`w-4 h-12 rounded-md border border-slate-600 relative overflow-hidden transition-all cursor-help ${currentQIndex === idx ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-60'}`}>
                            <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${mastery === 3 ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-yellow-500'}`} style={{ height: `${(mastery / 3) * 100}%` }} />
                        </div>
                    ))}
                </div>
            </div>

            <div className={`relative transition-all duration-200 ${cheatReady ? 'ring-8 ring-red-500 rounded-xl' : ''}`}>
                <canvas ref={canvasRef} width={800} height={450} className={`aspect-video shadow-2xl bg-black border-4 border-slate-800 rounded-xl transition-opacity duration-1000 ${isPowerOff ? 'opacity-0' : 'opacity-100'}`} />
                {isLevelWon && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm rounded-xl animate-in zoom-in pointer-events-none">
                        <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center border-8 border-green-500">
                            <span className="text-6xl block mb-4">🏆</span>
                            <h2 className="text-4xl font-black text-slate-800 uppercase">Niveau Réussi !</h2>
                        </div>
                    </div>
                )}
                {isPowerOff && <div className="absolute inset-0 bg-black rounded-xl flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full animate-ping"></div></div>}
            </div>
            {crash && <div className="absolute inset-0 bg-red-900/90 flex items-center justify-center text-white font-mono p-10 text-center z-50">💥 ERREUR SCRIPT : {crash}</div>}

            <div className="absolute bottom-6 w-full flex justify-center px-10">
                <div className="grid grid-cols-4 gap-4 w-full max-w-5xl">
                    {levelQuestions[currentQIndex]?.options?.map((o, i) => (
                        <button key={i} onClick={(e) => { e.stopPropagation(); handleAnswerClick(i); }} className="bg-indigo-600 text-white py-5 rounded-xl font-black uppercase shadow-xl hover:bg-indigo-500 transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1">{o}</button>
                    ))}
                </div>
            </div>
            <button onClick={onStop} className="absolute top-6 right-6 bg-red-600 text-white w-12 h-12 rounded-full font-black text-2xl shadow-xl border-4 border-white hover:scale-110 transition-all flex items-center justify-center pointer-events-auto">✕</button>
        </div>
    );
}
