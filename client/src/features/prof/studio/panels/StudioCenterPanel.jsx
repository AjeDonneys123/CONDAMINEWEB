// @signatures: StudioCenterPanel
import React from 'react';

export default function StudioCenterPanel({
    stageRef, currentScene, resolveUrl, selectedActorId, selectedAction,
    isPreviewPlaying, previewFrameIdx, selectedFrameIdx, handleStageMouseDown,
    selectedActor, handleUpdateProp, handleViewTestQuiz, saveProject, setIsPlaying,
    code, setCode
}) {
    return (
        <div className="studio-col-center custom-scrollbar">
            <div ref={stageRef} className="stage-wrapper" style={{ backgroundImage: currentScene?.backdrops?.[currentScene.currentBackdropIdx || 0]?.url ? `url(${resolveUrl(currentScene.backdrops[currentScene.currentBackdropIdx].url)})` : 'none' }}>
                {currentScene?.actors?.map((a) => { 
                    const isSelected = selectedActorId === a.id; 
                    let action = isSelected ? selectedAction : (a.actions?.find(act => act.name.toUpperCase() === "IDLE") || a.actions?.[0]); 
                    let frameIdx = isSelected ? (isPreviewPlaying ? previewFrameIdx : (selectedFrameIdx !== null ? selectedFrameIdx : 0)) : 0; 
                    return (
                        <div 
                            key={a.id} 
                            onMouseDown={e => handleStageMouseDown(e, a.id)} 
                            className={`actor-sprite ${isSelected ? 'selected' : ''}`} 
                            style={{ 
                                left: `${a.initialX}%`, 
                                top: `${a.initialY}%`, 
                                width: `${150 * (a.scale || 1)}px`, 
                                height: `${150 * (a.scale || 1)}px`, 
                                transform: `translate(-50%, -50%) rotate(${a.direction || 0}deg)`,
                                zIndex: isSelected ? 100 : 10 
                            }}
                        >
                            {action?.frames?.[frameIdx]?.url && <img src={resolveUrl(action.frames[frameIdx].url)} />}
                        </div>
                    ); 
                })}
            </div>

            <div className="props-bar">
                <div className="prop-item">
                    <span className="prop-label">Nom</span>
                    <input className="prop-input" value={selectedActor?.name || ""} onChange={e => handleUpdateProp('name', e.target.value)} />
                </div>
                <div className="prop-item">
                    <span className="prop-label">Taille (%)</span>
                    <input type="number" className="prop-input" value={Math.round((selectedActor?.scale || 1) * 100)} onChange={e => handleUpdateProp('scale', parseFloat(e.target.value)/100)} />
                </div>
                <button onClick={handleViewTestQuiz} className="btn-view-quiz">📋 QUIZ</button>
                <button onClick={() => { saveProject(); setIsPlaying(true); }} className="ml-auto bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] shadow-lg">▶ TESTER</button>
            </div>

            <div className="code-editor-box">
                <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" />
            </div>
        </div>
    );
}
