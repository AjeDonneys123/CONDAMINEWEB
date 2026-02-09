// @signatures: StudioLeftPanel
import React, { useState, useEffect, useRef } from 'react';
import SoundExpert from '../studioComp/SoundExpert';

export default function StudioLeftPanel({
    leftTab, setLeftTab, selectedActor, selectedActionIdx, setSelectedActionIdx, 
    selectedGlobalSoundIdx, setSelectedGlobalSoundIdx,
    setIsPreviewPlaying, saveProject, project, selectedSceneIdx, selectedActorId,
    selectedAction, handleMirrorSequence, handleUpdateActionSpeed, isPreviewPlaying,
    previewFrameIdx, selectedFrameIdx, setSelectedFrameIdx, setDraggedFrameIdx,
    handleReorderFrame, resolveUrl, handleDeleteFrame, frameUploadRef,
    eraserActive, setEraserActive, setFrameToErase,
    handleSmartAIClean, cleaning, setShowSoundModal,
    handleDeleteSound, handleEditSound,
    setPreviewFrameIdx,
    currentScene
}) {
    const [selectedSoundIdx, setSelectedSoundIdx] = useState(null);
    const audioCtxRef = useRef(null);
    const activeSourcesRef = useRef([]);

    // 1. INIT CONTEXTE
    useEffect(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        return () => stopAllSounds();
    }, []);

    // 2. PRELOAD
    useEffect(() => {
        if (selectedAction && selectedAction.sounds && selectedAction.sounds.length > 0) {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            selectedAction.sounds.forEach(snd => {
                SoundExpert.decodeAudio(resolveUrl(snd.url), audioCtxRef.current);
            });
        }
    }, [selectedAction]);

    const stopAllSounds = () => {
        activeSourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
        activeSourcesRef.current = [];
    };

    // 3. SEQUENCEUR
    useEffect(() => {
        let visualInterval = null;
        let soundIndex = 0;
        let isPlaying = isPreviewPlaying;

        if (isPlaying && selectedAction) {
            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }

            // VISUEL
            if (selectedAction.frames && selectedAction.frames.length > 0) {
                visualInterval = setInterval(() => {
                    if (typeof setPreviewFrameIdx === 'function') {
                        setPreviewFrameIdx(currentIdx => (currentIdx + 1) % selectedAction.frames.length);
                    }
                }, selectedAction.speed || 200);
            }

            // AUDIO
            if (selectedAction.sounds && selectedAction.sounds.length > 0) {
                const playNextSound = async () => {
                    if (!isPlaying) return;
                    const soundData = selectedAction.sounds[soundIndex];
                    if (!soundData) return;
                    const buffer = await SoundExpert.decodeAudio(resolveUrl(soundData.url), audioCtxRef.current);
                    if (!isPlaying || !buffer) return;

                    try {
                        const source = audioCtxRef.current.createBufferSource();
                        source.buffer = buffer;
                        source.connect(audioCtxRef.current.destination);
                        source.onended = () => {
                            if (isPlaying) {
                                soundIndex = (soundIndex + 1) % selectedAction.sounds.length;
                                playNextSound();
                            }
                        };
                        source.start(0);
                        activeSourcesRef.current.push(source);
                    } catch (e) { console.error("Audio Error", e); }
                };
                playNextSound();
            }
        } else {
            stopAllSounds();
            if (setPreviewFrameIdx) setPreviewFrameIdx(0);
        }

        return () => {
            isPlaying = false;
            if (visualInterval) clearInterval(visualInterval);
            stopAllSounds();
        };
    }, [isPreviewPlaying, selectedAction]);

    const handleSelectAction = (idx) => {
        setSelectedActionIdx(idx);
        setIsPreviewPlaying(false);
        setSelectedFrameIdx(null);
        setSelectedSoundIdx(null);
        if (setPreviewFrameIdx) setPreviewFrameIdx(0);
    };

    const handleSelectGlobalSound = (idx) => {
        setSelectedGlobalSoundIdx(idx);
        setIsPreviewPlaying(false);
        setSelectedFrameIdx(null);
        setSelectedSoundIdx(null);
    };

    const handlePenClick = () => {
        if (selectedFrameIdx !== null && leftTab === 'actions') {
            setFrameToErase({ url: selectedAction.frames[selectedFrameIdx].url, idx: selectedFrameIdx });
        } else if (selectedSoundIdx !== null) {
            handleEditSound(selectedSoundIdx); 
        }
    };

    // --- HANDLERS D'AJOUT ---

    const handleAddAction = () => {
        const name = prompt("Nom de l'action (ex: MARCHER) :"); 
        if(!name) return; 
        
        const next = JSON.parse(JSON.stringify(project)); 
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        
        if (actor) {
            actor.actions.push({ name: name.toUpperCase(), frames: [], sounds: [], speed: 100 }); 
            saveProject(next);
        }
    };

    const handleAddGlobalSound = () => {
        const name = prompt("Nom de l'événement (ex: VICTOIRE, DÉPART) :"); 
        if(!name) return; 
        
        const next = JSON.parse(JSON.stringify(project)); 
        const scene = next.scenes[selectedSceneIdx];

        if (!scene.globalSounds) scene.globalSounds = [];
        
        scene.globalSounds.push({ 
            name: name.toUpperCase(), 
            frames: [], 
            sounds: [], 
            speed: 100 
        }); 
        
        // On sauvegarde directement le projet complet
        saveProject(next);
    };

    const handleDeleteActionOrSound = (e, idx) => {
        e.stopPropagation();
        if (!confirm("Supprimer cet événement ?")) return;
        const next = JSON.parse(JSON.stringify(project));
        if (leftTab === 'actions') {
            const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
            actor.actions.splice(idx, 1);
            setSelectedActionIdx(0);
        } else {
            next.scenes[selectedSceneIdx].globalSounds.splice(idx, 1);
            setSelectedGlobalSoundIdx(0);
        }
        saveProject(next);
    };

    return (
        <div className="studio-col-left">
            <div className="studio-tab-header">
                <button className={`studio-tab-btn ${leftTab === 'actions' ? 'active' : ''}`} onClick={() => setLeftTab('actions')}>⚡ Actions</button>
                <button className={`studio-tab-btn ${leftTab === 'sounds' ? 'active' : ''}`} onClick={() => setLeftTab('sounds')}>🎵 Sons</button>
            </div>

            <div className="studio-action-list custom-scrollbar">
                {leftTab === 'actions' ? (
                    <>
                        {selectedActor?.actions?.map((act, idx) => (
                            <div key={idx} onClick={() => handleSelectAction(idx)} className={`action-item ${selectedActionIdx === idx ? 'selected' : ''}`}>
                                <span>{act.name}</span>
                                <div className="flex gap-2 items-center">
                                    <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-400">{act.frames?.length || 0}f</span>
                                    {act.sounds?.length > 0 && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded">🎵</span>}
                                    <button onClick={(e) => handleDeleteActionOrSound(e, idx)} className="text-[10px] text-red-300 hover:text-red-500 font-black ml-1">✕</button>
                                </div>
                            </div>
                        ))}
                        <button type="button" className="v84-add-btn-minimal" onClick={handleAddAction}>+ Action</button>
                    </>
                ) : (
                    <>
                        {currentScene?.globalSounds?.map((act, idx) => (
                            <div key={idx} onClick={() => handleSelectGlobalSound(idx)} className={`action-item ${selectedGlobalSoundIdx === idx ? 'selected' : ''}`}>
                                <span>{act.name}</span>
                                <div className="flex gap-2 items-center">
                                    {act.sounds?.length > 0 && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded">🎵</span>}
                                    <button onClick={(e) => handleDeleteActionOrSound(e, idx)} className="text-[10px] text-red-300 hover:text-red-500 font-black ml-1">✕</button>
                                </div>
                            </div>
                        ))}
                        <button type="button" className="v84-add-btn-minimal" onClick={handleAddGlobalSound}>+ Événement Sonore</button>
                    </>
                )}
            </div>

            {selectedAction && (
                <div className="studio-sequencer-box">
                    <div className="seq-header">
                        <span className="seq-label">{leftTab === 'actions' ? 'Séquenceur' : 'Timeline Sonore'}</span>
                        <div className="seq-controls">
                            {leftTab === 'actions' && <button className="btn-mirror" onClick={handleMirrorSequence} title="Miroir">↔️</button>}
                            <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(-50)}>-</button>
                            <span className="speed-indicator">{selectedAction.speed || 100}ms</span>
                            <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(50)}>+</button>
                            <button className={`btn-mini-ctrl ${isPreviewPlaying ? 'bg-indigo-100 text-indigo-600' : ''}`} onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}>
                                {isPreviewPlaying ? '⏹️' : '▶️'}
                            </button>
                        </div>
                    </div>
                    
                    {leftTab === 'actions' && (
                        <div className="seq-frames-grid custom-scrollbar" style={{height: '110px', minHeight: '110px'}}>
                            {selectedAction.frames.map((frame, fIdx) => (
                                <div key={fIdx} 
                                    className={`seq-frame ${isPreviewPlaying && previewFrameIdx === fIdx ? 'active' : ''} ${selectedFrameIdx === fIdx ? 'active' : ''}`} 
                                    draggable 
                                    onClick={() => { setSelectedFrameIdx(selectedFrameIdx === fIdx ? null : fIdx); setIsPreviewPlaying(false); setSelectedSoundIdx(null); }} 
                                    onDragStart={() => setDraggedFrameIdx(fIdx)} 
                                    onDragOver={e => e.preventDefault()} 
                                    onDrop={() => handleReorderFrame(fIdx)}>
                                    <img src={resolveUrl(frame.url)} />
                                    <button className="frame-del" onClick={e => { e.stopPropagation(); handleDeleteFrame(fIdx); }}>✕</button>
                                </div>
                            ))}
                            <div className="seq-frame seq-frame-add" onClick={() => frameUploadRef.current.click()}>+</div>
                        </div>
                    )}
                    
                    <div className={`border-slate-200 pt-2 ${leftTab === 'actions' ? 'border-t mt-2' : ''}`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="seq-label text-indigo-500">Piste Audio</span>
                            <button className="btn-sound-trigger !w-auto px-2 !text-[9px]" onClick={() => setShowSoundModal(true)}>
                                🔊 Ajouter Son
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {(selectedAction.sounds || []).map((snd, sIdx) => (
                                <div key={sIdx} 
                                     onClick={() => { setSelectedSoundIdx(selectedSoundIdx === sIdx ? null : sIdx); setSelectedFrameIdx(null); }}
                                     className={`sound-frame-visual h-16 ${selectedSoundIdx === sIdx ? 'active' : ''} relative group`}>
                                    <span className="text-xl">🎵</span>
                                    <span className="text-[8px] font-black text-indigo-800 w-full text-center truncate px-1">{snd.name?.substring(0,10)}</span>
                                    
                                    <button 
                                        className="frame-del !bg-red-500 !text-white !opacity-100 !top-1 !right-1 z-50" 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSound(sIdx); }}
                                        title="Supprimer le son"
                                    >✕</button>
                                </div>
                            ))}
                            <div className="border-2 border-dashed border-slate-200 rounded-lg h-16 flex items-center justify-center text-slate-300 text-[8px] font-bold">
                                LIBRE
                            </div>
                        </div>
                    </div>

                    <div className="eraser-bar mt-auto">
                        <div className="flex gap-2 items-center w-full">
                            <button className="btn-tool-pen" onClick={handlePenClick} disabled={selectedFrameIdx === null && selectedSoundIdx === null} title={selectedSoundIdx !== null ? "Éditer le son" : "Éditer l'image"}>
                                ✏️ ÉDITER
                            </button>
                            {leftTab === 'actions' && (
                                <button className={`btn-magic-clean ${cleaning ? 'pulse' : ''}`} onClick={handleSmartAIClean} disabled={cleaning || !selectedAction.frames || selectedAction.frames.length === 0} title={selectedFrameIdx !== null ? "Détourer l'image" : "Détourer TOUT"}>
                                    ✨ {cleaning ? '...' : (selectedFrameIdx !== null ? 'CIBLÉ' : 'TOUT')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
