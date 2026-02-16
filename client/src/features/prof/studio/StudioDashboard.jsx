// @signatures: StudioDashboard, handleSmartAIClean
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';
import SoundExpert from '../../../services/SoundExpert';

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

const ZOMBIE_GAME_CODE = `class MiniGame extends MiniGameBase {
    constructor(canvas, assets, callbacks) {
        super(canvas, assets, callbacks);
        this.resetInternalState();
    }
    resetInternalState() {
        this.projectiles = []; this.zombieX = 100; this.zombieState = "WALKING"; 
        this.heroState = "IDLE"; this.heroTimer = 0; this.hasDealtDamage = false;
        this.isStopped = false; this.baseSpeed = 0.15;
    }
    start() { 
        this.resetInternalState();
        if(this.HEROS) { this.HEROS.x = 15; this.HEROS.y = 70; this.HEROS.play("IDLE", true); } 
        this.resetZombie();
    }
    resetZombie() {
        this.zombieX = 100; this.zombieState = "WALKING"; this.hasDealtDamage = false;
        if(this.ZOMBIE) { this.ZOMBIE.x = 100; this.ZOMBIE.play("AVANCER", true); }
    }
    onResult(isCorrect) {
        if (isCorrect && this.HEROS) {
            this.HEROS.play("TIRER", false); this.heroState = "SHOOT"; this.heroTimer = 40;
            this.projectiles.push({ x: this.HEROS.x + 5, y: this.HEROS.y - 5 });
        } else if (!isCorrect) { this.zombieX -= 12; this.game.shake(); }
    }
    update() {
        if (this.isStopped) return;
        if (this.isBossPhase && this.ZOMBIE) { this.ZOMBIE.scale = this.ZOMBIE.baseScale * 1.6; } 
        else if (this.ZOMBIE) { this.ZOMBIE.scale = this.ZOMBIE.baseScale; }
        if (this.heroState === "SHOOT" || this.heroState === "HIT") {
            this.heroTimer--; if (this.heroTimer <= 0) { this.heroState = "IDLE"; if(this.HEROS) this.HEROS.play("IDLE", true); }
        }
        if (this.zombieState === "WALKING") {
            let speed = this.isBossPhase ? this.baseSpeed * 0.5 : this.baseSpeed;
            this.zombieX -= speed;
            if (this.zombieX < 20) {
                this.zombieState = "ATTACKING"; this.hasDealtDamage = false;
                if (this.ZOMBIE) { this.ZOMBIE.x = 20; this.ZOMBIE.play("TAPER", false); }
            } else if(this.ZOMBIE) this.ZOMBIE.x = this.zombieX;
        } 
        else if (this.zombieState === "ATTACKING") {
            if (this.ZOMBIE && this.ZOMBIE.frameIdx >= 1 && !this.hasDealtDamage) {
                this.hasDealtDamage = true;
                if (this.HEROS) { this.HEROS.play("TOUCHE", false); this.heroState = "HIT"; this.heroTimer = 60; }
                this.game.damage(1);
            }
            if (this.ZOMBIE && this.ZOMBIE.isAnimFinished) this.resetZombie();
        } 
        else if (this.zombieState === "HIT") {
            this.zombieX += 0.5; if(this.ZOMBIE) { this.ZOMBIE.x = this.zombieX; if (this.ZOMBIE.isAnimFinished) this.resetZombie(); }
        }
        for (let i = this.projectiles.length - 1; i >= 0; i--) { 
            let p = this.projectiles[i]; p.x += 3;
            if (this.zombieState === "WALKING" && p.x > this.zombieX - 5 && p.x < this.zombieX + 5) {
                this.projectiles.splice(i, 1); this.zombieState = "HIT";
                if (this.ZOMBIE) this.ZOMBIE.play("TOUCHE", false); 
            } 
            else if (p.x > 110) { this.projectiles.splice(i, 1); }
        }
    }
    draw() {
        if (this.isStopped) return;
        const ctx = this.ctx;
        this.projectiles.forEach(p => { 
            if (this.isBossPhase) {
                ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = "#f59e0b"; ctx.font = "50px Arial";
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("🔥", (p.x/100)*this.canvas.width, (p.y/100)*this.canvas.height);
                ctx.restore();
            } else {
                ctx.fillStyle = "#f97316"; ctx.beginPath(); 
                ctx.arc((p.x/100)*this.canvas.width, (p.y/100)*this.canvas.height, 10, 0, Math.PI*2); 
                ctx.fill(); 
            }
        });
    }
}
`;

const DEMO_PROJECT = { 
    title: "Nouveau Projet", 
    scenes: [{ 
        name: "Scene 1", backdrops: [], currentBackdropIdx: 0, 
        actors: [], 
        globalSounds: [] 
    }] 
};

export default function StudioDashboard({ user }) {
    const [project, setProject] = useState(DEMO_PROJECT);
    const [selectedActorId, setSelectedActorId] = useState(null);
    const [selectedActionIdx, setSelectedActionIdx] = useState(0);
    const [selectedGlobalSoundIdx, setSelectedGlobalSoundIdx] = useState(0);
    const [leftTab, setLeftTab] = useState('actions');
    const [code, setCode] = useState(ZOMBIE_GAME_CODE);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [statusText, setStatusText] = useState("");
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

    const selectedSceneIdx = 0;
    const currentScene = project?.scenes?.[selectedSceneIdx];
    const selectedActor = currentScene?.actors?.find(a => a.id === selectedActorId);
    const selectedAction = leftTab === 'actions' ? selectedActor?.actions?.[selectedActionIdx] : currentScene?.globalSounds?.[selectedGlobalSoundIdx];

    useEffect(() => { loadProjects(); }, [user]);

    async function loadProjects() {
        const data = await api.get(`/studio/projects/${user.id || user._id}`);
        if (data?.length > 0) {
            handleLoadProject(data[0]);
        }
    }

    async function saveProject(p = project) {
        if (!p) return;
        setLoading(true); setStatusText("Sync...");
        try {
            // FIX CRITIQUE : On force l'utilisation du state 'code' actuel
            // On s'assure que 'generatedCode' n'est pas écrasé par une vieille version présente dans 'p'
            const payload = {
                ...p,
                teacherId: user.id || user._id,
                generatedCode: code 
            };
            const saved = await api.post('/studio', payload);
            setProject(saved);
        } catch(e) { console.error(e); } 
        setLoading(false);
    }

    // ✅ FONCTION DE DÉTOURAGE
    const handleSmartAIClean = async () => {
        if (selectedFrameIdx === null || !selectedAction) return;
        const frame = selectedAction.frames[selectedFrameIdx];
        if (!frame) return;

        setCleaning(true); setStatusText("Détourage IA...");
        try {
            const res = await fetch('/api/studio/remove-bg-specialized', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: frame.url })
            });
            const data = await res.json();
            if (data.url) {
                const next = JSON.parse(JSON.stringify(project));
                const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
                actor.actions[selectedActionIdx].frames[selectedFrameIdx].url = data.url;
                setProject(next);
                await saveProject(next);
            }
        } catch(e) { alert("Erreur IA"); }
        setCleaning(false);
    };

    const handleSetPreviewFrameIdx = (valOrFn) => { if (typeof valOrFn === 'function') setPreviewFrameIdx(prev => valOrFn(prev)); else setPreviewFrameIdx(valOrFn); };
    const handleOpenSave = () => { setModalMode('SAVE'); setShowSaveLoadModal(true); };
    const handleOpenLoad = () => { setModalMode('LOAD'); setShowSaveLoadModal(true); };
    
    const handleCreateNew = () => { 
        setProject(DEMO_PROJECT); 
        setCode(ZOMBIE_GAME_CODE); 
        setSelectedActorId(null); 
        setShowSaveLoadModal(false); 
    };
    
    const handleLoadProject = (p) => { 
        setProject(p); 
        // FIX : Priorité au code du projet chargé, sinon défaut
        setCode(p.generatedCode || ZOMBIE_GAME_CODE); 
        if (p.scenes?.[0]?.actors?.[0]) setSelectedActorId(p.scenes[0].actors[0].id); 
        setShowSaveLoadModal(false); 
    };

    const handleUpdateActionSpeed = (delta) => { if (!selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); if (actor && actor.actions[selectedActionIdx]) actor.actions[selectedActionIdx].speed = Math.max(20, Math.min(2000, (actor.actions[selectedActionIdx].speed || 100) + delta)); } else { if (next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx]) next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].speed = Math.max(20, Math.min(2000, (next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].speed || 100) + delta)); } setProject(next); saveProject(next); };
    const handleSelectActor = (actorId) => { setSelectedActorId(actorId); setSelectedFrameIdx(null); };
    const handleStageMouseDown = (e, actorId) => { e.preventDefault(); e.stopPropagation(); handleSelectActor(actorId); setIsDraggingOnStage(true); };
    const handleStageMouseMove = (e) => { if (!isDraggingOnStage || !selectedActorId || !stageRef.current) return; const rect = stageRef.current.getBoundingClientRect(); const next = { ...project }; const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); if (actor) { actor.initialX = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))); actor.initialY = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))); setProject(next); } };
    const handleUpdateProp = (f, v) => { const next = { ...project }; const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); if (actor) { actor[f] = v; setProject(next); saveProject(next); } };
    const handleReorderFrame = (targetIdx) => { if (draggedFrameIdx === null || draggedFrameIdx === targetIdx || !selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); const frames = actor.actions[selectedActionIdx].frames; const [moved] = frames.splice(draggedFrameIdx, 1); frames.splice(targetIdx, 0, moved); } else { const frames = next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].frames; const [moved] = frames.splice(draggedFrameIdx, 1); frames.splice(targetIdx, 0, moved); } saveProject(next); setDraggedFrameIdx(null); };
    const handleDeleteFrame = (fIdx) => { if (!selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); actor.actions[selectedActionIdx].frames.splice(fIdx, 1); } else { next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].frames.splice(fIdx, 1); } saveProject(next); };
    const handleDeleteSound = (sIdx) => { if (!selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); actor.actions[selectedActionIdx].sounds.splice(sIdx, 1); } else { next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].sounds.splice(sIdx, 1); } saveProject(next); };
    const handleEditSound = (sIdx) => { const target = selectedAction.sounds[sIdx]; if (target) setSoundToEdit({ idx: sIdx, ...target }); };
    const handleSaveEditedSound = (newUrl, newName) => { if (!soundToEdit) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); actor.actions[selectedActionIdx].sounds[soundToEdit.idx] = { ...actor.actions[selectedActionIdx].sounds[soundToEdit.idx], url: newUrl, name: newName }; } else { next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].sounds[soundToEdit.idx] = { ...next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].sounds[soundToEdit.idx], url: newUrl, name: newName }; } setProject(next); saveProject(next); setSoundToEdit(null); };
    const handleDeleteActor = (e, id) => { e.stopPropagation(); if (!confirm("Supprimer ?")) return; const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].actors = next.scenes[selectedSceneIdx].actors.filter(a => a.id !== id); if (selectedActorId === id) setSelectedActorId(null); setProject(next); saveProject(next); };
    const handleDeleteBackdrop = (e, idx) => { e.stopPropagation(); if (!confirm("Supprimer ?")) return; const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].backdrops.splice(idx, 1); next.scenes[selectedSceneIdx].currentBackdropIdx = 0; setProject(next); saveProject(next); };
    const handleSaveSound = (url, name) => { if (!selectedAction) return; const next = JSON.parse(JSON.stringify(project)); if (leftTab === 'actions') { const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); if (!actor.actions[selectedActionIdx].sounds) actor.actions[selectedActionIdx].sounds = []; actor.actions[selectedActionIdx].sounds.push({ type: 'sound', url, name }); } else { if (!next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].sounds) next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].sounds = []; next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx].sounds.push({ type: 'sound', url, name }); } setProject(next); saveProject(next); };

    return (
        <div className="studio-wrapper" onMouseMove={handleStageMouseMove} onMouseUp={() => setIsDraggingOnStage(false)}>
            {showSaveLoadModal && (<SaveLoadModal mode={modalMode} user={user} currentProject={project} onClose={() => setShowSaveLoadModal(false)} onLoad={handleLoadProject} onNew={handleCreateNew} onSave={(p) => { saveProject(p).then(() => setShowSaveLoadModal(false)); }} />)}
            {frameToErase && (<ManualEraser imageUrl={frameToErase.url} resolveUrl={resolveUrl} onCancel={() => setFrameToErase(null)} onSave={(newUrl) => { const next = JSON.parse(JSON.stringify(project)); const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId); actor.actions[selectedActionIdx].frames[frameToErase.idx].url = newUrl; setProject(next); saveProject(next); setFrameToErase(null); }} />)}
            {showSoundModal && <SoundModal onSave={handleSaveSound} onClose={() => setShowSoundModal(false)} />}
            {soundToEdit && (<SoundEditorModal soundUrl={soundToEdit.url} soundName={soundToEdit.name} onSave={handleSaveEditedSound} onClose={() => setSoundToEdit(null)} resolveUrl={resolveUrl} />)}
            {(loading || cleaning) && (<div className="studio-loading-overlay"><div className="sablier-icon">⏳</div><div className="loading-text">{statusText}</div></div>)}
            {isPlaying && (<GameEngine code={code} project={project} activeSceneIdx={selectedSceneIdx} onStop={() => setIsPlaying(false)} resolveUrl={resolveUrl} />)}
            <div style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
                <input type="file" ref={frameUploadRef} multiple onChange={async (e) => { const files = Array.from(e.target.files); if (files.length === 0) return; setLoading(true); setStatusText("Upload..."); const next = JSON.parse(JSON.stringify(project)); const target = leftTab === 'actions' ? next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId).actions[selectedActionIdx] : next.scenes[selectedSceneIdx].globalSounds[selectedGlobalSoundIdx]; for (const file of files) { const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); if (res.url) target.frames.push({ url: res.url, name: file.name, type: 'image' }); } await saveProject(next); setLoading(false); }} />
                <input type="file" ref={actorUploadRef} onChange={async (e) => { const file = e.target.files[0]; if(!file) return; setLoading(true); setStatusText("Nouveau..."); const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); const next = JSON.parse(JSON.stringify(project)); const newActor = { id: `actor-${Date.now()}`, name: "P" + (next.scenes[selectedSceneIdx].actors.length + 1), actions: [{ name: "IDLE", speed: 100, frames: [{url: res.url, name: "C1", type:'image'}], sounds: [] }], initialX: 50, initialY: 50, scale: 1, direction: 0, rotationStyle: 'all' }; next.scenes[selectedSceneIdx].actors.push(newActor); setSelectedActorId(newActor.id); await saveProject(next); setLoading(false); }} />
                <input type="file" ref={backdropUploadRef} onChange={async (e) => { const file = e.target.files[0]; if(!file) return; setLoading(true); setStatusText("Décor..."); const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd }).then(r => r.json()); const next = JSON.parse(JSON.stringify(project)); next.scenes[selectedSceneIdx].backdrops.push({ url: res.url, name: file.name }); next.scenes[selectedSceneIdx].currentBackdropIdx = next.scenes[selectedSceneIdx].backdrops.length - 1; await saveProject(next); setLoading(false); }} />
            </div>
            <div className="studio-grid-body">
                <StudioLeftPanel 
                    leftTab={leftTab} setLeftTab={setLeftTab} selectedActor={selectedActor} selectedActionIdx={selectedActionIdx} setSelectedActionIdx={setSelectedActionIdx} selectedGlobalSoundIdx={selectedGlobalSoundIdx} setSelectedGlobalSoundIdx={setSelectedGlobalSoundIdx} setIsPreviewPlaying={setIsPreviewPlaying} saveProject={saveProject} project={project} selectedSceneIdx={selectedSceneIdx} selectedActorId={selectedActorId} selectedAction={selectedAction} handleUpdateActionSpeed={handleUpdateActionSpeed} isPreviewPlaying={isPreviewPlaying} previewFrameIdx={previewFrameIdx} selectedFrameIdx={selectedFrameIdx} setSelectedFrameIdx={setSelectedFrameIdx} setDraggedFrameIdx={setDraggedFrameIdx} handleReorderFrame={handleReorderFrame} resolveUrl={resolveUrl} handleDeleteFrame={handleDeleteFrame} frameUploadRef={frameUploadRef} setFrameToErase={setFrameToErase} setShowSoundModal={setShowSoundModal} handleDeleteSound={handleDeleteSound} handleEditSound={handleEditSound} setPreviewFrameIdx={handleSetPreviewFrameIdx} handleSmartAIClean={handleSmartAIClean} cleaning={cleaning}
                />
                <StudioCenterPanel 
                    stageRef={stageRef} currentScene={currentScene} resolveUrl={resolveUrl} selectedActorId={selectedActorId} selectedAction={selectedAction} isPreviewPlaying={isPreviewPlaying} previewFrameIdx={previewFrameIdx} selectedFrameIdx={selectedFrameIdx} handleStageMouseDown={handleStageMouseDown} selectedActor={selectedActor} handleUpdateProp={handleUpdateProp} saveProject={saveProject} setIsPlaying={setIsPlaying} code={code} setCode={setCode}
                />
                <StudioRightPanel 
                    project={project} setProject={setProject} handleOpenSave={handleOpenSave} handleOpenLoad={handleOpenLoad} actorUploadRef={actorUploadRef} currentScene={currentScene} selectedActorId={selectedActorId} handleSelectActor={handleSelectActor} handleDeleteActor={handleDeleteActor} resolveUrl={resolveUrl} backdropUploadRef={backdropUploadRef} handleDeleteBackdrop={handleDeleteBackdrop} saveProject={saveProject} selectedSceneIdx={selectedSceneIdx}
                />
            </div>
        </div>
    );
}
