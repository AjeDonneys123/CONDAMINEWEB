// @signatures: StudioDashboard, LiveEngine, flipFrame, handleAICleanBackground, handleAddAction, handleAddActor, handleAddFrame, handleDeleteActor, handleDeleteBackdrop, handleDeleteFrame, handleMirrorSequence, handleRemoveAllBackgrounds, handleReorderFrame, handleSelectActor, handleStageMouseDown, handleStageMouseMove, handleStageMouseUp, handleUpdateActionSpeed, handleUpdateProp, loadProjects, processFrameBackground, resolveUrl, saveProject, togglePreview
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';

/**
 * 🕹️ ENGINE V140 (REAL-TIME CLOCK)
 * Correction Vitesse : Utilisation de Date.now() pour une animation précise à la milliseconde.
 */
const LiveEngine = ({ code, project, activeSceneIdx, onStop }) => {
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const [crash, setCrash] = useState(null);

    function resolveUrl(url) {
        if (!url) return "";
        if (url.startsWith('/api/proxy')) return url;
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    useEffect(() => {
        if (!canvasRef.current || !code || !project) return;
        const canvas = canvasRef.current;
        const assets = {};
        
        async function run() {
            try {
                const scene = project?.scenes?.[activeSceneIdx];
                if (!scene) return;
                const resources = (scene.actors || []).flatMap(a => 
                    (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))
                ).concat((scene.backdrops || []).map(b => b.url));
                
                await Promise.all([...new Set(resources)].filter(Boolean).map(url => new Promise(resolve => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => { assets[url] = img; resolve(); };
                    img.onerror = () => resolve();
                    img.src = resolveUrl(url);
                    setTimeout(resolve, 2000);
                })));

                const engineLogic = `
                    const { canvas, ctx, assets, project, sceneIdx } = arguments[0];
                    class ActorProxy {
                        constructor(data) {
                            this.id = data.id; this.name = data.name;
                            this.x = data.initialX || 50; this.y = data.initialY || 50;
                            this.dir = data.direction || 0; this.scale = data.scale || 1;
                            this.rotationStyle = data.rotationStyle || 'all';
                            this.currentAction = data.actions?.[0]?.name || 'IDLE';
                            this.frameIdx = 0;
                            // CORRECTION V140 : On utilise le temps réel
                            this.lastAnimTime = 0; 
                        }
                        play(name) { 
                            if(this.currentAction.toUpperCase() !== name.toUpperCase()) {
                                this.currentAction = name; 
                                this.frameIdx = 0; 
                                this.lastAnimTime = 0; // Reset du timer
                            }
                        }
                    }
                    class MiniGameBase {
                        constructor() {
                            this.canvas = canvas; this.ctx = ctx; this.assets = assets;
                            this.keys = {}; this.running = true; this.actorsMap = new Map();
                            project.scenes[sceneIdx].actors.forEach((a, i) => {
                                const proxy = new ActorProxy(a);
                                this.actorsMap.set(a.id, proxy);
                                this['P' + (i + 1)] = proxy;
                                if (a.name) this[a.name] = proxy;
                            });
                            window.onkeydown = (e) => { this.keys[e.code] = true; if(e.code === 'Space') e.preventDefault(); };
                            window.onkeyup = (e) => this.keys[e.code] = false;
                        }
                        _render() {
                            if(!this.ctx) return;
                            this.ctx.fillStyle = 'white';
                            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                            
                            // Décor
                            const s = project.scenes[sceneIdx];
                            const bd = s.backdrops?.[s.currentBackdropIdx || 0];
                            if(bd && this.assets[bd.url]) this.ctx.drawImage(this.assets[bd.url], 0, 0, this.canvas.width, this.canvas.height);
                            
                            // Acteurs
                            s.actors.forEach((a) => {
                                const p = this.actorsMap.get(a.id);
                                if (!p) return;
                                const action = (a.actions || []).find(act => act.name.toUpperCase() === p.currentAction.toUpperCase()) || a.actions?.[0];
                                
                                if(action && action.frames?.length > 0) {
                                    // --- GESTION VITESSE TEMPS RÉEL (V140) ---
                                    const now = Date.now();
                                    const speedMs = action.speed || 100;

                                    if (now - p.lastAnimTime > speedMs) {
                                        p.frameIdx = (p.frameIdx + 1) % action.frames.length;
                                        p.lastAnimTime = now;
                                    }
                                    
                                    const frame = action.frames[p.frameIdx];
                                    const img = frame ? this.assets[frame.url] : null;
                                    
                                    if(img) {
                                        let rx = (p.x / 100) * this.canvas.width;
                                        let ry = (p.y / 100) * this.canvas.height;
                                        this.ctx.save(); 
                                        this.ctx.translate(rx, ry);
                                        
                                        let normDir = ((p.dir % 360) + 360) % 360;
                                        if (p.rotationStyle === 'left-right') { 
                                            if (normDir > 90 && normDir < 270) this.ctx.scale(-1, 1); 
                                        } else if (p.rotationStyle === 'all') { 
                                            this.ctx.rotate(p.dir * Math.PI / 180); 
                                        }
                                        
                                        let sz = 150 * p.scale; 
                                        this.ctx.drawImage(img, -sz/2, -sz/2, sz, sz);
                                        this.ctx.restore();
                                    }
                                }
                            });
                        }
                    }
                    ${code}
                    return typeof MiniGame !== 'undefined' ? MiniGame : MiniGameBase;
                `;
                const ctx = canvas.getContext('2d');
                const GameFactory = new Function(engineLogic);
                const FinalClass = GameFactory({ canvas, ctx, assets, project, sceneIdx: activeSceneIdx });
                engineRef.current = new FinalClass();
                const loop = () => {
                    if (!engineRef.current || !engineRef.current.running) return;
                    if (engineRef.current.update) engineRef.current.update();
                    engineRef.current._render();
                    requestAnimationFrame(loop);
                };
                loop();
            } catch(e) { setCrash("ERREUR: " + e.message); }
        }
        run();
        return () => { if(engineRef.current) engineRef.current.running = false; };
    }, [code, project, activeSceneIdx]);

    return (
        <div className="absolute inset-0 z-[100] bg-black">
            {crash && <div className="absolute top-0 left-0 right-0 bg-red-600 text-white p-2 text-[10px] font-mono z-[120]">{crash}</div>}
            <canvas ref={canvasRef} width={800} height={450} className="w-full h-full object-contain" />
            <button onClick={onStop} className="absolute top-4 right-4 bg-white text-black px-4 py-1 rounded-full font-black text-xs z-[130]">STOP</button>
        </div>
    );
};

export default function StudioDashboard({ user }) {
    const [projects, setProjects] = useState([]);
    const [project, setProject] = useState(null);
    const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
    const [selectedActorId, setSelectedActorId] = useState(null);
    const [selectedActionIdx, setSelectedActionIdx] = useState(0);
    const [leftTab, setLeftTab] = useState('actions');
    const [code, setCode] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    
    // --- ÉTATS SÉQUENCEUR ---
    const [draggedFrameIdx, setDraggedFrameIdx] = useState(null);
    const [dropTargetIdx, setDropTargetIdx] = useState(null);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
    const [selectedFrameIdx, setSelectedFrameIdx] = useState(null);
    const [isDraggingOnStage, setIsDraggingOnStage] = useState(false);

    const frameUploadRef = useRef(null);
    const actorUploadRef = useRef(null);
    const backdropUploadRef = useRef(null); 
    const stageRef = useRef(null);

    useEffect(() => { loadProjects(); }, [user]);

    // 🚀 SYNC PREVIEW ENGINE
    useEffect(() => {
        let timer;
        const currentSpeed = selectedAction?.speed || 100; 

        if (isPreviewPlaying) {
            const framesCount = selectedAction?.frames?.length || 0;
            if (framesCount > 0) {
                timer = setInterval(() => {
                    setPreviewFrameIdx(prev => (prev + 1) % framesCount);
                }, currentSpeed);
            }
        } else {
            setPreviewFrameIdx(0);
        }
        return () => clearInterval(timer);
    }, [isPreviewPlaying, selectedActionIdx, selectedActorId, project]);

    async function loadProjects() {
        const data = await api.get(`/studio/projects/${user.id || user._id}`);
        setProjects(data); 
        if (data && data.length > 0) {
            const p = data[0];
            setProject(p);
            if (p.generatedCode) setCode(p.generatedCode);
            if (!selectedActorId && p.scenes?.[0]?.actors?.[0]) handleSelectActor(p.scenes[0].actors[0].id, p);
        }
    }

    async function saveProject(p = project) {
        if (!p) return;
        setLoading(true);
        try {
            const saved = await api.post('/studio', { ...p, teacherId: user.id || user._id, generatedCode: code });
            setProject(saved);
        } catch(e) { console.error("Save Error", e); }
        setLoading(false);
    }

    const handleUpdateActionSpeed = (delta) => {
        if (!selectedActorId || selectedActionIdx === null) return;
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        if (actor && actor.actions[selectedActionIdx]) {
            const current = actor.actions[selectedActionIdx].speed || 100;
            const newSpeed = Math.max(20, Math.min(2000, current + delta));
            actor.actions[selectedActionIdx].speed = newSpeed;
            setProject(next);
            saveProject(next);
        }
    };

    const handleAICleanBackground = async () => {
        if (!project || selectedFrameIdx === null) return;
        if (!confirm("✨ Lancer le détourage professionnel ?")) return;
        setCleaning(true);
        try {
            const actor = project.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
            const frame = actor.actions[selectedActionIdx].frames[selectedFrameIdx];
            const res = await api.post('/studio/remove-bg-specialized', { url: frame.url });
            if (res.url) {
                const next = JSON.parse(JSON.stringify(project));
                const nextActorIdx = next.scenes[selectedSceneIdx].actors.findIndex(a => a.id === selectedActorId);
                next.scenes[selectedSceneIdx].actors[nextActorIdx].actions[selectedActionIdx].frames[selectedFrameIdx].url = res.url;
                await saveProject(next);
                alert("✨ Détourage réussi !");
            }
        } catch (e) { alert("Erreur lors du traitement."); }
        setCleaning(false);
    };

    const handleRemoveAllBackgrounds = async () => {
        if (!project || !selectedActorId) return;
        const actor = project.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        if (!actor) return;
        const isSingle = selectedFrameIdx !== null;
        const msg = isSingle 
            ? `Nettoyer UNIQUEMENT ce sprite pour ${actor.name} ?` 
            : `Nettoyer TOUS les sprites du personnage ${actor.name} ?`;
        if (!confirm(msg)) return;
        setCleaning(true);
        const next = JSON.parse(JSON.stringify(project));
        const nextActor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        try {
            if (isSingle) {
                const action = nextActor.actions[selectedActionIdx];
                const frame = action.frames[selectedFrameIdx];
                const newUrl = await processFrameBackground(frame.url);
                if (newUrl) action.frames[selectedFrameIdx].url = newUrl;
            } else {
                for (const action of nextActor.actions) {
                    for (let i = 0; i < action.frames.length; i++) {
                        const frame = action.frames[i];
                        const newUrl = await processFrameBackground(frame.url);
                        if (newUrl) action.frames[i].url = newUrl;
                    }
                }
            }
            await saveProject(next);
            alert(`✨ Nettoyage de ${actor.name} terminé !`);
            setSelectedFrameIdx(null);
        } catch (e) { alert("Erreur lors du nettoyage."); }
        setCleaning(false);
    };

    const processFrameBackground = async (url) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const corners = [[data[0], data[1], data[2]], [data[(img.width - 1) * 4], data[(img.width - 1) * 4 + 1], data[(img.width - 1) * 4 + 2]], [data[(img.width * (img.height - 1)) * 4], data[(img.width * (img.height - 1)) * 4 + 1], data[(img.width * (img.height - 1)) * 4 + 2]], [data[(data.length - 4)], data[(data.length - 3)], data[(data.length - 2)]]];
                const [targetR, targetG, targetB] = corners[0];
                const tolerance = 50; 

                for (let i = 0; i < data.length; i += 4) {
                    const dist = Math.sqrt(Math.pow(data[i] - targetR, 2) + Math.pow(data[i+1] - targetG, 2) + Math.pow(data[i+2] - targetB, 2));
                    if (dist < tolerance) data[i + 3] = 0; 
                }
                ctx.putImageData(imageData, 0, 0);
                canvas.toBlob(async (blob) => {
                    const formData = new FormData();
                    formData.append('file', blob, "cleaned.png");
                    const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                    resolve(res.url);
                }, 'image/png');
            };
            img.onerror = () => resolve(null);
            img.src = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
        });
    };

    // 🚀 FONCTION MIROIR (Canvas flip)
    const flipFrame = async (url) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.translate(img.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(async (blob) => {
                    const formData = new FormData();
                    formData.append('file', blob, "flipped.png");
                    const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                    resolve(res.url);
                }, 'image/png');
            };
            img.onerror = () => resolve(null);
            img.src = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
        });
    };

    const handleMirrorSequence = async () => {
        if (!project || !selectedActorId) return;
        const actor = project.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        const action = actor.actions[selectedActionIdx];
        if (!action || action.frames.length === 0) return;

        if (!confirm(`Retourner (Miroir) les ${action.frames.length} images de la séquence "${action.name}" ?`)) return;

        setCleaning(true);
        const next = JSON.parse(JSON.stringify(project));
        const nextActor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        const nextAction = nextActor.actions[selectedActionIdx];

        try {
            for (let i = 0; i < nextAction.frames.length; i++) {
                const newUrl = await flipFrame(nextAction.frames[i].url);
                if (newUrl) nextAction.frames[i].url = newUrl;
            }
            setProject(next);
            await saveProject(next);
            setSelectedFrameIdx(null); // Reset selection
        } catch (e) { alert("Erreur miroir"); }
        setCleaning(false);
    };

    const handleSelectActor = (actorId, currentProj = project) => {
        if (!currentProj) return;
        const next = JSON.parse(JSON.stringify(currentProj));
        const actors = next.scenes[selectedSceneIdx].actors;
        const idx = actors.findIndex(a => a.id === actorId);
        if (idx !== -1) {
            const [moved] = actors.splice(idx, 1);
            actors.push(moved);
            setProject(next);
            setSelectedActorId(actorId);
            setIsPreviewPlaying(false);
            setSelectedFrameIdx(null);
        }
    };

    const handleStageMouseDown = (e, actorId) => {
        e.preventDefault(); e.stopPropagation();
        handleSelectActor(actorId);
        setIsDraggingOnStage(true);
    };

    const handleStageMouseMove = (e) => {
        if (!isDraggingOnStage || !selectedActorId || !stageRef.current) return;
        const rect = stageRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const next = { ...project };
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        if (actor) {
            actor.initialX = Math.round(Math.max(0, Math.min(100, x)));
            actor.initialY = Math.round(Math.max(0, Math.min(100, y)));
            setProject(next);
        }
    };

    const handleStageMouseUp = () => { if (isDraggingOnStage) { setIsDraggingOnStage(false); saveProject(); } };

    const handleUpdateProp = (f, v) => {
        const next = { ...project };
        const actor = next.scenes?.[selectedSceneIdx]?.actors?.find(a => a.id === selectedActorId);
        if (actor) {
            actor[f] = isNaN(v) ? v : parseFloat(v);
            setProject(next);
            saveProject(next);
        }
    };

    const handleAddAction = () => {
        if (!selectedActorId) return;
        const name = prompt("Nom de l'action :", "MARCHER");
        if (!name) return;
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        actor.actions.push({ name: name.toUpperCase(), frames: [], speed: 100 });
        saveProject(next);
    };

    const handleReorderFrame = (targetIdx) => {
        if (draggedFrameIdx === null || draggedFrameIdx === targetIdx) return;
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        const frames = actor.actions[selectedActionIdx].frames;
        const [moved] = frames.splice(draggedFrameIdx, 1);
        frames.splice(targetIdx, 0, moved);
        saveProject(next);
        setDraggedFrameIdx(null); setDropTargetIdx(null);
    };

    const handleDeleteFrame = (fIdx) => {
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        actor.actions[selectedActionIdx].frames.splice(fIdx, 1);
        saveProject(next);
    };

    const togglePreview = () => { setIsPreviewPlaying(!isPreviewPlaying); };

    // 🗑️ SUPPRESSION PERSONNAGE
    const handleDeleteActor = (e, actorId) => {
        e.stopPropagation();
        if (!confirm("Supprimer ce personnage de la scène ?")) return;
        const next = JSON.parse(JSON.stringify(project));
        next.scenes[selectedSceneIdx].actors = next.scenes[selectedSceneIdx].actors.filter(a => a.id !== actorId);
        if (selectedActorId === actorId) setSelectedActorId(null);
        setProject(next);
        saveProject(next);
    };

    // 🗑️ SUPPRESSION DÉCOR
    const handleDeleteBackdrop = (e, bIdx) => {
        e.stopPropagation();
        if (!confirm("Supprimer ce décor ?")) return;
        const next = JSON.parse(JSON.stringify(project));
        const scene = next.scenes[selectedSceneIdx];
        scene.backdrops.splice(bIdx, 1);
        if (scene.currentBackdropIdx >= scene.backdrops.length) {
            scene.currentBackdropIdx = Math.max(0, scene.backdrops.length - 1);
        }
        setProject(next);
        saveProject(next);
    };

    const currentScene = project?.scenes?.[selectedSceneIdx];
    const selectedActor = currentScene?.actors?.find(a => a.id === selectedActorId);
    const selectedAction = selectedActor?.actions?.[selectedActionIdx];

    return (
        <div className="studio-wrapper" onMouseMove={handleStageMouseMove} onMouseUp={handleStageMouseUp} onMouseLeave={handleStageMouseUp}>
            <div style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
                <input type="file" ref={frameUploadRef} multiple onChange={async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0 || !selectedActorId) return;
                    setLoading(true);
                    const next = JSON.parse(JSON.stringify(project));
                    const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
                    const action = actor.actions[selectedActionIdx];
                    for (const file of files) {
                        const formData = new FormData(); formData.append('file', file);
                        const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                        if (res.url) action.frames.push({ url: res.url, name: file.name });
                    }
                    await saveProject(next);
                    setLoading(false);
                }} />
                <input type="file" ref={actorUploadRef} onChange={async (e) => {
                    const file = e.target.files[0]; if(!file) return;
                    setLoading(true);
                    const formData = new FormData(); formData.append('file', file);
                    const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                    const next = JSON.parse(JSON.stringify(project));
                    if (!next.scenes[selectedSceneIdx].actors) next.scenes[selectedSceneIdx].actors = [];
                    const newActor = { id: `actor-${Date.now()}`, name: "P" + (next.scenes[selectedSceneIdx].actors.length + 1), actions: [{ name: "IDLE", speed: 100, frames: [{url: res.url, name: "C1"}] }], initialX: 50, initialY: 50, scale: 1, direction: 0, rotationStyle: 'all' };
                    next.scenes[selectedSceneIdx].actors.push(newActor);
                    handleSelectActor(newActor.id, next);
                    await saveProject(next);
                    setLoading(false);
                }} />
                <input type="file" ref={backdropUploadRef} onChange={async (e) => {
                    const file = e.target.files[0]; if(!file) return;
                    setLoading(true);
                    const formData = new FormData(); formData.append('file', file);
                    const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                    const next = JSON.parse(JSON.stringify(project));
                    if (!next.scenes[selectedSceneIdx].backdrops) next.scenes[selectedSceneIdx].backdrops = [];
                    next.scenes[selectedSceneIdx].backdrops.push({ url: res.url, name: file.name });
                    next.scenes[selectedSceneIdx].currentBackdropIdx = next.scenes[selectedSceneIdx].backdrops.length - 1;
                    await saveProject(next);
                    setLoading(false);
                }} />
            </div>

            <div className="studio-assets-panel">
                <div className="studio-tab-header">
                    <button onClick={() => setLeftTab('actions')} className={`studio-tab-btn ${leftTab === 'actions' ? 'active' : ''}`}>⚡ Actions</button>
                    <button onClick={() => setLeftTab('sounds')} className={`studio-tab-btn ${leftTab === 'sounds' ? 'active' : ''}`}>🎵 Sons</button>
                </div>
                <div className="studio-asset-list custom-scrollbar">
                    {leftTab === 'actions' ? (
                        <>
                            {selectedActor?.actions?.map((act, idx) => (
                                <div key={idx} onClick={() => { setSelectedActionIdx(idx); setIsPreviewPlaying(false); setSelectedFrameIdx(null); }} className={`action-card-square ${selectedActionIdx === idx ? 'active' : ''}`}>
                                    <span>{act.name}</span>
                                </div>
                            ))}
                            <button className="v84-add-btn-minimal" onClick={handleAddAction}>+ Ajouter Action</button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-10 opacity-30 text-center">
                            <span className="text-3xl mb-2">🎹</span>
                            <span className="text-[10px] font-black uppercase">Sons bientôt disponibles</span>
                        </div>
                    )}
                </div>
                {leftTab === 'actions' && selectedAction && (
                    <div className="studio-sequence-editor">
                        <div className="sequence-header">
                            <span className="text-[9px] font-black text-slate-400 uppercase">Séquence ({selectedAction.name})</span>
                            <div className="sequence-controls">
                                {/* BOUTON MIROIR */}
                                <button className="btn-mirror" onClick={handleMirrorSequence} title="Miroir Horizontal">↔️</button>
                                
                                {/* CONTRÔLES VITESSE DYNAMIQUES */}
                                <button className="btn-speed" onClick={() => handleUpdateActionSpeed(-50)}>-</button>
                                <span className="speed-indicator">{selectedAction.speed || 100}ms</span>
                                <button className="btn-speed" onClick={() => handleUpdateActionSpeed(50)}>+</button>
                                
                                <button className={`btn-preview-play ${isPreviewPlaying ? 'playing' : ''}`} onClick={togglePreview}>{isPreviewPlaying ? '⏹️ STOP' : '▶️ PLAY'}</button>
                            </div>
                        </div>
                        <div className="sequence-grid custom-scrollbar">
                            {selectedAction.frames.map((frame, fIdx) => (
                                <div 
                                    key={fIdx} 
                                    className={`frame-card ${isPreviewPlaying && previewFrameIdx === fIdx ? 'active-preview' : ''} ${selectedFrameIdx === fIdx ? 'selected-for-clean' : ''}`} 
                                    draggable 
                                    onClick={() => { setSelectedFrameIdx(selectedFrameIdx === fIdx ? null : fIdx); setIsPreviewPlaying(false); }}
                                    onDragStart={() => setDraggedFrameIdx(fIdx)} 
                                    onDragOver={(e) => { e.preventDefault(); setDropTargetIdx(fIdx); }} 
                                    onDrop={() => handleReorderFrame(fIdx)} 
                                    onDragLeave={() => setDropTargetIdx(null)}
                                >
                                    <img src={`/api/proxy/${frame.url.split('/').pop()}`} className="frame-img" alt="" />
                                    <button className="frame-del" onClick={(e) => { e.stopPropagation(); handleDeleteFrame(fIdx); }}>✕</button>
                                </div>
                            ))}
                            <button className="btn-add-frame" onClick={() => frameUploadRef.current.click()}>+</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="studio-center-column">
                <div ref={stageRef} className="stage-view" style={{ backgroundImage: currentScene?.backdrops?.[currentScene.currentBackdropIdx || 0]?.url ? `url(/api/proxy/${currentScene.backdrops[currentScene.currentBackdropIdx || 0].url.split('/').pop()})` : 'none' }}>
                    {isPlaying ? <LiveEngine code={code} project={project} activeSceneIdx={selectedSceneIdx} onStop={() => setIsPlaying(false)} /> : (
                        currentScene?.actors?.map((a) => {
                            const isSelected = selectedActorId === a.id;
                            let actionToRender;
                            let currentFrameIdx = 0;
                            if (isSelected) {
                                actionToRender = selectedAction;
                                if (isPreviewPlaying) { currentFrameIdx = previewFrameIdx; } 
                                else if (selectedFrameIdx !== null) { currentFrameIdx = selectedFrameIdx; }
                            } else {
                                actionToRender = (a.actions?.find(act => act.name.toUpperCase() === "IDLE") || a.actions?.[0]);
                            }
                            const frameUrl = actionToRender?.frames?.[currentFrameIdx]?.url;
                            return (
                                <div key={a.id} onMouseDown={(e) => handleStageMouseDown(e, a.id)} className={`actor-on-stage ${isSelected ? 'selected' : ''}`} style={{ left: `${a.initialX}%`, top: `${a.initialY}%`, transform: `translate(-50%, -50%) scale(${a.scale}) rotate(${a.direction || 0}deg)` }}>
                                    {frameUrl ? <img src={`/api/proxy/${frameUrl.split('/').pop()}`} alt="" /> : <div className="text-[10px] opacity-20">VIDE</div>}
                                    <div className="actor-label-tag">{a.name}</div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="v115-prop-bar">
                    <div className="flex flex-col"><span className="text-[8px] font-black opacity-30 uppercase">Nom</span><input className="prop-input-mini !w-16" value={selectedActor?.name || ""} onChange={e => handleUpdateProp('name', e.target.value)} /></div>
                    <div className="flex flex-col border-l pl-4"><span className="text-[8px] font-black opacity-30 uppercase mb-1">Taille (%)</span><input type="number" className="prop-input-mini !w-16" value={Math.round((selectedActor?.scale || 1) * 100)} onChange={e => handleUpdateProp('scale', parseFloat(e.target.value) / 100)} /></div>
                    <div className="flex flex-col border-l pl-4"><span className="text-[8px] font-black opacity-30 uppercase mb-1">Style de Rotation</span><div className="flex gap-1"><button onClick={() => handleUpdateProp('rotationStyle', 'all')} className={`p-1.5 rounded-lg border-2 ${selectedActor?.rotationStyle === 'all' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>🔄</button><button onClick={() => handleUpdateProp('rotationStyle', 'left-right')} className={`p-1.5 rounded-lg border-2 ${selectedActor?.rotationStyle === 'left-right' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>↔️</button><button onClick={() => handleUpdateProp('rotationStyle', 'none')} className={`p-1.5 rounded-lg border-2 ${selectedActor?.rotationStyle === 'none' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>🚫</button></div></div>
                    <button onClick={() => setIsPlaying(true)} className="ml-auto bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">▶ TESTER</button>
                </div>
                <div className="compact-code-editor"><textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" placeholder="Tapez votre code ici..." /></div>
            </div>

            <div className="studio-library-panel">
                <div className="library-scroll-area custom-scrollbar">
                    {/* SECTION PERSONNAGES */}
                    <div className="library-section-header">
                        <div className="lib-header-top">
                            <span className="lib-section-title">Personnages</span>
                            {selectedFrameIdx !== null && (
                                <button className="btn-ai-clean animate-pulse" onClick={handleAICleanBackground} disabled={cleaning || loading}>
                                    {cleaning ? '🤖 ANALYSE...' : '🤖 PRO DETOURAGE'}
                                </button>
                            )}
                        </div>
                        <div className="lib-actions-row">
                            <button className="btn-clean-bgs" onClick={handleRemoveAllBackgrounds} disabled={cleaning || loading}>
                                {cleaning ? '⏳ TRAITEMENT...' : '✨ NETTOYER BGS'}
                            </button>
                        </div>
                    </div>
                    <div className="library-grid">
                        {currentScene?.actors?.map((actor) => {
                            const thumb = actor.actions?.[0]?.frames?.[0]?.url;
                            return (
                                <div key={actor.id} className={`item-card ${selectedActorId === actor.id ? 'active' : ''}`} onClick={() => handleSelectActor(actor.id)}>
                                    <button className="item-del-btn" onClick={(e) => handleDeleteActor(e, actor.id)}>✕</button>
                                    <div className="item-img-container"><img src={thumb ? `/api/proxy/${thumb.split('/').pop()}` : ""} className="item-img" alt={actor.name} /></div>
                                    <div className="item-name-tag">{actor.name}</div>
                                </div>
                            );
                        })}
                        <div className="item-card !bg-indigo-50 !border-dashed !border-indigo-200" onClick={() => actorUploadRef.current.click()}><div className="item-img-container !bg-transparent"><span className="text-3xl text-indigo-300">+</span></div><div className="item-name-tag text-indigo-400 text-[9px]">Nouveau</div></div>
                    </div>
                </div>

                {/* SECTION BACKGROUNDS */}
                <div className="library-bg-section">
                    <div className="library-section-header">
                        <span className="lib-section-title">Décors (Backgrounds)</span>
                    </div>
                    <div className="library-grid custom-scrollbar overflow-y-auto">
                        {currentScene?.backdrops?.map((bd, bIdx) => (
                            <div key={bIdx} className={`item-card ${currentScene.currentBackdropIdx === bIdx ? 'active' : ''}`} onClick={() => {
                                const next = JSON.parse(JSON.stringify(project));
                                next.scenes[selectedSceneIdx].currentBackdropIdx = bIdx;
                                setProject(next);
                                saveProject(next);
                            }}>
                                <button className="item-del-btn" onClick={(e) => handleDeleteBackdrop(e, bIdx)}>✕</button>
                                <div className="item-img-container"><img src={`/api/proxy/${bd.url.split('/').pop()}` } className="item-img" alt="" /></div>
                                <div className="item-name-tag">DÉCOR {bIdx+1}</div>
                            </div>
                        ))}
                        <div className="item-card !bg-emerald-50 !border-dashed !border-emerald-200" onClick={() => backdropUploadRef.current.click()}><div className="item-img-container !bg-transparent"><span className="text-3xl text-emerald-300">+</span></div><div className="item-name-tag text-emerald-400 text-[9px]">Ajouter</div></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
