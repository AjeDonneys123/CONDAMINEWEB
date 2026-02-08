// @signatures: StudioDashboard
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';
import SoundExpert from './studioComp/SoundExpert';

import ManualEraser from './studioComp/ManualEraser';
import GameEngine from './studioComp/GameEngine';
import SaveLoadModal from './studioComp/SaveLoadModal';
import SoundModal from './studioComp/SoundModal';
import SoundEditorModal from './studioComp/SoundEditorModal';

import StudioLeftPanel from './panels/StudioLeftPanel';
import StudioCenterPanel from './panels/StudioCenterPanel';
import StudioRightPanel from './panels/StudioRightPanel';

function resolveUrl(url) {
    if (!url) return "";
    if (url.startsWith('/api/proxy') || url.startsWith('blob:')) return url;
    const id = url.split('/').pop();
    return `/api/proxy/${id}`;
}

const defaultCode = `class MiniGame extends MiniGameBase {
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
    onLevelWin() { this.isStopped = true; this.playGlobal("VICTOIRE"); }
    onResult(correct) { 
        if(correct) { 
            this.heroState = "SHOOT"; this.heroTimer = 30; 
            this.projectiles.push({ x: 20, y: 65 });
            if(this.HEROS) this.HEROS.play("SHOOT"); 
        } 
    }
    update() {
        if(this.isStopped) return;
        if(this.heroState === "SHOOT") { this.heroTimer--; if(this.heroTimer <= 0) { this.heroState = "IDLE"; if(this.HEROS) this.HEROS.play("IDLE"); } }
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

const DEMO_PROJECT = { title: "Mon Premier Jeu", scenes: [{ name: "Scene 1", backdrops: [], currentBackdropIdx: 0, actors: [ { id: "actor-hero", name: "HEROS", initialX: 15, initialY: 70, scale: 1, direction: 0, rotationStyle: 'all', actions: [{ name: "IDLE", speed: 100, frames: [], sounds: [] }, { name: "SHOOT", speed: 100, frames: [], sounds: [] }] }, { id: "actor-zombie", name: "ZOMBIE", initialX: 90, initialY: 70, scale: 1, direction: 0, rotationStyle: 'left-right', actions: [{ name: "AVANCER", speed: 150, frames: [], sounds: [] }] } ], globalSounds: [ { name: "DÉPART", sounds: [] }, { name: "VICTOIRE", sounds: [] }, { name: "DÉFAITE", sounds: [] } ] }] };

export default function StudioDashboard({ user }) {
    const [project, setProject] = useState(DEMO_PROJECT);
    const [selectedActorId, setSelectedActorId] = useState("actor-hero");
    const [selectedActionIdx, setSelectedActionIdx] = useState(0);
    const [selectedGlobalSoundIdx, setSelectedGlobalSoundIdx] = useState(0);
    const [leftTab, setLeftTab] = useState('actions');
    const [code, setCode] = useState(defaultCode);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [testQuizData, setTestQuizData] = useState(null);
    const [showTestQuizModal, setShowTestQuizModal] = useState(false);
    const [eraserActive, setEraserActive] = useState(false);
    const [frameToErase, setFrameToErase] = useState(null);
    const [showSoundModal, setShowSoundModal] = useState(false);
    const [soundToEdit, setSoundToEdit] = useState(null);
    const [draggedFrameIdx, setDraggedFrameIdx] = useState(null);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
    const [selectedFrameIdx, setSelectedFrameIdx] = useState(null);
    const [isDraggingOnStage, setIsDraggingOnStage] = useState(false);
    const [showSaveLoadModal, setShowSaveLoadModal] = useState(false);
    const [modalMode, setModalMode] = useState('LOAD'); 

    const frameUploadRef = useRef(null);
    const actorUploadRef = useRef(null);
    const backdropUploadRef = useRef(null); 
    const stageRef = useRef(null);
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map()); 
    const activeSourcesRef = useRef([]);

    // --- VARIABLES DÉRIVÉES (FIX REFERENCE ERROR) ---
    const selectedSceneIdx = 0;
    const currentScene = project?.scenes?.[selectedSceneIdx];
    const selectedActor = currentScene?.actors?.find(a => a.id === selectedActorId) || currentScene?.actors?.[0];
    const selectedAction = leftTab === 'actions' ? selectedActor?.actions?.[selectedActionIdx] : currentScene?.globalSounds?.[selectedGlobalSoundIdx];

    useEffect(() => { loadProjects(); }, [user]);

    useEffect(() => {
        if (!selectedAction || !selectedAction.sounds) return;
        const initCtx = () => { if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); };
        const decodeSounds = async () => {
            initCtx();
            for (const snd of selectedAction.sounds) {
                if (snd.url && !audioBuffersRef.current.has(snd.url)) {
                    const buffer = await SoundExpert.decodeAudio(resolveUrl(snd.url), audioCtxRef.current);
                    if (buffer) audioBuffersRef.current.set(snd.url, buffer);
                }
            }
        };
        decodeSounds();
    }, [selectedAction]);

    const playAllActionSounds = () => {
        stopAllSounds();
        if (!audioCtxRef.current || !selectedAction || !selectedAction.sounds) return;
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        selectedAction.sounds.forEach(snd => {
            const buffer = audioBuffersRef.current.get(snd.url);
            if (buffer) {
                const source = ctx.createBufferSource();
                source.buffer = buffer; source.connect(ctx.destination); source.start(0);
                activeSourcesRef.current.push(source);
            }
        });
    };

    const stopAllSounds = () => {
        activeSourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
        activeSourcesRef.current = [];
    };

    useEffect(() => {
        let timer;
        if (isPreviewPlaying && selectedAction?.frames?.length > 0) {
            timer = setInterval(() => { setPreviewFrameIdx(prev => (prev + 1) % (selectedAction.frames.length || 1)); }, selectedAction.speed || 100);
        } else { setPreviewFrameIdx(0); }
        return () => clearInterval(timer);
    }, [isPreviewPlaying, selectedAction]);

    useEffect(() => {
        if (isPreviewPlaying) playAllActionSounds();
        else stopAllSounds();
    }, [isPreviewPlaying]);

    async function loadProjects() {
        const data = await api.get(`/studio/projects/${user.id || user._id}`);
        if (data?.length > 0) {
            const p = data[0];
            if (p.scenes?.[0] && !p.scenes[0].globalSounds) p.scenes[0].globalSounds = DEMO_PROJECT.scenes[0].globalSounds;
            setProject(p); if (p.generatedCode) setCode(p.generatedCode);
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

    const handleOpenSave = () => { setModalMode('SAVE'); setShowSaveLoadModal(true); };
    const handleOpenLoad = () => { setModalMode('LOAD'); setShowSaveLoadModal(true); };
    const handleCreateNew = () => { setProject(DEMO_PROJECT); setCode(defaultCode); setSelectedActorId("actor-hero"); setShowSaveLoadModal(false); };
    const handleLoadProject = (p) => { 
        if (p.scenes?.[0] && !p.scenes[0].globalSounds) p.scenes[0].globalSounds = DEMO_PROJECT.scenes[0].globalSounds;
        setProject(p); setCode(p.generatedCode || defaultCode); if (p.scenes?.[0]?.actors?.[0]) setSelectedActorId(p.scenes[0].actors[0].id); else setSelectedActorId(null); setShowSaveLoadModal(false); 
    };
    
    const handleViewTestQuiz = async () => { try { const data = await api.get('/games/test-data'); if (data) { setTestQuizData(data); setShowTestQuizModal(true); } } catch (e) { console.error(e); } };
    const handleUpdateActionSpeed = (delta) => { if (!selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); if (actor && actor.actions[selectedActionIdx]) actor.actions[selectedActionIdx].speed = Math.max(20, Math.min(2000, (actor.actions[selectedActionIdx].speed || 100) + delta)); } else { if (next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx]) next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].speed = Math.max(20, Math.min(2000, (next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].speed || 100) + delta)); } setProject(next); saveProject(next); };
    const handleSmartAIClean = async () => { if (!selectedAction || leftTab === 'sounds') return; const targetIndices = selectedFrameIdx !== null ? [selectedFrameIdx] : selectedAction.frames.map((_, i) => i); if (targetIndices.length === 0) return; if (!confirm(`✨ Nettoyage IA : Traiter ${targetIndices.length} image(s) ?`)) return; setCleaning(true); setStatusText(selectedFrameIdx !== null ? "Détourage CIBLÉ..." : "Détourage EN SÉRIE..."); const next = JSON.parse(JSON.stringify(project)); const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); const act = actor.actions[selectedActionIdx]; for (const idx of targetIndices) { try { const res = await api.post('/studio/remove-bg-specialized', { url: act.frames[idx].url }); if (res.url) act.frames[idx].url = res.url; } catch (e) {} } setProject(next); await saveProject(next); setCleaning(false); };
    const handleMirrorSequence = async () => { if (!selectedAction || leftTab === 'sounds') return; setCleaning(true); setStatusText("Création Miroir..."); const next = JSON.parse(JSON.stringify(project)); const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); const act = actor.actions[selectedActionIdx]; for (let i = 0; i < act.frames.length; i++) { if(act.frames[i].type === 'sound') continue; const img = new Image(); img.crossOrigin = "anonymous"; const url = await new Promise(res => { img.onload = () => { const c = document.createElement('canvas'); c.width=img.width; c.height=img.height; const x = c.getContext('2d'); x.translate(img.width, 0); x.scale(-1,1); x.drawImage(img,0,0); c.toBlob(async b => { const f = new FormData(); f.append('file', b, "flipped.png"); const r = await fetch('/api/studio/upload-asset', { method: 'POST', body: f }).then(z=>z.json()); res(r.url); }, 'image/png'); }; img.src = resolveUrl(act.frames[i].url); }); if(url) act.frames[i].url = url; } setProject(next); await saveProject(next); setCleaning(false); };
    const handleSelectActor = (actorId) => { setSelectedActorId(actorId); setSelectedFrameIdx(null); };
    const handleStageMouseDown = (e, actorId) => { e.preventDefault(); e.stopPropagation(); handleSelectActor(actorId); setIsDraggingOnStage(true); };
    const handleStageMouseMove = (e) => { if (!isDraggingOnStage || !selectedActorId || !stageRef.current) return; const rect = stageRef.current.getBoundingClientRect(); const next = { ...project }; const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); if (actor) { actor.initialX = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))); actor.initialY = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))); setProject(next); } };
    const handleUpdateProp = (f, v) => { const next = { ...project }; const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); if (actor) { actor[f] = isNaN(v) ? v : parseFloat(v); setProject(next); saveProject(next); } };
    const handleReorderFrame = (targetIdx) => { if (draggedFrameIdx === null || draggedFrameIdx === targetIdx || !selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); const frames = actor.actions[selectedActionIdx].frames; const [moved] = frames.splice(draggedFrameIdx, 1); frames.splice(targetIdx, 0, moved); } else { const frames = next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].frames; const [moved] = frames.splice(draggedFrameIdx, 1); frames.splice(targetIdx, 0, moved); } saveProject(next); setDraggedFrameIdx(null); };
    const handleDeleteFrame = (fIdx) => { if (!selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); actor.actions[selectedActionIdx].frames.splice(fIdx, 1); } else { next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].frames.splice(fIdx, 1); } stopAllSounds(); saveProject(next); };
    const handleDeleteSound = (sIdx) => { if (!selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); actor.actions[selectedActionIdx].sounds.splice(sIdx, 1); } else { next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].sounds.splice(sIdx, 1); } stopAllSounds(); saveProject(next); };
    
    const handleEditSound = (sIdx) => { const target = selectedAction.sounds[sIdx]; if (target) setSoundToEdit({ idx: sIdx, ...target }); };
    const handleSaveEditedSound = (newUrl, newName) => { if (!soundToEdit) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); actor.actions[selectedActionIdx].sounds[soundToEdit.idx] = { ...actor.actions[selectedActionIdx].sounds[soundToEdit.idx], url: newUrl, name: newName }; } else { next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].sounds[soundToEdit.idx] = { ...next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].sounds[soundToEdit.idx], url: newUrl, name: newName }; } setProject(next); saveProject(next); setSoundToEdit(null); };

    const handleDeleteActor = (e, id) => { e.stopPropagation(); if (!confirm("Supprimer ?")) return; const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].actors = next.scenes[selectedSceneIdx].actors.filter(a => a.id !== id); if (selectedActorId === id) setSelectedActorId(null); setProject(next); saveProject(next); };
    const handleDeleteBackdrop = (e, idx) => { e.stopPropagation(); if (!confirm("Supprimer ?")) return; const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].backdrops.splice(idx, 1); next.scenes[selectedSceneIdx].currentBackdropIdx = 0; setProject(next); saveProject(next); };
    const handleSaveSound = (url, name) => { if (!selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); const act = actor.actions[selectedActionIdx]; if (!act.sounds) act.sounds = []; act.sounds.push({ type: 'sound', url: url, name: name }); } else { const act = next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx]; if (!act.sounds) act.sounds = []; act.sounds.push({ type: 'sound', url: url, name: name }); } setProject(next); saveProject(next); };

    return (
        <div className="studio-wrapper" onMouseMove={handleStageMouseMove} onMouseUp={() => setIsDraggingOnStage(false)}>
            {showSaveLoadModal && (<SaveLoadModal mode={modalMode} user={user} currentProject={project} onClose={() => setShowSaveLoadModal(false)} onLoad={handleLoadProject} onNew={handleCreateNew} onSave={(p) => { saveProject(p).then(() => setShowSaveLoadModal(false)); }} />)}
            {frameToErase && (<ManualEraser imageUrl={frameToErase.url} resolveUrl={resolveUrl} onCancel={() => setFrameToErase(null)} onSave={(newUrl) => { const next = JSON.parse(JSON.stringify(project)); const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); actor.actions[selectedActionIdx].frames[frameToErase.idx].url = newUrl; setProject(next); saveProject(next); setFrameToErase(null); }} />)}
            {showSoundModal && <SoundModal onSave={handleSaveSound} onClose={() => setShowSoundModal(false)} />}
            {showTestQuizModal && (<div className="quiz-data-overlay" onClick={() => setShowTestQuizModal(false)}><div className="quiz-data-window" onClick={e => e.stopPropagation()}><div className="quiz-data-header"><span className="font-black text-slate-700 uppercase">Quiz Test</span><button onClick={() => setShowTestQuizModal(false)}>✕</button></div><div className="quiz-data-body custom-scrollbar"><pre>{JSON.stringify(testQuizData, null, 2)}</pre></div></div></div>)}
            {soundToEdit && (<SoundEditorModal soundUrl={soundToEdit.url} soundName={soundToEdit.name} onSave={handleSaveEditedSound} onClose={() => setSoundToEdit(null)} resolveUrl={resolveUrl} />)}

            {(loading || cleaning) && (<div className="studio-loading-overlay"><div className="sablier-icon">⏳</div><div className="loading-text">{statusText}</div></div>)}
            {isPlaying && (<GameEngine code={code} project={project} activeSceneIdx={selectedSceneIdx} onStop={() => setIsPlaying(false)} resolveUrl={resolveUrl} />)}

            <div style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
                <input type="file" ref={frameUploadRef} multiple onChange={async (e) => { const files = Array.from(e.target.files); if (files.length === 0) return; setLoading(true); setStatusText("Upload frames..."); const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); const act = actor.actions[selectedActionIdx]; for (const file of files) { const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); if (res.url) act.frames.push({ url: res.url, name: file.name, type: 'image' }); } } else { const act = next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx]; for (const file of files) { const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); if (res.url) act.frames.push({ url: res.url, name: file.name, type: 'image' }); } } await saveProject(next); setLoading(false); }} />
                <input type="file" ref={actorUploadRef} onChange={async (e) => { const file = e.target.files[0]; if(!file) return; setLoading(true); setStatusText("Nouveau personnage..."); const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); const next = JSON.parse(JSON.stringify(project)); const newActor = { id: `actor-${Date.now()}`, name: "P" + (next.scenes[selectedSceneIdx].actors.length + 1), actions: [{ name: "IDLE", speed: 100, frames: [{url: res.url, name: "C1", type:'image'}], sounds: [] }], initialX: 50, initialY: 50, scale: 1, direction: 0, rotationStyle: 'all' }; next.scenes[selectedSceneIdx].actors.push(newActor); setSelectedActorId(newActor.id); await saveProject(next); setLoading(false); }} />
                <input type="file" ref={backdropUploadRef} onChange={async (e) => { const file = e.target.files[0]; if(!file) return; setLoading(true); setStatusText("Upload décor..."); const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].backdrops.push({ url: res.url, name: file.name }); next.scenes[selectedSceneIdx].currentBackdropIdx = next.scenes[selectedSceneIdx].backdrops.length - 1; await saveProject(next); setLoading(false); }} />
            </div>

            <div className="studio-grid-body">
                <StudioLeftPanel 
                    leftTab={leftTab} setLeftTab={setLeftTab} 
                    selectedActor={selectedActor} selectedActionIdx={selectedActionIdx} setSelectedActionIdx={setSelectedActionIdx}
                    selectedGlobalSoundIdx={selectedGlobalSoundIdx} setSelectedGlobalSoundIdx={setSelectedGlobalSoundIdx}
                    setIsPreviewPlaying={setIsPreviewPlaying} saveProject={saveProject} project={project}
                    selectedSceneIdx={selectedSceneIdx} selectedActorId={selectedActorId} selectedAction={selectedAction}
                    handleMirrorSequence={handleMirrorSequence} handleUpdateActionSpeed={handleUpdateActionSpeed}
                    isPreviewPlaying={isPreviewPlaying} previewFrameIdx={previewFrameIdx}
                    selectedFrameIdx={selectedFrameIdx} setSelectedFrameIdx={setSelectedFrameIdx}
                    setDraggedFrameIdx={setDraggedFrameIdx} handleReorderFrame={handleReorderFrame}
                    resolveUrl={resolveUrl} handleDeleteFrame={handleDeleteFrame}
                    frameUploadRef={frameUploadRef}
                    eraserActive={eraserActive} setEraserActive={setEraserActive} setFrameToErase={setFrameToErase}
                    handleSmartAIClean={handleSmartAIClean} cleaning={cleaning}
                    setShowSoundModal={setShowSoundModal}
                    handleDeleteSound={handleDeleteSound} 
                    handleEditSound={handleEditSound}
                />
                <StudioCenterPanel 
                    stageRef={stageRef} currentScene={currentScene} resolveUrl={resolveUrl}
                    selectedActorId={selectedActorId} selectedAction={selectedAction}
                    isPreviewPlaying={isPreviewPlaying} previewFrameIdx={previewFrameIdx}
                    selectedFrameIdx={selectedFrameIdx} handleStageMouseDown={handleStageMouseDown}
                    selectedActor={selectedActor} handleUpdateProp={handleUpdateProp}
                    handleViewTestQuiz={handleViewTestQuiz} saveProject={saveProject}
                    setIsPlaying={setIsPlaying} code={code} setCode={setCode}
                />
                <StudioRightPanel 
                    project={project} setProject={setProject}
                    handleOpenSave={handleOpenSave} handleOpenLoad={handleOpenLoad}
                    actorUploadRef={actorUploadRef} currentScene={currentScene}
                    selectedActorId={selectedActorId} handleSelectActor={handleSelectActor}
                    handleDeleteActor={handleDeleteActor} resolveUrl={resolveUrl}
                    backdropUploadRef={backdropUploadRef} handleDeleteBackdrop={handleDeleteBackdrop}
                    saveProject={saveProject} selectedSceneIdx={selectedSceneIdx}
                />
            </div>
        </div>
    );
}
