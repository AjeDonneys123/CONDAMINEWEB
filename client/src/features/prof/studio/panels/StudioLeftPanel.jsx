// @signatures: StudioLeftPanel
import React, { useState, useEffect, useRef } from 'react';
import SoundExpert from '../studioComp/SoundExpert';

export default function StudioLeftPanel({
    leftTab, setLeftTab, selectedActor, selectedActionIdx, setSelectedActionIdx, 
    selectedGlobalSoundIdx, setSelectedGlobalSoundIdx,
    setIsPreviewPlaying, saveProject, project, selectedSceneIdx, selectedActorId,
    selectedAction, handleUpdateActionSpeed, isPreviewPlaying,
    previewFrameIdx, selectedFrameIdx, setSelectedFrameIdx, setDraggedFrameIdx,
    handleReorderFrame, resolveUrl, handleDeleteFrame, frameUploadRef,
    setFrameToErase, setShowSoundModal, handleDeleteSound, handleEditSound,
    setPreviewFrameIdx, handleSmartAIClean, cleaning
}) {
    const [selectedSoundIdx, setSelectedSoundIdx] = useState(null);
    const audioCtxRef = useRef(null);
    const activeSourcesRef = useRef([]);

    useEffect(() => {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        return () => stopAllSounds();
    }, []);

    const stopAllSounds = () => {
        activeSourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
        activeSourcesRef.current = [];
    };

    useEffect(() => {
        let visualInterval = null;
        let soundIndex = 0;
        let isPlaying = isPreviewPlaying;

        if (isPlaying && selectedAction) {
            if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
            if (selectedAction.frames?.length > 0) {
                visualInterval = setInterval(() => {
                    setPreviewFrameIdx(c => (c + 1) % selectedAction.frames.length);
                }, selectedAction.speed || 200);
            }
            if (selectedAction.sounds?.length > 0) {
                const playNextSound = async () => {
                    if (!isPlaying) return;
                    const snd = selectedAction.sounds[soundIndex];
                    const buffer = await SoundExpert.decodeAudio(resolveUrl(snd.url), audioCtxRef.current);
                    if (!isPlaying || !buffer) return;
                    const source = audioCtxRef.current.createBufferSource();
                    source.buffer = buffer; source.connect(audioCtxRef.current.destination);
                    source.onended = () => { if (isPlaying) { soundIndex = (soundIndex+1) % selectedAction.sounds.length; playNextSound(); } };
                    source.start(0); activeSourcesRef.current.push(source);
                };
                playNextSound();
            }
        } else {
            stopAllSounds(); setPreviewFrameIdx(0);
        }
        return () => { isPlaying = false; if (visualInterval) clearInterval(visualInterval); stopAllSounds(); };
    }, [isPreviewPlaying, selectedAction]);

    return (
        <div className="studio-col-left">
            <div className="studio-tab-header">
                <button className={`studio-tab-btn ${leftTab === 'actions' ? 'active' : ''}`} onClick={() => setLeftTab('actions')}>⚡ Actions</button>
                <button className={`studio-tab-btn ${leftTab === 'sounds' ? 'active' : ''}`} onClick={() => setLeftTab('sounds')}>🎵 Sons</button>
            </div>

            <div className="studio-action-list custom-scrollbar">
                {leftTab === 'actions' ? (
                    selectedActor?.actions?.map((act, idx) => (
                        <div key={idx} onClick={() => { setSelectedActionIdx(idx); setIsPreviewPlaying(false); setSelectedFrameIdx(null); }} className={`action-item ${selectedActionIdx === idx ? 'selected' : ''}`}>
                            <span>{act.name}</span>
                            <div className="flex gap-2 items-center">
                                <span className="text-[9px] opacity-40">{act.frames?.length || 0}f</span>
                            </div>
                        </div>
                    ))
                ) : (
                    project.scenes[selectedSceneIdx].globalSounds?.map((act, idx) => (
                        <div key={idx} onClick={() => { setSelectedGlobalSoundIdx(idx); setIsPreviewPlaying(false); }} className={`action-item ${selectedGlobalSoundIdx === idx ? 'selected' : ''}`}>
                            <span>{act.name}</span>
                        </div>
                    ))
                )}
            </div>

            {selectedAction && (
                <div className="studio-sequencer-box">
                    <div className="seq-header">
                        <span className="seq-label">Séquenceur</span>
                        <div className="seq-controls">
                            <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(-50)}>-</button>
                            <span className="speed-indicator">{selectedAction.speed || 100}ms</span>
                            <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(50)}>+</button>
                            <button className={`btn-mini-ctrl ${isPreviewPlaying ? 'bg-indigo-100 text-indigo-600' : ''}`} onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}>
                                {isPreviewPlaying ? '⏹️' : '▶️'}
                            </button>
                        </div>
                    </div>
                    
                    {leftTab === 'actions' && (
                        <div className="seq-frames-grid custom-scrollbar">
                            {selectedAction.frames.map((frame, fIdx) => (
                                <div key={fIdx} 
                                    className={`seq-frame ${selectedFrameIdx === fIdx ? 'active' : ''}`} 
                                    draggable 
                                    onClick={() => { setSelectedFrameIdx(fIdx); setIsPreviewPlaying(false); }} 
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
                    
                    <div className="eraser-bar">
                        <div className="flex gap-2 w-full">
                            <button className="btn-tool-pen" onClick={() => selectedFrameIdx !== null && setFrameToErase({url: selectedAction.frames[selectedFrameIdx].url, idx: selectedFrameIdx})} disabled={selectedFrameIdx === null}>✏️ GOMME</button>
                            {leftTab === 'actions' && (
                                <button className={`btn-magic-clean ${cleaning ? 'pulse' : ''}`} onClick={handleSmartAIClean} disabled={cleaning || selectedFrameIdx === null}>
                                    ✨ {cleaning ? '...' : 'DÉTOURER'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
