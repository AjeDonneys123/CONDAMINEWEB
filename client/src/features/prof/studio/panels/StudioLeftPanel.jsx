// @signatures: StudioLeftPanel
import React from 'react';

export default function StudioLeftPanel({
    leftTab, setLeftTab, selectedActor, selectedActionIdx, setSelectedActionIdx, 
    setIsPreviewPlaying, saveProject, project, selectedSceneIdx, selectedActorId,
    selectedAction, handleMirrorSequence, handleUpdateActionSpeed, isPreviewPlaying,
    previewFrameIdx, selectedFrameIdx, setSelectedFrameIdx, setDraggedFrameIdx,
    handleReorderFrame, resolveUrl, handleDeleteFrame, frameUploadRef,
    eraserActive, setEraserActive, setFrameToErase,
    handleSmartAIClean, cleaning, setShowSoundModal
}) {
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
                            <div key={idx} onClick={() => { setSelectedActionIdx(idx); setIsPreviewPlaying(false); setSelectedFrameIdx(null); }} className={`action-item ${selectedActionIdx === idx ? 'selected' : ''}`}>
                                {act.name} {act.soundUrl && '🎵'}
                            </div>
                        ))}
                        <button className="v84-add-btn-minimal" onClick={() => { 
                            const name = prompt("Nom :"); 
                            if(!name) return; 
                            const next = JSON.parse(JSON.stringify(project)); 
                            next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId).actions.push({ name: name.toUpperCase(), frames: [], speed: 100 }); 
                            saveProject(next); 
                        }}>+ Ajouter</button>
                    </>
                ) : (
                    <div className="p-10 opacity-30 text-center uppercase text-[10px] font-black">Bientôt</div>
                )}
            </div>

            {leftTab === 'actions' && selectedAction && (
                <div className="studio-sequencer-box">
                    <div className="seq-header">
                        <span className="seq-label">Timeline ({selectedAction.frames.length}f)</span>
                        <div className="seq-controls">
                            <button className="btn-mirror" onClick={handleMirrorSequence} title="Miroir">↔️</button>
                            
                            {/* BOUTON SON */}
                            <button className="btn-sound-trigger" onClick={() => setShowSoundModal(true)} title="Ajouter un son">
                                {selectedAction.soundUrl ? '🔊' : '🎵'}
                            </button>

                            <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(-50)}>-</button>
                            <span className="speed-indicator">{selectedAction.speed || 100}ms</span>
                            <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(50)}>+</button>
                            <button className="btn-mini-ctrl" onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}>{isPreviewPlaying ? '⏹️' : '▶️'}</button>
                        </div>
                    </div>
                    <div className="seq-frames-grid custom-scrollbar">
                        {selectedAction.frames.map((frame, fIdx) => (
                            <div key={fIdx} 
                                 className={`seq-frame ${isPreviewPlaying && previewFrameIdx === fIdx ? 'active' : ''} ${selectedFrameIdx === fIdx ? 'active' : ''}`} 
                                 draggable 
                                 onClick={() => { setSelectedFrameIdx(selectedFrameIdx === fIdx ? null : fIdx); setIsPreviewPlaying(false); }} 
                                 onDragStart={() => setDraggedFrameIdx(fIdx)} 
                                 onDragOver={e => e.preventDefault()} 
                                 onDrop={() => handleReorderFrame(fIdx)}>
                                <img src={resolveUrl(frame.url)} />
                                <button className="frame-del" onClick={e => { e.stopPropagation(); handleDeleteFrame(fIdx); }}>✕</button>
                            </div>
                        ))}
                        <div className="seq-frame seq-frame-add" onClick={() => frameUploadRef.current.click()}>+</div>
                    </div>
                    
                    <div className="eraser-bar">
                        <div className="flex gap-2 items-center">
                            {selectedFrameIdx !== null ? (
                                <button className="btn-launch-eraser" onClick={() => setFrameToErase({ url: selectedAction.frames[selectedFrameIdx].url, idx: selectedFrameIdx })}>GOMMER</button>
                            ) : (
                                <button className="btn-eraser-main disabled" disabled title="Sélectionnez une image">🧽</button>
                            )}
                        </div>
                        <button className={`btn-magic-clean ${cleaning ? 'pulse' : ''}`} onClick={handleSmartAIClean} title="Détourer toute l'action">
                            ✨ {selectedFrameIdx !== null ? 'CIBLÉ' : 'AUTO'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
