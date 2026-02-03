// @signatures: StudioDashboard, LiveEngine, handleSelectActor, handleStageMouseDown, handleStageMouseMove, handleStageMouseUp, handleAddAction, handleAddFrame, handleAddActor, handleUpdateProp, handleReorderFrame, handleDeleteFrame, togglePreview, handleRemoveAllBackgrounds, processFrameBackground
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';

/**
 * 🕹️ ENGINE V123 (CORE)
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
                            this.frameIdx = 0; this.animTick = 0;
                        }
                        play(name) { 
                            if(this.currentAction.toUpperCase() !== name.toUpperCase()) {
                                this.currentAction = name; this.frameIdx = 0; this.animTick = 0;
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
                            const s = project.scenes[sceneIdx];
                            const bd = s.backdrops?.[s.currentBackdropIdx || 0];
                            if(bd && this.assets[bd.url]) this.ctx.drawImage(this.assets[bd.url], 0, 0, this.canvas.width, this.canvas.height);
                            s.actors.forEach((a) => {
                                const p = this.actorsMap.get(a.id);
                                if (!p) return;
                                const action = (a.actions || []).find(act => act.name.toUpperCase() === p.currentAction.toUpperCase()) || a.actions?.[0];
                                if(action && action.frames?.length > 0) {
                                    p.animTick++; if(p.animTick > 6) { p.animTick = 0; p.frameIdx = (p.frameIdx + 1) % action.frames.length; }
                                    const frame = action.frames[p.frameIdx];
                                    const img = frame ? this.assets[frame.url] : null;
                                    if(img) {
                                        let rx = (p.x / 100) * this.canvas.width;
                                        let ry = (p.y / 100) * this.canvas.height;
                                        this.ctx.save(); this.ctx.translate(rx, ry);
                                        let normDir = ((p.dir % 360) + 360) % 360;
                                        if (p.rotationStyle === 'left-right') { if (normDir > 90 && normDir < 270) this.ctx.scale(-1, 1); }
                                        else if (p.rotationStyle === 'all') { this.ctx.rotate(p.dir * Math.PI / 180); }
                                        let sz = 150 * p.scale; this.ctx.drawImage(img, -sz/2, -sz/2, sz, sz);
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
    const [isDraggingOnStage, setIsDraggingOnStage] = useState(false);
    const [previewLatency, setPreviewLatency] = useState(300);

    const frameUploadRef = useRef(null);
    const actorUploadRef = useRef(null);
    const previewIntervalRef = useRef(null);
    const stageRef = useRef(null);

    useEffect(() => { loadProjects(); }, [user]);
    useEffect(() => { stopPreview(); }, [selectedActorId, selectedActionIdx]);
    useEffect(() => { if (isPreviewPlaying) { stopPreview(); startPreview(); } }, [previewLatency]);

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

    // 🚀 FONCTION DE NETTOYAGE DES BACKGROUNDS
    const handleRemoveAllBackgrounds = async () => {
        if (!project || !confirm("Voulez-vous rendre transparent le fond de TOUS les sprites de ce projet ?")) return;
        setCleaning(true);
        const next = JSON.parse(JSON.stringify(project));
        
        try {
            for (const scene of next.scenes) {
                for (const actor of scene.actors) {
                    for (const action of actor.actions) {
                        for (let i = 0; i < action.frames.length; i++) {
                            const frame = action.frames[i];
                            const newUrl = await processFrameBackground(frame.url);
                            if (newUrl) action.frames[i].url = newUrl;
                        }
                    }
                }
            }
            await saveProject(next);
            alert("✨ Nettoyage terminé avec succès !");
        } catch (e) {
            alert("Erreur lors du nettoyage.");
        }
        setCleaning(false);
    };

    const processFrameBackground = async (url) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // On récupère la couleur du premier pixel (fond supposé)
                const targetR = data[0];
                const targetG = data[1];
                const targetB = data[2];
                const tolerance = 35; // Seuil de ressemblance

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    
                    const dist = Math.sqrt(
                        Math.pow(r - targetR, 2) + 
                        Math.pow(g - targetG, 2) + 
                        Math.pow(b - targetB, 2)
                    );

                    if (dist < tolerance) {
                        data[i + 3] = 0; // Transparent
                    }
                }
                
                ctx.putImageData(imageData, 0, 0);
                canvas.toBlob(async (blob) => {
                    const formData = new FormData();
                    formData.append('file', blob, "cleaned_sprite.png");
                    const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                    resolve(res.url);
                }, 'image/png');
            };
            img.onerror = () => resolve(null);
            img.src = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
        });
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

    const handleStageMouseUp = () => {
        if (isDraggingOnStage) { setIsDraggingOnStage(false); saveProject(); }
    };

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
        actor.actions.push({ name: name.toUpperCase(), frames: [] });
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

    const togglePreview = () => { if (isPreviewPlaying) stopPreview(); else startPreview(); };
    const startPreview = () => {
        const framesCount = selectedAction?.frames?.length || 0;
        if (framesCount === 0) return;
        setIsPreviewPlaying(true); setPreviewFrameIdx(0);
        previewIntervalRef.current = setInterval(() => { setPreviewFrameIdx(prev => (prev + 1) % framesCount); }, previewLatency);
    };
    const stopPreview = () => { if (previewIntervalRef.current) clearInterval(previewIntervalRef.current); setIsPreviewPlaying(false); setPreviewFrameIdx(0); };

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
                    const newActor = { id: `actor-${Date.now()}`, name: "P" + (next.scenes[selectedSceneIdx].actors.length + 1), actions: [{ name: "IDLE", frames: [{url: res.url, name: "C1"}] }], initialX: 50, initialY: 50, scale: 1, direction: 0, rotationStyle: 'all' };
                    next.scenes[selectedSceneIdx].actors.push(newActor);
                    handleSelectActor(newActor.id, next);
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
                                <div key={idx} onClick={() => { setSelectedActionIdx(idx); }} className={`action-card-square ${selectedActionIdx === idx ? 'active' : ''}`}>
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
                                <button className="btn-speed" onClick={() => setPreviewLatency(prev => Math.max(50, prev - 50))}>-</button>
                                <span className="speed-indicator">{previewLatency}ms</span>
                                <button className="btn-speed" onClick={() => setPreviewLatency(prev => prev + 50)}>+</button>
                                <button className={`btn-preview-play ${isPreviewPlaying ? 'playing' : ''}`} onClick={togglePreview}>{isPreviewPlaying ? '⏹️ STOP' : '▶️ PLAY'}</button>
                            </div>
                        </div>
                        <div className="sequence-grid custom-scrollbar">
                            {selectedAction.frames.map((frame, fIdx) => (
                                <div key={fIdx} className={`frame-card ${isPreviewPlaying && previewFrameIdx === fIdx ? 'active-preview' : ''}`} draggable onDragStart={() => setDraggedFrameIdx(fIdx)} onDragOver={(e) => { e.preventDefault(); setDropTargetIdx(fIdx); }} onDrop={() => handleReorderFrame(fIdx)} onDragLeave={() => setDropTargetIdx(null)}>
                                    <img src={`/api/proxy/${frame.url.split('/').pop()}`} className="frame-img" alt="" />
                                    <button className="frame-del" onClick={() => handleDeleteFrame(fIdx)}>✕</button>
                                </div>
                            ))}
                            <button className="btn-add-frame" onClick={() => frameUploadRef.current.click()}>+</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="studio-center-column">
                <div ref={stageRef} className="stage-view" style={{ backgroundImage: currentScene?.backdrops?.[0]?.url ? `url(/api/proxy/${currentScene.backdrops[0].url.split('/').pop()})` : 'none' }}>
                    {isPlaying ? <LiveEngine code={code} project={project} activeSceneIdx={selectedSceneIdx} onStop={() => setIsPlaying(false)} /> : (
                        currentScene?.actors?.map((a) => {
                            const isSelected = selectedActorId === a.id;
                            const actionToRender = (isSelected && isPreviewPlaying) ? selectedAction : (a.actions?.find(act => act.name.toUpperCase() === "IDLE") || a.actions?.[0]);
                            const currentFrameIdx = (isSelected && isPreviewPlaying) ? previewFrameIdx : 0;
                            const frameUrl = actionToRender?.frames?.[currentFrameIdx]?.url;
                            return (
                                <div key={a.id} onMouseDown={(e) => handleStageMouseDown(e, a.id)} className={`actor-on-stage ${isSelected ? 'selected' : ''}`} style={{ left: `${a.initialX}%`, top: `${a.initialY}%`, transform: `translate(-50%, -50%) scale(${a.scale}) rotate(${a.direction}deg)` }}>
                                    <img src={frameUrl ? `/api/proxy/${frameUrl.split('/').pop()}` : ""} alt="" />
                                    <div className="actor-label-tag">{a.name}</div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="v115-prop-bar">
                    <div className="flex flex-col"><span className="text-[8px] font-black opacity-30 uppercase">Nom</span><input className="prop-input-mini !w-16" value={selectedActor?.name || ""} onChange={e => handleUpdateProp('name', e.target.value)} /></div>
                    <div className="flex flex-col border-l pl-4"><span className="text-[8px] font-black opacity-30 uppercase mb-1">Style de Rotation</span><div className="flex gap-1"><button onClick={() => handleUpdateProp('rotationStyle', 'all')} className={`p-1.5 rounded-lg border-2 ${selectedActor?.rotationStyle === 'all' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>🔄</button><button onClick={() => handleUpdateProp('rotationStyle', 'left-right')} className={`p-1.5 rounded-lg border-2 ${selectedActor?.rotationStyle === 'left-right' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>↔️</button><button onClick={() => handleUpdateProp('rotationStyle', 'none')} className={`p-1.5 rounded-lg border-2 ${selectedActor?.rotationStyle === 'none' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>🚫</button></div></div>
                    <button onClick={() => setIsPlaying(true)} className="ml-auto bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">▶ TESTER</button>
                </div>
                <div className="compact-code-editor"><textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" placeholder="Tapez votre code ici..." /></div>
            </div>

            <div className="studio-library-panel">
                <div className="library-section-header">
                    <span className="font-black text-[10px] uppercase text-slate-400">Personnages</span>
                    <button className="btn-clean-bgs" onClick={handleRemoveAllBackgrounds} disabled={cleaning || loading}>
                        {cleaning ? '✨ NETTOYAGE...' : '✨ NETTOYER BGS'}
                    </button>
                </div>
                <div className="library-grid custom-scrollbar">
                    {currentScene?.actors?.map((actor) => {
                        const thumb = actor.actions?.[0]?.frames?.[0]?.url;
                        return (
                            <div key={actor.id} className={`item-card ${selectedActorId === actor.id ? 'active' : ''}`} onClick={() => handleSelectActor(actor.id)}>
                                <div className="item-img-container"><img src={thumb ? `/api/proxy/${thumb.split('/').pop()}` : ""} className="item-img" alt={actor.name} /></div>
                                <div className="item-name-tag">{actor.name}</div>
                            </div>
                        );
                    })}
                    <div className="item-card !bg-indigo-50 !border-dashed !border-indigo-200" onClick={() => actorUploadRef.current.click()}><div className="item-img-container !bg-transparent"><span className="text-3xl text-indigo-300">+</span></div><div className="item-name-tag text-indigo-400 text-[9px]">Nouveau</div></div>
                </div>
            </div>
        </div>
    );
}
