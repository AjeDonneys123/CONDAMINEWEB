// @signatures: UnifiedMoteur, handleAnswerClick, triggerWinSequence, startCurrentLevel, updateBarLogic, changeQuestionLogic
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from '../../../services/SoundExpert';
import { api } from '../../../services/api';
import { createGameBase } from '../../../services/gameCore';
import { resolveDriveAssetUrl } from '../../../utils/driveUrl';

/**
 * 🧠 UNIFIED MOTEUR V9.5 (DEBUG & BRIDGE)
 * REPAIRS: 
 * - Error Reporting UI (Affiche les crashs de script).
 * - Complete Bridge (SHAKE, SUBMIT_ANSWER).
 * - Multi-level reset fix.
 */

const ZOMBIE_FALLBACK_CODE = `class MiniGame extends MiniGameBase {
    constructor(canvas, assets, callbacks) {
        super(canvas, assets, callbacks);
        this.resetInternalState();
    }
    resetInternalState() {
        this.projectiles = []; this.zombieX = 100; this.zombieState = "WALKING"; 
        this.heroState = "IDLE"; this.heroTimer = 0; this.isStopped = false;
    }
    start() { this.game.setUI(true); if(this.HEROS) this.HEROS.play("IDLE", true); }
    onResult(isCorrect) {
        if (isCorrect && this.HEROS) {
            this.HEROS.play("TIRER", false); this.heroState = "SHOOT"; this.heroTimer = 40;
            this.projectiles.push({ x: this.HEROS.x + 5, y: this.HEROS.y - 5 });
        } else if (!isCorrect) { this.zombieX -= 10; this.game.shake(); }
    }
    update() {
        if (this.isStopped) return;
        if (this.zombieState === "WALKING") {
            this.zombieX -= this.isBossPhase ? 0.08 : 0.15;
            if (this.ZOMBIE) this.ZOMBIE.x = this.zombieX;
            if (this.zombieX < 20) { this.game.damage(1); this.zombieX = 100; }
        }
        this.projectiles.forEach((p,i) => { p.x += 3; if(p.x > 100) this.projectiles.splice(i,1); });
    }
}`;

export default function UnifiedMoteur({ gameData, onExit, isStudioTest = false, user }) {
    const [lives, setLives] = useState(4);
    const [questionStates, setQuestionStates] = useState([]); 
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [allLevels, setAllLevels] = useState([]);
    const [globalIntroData, setGlobalIntroData] = useState({});
    const [levelQuestions, setLevelQuestions] = useState([]);
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [showAnswerUI, setShowAnswerUI] = useState(true);
    const [showLevelIntro, setShowLevelIntro] = useState(true);
    const [showLevelBanner, setShowLevelBanner] = useState(false);
    const [showStageClear, setShowStageClear] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [showGameComplete, setShowGameComplete] = useState(false);
    const [zoomMedia, setZoomMedia] = useState(null);
    const [activeBossVisual, setActiveBossVisual] = useState(false);
    const [isShake, setIsShake] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [userInput, setUserInput] = useState("");
    const [loadProgress, setLoadProgress] = useState("");
    const [isReady, setIsReady] = useState(false);
    const [engineStarted, setEngineStarted] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [isSoundOn, setIsSoundOn] = useState(true);
    
    // --- NOUVEAU : GESTION DES ERREURS DE SCRIPT ---
    const [scriptError, setScriptError] = useState(null);

    const canvasRef = useRef(null);
    const frameIdRef = useRef(null);
    const gameInstanceRef = useRef(null);
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());
    const imageAssetsRef = useRef(new Map());
    const projectRef = useRef(gameData || {});
    const bossModeRef = useRef(false);
    const liveData = useRef({ qStates: [], qIndex: 0, lives: 4 });
    const keysPressed = useRef({});
    const mobileControlTimers = useRef({});
    const soundEnabledRef = useRef(true);

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
            case 'SET_BOSS': setActiveBossVisual(!!value); bossModeRef.current = !!value; break;
            case 'SET_UI': setShowAnswerUI(!!value); break;
            case 'SHAKE': setIsShake(true); setTimeout(() => setIsShake(false), 600); break;
            case 'SUBMIT_ANSWER': handleAnswerClick(value); break;
            case 'AUDIO': triggerGlobalEvent(value); break;
        }
    });

    const resolveUrl = (url) => {
        return resolveDriveAssetUrl(url);
    };

    const playBufferedSound = (buffer) => {
        if (!audioCtxRef.current || !buffer || !soundEnabledRef.current) return;
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtxRef.current.destination);
        source.start(0);
    };

    const isCheatMode = () => keysPressed.current['KeyS'] && keysPressed.current['KeyT'];

    const getYoutubeEmbed = (url = "") => {
        if (!url) return "";
        const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^?&/]+)/i);
        return m?.[1] ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0&modestbranding=1` : url;
    };
    const getYoutubeThumb = (url = "") => {
        if (!url) return "";
        const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^?&/]+)/i);
        return m?.[1] ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : "";
    };

    const isYoutubeUrl = (url = "") => /(?:youtu\.be\/|youtube\.com\/)/i.test(String(url));
    const getGameFamily = () => {
        const type = String(gameData?.type || "").toLowerCase();
        const title = String(gameData?.title || "").toLowerCase();
        const code = String(gameData?.generatedCode || "").toLowerCase();
        if (type.includes('starship') || title.includes('starship') || code.includes('starship')) return 'starship';
        if (type.includes('jumper') || title.includes('jumper') || code.includes('jumper')) return 'jumper';
        return 'other';
    };
    const supportsMobilePad = () => {
        const family = getGameFamily();
        return family === 'starship' || family === 'jumper';
    };

    const mobileActionToCodes = (action) => {
        const family = getGameFamily();
        if (action === 'left') return ['ArrowLeft', 'KeyA'];
        if (action === 'right') return ['ArrowRight', 'KeyD'];
        if (action === 'jump') {
            if (family === 'jumper') return ['ArrowUp', 'Space', 'KeyW'];
            return ['ArrowUp', 'KeyW'];
        }
        if (action === 'shoot') {
            if (family === 'starship') return ['Space', 'KeyX', 'KeyF'];
            return ['KeyX', 'KeyF', 'Enter'];
        }
        return [];
    };

    const setCodesState = (codes, pressed) => {
        codes.forEach(code => { keysPressed.current[code] = pressed; });
    };

    const startMobileAction = (action) => {
        const codes = mobileActionToCodes(action);
        if (codes.length === 0) return;
        setCodesState(codes, true);
        if (mobileControlTimers.current[action]) return;
        mobileControlTimers.current[action] = setInterval(() => setCodesState(codes, true), 60);
    };

    const stopMobileAction = (action) => {
        const codes = mobileActionToCodes(action);
        setCodesState(codes, false);
        if (mobileControlTimers.current[action]) {
            clearInterval(mobileControlTimers.current[action]);
            delete mobileControlTimers.current[action];
        }
    };

    const bindControlPress = (action) => ({
        onMouseDown: (e) => { e.preventDefault(); startMobileAction(action); },
        onMouseUp: (e) => { e.preventDefault(); stopMobileAction(action); },
        onMouseLeave: (e) => { e.preventDefault(); stopMobileAction(action); },
        onTouchStart: (e) => { e.preventDefault(); startMobileAction(action); },
        onTouchEnd: (e) => { e.preventDefault(); stopMobileAction(action); },
        onTouchCancel: (e) => { e.preventDefault(); stopMobileAction(action); }
    });
    const pickMediaFromObject = (obj, type) => {
        if (!obj || typeof obj !== 'object') return "";
        const exactKeys = type === 'video'
            ? ['videoUrl', 'videoURL', 'video', 'youtubeUrl', 'videoLink', 'video_link', 'urlVideo', 'url_video']
            : ['sheetUrl', 'ficheUrl', 'sheet', 'fiche', 'imageUrl', 'imageURL', 'urlFiche', 'url_fiche'];
        for (const k of exactKeys) {
            if (typeof obj[k] === 'string' && obj[k].trim()) return obj[k].trim();
        }
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string' && v.trim()) {
                const lk = k.toLowerCase();
                const isMatch = type === 'video'
                    ? (lk.includes('video') || lk.includes('youtube'))
                    : (lk.includes('sheet') || lk.includes('fiche') || lk.includes('image'));
                if (isMatch) return v.trim();
            }
        }
        return "";
    };

    const getIntroMedia = () => {
        const level = allLevels[currentLevelIdx] || {};
        const levelIntro = level.intro || {};
        const rootIntro = gameData?.intro || {};
        const globalIntro = globalIntroData || {};
        const sheetUrl =
            pickMediaFromObject(levelIntro, 'sheet') ||
            pickMediaFromObject(level, 'sheet') ||
            pickMediaFromObject(rootIntro, 'sheet') ||
            pickMediaFromObject(globalIntro, 'sheet') ||
            pickMediaFromObject(gameData, 'sheet') ||
            "";
        const videoUrl =
            pickMediaFromObject(levelIntro, 'video') ||
            pickMediaFromObject(level, 'video') ||
            pickMediaFromObject(rootIntro, 'video') ||
            pickMediaFromObject(globalIntro, 'video') ||
            pickMediaFromObject(gameData, 'video') ||
            "";
        return { sheetUrl, videoUrl };
    };

    const triggerGlobalEvent = (eventName) => {
        const scene = projectRef.current.scenes?.[0];
        if (!scene || !scene.globalSounds) return;
        const cleanTarget = eventName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const event = scene.globalSounds.find(g => g.name && g.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() === cleanTarget);
        if (event && event.sounds && audioCtxRef.current) {
            if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
            event.sounds.forEach(snd => {
                const buffer = audioBuffersRef.current.get(resolveUrl(snd.url));
                playBufferedSound(buffer);
            });
        }
    };

    const updateBarLogic = (isCorrect) => {
        const idx = liveData.current.qIndex;
        if (isCorrect) { liveData.current.qStates[idx] = Math.min(3, (liveData.current.qStates[idx] || 0) + 1); } 
        else { liveData.current.qStates[idx] = Math.max(0, (liveData.current.qStates[idx] || 0) - 1); }
        setQuestionStates([...liveData.current.qStates]);
    };

    const changeQuestionLogic = () => {
        setFeedback(null); setUserInput("");
        const states = liveData.current.qStates;
        const available = states.map((s, i) => s < 3 ? i : -1).filter(i => i !== -1);
        if (available.length > 0) {
            const currentIdx = liveData.current.qIndex;
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

    const triggerWinSequence = async () => {
        const isGameFinished = !allLevels[currentLevelIdx + 1];
        if (!isStudioTest && user && gameData?._id) {
            try {
                await fetch('/api/games/save-progress', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ studentId: user._id || user.id, gameId: gameData._id, score: lives * 100, levelReached: isGameFinished ? 1 : 0 })
                });
            } catch(e) {}
        }
        if (isGameFinished) {
            triggerGlobalEvent("VICTOIRE");
            if (gameInstanceRef.current) gameInstanceRef.current.isStopped = true;
            setEngineStarted(false);
            setShowGameComplete(true);
        } 
        else { 
            triggerGlobalEvent("UPLEVEL"); 
            if (gameInstanceRef.current) gameInstanceRef.current.isStopped = true;
            setEngineStarted(false);
            setShowStageClear(true); 
            setTimeout(() => { 
                setShowStageClear(false); 
                setCurrentLevelIdx(p => p + 1); 
                setShowLevelIntro(true); 
            }, 3000); 
        }
    };

    useEffect(() => {
        const initGame = async () => {
            let sourceGame = gameData || null;
            let levelsData = sourceGame?.levels || [];
            if (levelsData.length === 0) {
                 try {
                    const res = await api.get('/games/test-data');
                    if (res) sourceGame = res;
                    levelsData = res?.levels?.length > 0 ? res.levels : [];
                 } catch(e) {}
            }
            if (levelsData.length === 0) levelsData = [{ name: "Niveau 1", questions: [{q:"Prêt ?",options:["OUI","NON"],a:0}] }];
            setGlobalIntroData(sourceGame?.globalIntro || {});
            setAllLevels(levelsData);
            if (levelsData[currentLevelIdx]) {
                const qs = levelsData[currentLevelIdx].questions || [];
                setLevelQuestions(qs);
                const initialStates = new Array(qs.length).fill(0);
                liveData.current.qStates = initialStates;
                liveData.current.qIndex = 0; liveData.current.lives = 4;
                setQuestionStates(initialStates); setCurrentQIndex(0); setLives(4); setActiveBossVisual(false); bossModeRef.current = false;
                setShowLevelIntro(true); setScriptError(null);
            }
        };
        initGame();
    }, [gameData, currentLevelIdx]);

    useEffect(() => {
        if (!gameData) return;
        setIsReady(false);
        projectRef.current = gameData; 
        const scene = gameData.scenes?.[0];
        if (scene) {
            const imgs = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))).concat((scene.backdrops || []).map(b => b.url)))].filter(Boolean);
            const snds = [...new Set((scene.actors || []).flatMap(a => (a.actions || []).flatMap(act => (act.sounds || []).map(s => s.url))).concat((scene.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url))))].filter(Boolean);
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            let loadedCount = 0;
            if (imgs.length === 0) setIsReady(true);
            imgs.forEach(url => { 
                const rKey = resolveUrl(url); 
                const img = new Image(); img.crossOrigin = "anonymous"; 
                img.onload = () => { imageAssetsRef.current.set(rKey, img); loadedCount++; setLoadProgress(`${Math.round(loadedCount/imgs.length*100)}%`); if (loadedCount >= imgs.length) setIsReady(true); };
                img.onerror = () => { loadedCount++; if (loadedCount >= imgs.length) setIsReady(true); };
                img.src = rKey; 
            });
            snds.forEach(url => { SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => { if (buf) audioBuffersRef.current.set(resolveUrl(url), buf); }); });
        }
    }, [gameData]);

    const handleAnswerClick = (val) => {
        if (feedback || showLevelIntro || showStageClear || showGameOver) return;
        const currentQ = levelQuestions[currentQIndex];
        const clean = (s) => String(s).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let isCorrect = (typeof val === 'number') ? (currentQ.a === val) : (clean(val) === clean(currentQ.options[currentQ.a]));
        setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
        if (gameInstanceRef.current?.onResult) gameInstanceRef.current.onResult(isCorrect);
        setTimeout(() => { updateBarLogic(isCorrect); changeQuestionLogic(); }, 1200);
    };

    const startCurrentLevel = async () => { 
        if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
        setEngineStarted(true); setShowLevelIntro(false); setShowLevelBanner(true); 
        setTimeout(() => triggerGlobalEvent("DEPART"), 100);
        setTimeout(() => setShowLevelBanner(false), 1500); 
    };

    const handleHeartClick = () => {
        if (!isCheatMode()) return;
        liveData.current.lives = Math.max(0, liveData.current.lives - 1);
        setLives(liveData.current.lives);
        if (liveData.current.lives <= 0) {
            setShowGameOver(true);
            triggerGlobalEvent("DEFAITE");
        }
    };

    const handleQuestionClick = () => {
        if (!isCheatMode()) return;
        triggerGlobalEvent("UPLEVEL");
        triggerWinSequence();
    };

    const handleBarClick = (idx) => {
        if (!isCheatMode()) return;
        const nextStates = [...liveData.current.qStates];
        nextStates[idx] = Math.min(3, (nextStates[idx] || 0) + 1);
        liveData.current.qStates = nextStates;
        setQuestionStates(nextStates);
        if (nextStates.every(s => s >= 3)) {
            triggerGlobalEvent("UPLEVEL");
            triggerWinSequence();
        }
    };

    const handleRetry = () => {
        setShowGameOver(false);
        setLives(4);
        liveData.current.lives = 4;
        setEngineStarted(false);
        setShowLevelIntro(true);
    };

    useEffect(() => {
        if (!engineStarted || !canvasRef.current) return;
        try {
            const MiniGameBase = createGameBase({ 
                audioBuffers: audioBuffersRef.current, audioCtx: audioCtxRef.current, projectRef, sceneIdx: 0, imageAssets: imageAssetsRef.current, resolveUrl, canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'), 
                playParallelSound: (url) => {
                    const b = audioBuffersRef.current.get(resolveUrl(url));
                    playBufferedSound(b);
                },
                bridge: { trigger: (t, v) => bridgeProxy.current(t, v) }, questions: levelQuestions
            });
            
            const scriptToRun = projectRef.current.generatedCode || ZOMBIE_FALLBACK_CODE;
            
            // --- WRAPPER DE SÉCURITÉ ---
            let factory, instance;
            try {
                factory = new Function('MiniGameBase', scriptToRun + "\n return MiniGame;");
                instance = new (factory(MiniGameBase))(canvasRef.current, {}, {
                    onPlayerHit: () => {
                        liveData.current.lives = Math.max(0, liveData.current.lives - 1);
                        setLives(liveData.current.lives);
                        if (liveData.current.lives <= 0) {
                            setShowGameOver(true);
                            triggerGlobalEvent("DEFAITE");
                        }
                    }
                });
            } catch (initErr) {
                setScriptError(`Erreur d'initialisation : ${initErr.message}`);
                return;
            }

            gameInstanceRef.current = instance; if (instance.start) instance.start();
            
            const tick = () => {
                try {
                    if (instance && !instance.isStopped) {
                        if(instance.keys) Object.assign(instance.keys, keysPressed.current);
                        instance.isBossPhase = bossModeRef.current;
                        instance.currentQIndex = liveData.current.qIndex;
                        if (instance.update) instance.update(); 
                        if (instance._render) instance._render(); 
                        if (instance.draw) instance.draw();
                    }
                    frameIdRef.current = requestAnimationFrame(tick);
                } catch (runtimeErr) {
                    setScriptError(`Erreur d'exécution : ${runtimeErr.message}`);
                    cancelAnimationFrame(frameIdRef.current);
                }
            };
            tick();
        } catch (e) { setScriptError(`Crash Moteur : ${e.message}`); }
        return () => { if(frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
    }, [engineStarted]);

    useEffect(() => {
        soundEnabledRef.current = isSoundOn;
    }, [isSoundOn]);

    useEffect(() => {
        const hDown = (e) => keysPressed.current[e.code] = true;
        const hUp = (e) => keysPressed.current[e.code] = false;
        window.addEventListener('keydown', hDown); window.addEventListener('keyup', hUp);
        return () => { window.removeEventListener('keydown', hDown); window.removeEventListener('keyup', hUp); };
    }, []);

    useEffect(() => {
        const onResize = () => setIsMobileViewport(window.innerWidth <= 900);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        return () => {
            Object.keys(mobileControlTimers.current).forEach((key) => {
                clearInterval(mobileControlTimers.current[key]);
            });
            mobileControlTimers.current = {};
        };
    }, []);

    const introMedia = getIntroMedia();

    return (
        <div className={"fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center " + (isShake ? 'animate-shake' : '')}>
            
            {/* ALERT ERREUR SCRIPT */}
            {scriptError && (
                <div className="absolute top-0 left-0 right-0 bg-red-600 text-white p-4 text-center font-black z-[100000] animate-in slide-in-from-top">
                    ⚠️ ERREUR SCRIPT STUDIO : {scriptError}
                    <button onClick={() => setScriptError(null)} className="ml-4 underline">Fermer</button>
                </div>
            )}

            {showLevelBanner && <div className="fixed top-[20%] z-[5000] animate-in zoom-in"><span className="text-yellow-400 font-black text-6xl uppercase drop-shadow-lg">Niveau {currentLevelIdx + 1}</span></div>}
            {showStageClear && <div className="fixed top-[40%] z-[5000] animate-in zoom-in text-center"><span className="text-yellow-400 font-black text-8xl uppercase drop-shadow-lg block">STAGE CLEAR !</span></div>}

            {zoomMedia && (
                <div className="fixed inset-0 z-[12000] bg-black/95 flex items-center justify-center p-4 animate-in fade-in pointer-events-auto" onClick={() => setZoomMedia(null)}>
                    <button onClick={() => setZoomMedia(null)} className="absolute top-6 right-6 w-14 h-14 bg-white hover:bg-red-600 hover:text-white text-black rounded-full flex items-center justify-center text-2xl font-black shadow-2xl">✕</button>
                    <div className="w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        {zoomMedia === 'sheet' ? (
                            <img src={resolveUrl(introMedia.sheetUrl)} className="h-[90vh] max-w-[95vw] object-contain rounded-2xl shadow-2xl" alt="Fiche" />
                        ) : !introMedia.videoUrl ? (
                            <div className="h-[90vh] w-[95vw] max-w-[1400px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex items-center justify-center">
                                <div className="text-center px-6">
                                    <div className="text-5xl mb-4">🎬</div>
                                    <div className="text-white font-black uppercase text-xl">Aucune vidéo configurée</div>
                                    <div className="text-slate-400 text-sm mt-2">Ajoute un lien vidéo dans le studio pour ce niveau.</div>
                                </div>
                            </div>
                        ) : isYoutubeUrl(introMedia.videoUrl) ? (
                            <div className="h-[90vh] w-[95vw] max-w-[1400px] bg-black rounded-2xl overflow-hidden shadow-2xl">
                                <iframe
                                    className="w-full h-full"
                                    src={getYoutubeEmbed(introMedia.videoUrl)}
                                    frameBorder="0"
                                    allow="autoplay; encrypted-media; picture-in-picture"
                                    allowFullScreen
                                    title="Video"
                                />
                            </div>
                        ) : (
                            <div className="h-[90vh] w-[95vw] max-w-[1400px] bg-black rounded-2xl overflow-hidden shadow-2xl">
                                <video
                                    className="w-full h-full"
                                    src={resolveUrl(introMedia.videoUrl)}
                                    controls
                                    autoPlay
                                    playsInline
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showGameComplete && (
                <div className="absolute inset-0 z-[7000] bg-gradient-to-br from-yellow-500 to-indigo-700 flex flex-col items-center justify-center animate-in zoom-in p-10 text-center">
                    <div className="text-[120px] mb-2">🏆</div>
                    <h1 className="text-7xl font-black text-white uppercase tracking-tighter mb-4">VICTOIRE</h1>
                    <p className="text-white/90 font-bold uppercase tracking-widest mb-8">Tous les niveaux sont terminés</p>
                    <div className="bg-white/20 backdrop-blur-md rounded-3xl p-6 border-2 border-white/40 mb-8">
                        <div className="text-xs font-black text-white/70 uppercase mb-2">Score Final</div>
                        <div className="text-5xl font-black text-white">{lives * 100 + (allLevels.length * 50)} PTS</div>
                    </div>
                    <button onClick={onExit} className="px-10 py-4 bg-white text-indigo-700 font-black text-xl rounded-2xl uppercase">Retour menu</button>
                </div>
            )}
            
            {showLevelIntro && (
                <div className={`absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-[6000] p-8 text-center animate-in zoom-in ${zoomMedia ? 'pointer-events-none' : ''}`}>
                    <h1 className="text-5xl text-white font-black mb-6 uppercase">{allLevels[currentLevelIdx]?.name || ("Niveau " + (currentLevelIdx+1))}</h1>
                    <div className="flex gap-10 mb-12 w-full max-w-4xl justify-center h-[280px]">
                        <div className="h-full aspect-[3/4] flex flex-col">
                            <div className="text-white text-xs font-black uppercase tracking-widest mb-2 text-left">FICHE</div>
                            <div onClick={() => introMedia.sheetUrl && setZoomMedia('sheet')} className="flex-1 bg-slate-800 rounded-3xl border-4 border-slate-700 overflow-hidden flex items-center justify-center shadow-2xl cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all">
                                {introMedia.sheetUrl ? <img src={resolveUrl(introMedia.sheetUrl)} className="w-full h-full object-contain" /> : <span className="text-slate-500 font-bold uppercase text-[10px]">Aucune fiche</span>}
                            </div>
                        </div>
                        <div className="h-full aspect-video flex flex-col">
                            <div className="text-white text-xs font-black uppercase tracking-widest mb-2 text-left">VIDÉO</div>
                            <div onClick={() => setZoomMedia('video')} className="flex-1 bg-black rounded-3xl border-4 border-slate-700 overflow-hidden shadow-2xl flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all relative group">
                                {introMedia.videoUrl ? (
                                    <>
                                        {isYoutubeUrl(introMedia.videoUrl) ? (
                                            <img src={getYoutubeThumb(introMedia.videoUrl)} alt="Miniature vidéo" className="absolute inset-0 w-full h-full object-cover" />
                                        ) : (
                                            <video
                                                className="absolute inset-0 w-full h-full object-cover"
                                                src={resolveUrl(introMedia.videoUrl)}
                                                muted
                                                playsInline
                                                preload="metadata"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-black/25"></div>
                                        <span className="text-6xl z-10 drop-shadow-2xl">▶️</span>
                                    </>
                                ) : <span className="text-slate-500 font-bold uppercase text-[10px]">Aucune vidéo</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={startCurrentLevel} disabled={!isReady} className="px-16 py-6 rounded-full font-black text-3xl shadow-2xl border-4 bg-white text-indigo-900 border-indigo-500 hover:scale-110">
                        {isReady ? 'DÉMARRER 🚀' : `CHARGEMENT ${loadProgress}`}
                    </button>
                </div>
            )}
            
            {engineStarted && !showLevelIntro && (
                <>
                    <div className={"absolute w-full flex justify-between pointer-events-none z-30 " + (isMobileViewport ? 'top-2 px-2 gap-2' : 'top-6 px-10')}>
                        <div onClick={handleHeartClick} className={"bg-slate-900/80 rounded-2xl border-2 border-slate-700 shadow-lg pointer-events-auto cursor-pointer " + (isMobileViewport ? 'p-2 px-3 text-2xl' : 'p-3 px-6 text-3xl')}>{"❤️".repeat(lives)}</div>
                        <div className={isMobileViewport ? 'flex-1 mx-1' : 'flex-1 mx-10'}>
                            <div onClick={handleQuestionClick} className={"bg-slate-900/95 text-white font-black rounded-2xl border-2 text-center border-slate-600 cursor-pointer pointer-events-auto " + (isMobileViewport ? 'py-2 px-3 text-base leading-tight' : 'py-4 px-10 text-xl') + " " + (activeBossVisual ? 'border-red-500 ring-2 ring-red-500/50' : '')}>
                                {feedback === 'CORRECT' ? "✅ BIEN JOUÉ !" : feedback === 'WRONG' ? "❌ MAUVAISE RÉPONSE" : levelQuestions[currentQIndex]?.q}
                            </div>
                        </div>
                        <div className={"flex pointer-events-auto " + (isMobileViewport ? 'gap-1.5' : 'gap-2')}>
                            {questionStates.map((s, i) => (
                                <div key={i} onClick={() => handleBarClick(i)} className={(isMobileViewport ? 'w-4 h-12' : 'w-6 h-16') + " rounded-lg border-2 cursor-pointer " + (currentQIndex === i ? 'border-white scale-110' : 'border-slate-600 opacity-60') + " bg-slate-800 overflow-hidden relative"}>
                                    <div className={"absolute bottom-0 w-full transition-all duration-500 " + (s >= 3 ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : s >= 2 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-yellow-500')} style={{height: (s/3*100) + "%" }}></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <canvas ref={canvasRef} width={800} height={450} className={(isMobileViewport ? "w-[96vw] h-[56vh] max-h-[62vh] aspect-auto " : "aspect-video ") + "shadow-2xl bg-black border-4 " + (activeBossVisual ? 'border-red-600 shadow-[0_0_50px_red]' : 'border-slate-800') + " rounded-lg"} />
                    {showAnswerUI && levelQuestions[currentQIndex] && !showStageClear && !showGameComplete && !showGameOver && (
                        <div className={"absolute w-full flex justify-center pointer-events-auto z-30 " + (isMobileViewport ? 'bottom-3 px-2' : 'bottom-10 px-10')}>
                            {activeBossVisual ? (
                                <div className={"flex w-full max-w-2xl animate-in slide-in-from-bottom " + (isMobileViewport ? 'gap-2' : 'gap-4')}>
                                    <input autoFocus className={"flex-1 bg-slate-900 border-4 border-red-600 text-white font-black rounded-2xl text-center outline-none " + (isMobileViewport ? 'text-xl py-2 px-3' : 'text-3xl py-4 px-8')} value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnswerClick(userInput)} placeholder="TAPE TA RÉPONSE..." />
                                    <button onClick={() => handleAnswerClick(userInput)} className={"bg-red-600 text-white rounded-2xl font-black border-b-8 border-red-800 uppercase " + (isMobileViewport ? 'px-4 text-sm' : 'px-10 text-xl')}>Attaquer</button>
                                </div>
                            ) : (
                                <div className={"grid grid-cols-2 md:grid-cols-4 w-full max-w-5xl " + (isMobileViewport ? 'gap-2' : 'gap-4')}>
                                    {levelQuestions[currentQIndex].options.map((o, i) => (<button key={i} onClick={() => handleAnswerClick(i)} className={"bg-indigo-600 text-white rounded-2xl font-black uppercase border-b-8 border-indigo-800 active:border-b-0 active:translate-y-2 " + (isMobileViewport ? 'py-3 text-base' : 'py-6 text-lg')}>{o}</button>))}
                                </div>
                            )}
                        </div>
                    )}

                    {isMobileViewport && supportsMobilePad() && (
                        <div className="absolute inset-x-0 bottom-2 z-40 px-3 pointer-events-none">
                            <div className="w-full flex items-end justify-between">
                                <div className="flex gap-2 pointer-events-auto">
                                    <button {...bindControlPress('left')} className="w-16 h-16 rounded-2xl border-2 border-white/30 bg-slate-900/75 text-white text-2xl font-black active:scale-95 select-none">◀</button>
                                    <button {...bindControlPress('right')} className="w-16 h-16 rounded-2xl border-2 border-white/30 bg-slate-900/75 text-white text-2xl font-black active:scale-95 select-none">▶</button>
                                </div>
                                <div className="flex gap-2 pointer-events-auto">
                                    <button {...bindControlPress('shoot')} className="w-16 h-16 rounded-2xl border-2 border-red-300/70 bg-red-600/80 text-white text-xs font-black uppercase tracking-wider active:scale-95 select-none">TIR</button>
                                    <button {...bindControlPress('jump')} className="w-16 h-16 rounded-2xl border-2 border-emerald-300/70 bg-emerald-600/80 text-white text-xs font-black uppercase tracking-wider active:scale-95 select-none">SAUT</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            <div className="absolute top-2 right-4 flex items-center gap-2 z-[7000]">
                <button
                    onClick={() => setIsSoundOn(prev => !prev)}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-base font-black border-2 border-white/20"
                    title={isSoundOn ? 'Son ON' : 'Son OFF'}
                >
                    {isSoundOn ? '🔊' : '🔇'}
                </button>
                <button onClick={onExit} className="w-10 h-10 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xl font-black border-2 border-white/20">✕</button>
            </div>
            {showGameOver && (<div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[8000] animate-in zoom-in"><h1 className="text-8xl font-black text-red-600 mb-8 uppercase tracking-widest">GAME OVER</h1><button onClick={handleRetry} className="bg-white text-black px-12 py-5 rounded-2xl font-black text-2xl hover:bg-red-500 hover:text-white transition-all uppercase">RÉESSAYER 🔄</button></div>)}
        </div>
    );
}
