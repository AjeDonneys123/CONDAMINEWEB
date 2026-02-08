// @signatures: StudioDashboard
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';
import ManualEraser from './studioComp/ManualEraser';
import GameEngine from './studioComp/GameEngine';
import SaveLoadModal from './studioComp/SaveLoadModal';
import SoundModal from './studioComp/SoundModal';

function resolveUrl(url) {
    if (!url) return "";
    if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
    const id = url.split('/').pop();
    return `/api/proxy/${id}`;
}

// 🧟 CODE PAR DÉFAUT (ZOMBIE)
const defaultCode = `// 🧟 ZOMBIE V480
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
    onResult(correct) { 
        if(correct) { 
            this.heroState = "SHOOT"; 
            this.heroTimer = 30; 
            this.projectiles.push({ x: 20, y: 65 }); 
        } 
    }
    update() {
        if(this.isStopped) return;
        if(this.heroState === "SHOOT") { this.heroTimer--; if(this.heroTimer <= 0) this.heroState = "IDLE"; }
        this.zombieX -= 0.15; 
        if(this.zombieX < 20) { if (this.callbacks.onPlayerHit) this.callbacks.onPlayerHit(); this.zombieX = 100; }
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

const DEMO_PROJECT = { 
    title: "Mon Premier Jeu", 
    scenes: [{ 
        name: "Scene 1", backdrops: [], currentBackdropIdx: 0,
        actors: [
            { id: "actor-hero", name: "HEROS", initialX: 15, initialY: 70, scale: 1, direction: 0, rotationStyle: 'all', actions: [{ name: "IDLE", speed: 100, frames: [] }, { name: "SHOOT", speed: 100, frames: [] }] },
            { id: "actor-zombie", name: "ZOMBIE", initialX: 90, initialY: 70, scale: 1, direction: 0, rotationStyle: 'left-right', actions: [{ name: "AVANCER", speed: 150, frames: [] }] }
        ] 
    }] 
};

export default function StudioDashboard({ user }) {
    const [project, setProject] = useState(DEMO_PROJECT);
    const [selectedActorId, setSelectedActorId] = useState("actor-hero");
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
    const [showSaveLoadModal, setShowSaveLoadModal] = useState(false);
    const [modalMode, setModalMode] = useState('LOAD'); 
    const [showSoundModal, setShowSoundModal] = useState(false);

    const frameUploadRef = useRef(null);
    const actorUploadRef = useRef(null);
    const backdropUploadRef = useRef(null); 
    const stageRef = useRef(null);

    const selectedSceneIdx = 0;
    const currentScene = project?.scenes?.[selectedSceneIdx];
    const selectedActor = currentScene?.actors?.find(a => a.id === selectedActorId) || currentScene?.actors?.[0];
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
        } else {
            setProject(DEMO_PROJECT);
            setCode(defaultCode);
            setSelectedActorId("actor-hero");
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

    // --- HANDLERS ACTIONS ---

    const handleCreateNew = () => { setProject(DEMO_PROJECT); setCode(defaultCode); setSelectedActorId("actor-hero"); setShowSaveLoadModal(false); };
    const handleLoadProject = (p) => { setProject(p); setCode(p.generatedCode || defaultCode); if (p.scenes?.[0]?.actors?.[0]) setSelectedActorId(p.scenes[0].actors[0].id); else setSelectedActorId(null); setShowSaveLoadModal(false); };
    
    // --- RESTAURATION DE LA FONCTION MANQUANTE ---
    const handleViewTestQuiz = async () => {
        try {
            const data = await api.get('/games/test-data');
            if (data) { 
                setTestQuizData(data); 
                setShowTestQuizModal(true); 
            }
        } catch (e) { console.error(e); }
    };

    const handleSmartAIClean = async () => { /* ... (Logique IA Clean) ... */ };
    const handleMirrorSequence = async () => { /* ... (Logique Miroir) ... */ };
    const handleSelectActor = (actorId) => { setSelectedActorId(actorId); setSelectedFrameIdx(null); };
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
        if (actor) { actor[f] = isNaN(v) ? v : parseFloat(v); setProject(next); saveProject(next); }
    };
    const handleReorderFrame = (targetIdx) => { /* ... */ };
    const handleDeleteFrame = (fIdx) => { /* ... */ };
    const handleDeleteActor = (e, id) => { /* ... */ };
    const handleDeleteBackdrop = (e, idx) => { /* ... */ };
    const handleUpdateActionSpeed = (delta) => { /* ... */ };

    const handleSaveSound = (url, name) => {
        if (!selectedAction) return;
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        const act = actor.actions[selectedActionIdx];
        act.soundUrl = url;
        act.soundName = name;
        setProject(next);
        saveProject(next);
        alert(`Son "${name}" ajouté à l'action !`);
    };

    return (
        <div className="studio-wrapper" onMouseMove={handleStageMouseMove} onMouseUp={() => setIsDraggingOnStage(false)}>
            {showSaveLoadModal && (<SaveLoadModal mode={modalMode} user={user} currentProject={project} onClose={() => setShowSaveLoadModal(false)} onLoad={handleLoadProject} onNew={handleCreateNew} onSave={(p) => { saveProject(p).then(() => setShowSaveLoadModal(false)); }} />)}
            {frameToErase && (<ManualEraser imageUrl={frameToErase.url} initialSize={eraserSize} resolveUrl={resolveUrl} onCancel={() => setFrameToErase(null)} onSave={(newUrl) => { const next = JSON.parse(JSON.stringify(project)); const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); actor.actions[selectedActionIdx].frames[frameToErase.idx].url = newUrl; setProject(next); saveProject(next); setFrameToErase(null); }} />)}
            {showSoundModal && <SoundModal onSave={handleSaveSound} onClose={() => setShowSoundModal(false)} />}
            
            {(loading || cleaning) && (<div className="studio-loading-overlay"><div className="sablier-icon">⏳</div><div className="loading-text">{statusText}</div></div>)}
            
            <div style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
                <input type="file" ref={frameUploadRef} multiple onChange={async (e) => { /* ... */ }} />
                <input type="file" ref={actorUploadRef} onChange={async (e) => { /* ... */ }} />
                <input type="file" ref={backdropUploadRef} onChange={async (e) => { /* ... */ }} />
            </div>

            {showTestQuizModal && (<div className="quiz-data-overlay" onClick={() => setShowTestQuizModal(false)}><div className="quiz-data-window" onClick={e => e.stopPropagation()}><div className="quiz-data-header"><span className="font-black text-slate-700 uppercase">Quiz Test</span><button onClick={() => setShowTestQuizModal(false)}>✕</button></div><div className="quiz-data-body custom-scrollbar"><pre>{JSON.stringify(testQuizData, null, 2)}</pre></div></div></div>)}
            
            {isPlaying && (<GameEngine code={code} project={project} activeSceneIdx={selectedSceneIdx} onStop={() => setIsPlaying(false)} resolveUrl={resolveUrl} />)}

            <div className="studio-grid-body">
                <div className="studio-col-left">
                    <div className="studio-tab-header"><button className={`studio-tab-btn ${leftTab === 'actions' ? 'active' : ''}`} onClick={() => setLeftTab('actions')}>⚡ Actions</button><button className={`studio-tab-btn ${leftTab === 'sounds' ? 'active' : ''}`} onClick={() => setLeftTab('sounds')}>🎵 Sons</button></div>
                    <div className="studio-action-list custom-scrollbar">
                        {leftTab === 'actions' ? (<>
                            {selectedActor?.actions?.map((act, idx) => (
                                <div key={idx} onClick={() => { setSelectedActionIdx(idx); setIsPreviewPlaying(false); setSelectedFrameIdx(null); }} className={`action-item ${selectedActionIdx === idx ? 'selected' : ''}`}>
                                    {act.name} {act.soundUrl && '🎵'}
                                </div>
                            ))}
                            <button className="v84-add-btn-minimal" onClick={() => { /* ... */ }}>+ Ajouter</button>
                        </>) : <div className="p-10 opacity-30 text-center uppercase text-[10px] font-black">Bientôt</div>}
                    </div>
                    {leftTab === 'actions' && selectedAction && (
                        <div className="studio-sequencer-box">
                            <div className="seq-header">
                                <span className="seq-label">Timeline ({selectedAction.frames.length}f)</span>
                                <div className="seq-controls">
                                    <button className="btn-mirror" onClick={handleMirrorSequence} title="Miroir">↔️</button>
                                    <button className="btn-sound-trigger" onClick={() => setShowSoundModal(true)} title="Ajouter un son">{selectedAction.soundUrl ? '🔊' : '🎵'}</button>
                                    <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(-50)}>-</button>
                                    <span className="speed-indicator">{selectedAction.speed || 100}ms</span>
                                    <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(50)}>+</button>
                                    <button className="btn-mini-ctrl" onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}>{isPreviewPlaying ? '⏹️' : '▶️'}</button>
                                </div>
                            </div>
                            <div className="seq-frames-grid custom-scrollbar">
                                {selectedAction.frames.map((frame, fIdx) => (
                                    <div key={fIdx} className={`seq-frame ${isPreviewPlaying && previewFrameIdx === fIdx ? 'active' : ''} ${selectedFrameIdx === fIdx ? 'active' : ''}`} draggable onClick={() => { setSelectedFrameIdx(selectedFrameIdx === fIdx ? null : fIdx); setIsPreviewPlaying(false); }} onDragStart={() => setDraggedFrameIdx(fIdx)} onDragOver={e => e.preventDefault()} onDrop={() => handleReorderFrame(fIdx)}>
                                        <img src={resolveUrl(frame.url)} /><button className="frame-del" onClick={e => { e.stopPropagation(); handleDeleteFrame(fIdx); }}>✕</button>
                                    </div>
                                ))}
                                <div className="seq-frame seq-frame-add" onClick={() => frameUploadRef.current.click()}>+</div>
                            </div>
                            <div className="eraser-bar">
                                <button className={`btn-eraser-main ${eraserActive ? 'active' : ''}`} onClick={() => setEraserActive(!eraserActive)}>🧽</button>
                                <div className="eraser-size-ctrl"><button className="btn-size" onClick={() => setEraserSize(Math.max(1, eraserSize - 2))}>-</button><span className="size-val">{eraserSize}</span><button className="btn-size" onClick={() => setEraserSize(Math.min(100, eraserSize + 2))}>+</button></div>
                                {eraserActive && selectedFrameIdx !== null && <button className="btn-launch-eraser" onClick={() => setFrameToErase({ url: selectedAction.frames[selectedFrameIdx].url, idx: selectedFrameIdx })}>GOMMER</button>}
                                <button className={`btn-magic-clean ${cleaning ? 'pulse' : ''}`} onClick={handleSmartAIClean} title={selectedFrameIdx !== null ? "Détourer cette image" : "Détourer toute l'action"}>✨ {selectedFrameIdx !== null ? 'CIBLÉ' : 'AUTO'}</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="studio-col-center custom-scrollbar">
                    <div ref={stageRef} className="stage-wrapper" style={{ backgroundImage: currentScene?.backdrops?.[currentScene.currentBackdropIdx || 0]?.url ? `url(${resolveUrl(currentScene.backdrops[currentScene.currentBackdropIdx].url)})` : 'none' }}>
                        {currentScene?.actors?.map((a) => { 
                            const isSelected = selectedActorId === a.id; 
                            let action = isSelected ? selectedAction : (a.actions?.find(act => act.name.toUpperCase() === "IDLE") || a.actions?.[0]); 
                            let frameIdx = isSelected ? (isPreviewPlaying ? previewFrameIdx : (selectedFrameIdx !== null ? selectedFrameIdx : 0)) : 0; 
                            return (
                                <div key={a.id} onMouseDown={e => handleStageMouseDown(e, a.id)} className={`actor-sprite ${isSelected ? 'selected' : ''}`} style={{ left: `${a.initialX}%`, top: `${a.initialY}%`, width: `${150 * (a.scale || 1)}px`, height: `${150 * (a.scale || 1)}px`, transform: `translate(-50%, -50%) rotate(${a.direction || 0}deg)`, zIndex: isSelected ? 100 : 10 }}>
                                    {action?.frames?.[frameIdx]?.url && <img src={resolveUrl(action.frames[frameIdx].url)} />}
                                </div>
                            ); 
                        })}
                    </div>
                    <div className="props-bar">
                        <div className="prop-item"><span className="prop-label">Nom</span><input className="prop-input" value={selectedActor?.name || ""} onChange={e => handleUpdateProp('name', e.target.value)} /></div>
                        <div className="prop-item"><span className="prop-label">Taille (%)</span><input type="number" className="prop-input" value={Math.round((selectedActor?.scale || 1) * 100)} onChange={e => handleUpdateProp('scale', parseFloat(e.target.value)/100)} /></div>
                        <button onClick={handleViewTestQuiz} className="btn-view-quiz">📋 QUIZ</button>
                        <button onClick={() => { saveProject(); setIsPlaying(true); }} className="ml-auto bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] shadow-lg">▶ TESTER</button>
                    </div>
                    <div className="code-editor-box"><textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" /></div>
                </div>

                <div className="studio-col-right">
                    <div className="right-project-header">
                        <div className="project-meta-row"><span className="mini-proj-icon">🎬</span><input className="mini-proj-input" value={project?.title || ""} onChange={e => setProject({...project, title: e.target.value})} placeholder="TITRE..." /></div>
                        <div className="project-actions-row"><button onClick={handleOpenSave} className="btn-mini-action btn-save-mini">💾 SAUVER</button><button onClick={handleOpenLoad} className="btn-mini-action btn-load-mini">📂 CHARGER</button></div>
                    </div>
                    <div className="lib-section" style={{flex: 2}}>
                        <div className="lib-header"><span>Personnages</span><button className="btn-lib-add" onClick={() => actorUploadRef.current.click()}>+ IMPORT</button></div>
                        <div className="lib-grid custom-scrollbar">
                            {currentScene?.actors?.map((actor) => (
                                <div key={actor.id} className={`lib-item ${selectedActorId === actor.id ? 'active' : ''}`} onClick={() => handleSelectActor(actor.id)}>
                                    <button className="item-del-btn" onClick={e => handleDeleteActor(e, actor.id)}>✕</button>
                                    <img src={actor.actions?.[0]?.frames?.[0]?.url ? resolveUrl(actor.actions[0].frames[0].url) : ""} className="lib-thumb" />
                                    <span className="lib-name">{actor.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="lib-section" style={{flex: 1}}>
                        <div className="lib-header"><span>Décors</span><button className="btn-lib-add" onClick={() => backdropUploadRef.current.click()}>+ IMPORT</button></div>
                        <div className="lib-grid custom-scrollbar">
                            {currentScene?.backdrops?.map((bd, bIdx) => (
                                <div key={bIdx} className={`lib-item ${currentScene.currentBackdropIdx === bIdx ? 'active' : ''}`} onClick={() => { const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].currentBackdropIdx = bIdx; setProject(next); saveProject(next); }}>
                                    <button className="item-del-btn" onClick={e => handleDeleteBackdrop(e, bIdx)}>✕</button>
                                    <img src={resolveUrl(bd.url)} className="lib-thumb" />
                                    <span className="lib-name">DÉCOR {bIdx+1}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
