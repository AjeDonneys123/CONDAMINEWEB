// @signatures: StudioRightPanel
import React from 'react';

export default function StudioRightPanel({
    project, setProject, handleOpenSave, handleOpenLoad,
    actorUploadRef, currentScene, selectedActorId, handleSelectActor, handleDeleteActor, resolveUrl,
    backdropUploadRef, handleDeleteBackdrop, saveProject, selectedSceneIdx
}) {
    return (
        <div className="studio-col-right">
            
            {/* MINI HEADER LOCAL */}
            <div className="right-project-header">
                <div className="project-meta-row">
                    <span className="mini-proj-icon">🎬</span>
                    <input 
                        className="mini-proj-input" 
                        value={project?.title || ""} 
                        onChange={e => setProject({...project, title: e.target.value})} 
                        placeholder="TITRE..." 
                    />
                </div>
                <div className="project-actions-row">
                    <button onClick={handleOpenSave} className="btn-mini-action btn-save-mini">💾 SAUVER</button>
                    <button onClick={handleOpenLoad} className="btn-mini-action btn-load-mini">📂 CHARGER</button>
                </div>
            </div>
            
            {/* BIBLIOTHÈQUE PERSONNAGES */}
            <div className="lib-section" style={{flex: 2}}>
                <div className="lib-header">
                    <span>Personnages</span>
                    <button className="btn-lib-add" onClick={() => actorUploadRef.current.click()}>+ IMPORT</button>
                </div>
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

            {/* BIBLIOTHÈQUE DÉCORS */}
            <div className="lib-section" style={{flex: 1}}>
                <div className="lib-header">
                    <span>Décors</span>
                    <button className="btn-lib-add" onClick={() => backdropUploadRef.current.click()}>+ IMPORT</button>
                </div>
                <div className="lib-grid custom-scrollbar">
                    {currentScene?.backdrops?.map((bd, bIdx) => (
                        <div key={bIdx} className={`lib-item ${currentScene.currentBackdropIdx === bIdx ? 'active' : ''}`} onClick={() => { 
                            const next = JSON.parse(JSON.stringify(project)); 
                            next.scenes[selectedSceneIdx].currentBackdropIdx = bIdx; 
                            setProject(next); 
                            saveProject(next); 
                        }}>
                            <button className="item-del-btn" onClick={e => handleDeleteBackdrop(e, bIdx)}>✕</button>
                            <img src={resolveUrl(bd.url)} className="lib-thumb" />
                            <span className="lib-name">DÉCOR {bIdx+1}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
