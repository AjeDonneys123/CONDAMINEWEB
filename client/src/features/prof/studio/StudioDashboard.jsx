// @signatures: StudioDashboard, handleSmartAIClean, localAutoClean
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';
import SoundExpert from '../../../services/SoundExpert';
import { resolveDriveAssetUrl } from '../../../utils/driveUrl';

import ManualEraser from './studioComp/ManualEraser';
import GameEngine from './studioComp/GameEngine';
import SaveLoadModal from './studioComp/SaveLoadModal';
import SoundModal from './studioComp/SoundModal';
import SoundEditorModal from './studioComp/SoundEditorModal';

import StudioLeftPanel from './panels/StudioLeftPanel';
import StudioCenterPanel from './panels/StudioCenterPanel';
import StudioRightPanel from './panels/StudioRightPanel';

const resolveUrl = (url) => resolveDriveAssetUrl(url);

const DEMO_PROJECT = { title: "Nouveau Projet", scenes: [{ name: "Scene 1", backdrops: [], currentBackdropIdx: 0, actors: [], globalSounds: [] }] };
const LOCAL_STUDIO_PREFIX = 'studio-local-session-v1';

export default function StudioDashboard({ user }) {
    const [project, setProject] = useState({ ...DEMO_PROJECT, localSessionId: `local-${Date.now()}` });
    const [selectedActorId, setSelectedActorId] = useState(null);
    const [selectedActionIdx, setSelectedActionIdx] = useState(0);
    const [selectedGlobalSoundIdx, setSelectedGlobalSoundIdx] = useState(0);
    const [leftTab, setLeftTab] = useState('actions');
    const [code, setCode] = useState("");
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
    const [localStudioMode, setLocalStudioMode] = useState(true);

    const frameUploadRef = useRef(null);
    const actorUploadRef = useRef(null);
    const backdropUploadRef = useRef(null); 
    const stageRef = useRef(null);

    const selectedSceneIdx = 0;
    const currentScene = project?.scenes?.[selectedSceneIdx];
    const selectedActor = currentScene?.actors?.find(a => a.id === selectedActorId);
    const selectedAction = leftTab === 'actions' ? selectedActor?.actions?.[selectedActionIdx] : currentScene?.globalSounds?.[selectedGlobalSoundIdx];

    const userId = user?.id || user?._id || 'unknown-user';
    const localModeStorageKey = `studio-local-mode:${userId}`;

    const withLocalSessionId = (projectLike) => {
        if (!projectLike) return projectLike;
        if (projectLike._id || projectLike.localSessionId) return projectLike;
        return { ...projectLike, localSessionId: `local-${Date.now()}` };
    };

    const getLocalProjectKey = (projectLike) => {
        const withId = withLocalSessionId(projectLike);
        const projectKey = withId?._id || withId?.localSessionId || 'draft';
        return `${LOCAL_STUDIO_PREFIX}:${userId}:${projectKey}`;
    };

    const persistLocalSession = (nextProject, nextCode) => {
        try {
            if (!nextProject) return;
            localStorage.setItem(
                getLocalProjectKey(nextProject),
                JSON.stringify({
                    project: withLocalSessionId(nextProject),
                    code: String(nextCode ?? ''),
                    updatedAt: Date.now()
                })
            );
        } catch (e) {}
    };

    const hydrateWithLocalSession = (baseProject) => {
        const safeBase = withLocalSessionId(baseProject);
        try {
            const raw = localStorage.getItem(getLocalProjectKey(safeBase));
            if (!raw) return { project: safeBase, code: safeBase?.generatedCode || '' };
            const parsed = JSON.parse(raw);
            if (!parsed?.project) return { project: safeBase, code: safeBase?.generatedCode || '' };
            const localProject = { ...safeBase, ...parsed.project };
            return { project: localProject, code: String(parsed.code ?? localProject.generatedCode ?? '') };
        } catch (e) {
            return { project: safeBase, code: safeBase?.generatedCode || '' };
        }
    };

    useEffect(() => {
        try {
            const savedMode = localStorage.getItem(localModeStorageKey);
            if (savedMode === 'false') setLocalStudioMode(false);
        } catch (e) {}
    }, [localModeStorageKey]);

    useEffect(() => {
        try {
            localStorage.setItem(localModeStorageKey, String(localStudioMode));
        } catch (e) {}
    }, [localModeStorageKey, localStudioMode]);

    useEffect(() => { loadProjects(); }, [user]);

    useEffect(() => {
        persistLocalSession(project, code);
    }, [project, code, userId]);

    async function loadProjects() {
        if(user && (user.id || user._id)) {
            try {
                const data = await api.get(`/studio/projects/${user.id || user._id}`);
                const firstActive = (data || []).find(p => !p.isTrashed) || (data || [])[0];
                if (firstActive) {
                    handleLoadProject(firstActive);
                    return;
                }
                const fallback = withLocalSessionId({ ...DEMO_PROJECT });
                setProject(fallback);
                setCode("");
            } catch(e){}
        }
    }

    async function saveProject(p = project, options = {}) {
        if (!p) return;
        const nextProject = withLocalSessionId(JSON.parse(JSON.stringify(p)));
        setProject(nextProject);
        persistLocalSession(nextProject, code);
        const shouldSyncRemote = options.remote === true || !localStudioMode;
        if (!shouldSyncRemote) return nextProject;
        setLoading(true); setStatusText(`Sync... ${nextProject?.isProduction ? '🟠 PRODUCTION' : '🟢 PRÊT'}`);
        try {
            const payload = { ...nextProject, teacherId: user.id || user._id, generatedCode: code };
            const saved = await api.post('/studio', payload);
            setProject(saved);
            persistLocalSession(saved, code);
            return saved;
        } catch(e) { console.error(e); } 
        finally {
            setLoading(false);
        }
    }

    // --- ALGORITHME DE DÉTOURAGE LOCAL (Plan B - Flood Fill) ---
    const localAutoClean = (imageUrl) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = resolveUrl(imageUrl);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                const width = canvas.width;
                const height = canvas.height;

                // 1. Détection couleur Haut-Droit (Pixel de référence)
                const startX = width - 1;
                const startY = 0;
                const startPos = (startY * width + startX) * 4;
                
                const targetR = data[startPos];
                const targetG = data[startPos + 1];
                const targetB = data[startPos + 2];
                const targetA = data[startPos + 3];

                // Si déjà transparent, on arrête
                if (targetA === 0) {
                    resolve(null); 
                    return;
                }

                // 2. Flood Fill (Algorithme de remplissage)
                const tolerance = 40; 
                const stack = [[startX, startY]];
                const visited = new Uint8Array(width * height);

                const matchColor = (pos) => {
                    const r = data[pos];
                    const g = data[pos+1];
                    const b = data[pos+2];
                    return Math.abs(r - targetR) < tolerance &&
                           Math.abs(g - targetG) < tolerance &&
                           Math.abs(b - targetB) < tolerance;
                };

                while (stack.length > 0) {
                    const [x, y] = stack.pop();
                    const pos = (y * width + x) * 4;
                    const visitIdx = y * width + x;

                    if (visited[visitIdx]) continue;
                    visited[visitIdx] = 1;

                    if (matchColor(pos)) {
                        data[pos + 3] = 0; // Alpha à 0 (Transparent)

                        if (x > 0) stack.push([x - 1, y]);
                        if (x < width - 1) stack.push([x + 1, y]);
                        if (y > 0) stack.push([x, y - 1]);
                        if (y < height - 1) stack.push([x, y + 1]);
                    }
                }

                // 3. Export
                ctx.putImageData(imgData, 0, 0);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/png');
            };
            
            img.onerror = (e) => reject(e);
        });
    };

    // --- SMART CLEAN HYBRIDE ---
    const handleSmartAIClean = async () => {
        if (!selectedAction) return;

        const frames = selectedAction.frames || [];
        if (frames.length === 0) return alert("Aucune image à nettoyer !");

        const targetIndexes = selectedFrameIdx !== null
            ? [selectedFrameIdx]
            : frames.map((_, idx) => idx);

        if (targetIndexes.some((idx) => String(frames[idx]?.url || '').startsWith('blob:'))) {
            return alert("Sauvegardez d'abord !");
        }

        setCleaning(true);

        const cleanFrameUrl = async (frameUrl, currentIdx, total) => {
            let newUrl = null;
            setStatusText(`Détourage IA... (${currentIdx}/${total})`);

            // TENTATIVE 1 : IA SERVEUR
            const res = await fetch('/api/studio/remove-bg-specialized', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: frameUrl })
            });
            const data = await res.json();

            if (res.ok && !data.warning && data.url) {
                newUrl = data.url;
            } else {
                // TENTATIVE 2 : FALLBACK LOCAL
                setStatusText(`Détourage local... (${currentIdx}/${total})`);
                const blob = await localAutoClean(frameUrl);
                if (blob) {
                    const fd = new FormData();
                    fd.append('file', blob, `autoclean-${Date.now()}-${currentIdx}.png`);
                    const uploadRes = await fetch('/api/studio/upload-asset', { method: 'POST', body: fd });
                    const uploadData = await uploadRes.json();
                    if (uploadData.url) newUrl = uploadData.url;
                }
            }

            return newUrl;
        };

        try {
            const next = JSON.parse(JSON.stringify(project));
            const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
            if (!actor || !actor.actions?.[selectedActionIdx]) throw new Error("Action introuvable");
            const actionFrames = actor.actions[selectedActionIdx].frames || [];

            let changed = 0;
            for (let i = 0; i < targetIndexes.length; i += 1) {
                const fIdx = targetIndexes[i];
                const frame = actionFrames[fIdx];
                if (!frame?.url) continue;
                const cleanedUrl = await cleanFrameUrl(frame.url, i + 1, targetIndexes.length);
                if (cleanedUrl) {
                    actionFrames[fIdx].url = cleanedUrl;
                    changed += 1;
                }
            }

            if (changed > 0) {
                setProject(next);
                await saveProject(next);
            } else {
                alert("Aucune image modifiée.");
            }
        } catch(e) {
            console.error("Échec total détourage", e);
            alert("Impossible de détourer cette image.");
        }
        setCleaning(false);
    };

    const handleSetPreviewFrameIdx = (valOrFn) => { if (typeof valOrFn === 'function') setPreviewFrameIdx(prev => valOrFn(prev)); else setPreviewFrameIdx(valOrFn); };
    const handleOpenSave = () => { setModalMode('SAVE'); setShowSaveLoadModal(true); };
    const handleOpenLoad = () => { setModalMode('LOAD'); setShowSaveLoadModal(true); };
    const handleCreateNew = () => {
        const next = withLocalSessionId({ ...DEMO_PROJECT });
        setProject(next);
        setCode("");
        setSelectedActorId(null);
        setShowSaveLoadModal(false);
    };
    const handleLoadProject = (p) => {
        const hydrated = hydrateWithLocalSession(p);
        setProject(hydrated.project);
        setCode(hydrated.code || "");
        if (hydrated.project?.scenes?.[0]?.actors?.[0]) setSelectedActorId(hydrated.project.scenes[0].actors[0].id);
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
            {showSaveLoadModal && (<SaveLoadModal mode={modalMode} user={user} currentProject={project} onClose={() => setShowSaveLoadModal(false)} onLoad={handleLoadProject} onNew={handleCreateNew} onSave={(p) => { saveProject(p, { remote: true }).then(() => setShowSaveLoadModal(false)); }} />)}
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
                    stageRef={stageRef} currentScene={currentScene} resolveUrl={resolveUrl} selectedActorId={selectedActorId} selectedAction={selectedAction} isPreviewPlaying={isPreviewPlaying} previewFrameIdx={previewFrameIdx} selectedFrameIdx={selectedFrameIdx} handleStageMouseDown={handleStageMouseDown} selectedActor={selectedActor} handleUpdateProp={handleUpdateProp} saveProject={saveProject} setIsPlaying={setIsPlaying} project={project} code={code} setCode={setCode}
                />
                <StudioRightPanel 
                    project={project} setProject={setProject} handleOpenSave={handleOpenSave} handleOpenLoad={handleOpenLoad} actorUploadRef={actorUploadRef} currentScene={currentScene} selectedActorId={selectedActorId} handleSelectActor={handleSelectActor} handleDeleteActor={handleDeleteActor} resolveUrl={resolveUrl} backdropUploadRef={backdropUploadRef} handleDeleteBackdrop={handleDeleteBackdrop} saveProject={saveProject} selectedSceneIdx={selectedSceneIdx}
                    localStudioMode={localStudioMode}
                    setLocalStudioMode={setLocalStudioMode}
                />
            </div>
        </div>
    );
}
