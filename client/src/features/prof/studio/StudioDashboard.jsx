// @signatures: StudioDashboard
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';
import ManualEraser from './studioComp/ManualEraser';
import GameEngine from './studioComp/GameEngine';
import SaveLoadModal from './studioComp/SaveLoadModal';

const CURRENT_BUILD = 71; 

function resolveUrl(url) {
    if (!url) return "";
    if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
    const id = url.split('/').pop();
    return `/api/proxy/${id}`;
}

const defaultCode = `// 🧟 ZOMBIE V445
class MiniGame extends MiniGameBase {
    constructor(canvas, assets, callbacks) {
        super(canvas, assets, callbacks);
        this.heroState = "IDLE"; this.heroTimer = 0;
        this.zombieX = 90; this.projectiles = [];
        this.isStopped = false;
    }
    start() { 
        this.isStopped = false;
        if(this.HEROS) { this.HEROS.x = 15; this.HEROS.y = 70; } 
        if(this.ZOMBIE) { this.ZOMBIE.x = 90; this.ZOMBIE.y = 70; } 
    }
    onLevelWin() { this.isStopped = true; }
    onResult(correct) { if(correct) { this.heroState = "SHOOT"; this.heroTimer = 30; this.projectiles.push({ x: 20, y: 65 }); } }
    update() {
        if(this.isStopped) return;
        if(this.heroState === "SHOOT") { this.heroTimer--; if(this.heroTimer <= 0) this.heroState = "IDLE"; }
        this.zombieX -= 0.15; if(this.zombieX < 20) { if (this.callbacks.onPlayerHit) this.callbacks.onPlayerHit(); this.zombieX = 100; }
        if(this.ZOMBIE) { this.ZOMBIE.x = this.zombieX; this.ZOMBIE.dir = -90; this.ZOMBIE.play("AVANCER"); }
        for(let i=this.projectiles.length-1; i>=0; i--) { let p = this.projectiles[i]; p.x += 3; if(p.x > this.zombieX - 5 && p.x < this.zombieX + 5) { this.projectiles.splice(i, 1); this.zombieX = 100; } }
    }
    draw() {
        if(this.isStopped) return;
        const ctx = this.ctx; const cw = this.canvas.width; const ch = this.canvas.height;
        ctx.fillStyle = "#f97316"; this.projectiles.forEach(p => { ctx.beginPath(); ctx.arc((p.x/100)*cw, (p.y/100)*ch, 10, 0, Math.PI*2); ctx.fill(); });
    }
}
`;

export default function StudioDashboard({ user }) {
    const [project, setProject] = useState({ title: "Nouveau Projet", scenes: [{ name: "Scene 1", actors: [], backdrops: [] }] });
    const [selectedActorId, setSelectedActorId] = useState(null);
    const [selectedActionIdx, setSelectedActionIdx] = useState(0);
    const [leftTab, setLeftTab] = useState('actions');
    const [code, setCode] = useState(defaultCode);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [eraserActive, setEraserActive] = useState(false);
    const [eraserSize, setEraserSize] = useState(10);
    const [frameToErase, setFrameToErase] = useState(null);
    const [testQuizData, setTestQuizData] = useState(null);
    const [showTestQuizModal, setShowTestQuizModal] = useState(false);
    const [draggedFrameIdx, setDraggedFrameIdx] = useState(null);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
    const [selectedFrameIdx, setSelectedFrameIdx] = useState(null);
    const [isDraggingOnStage, setIsDraggingOnStage] = useState(false);
    
    // --- SAVE / LOAD STATE ---
    const [showSaveLoadModal, setShowSaveLoadModal] = useState(false);
    const [modalMode, setModalMode] = useState('LOAD'); // 'SAVE' or 'LOAD'

    const frameUploadRef = useRef(null);
    const actorUploadRef = useRef(null);
    const backdropUploadRef = useRef(null); 
    const stageRef = useRef(null);

    const selectedSceneIdx = 0;
    const currentScene = project?.scenes?.[selectedSceneIdx];
    const selectedActor = currentScene?.actors?.find(a => a.id === selectedActorId);
    const selectedAction = selectedActor?.actions?.[selectedActionIdx];

    useEffect(() => { loadProjects(); }, [user]);

    useEffect(() => {
        let timer;
        if (isPreviewPlaying && selectedAction?.frames?.length > 0) {
            timer = setInterval(() => { setPreviewFrameIdx(prev => (prev + 1) % selectedAction.frames.length); }, selectedAction.speed || 100);
        } else setPreviewFrameIdx(0);
        return () => clearInterval(timer);
    }, [isPreviewPlaying, selectedAction]);

    async function loadProjects() {
        const data = await api.get(`/studio/projects/${user.id || user._id}`);
        if (data?.length > 0) {
            const p = data[0];
            setProject(p);
            setCode(p.generatedCode || defaultCode);
            if (p.scenes?.[0]?.actors?.[0]) setSelectedActorId(p.scenes[0].actors[0].id);
        }
    }

    async function saveProject(p = project) {
        if (!p) return;
        setLoading(true); setStatusText("Synchronisation Cloud...");
        try {
            const saved = await api.post('/studio', { ...p, teacherId: user.id || user._id, generatedCode: code });
            setProject(saved);
        } catch(e) {} setLoading(false);
    }

    // --- GESTION SAVE / LOAD / NEW ---
    const handleOpenSave = () => {
        setModalMode('SAVE');
        setShowSaveLoadModal(true);
    };

    const handleOpenLoad = () => {
        setModalMode('LOAD');
        setShowSaveLoadModal(true);
    };

    const handleLoadProject = (p) => {
        setProject(p);
        setCode(p.generatedCode || defaultCode);
        if (p.scenes?.[0]?.actors?.[0]) setSelectedActorId(p.scenes[0].actors[0].id);
        else setSelectedActorId(null);
        setShowSaveLoadModal(false);
    };

    const handleCreateNew = () => {
        setProject({ title: "Nouveau Projet", scenes: [{ name: "Scene 1", actors: [], backdrops: [] }] });
        setCode(defaultCode);
        setSelectedActorId(null);
        setShowSaveLoadModal(false);
    };

    const handleViewTestQuiz = async () => {
        try {
            const data = await api.get('/games/test-data');
            if (data) { setTestQuizData(data); setShowTestQuizModal(true); }
        } catch (e) {}
    };

    const handleUpdateActionSpeed = (delta) => {
        if (!selectedAction) return;
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        if (actor && actor.actions[selectedActionIdx]) {
            actor.actions[selectedActionIdx].speed = Math.max(20, Math.min(2000, (actor.actions[selectedActionIdx].speed || 100) + delta));
            setProject(next); saveProject(next);
        }
    };

    const handleBatchAIClean = async () => {
        if (!selectedAction) return;
        if (!confirm(`🤖 NETTOYAGE IA : Envoyer les ${selectedAction.frames.length} images ?`)) return;
        setCleaning(true); setStatusText("Analyse IA en cours...");
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        const act = actor.actions[selectedActionIdx];
        for (let i = 0; i < act.frames.length; i++) {
            const res = await api.post('/studio/remove-bg-specialized', { url: act.frames[i].url });
            if (res.url) act.frames[i].url = res.url;
        }
        setProject(next); await saveProject(next); setCleaning(false);
    };

    const handleBatchManualClean = async () => {
        if (!selectedAction) return;
        if (!confirm("🎨 Détourage Automatique (Haut-Gauche) ?")) return;
        setCleaning(true); setStatusText("Détourage Chromatique...");
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        const act = actor.actions[selectedActionIdx];
        for (let i = 0; i < act.frames.length; i++) {
            const url = await processFrameBackgroundManual(act.frames[i].url);
            if (url) act.frames[i].url = url;
        }
        setProject(next); await saveProject(next); setCleaning(false);
    };

    const processFrameBackgroundManual = async (url) => {
        return new Promise((resolve) => {
            const img = new Image(); img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
                const iD = ctx.getImageData(0, 0, canvas.width, canvas.height); const d = iD.data;
                const [tr, tg, tb] = [d[0], d[1], d[2]];
                for (let i = 0; i < d.length; i += 4) {
                    const dist = Math.sqrt(Math.pow(d[i]-tr,2)+Math.pow(d[i+1]-tg,2)+Math.pow(d[i+2]-tb,2));
                    if (dist < 50) d[i+3] = 0;
                }
                ctx.putImageData(iD, 0, 0);
                canvas.toBlob(async (blob) => {
                    const fd = new FormData(); fd.append('file', blob, "auto-clean.png");
                    const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json());
                    resolve(res.url);
                }, 'image/png');
            };
            img.src = resolveUrl(url);
        });
    };

    const handleMirrorSequence = async () => {
        if (!selectedAction) return;
        setCleaning(true); setStatusText("Création Miroir...");
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        const act = actor.actions[selectedActionIdx];
        for (let i = 0; i < act.frames.length; i++) {
            const img = new Image(); img.crossOrigin = "anonymous";
            const url = await new Promise(res => {
                img.onload = () => {
                    const c = document.createElement('canvas'); c.width=img.width; c.height=img.height;
                    const x = c.getContext('2d'); x.translate(img.width, 0); x.scale(-1,1); x.drawImage(img,0,0);
                    c.toBlob(async b => {
                        const f = new FormData(); f.append('file', b, "flipped.png");
                        const r = await fetch('/api/studio/upload-asset', { method: 'POST', body: f }).then(z=>z.json());
                        res(r.url);
                    }, 'image/png');
                };
                img.src = resolveUrl(act.frames[i].url);
            });
            if(url) act.frames[i].url = url;
        }
        setProject(next); await saveProject(next); setCleaning(false);
    };

    const handleSelectActor = (actorId) => {
        if (!project) return;
        const next = JSON.parse(JSON.stringify(project));
        const actors = next.scenes[selectedSceneIdx].actors;
        const idx = actors.findIndex(a => a.id === actorId);
        if (idx === -1) return;
        const [moved] = actors.splice(idx, 1); actors.push(moved);
        setProject(next); setSelectedActorId(actorId); setSelectedFrameIdx(null);
    };

    const handleStageMouseDown = (e, actorId) => { e.preventDefault(); e.stopPropagation(); handleSelectActor(actorId); setIsDraggingOnStage(true); };
    const handleStageMouseMove = (e) => {
        if (!isDraggingOnStage || !selectedActorId || !stageRef.current) return;
        const rect = stageRef.current.getBoundingClientRect();
        const next = { ...project };
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        if (actor) {
            actor.initialX = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
            actor.initialY = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)));
            setProject(next);
        }
    };

    const handleUpdateProp = (f, v) => {
        if (!selectedActor) return;
        const next = { ...project };
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        if (actor) {
            actor[f] = isNaN(v) ? v : parseFloat(v); setProject(next); saveProject(next);
        }
    };

    const handleReorderFrame = (targetIdx) => {
        if (draggedFrameIdx === null || draggedFrameIdx === targetIdx || !selectedAction) return;
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        const frames = actor.actions[selectedActionIdx].frames;
        const [moved] = frames.splice(draggedFrameIdx, 1); frames.splice(targetIdx, 0, moved);
        saveProject(next); setDraggedFrameIdx(null);
    };

    const handleDeleteFrame = (fIdx) => {
        if (!selectedAction) return;
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        actor.actions[selectedActionIdx].frames.splice(fIdx, 1);
        saveProject(next);
    };

    const handleDeleteActor = (e, id) => { e.stopPropagation(); if (!confirm("Supprimer ?")) return; const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].actors = next.scenes[selectedSceneIdx].actors.filter(a => a.id !== id); if (selectedActorId === id) setSelectedActorId(null); setProject(next); saveProject(next); };
    const handleDeleteBackdrop = (e, idx) => { e.stopPropagation(); if (!confirm("Supprimer ?")) return; const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].backdrops.splice(idx, 1); next.scenes[selectedSceneIdx].currentBackdropIdx = 0; setProject(next); saveProject(next); };

    return (
        <div className="studio-wrapper" onMouseMove={handleStageMouseMove} onMouseUp={() => setIsDraggingOnStage(false)}>
            {showSaveLoadModal && (
                <SaveLoadModal 
                    mode={modalMode} 
                    user={user} 
                    currentProject={project}
                    onClose={() => setShowSaveLoadModal(false)}
                    onLoad={handleLoadProject}
                    onNew={handleCreateNew}
                    onSave={(p) => { 
                        saveProject(p).then(() => setShowSaveLoadModal(false)); 
                    }}
                />
            )}

            {frameToErase && (
                <ManualEraser 
                    imageUrl={frameToErase.url} initialSize={eraserSize} resolveUrl={resolveUrl}
                    onCancel={() => setFrameToErase(null)}
                    onSave={(newUrl) => {
                        const next = JSON.parse(JSON.stringify(project));
                        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
                        actor.actions[selectedActionIdx].frames[frameToErase.idx].url = newUrl;
                        setProject(next); saveProject(next); setFrameToErase(null);
                    }}
                />
            )}

            {(loading || cleaning) && (<div className="studio-loading-overlay"><div className="sablier-icon">⏳</div><div className="loading-text">{statusText}</div></div>)}
            
            <div style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
                <input type="file" ref={frameUploadRef} multiple onChange={async (e) => { const files = Array.from(e.target.files); if (files.length === 0) return; setLoading(true); setStatusText("Upload frames..."); const next = JSON.parse(JSON.stringify(project)); const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); const act = actor.actions[selectedActionIdx]; for (const file of files) { const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); if (res.url) act.frames.push({ url: res.url, name: file.name }); } await saveProject(next); setLoading(false); }} />
                <input type="file" ref={actorUploadRef} onChange={async (e) => { const file = e.target.files[0]; if(!file) return; setLoading(true); setStatusText("Nouveau personnage..."); const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); const next = JSON.parse(JSON.stringify(project)); const newActor = { id: `actor-${Date.now()}`, name: "P" + (next.scenes[selectedSceneIdx].actors.length + 1), actions: [{ name: "IDLE", speed: 100, frames: [{url: res.url, name: "C1"}] }], initialX: 50, initialY: 50, scale: 1, direction: 0, rotationStyle: 'all' }; next.scenes[selectedSceneIdx].actors.push(newActor); setSelectedActorId(newActor.id); await saveProject(next); setLoading(false); }} />
                <input type="file" ref={backdropUploadRef} onChange={async (e) => { const file = e.target.files[0]; if(!file) return; setLoading(true); setStatusText("Upload décor..."); const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].backdrops.push({ url: res.url, name: file.name }); next.scenes[selectedSceneIdx].currentBackdropIdx = next.scenes[selectedSceneIdx].backdrops.length - 1; await saveProject(next); setLoading(false); }} />
            </div>

            {showTestQuizModal && (<div className="quiz-data-overlay" onClick={() => setShowTestQuizModal(false)}><div className="quiz-data-window" onClick={e => e.stopPropagation()}><div className="quiz-data-header"><span className="font-black text-slate-700 uppercase">Quiz Test</span><button onClick={() => setShowTestQuizModal(false)}>✕</button></div><div className="quiz-data-body custom-scrollbar"><pre>{JSON.stringify(testQuizData, null, 2)}</pre></div></div></div>)}
            
            {isPlaying && (
                <GameEngine 
                    code={code} 
                    project={project} 
                    activeSceneIdx={selectedSceneIdx} 
                    onStop={() => setIsPlaying(false)} 
                    resolveUrl={resolveUrl} 
                />
            )}

            {/* HEADER FIXE */}
            <div className="v84-game-header">
                <div className="flex items-center gap-4 flex-1">
                    <span className="v84-game-icon">🎬</span>
                    <input className="v84-game-title-input" value={project?.title || ""} onChange={e => setProject({...project, title: e.target.value})} placeholder="TITRE DU PROJET..." />
                    <button onClick={handleOpenSave} className="px-4 py-2 rounded-xl bg-green-500 text-white font-black text-xs uppercase hover:scale-105 transition-transform shadow-lg ml-4">💾 SAUVEGARDER</button>
                    <button onClick={handleOpenLoad} className="px-4 py-2 rounded-xl bg-blue-500 text-white font-black text-xs uppercase hover:scale-105 transition-transform shadow-lg">📂 CHARGER</button>
                </div>
            </div>

            {/* CORPS PRINCIPAL EN 3 COLONNES */}
            <div className="studio-wrapper-body">
                <div className="studio-assets-panel">
                    <div className="studio-tab-header"><button onClick={() => setLeftTab('actions')} className={`studio-tab-btn ${leftTab === 'actions' ? 'active' : ''}`}>⚡ Actions</button><button onClick={() => setLeftTab('sounds')} className={`studio-tab-btn ${leftTab === 'sounds' ? 'active' : ''}`}>🎵 Sons</button></div>
                    <div className="studio-asset-list custom-scrollbar">
                        {leftTab === 'actions' ? (<>{selectedActor?.actions?.map((act, idx) => (<div key={idx} onClick={() => { setSelectedActionIdx(idx); setIsPreviewPlaying(false); setSelectedFrameIdx(null); }} className={`action-card-square ${selectedActionIdx === idx ? 'active' : ''}`}><span>{act.name}</span></div>))}<button className="v84-add-btn-minimal" onClick={() => { const name = prompt("Nom :"); if(!name) return; const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId).actions.push({ name: name.toUpperCase(), frames: [], speed: 100 }); saveProject(next); }}>+ Ajouter</button></>) : <div className="p-10 opacity-30 text-center uppercase text-[10px] font-black">Bientôt</div>}
                    </div>
                    {leftTab === 'actions' && selectedAction && (
                        <div className="studio-sequence-editor">
                            <div className="sequence-header"><span className="text-[9px] font-black text-slate-400 uppercase">Séquence ({selectedAction.name})</span><div className="sequence-controls"><button className="btn-mirror" onClick={handleMirrorSequence} title="Miroir">↔️</button><button className="btn-speed" onClick={() => handleUpdateActionSpeed(-50)}>-</button><span className="speed-indicator">{selectedAction.speed || 100}ms</span><button className="btn-speed" onClick={() => handleUpdateActionSpeed(50)}>+</button><button className={`btn-preview-play ${isPreviewPlaying ? 'playing' : ''}`} onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}>{isPreviewPlaying ? '⏹️' : '▶️'}</button></div></div>
                            <div className="sequence-grid custom-scrollbar">{selectedAction.frames.map((frame, fIdx) => (<div key={fIdx} className={`frame-card ${isPreviewPlaying && previewFrameIdx === fIdx ? 'active-preview' : ''} ${selectedFrameIdx === fIdx ? 'selected-for-clean' : ''}`} draggable onClick={() => { setSelectedFrameIdx(selectedFrameIdx === fIdx ? null : fIdx); setIsPreviewPlaying(false); }} onDragStart={() => setDraggedFrameIdx(fIdx)} onDragOver={e => e.preventDefault()} onDrop={() => handleReorderFrame(fIdx)}><img src={resolveUrl(frame.url)} className="frame-img" /><button className="frame-del" onClick={e => { e.stopPropagation(); handleDeleteFrame(fIdx); }}>✕</button></div>))}<button className="v84-add-btn-minimal !p-2 !h-16 !w-16" onClick={() => frameUploadRef.current.click()}>+</button></div>
                            <div className="eraser-tool-bar"><button className={`btn-eraser-main ${eraserActive ? 'active' : ''}`} onClick={() => setEraserActive(!eraserActive)}>🧽</button><div className="eraser-size-ctrl"><button onClick={() => setEraserSize(Math.max(1, eraserSize - 2))} className="btn-size">-</button><span className="size-val">{eraserSize}</span><button onClick={() => setEraserSize(Math.min(100, eraserSize + 2))} className="btn-size">+</button></div>{eraserActive && selectedFrameIdx !== null && (<button className="btn-launch-eraser animate-pulse" onClick={() => setFrameToErase({ url: selectedAction.frames[selectedFrameIdx].url, idx: selectedFrameIdx })}>GOMMER FRAME</button>)}</div>
                        </div>
                    )}
                </div>
                
                <div className="studio-center-column">
                    <div ref={stageRef} className="stage-view" style={{ backgroundImage: currentScene?.backdrops?.[currentScene.currentBackdropIdx || 0]?.url ? `url(${resolveUrl(currentScene.backdrops[currentScene.currentBackdropIdx].url)})` : 'none' }}>{currentScene?.actors?.map((a) => { const isSelected = selectedActorId === a.id; let action = isSelected ? selectedAction : (a.actions?.find(act => act.name.toUpperCase() === "IDLE") || a.actions?.[0]); let frameIdx = isSelected ? (isPreviewPlaying ? previewFrameIdx : (selectedFrameIdx !== null ? selectedFrameIdx : 0)) : 0; return (<div key={a.id} onMouseDown={e => handleStageMouseDown(e, a.id)} className={`actor-on-stage ${isSelected ? 'selected' : ''}`} style={{ left: `${a.initialX}%`, top: `${a.initialY}%`, transform: `translate(-50%, -50%) scale(${a.scale}) rotate(${a.direction || 0}deg)` }}>{action?.frames?.[frameIdx]?.url && <img src={resolveUrl(action.frames[frameIdx].url)} />}<div className="actor-label-tag">{a.name}</div></div>); })}</div>
                    <div className="v115-prop-bar"><div className="flex flex-col"><span className="text-[8px] font-black opacity-30 uppercase">Nom</span><input className="prop-input-mini" value={selectedActor?.name || ""} onChange={e => handleUpdateProp('name', e.target.value)} /></div><div className="flex flex-col border-l pl-4"><span className="text-[8px] font-black opacity-30 uppercase">Taille (%)</span><input type="number" className="prop-input-mini" value={Math.round((selectedActor?.scale || 1) * 100)} onChange={e => handleUpdateProp('scale', parseFloat(e.target.value)/100)} /></div><button onClick={handleViewTestQuiz} className="btn-view-quiz">📋 QUIZ</button><button onClick={() => { saveProject(); setIsPlaying(true); }} className="ml-2 bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] shadow-lg">▶ TESTER</button></div>
                    <div className="compact-code-editor"><textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" /></div>
                </div>

                <div className="studio-library-panel">
                    <div className="library-scroll-area custom-scrollbar"><div className="library-section-header"><span className="lib-section-title">Personnages</span><div className="flex flex-col gap-1 mt-2"><button className="bg-blue-100 text-blue-600 border border-blue-200 rounded-lg py-1 text-[9px] font-black uppercase" onClick={handleBatchManualClean}>🎨 AUTO-CLEAN</button><button className="bg-purple-100 text-purple-600 border border-purple-200 rounded-lg py-1 text-[9px] font-black uppercase" onClick={handleBatchAIClean} disabled={cleaning}>✨ IA CLEAN</button></div></div><div className="library-grid">{currentScene?.actors?.map((actor) => (<div key={actor.id} className={`item-card ${selectedActorId === actor.id ? 'active' : ''}`} onClick={() => handleSelectActor(actor.id)}><button className="item-del-btn" onClick={e => handleDeleteActor(e, actor.id)}>✕</button><div className="item-img-container"><img src={actor.actions?.[0]?.frames?.[0]?.url ? resolveUrl(actor.actions[0].frames[0].url) : ""} className="item-img" /></div><div className="item-name-tag">{actor.name}</div></div>))}<div className="item-card !bg-indigo-50" onClick={() => actorUploadRef.current.click()}><span className="text-3xl text-indigo-300">+</span></div></div></div>
                    <div className="library-bg-section"><div className="library-section-header"><span className="lib-section-title">Décors</span></div><div className="library-grid custom-scrollbar">{currentScene?.backdrops?.map((bd, bIdx) => (<div key={bIdx} className={`item-card ${currentScene.currentBackdropIdx === bIdx ? 'active' : ''}`} onClick={() => { const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].currentBackdropIdx = bIdx; setProject(next); saveProject(next); }}><button className="item-del-btn" onClick={e => handleDeleteBackdrop(e, bIdx)}>✕</button><div className="item-img-container"><img src={resolveUrl(bd.url)} className="item-img" /></div><div className="item-name-tag">DÉCOR {bIdx+1}</div></div>))}<div className="item-card !bg-emerald-50" onClick={() => backdropUploadRef.current.click()}><span className="text-3xl text-emerald-300">+</span></div></div></div>
                </div>
            </div>
        </div>
    );
}
