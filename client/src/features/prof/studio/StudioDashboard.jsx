import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';

const AssetThumb = ({ url, className, fallbackEmoji, style }) => {
    const [hasError, setHasError] = useState(false);
    useEffect(() => { setHasError(false); }, [url]);
    if (!url || hasError) return <div className={`flex items-center justify-center w-full h-full text-2xl ${className}`} style={style}><span className="opacity-50 select-none">{fallbackEmoji || '📦'}</span></div>;
    return <img src={url} className={className} style={style} onError={() => setHasError(true)} draggable="false" alt="asset" />;
};

/**
 * 🎬 STUDIO V35 - PERSISTENCE & SCENARIO ENGINE
 * - Sauvegarde automatique des sprites découpés sur le serveur.
 * - Sauvegarde du projet JSON en BDD.
 * - Moteur de Scénario (Timeline) en bas.
 */
export default function StudioDashboard({ user }) {

    const [project, setProject] = useState({
        _id: null, // ID BDD
        title: "Nouveau Projet",
        teacherId: user.id || user._id,
        scenes: [{
            id: 1, name: "Scène 1", bg: "#ffffff",
            actors: [],
            timeline: [] // LE SCÉNARIO GLOBAL
        }]
    });

    const [activeSceneIdx, setActiveSceneIdx] = useState(0);
    const [selectedActorId, setSelectedActorId] = useState(null);
    
    // UI STATES
    const [isSequencerOpen, setIsSequencerOpen] = useState(false);
    const [sequencerFrames, setSequencerFrames] = useState([]);
    const [playbackId, setPlaybackId] = useState(null);
    const [processingMsg, setProcessingMsg] = useState("");
    const [leftTab, setLeftTab] = useState('costumes');

    const fileInputRef = useRef(null);
    const activeScene = project.scenes[activeSceneIdx];
    const selectedActor = activeScene.actors.find(a => a.id === selectedActorId);

    // ==================================================================================
    // 💾 PERSISTENCE & SAUVEGARDE
    // ==================================================================================

    // 1. Upload d'un Blob (Image découpée) vers le serveur pour avoir une URL permanente
    const uploadBlob = async (blob, filename) => {
        const formData = new FormData();
        formData.append('file', blob, filename + '.png');
        try {
            const res = await fetch('/api/studio/upload', { method: 'POST', body: formData });
            const data = await res.json();
            return data.url; // URL /uploads/studio_....png
        } catch (e) {
            console.error("Upload fail", e);
            return null;
        }
    };

    // 2. Sauvegarde du Projet Complet
    const saveProject = async () => {
        setProcessingMsg("Sauvegarde du projet...");
        try {
            const payload = { ...project, teacherId: user.id || user._id };
            const res = await fetch('/api/studio/projects', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            setProject(prev => ({ ...prev, _id: data._id }));
            setProcessingMsg("");
            alert("Projet sauvegardé avec succès ! 💾");
        } catch (e) {
            setProcessingMsg("");
            alert("Erreur de sauvegarde.");
        }
    };

    // ==================================================================================
    // 🎬 MOTEUR DE SCÉNARIO (TIMELINE)
    // ==================================================================================

    const addScenarioEvent = (type) => {
        if (!selectedActor && type !== 'WAIT') return alert("Sélectionnez un acteur d'abord !");
        
        let newEvent = { id: `evt_${Date.now()}`, type, target: selectedActor ? selectedActor.id : null };

        if (type === 'MOVE') {
            // Par défaut, bouge vers la position actuelle (pour initialiser)
            newEvent.x = Math.round(selectedActor.x);
            newEvent.y = Math.round(selectedActor.y);
            newEvent.duration = 1; // secondes
        } else if (type === 'SAY') {
            const text = prompt("Que doit dire le personnage ?");
            if (!text) return;
            newEvent.text = text;
        } else if (type === 'ACTION') {
            if (selectedActor.actions.length === 0) return alert("Cet acteur n'a aucune action définie !");
            // On prend la première action par défaut, ou on demande
            // Pour faire simple : première action
            newEvent.actionId = selectedActor.actions[0].id;
            newEvent.actionName = selectedActor.actions[0].name;
        }

        const newScenes = [...project.scenes];
        newScenes[activeSceneIdx].timeline.push(newEvent);
        setProject({ ...project, scenes: newScenes });
    };

    const deleteScenarioEvent = (e, idx) => {
        e.stopPropagation();
        const newScenes = [...project.scenes];
        newScenes[activeSceneIdx].timeline = newScenes[activeSceneIdx].timeline.filter((_, i) => i !== idx);
        setProject({ ...project, scenes: newScenes });
    };

    // ==================================================================================
    // ✂️ MOTEUR DÉCOUPAGE (MODIFIÉ POUR UPLOAD AUTO)
    // ==================================================================================
    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file || !selectedActor) return;
        const url = URL.createObjectURL(file);
        
        // On demande juste "Grille" ou "Simple"
        if (confirm(`Image chargée.\nEst-ce une planche de sprites (Grille) ?`)) {
            const input = prompt("Format de la grille ? (ex: 4x4)", "4x4");
            if(input) {
                const [c, r] = input.split('x').map(Number);
                runGridSlicer(url, file.name.substring(0, 8), c, r);
            }
        } else {
            // Import direct (mais on l'upload quand même pour persistance)
            fetch(url).then(r => r.blob()).then(blob => {
                uploadBlob(blob, file.name).then(serverUrl => {
                    if(serverUrl) injectCostumes([serverUrl], file.name.substring(0,8));
                });
            });
        }
        e.target.value = null;
    };

    const runGridSlicer = (imageUrl, baseName, cols, rows) => {
        setProcessingMsg("Découpage & Upload...");
        const img = new Image(); img.crossOrigin = "Anonymous"; img.src = imageUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width; canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Nettoyage fond
            const idata = ctx.getImageData(0,0,img.width,img.height);
            const d = idata.data;
            for(let i=0; i<d.length; i+=4) {
                if(d[i]>200 && d[i+1]>200 && d[i+2]>200) d[i+3]=0;
            }
            ctx.putImageData(idata, 0, 0);

            const spriteW = Math.floor(img.width / cols);
            const spriteH = Math.floor(img.height / rows);
            const uploads = [];

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const sC = document.createElement('canvas');
                    sC.width = spriteW; sC.height = spriteH;
                    sC.getContext('2d').drawImage(canvas, x*spriteW, y*spriteH, spriteW, spriteH, 0, 0, spriteW, spriteH);
                    
                    // On crée une promesse d'upload pour chaque sprite
                    const p = new Promise(resolve => {
                        sC.toBlob(blob => {
                            uploadBlob(blob, `${baseName}_${x}_${y}`).then(url => resolve(url));
                        }, 'image/png');
                    });
                    uploads.push(p);
                }
            }

            Promise.all(uploads).then(serverUrls => {
                injectCostumes(serverUrls.filter(u=>u), baseName);
                setProcessingMsg("");
            });
        };
    };

    // ==================================================================================
    // ⚙️ HELPERS STANDARD
    // ==================================================================================
    const injectCostumes = (urls, baseName) => {
        if (!selectedActor) return;
        setProject(prev => {
            const next = { ...prev };
            const act = next.scenes[activeSceneIdx].actors.find(a => a.id === selectedActorId);
            if (act) {
                urls.forEach((url, i) => {
                    act.costumes.push({ id: `c_${Date.now()}_${i}`, url, name: `${baseName}_${act.costumes.length + 1}` });
                });
                if (act.costumes.length === urls.length) act.currentCostumeIdx = 0;
            }
            return next;
        });
    };

    const updateActor = (key, val) => {
        if (!selectedActor) return;
        setProject(prev => {
            const next = { ...prev };
            const act = next.scenes[activeSceneIdx].actors.find(a => a.id === selectedActorId);
            if (act) act[key] = val;
            return next;
        });
    };

    const createActor = () => {
        const name = prompt("Nom ?") || "Nouveau";
        const newId = `a_${Date.now()}`;
        const newActor = {
            id: newId, name, x: 50, y: 50, scale: 1, currentCostumeIdx: 0, 
            costumes: [{ id: `c_def`, url: '', name: 'Base' }], 
            actions: [], sounds: []
        };
        setProject(prev => {
            const next = { ...prev };
            next.scenes[activeSceneIdx].actors.push(newActor);
            return next;
        });
        setSelectedActorId(newId);
    };

    const deleteCostume = (e, idx) => {
        e.stopPropagation(); if(!selectedActor) return;
        setProject(prev => {
            const next = { ...prev }; const act = next.scenes[activeSceneIdx].actors.find(a => a.id === selectedActorId);
            act.costumes = act.costumes.filter((_, i) => i !== idx);
            if(act.currentCostumeIdx >= act.costumes.length) act.currentCostumeIdx = 0;
            return next;
        });
    };

    const deleteActor = (e, actorId) => {
        e.stopPropagation(); if(!confirm("Supprimer ?")) return;
        setProject(prev => {
            const next = { ...prev }; 
            next.scenes[activeSceneIdx].actors = next.scenes[activeSceneIdx].actors.filter(a => a.id !== actorId); 
            return next;
        });
        setSelectedActorId(null);
    };

    // Sequencer Actions
    const handleCostumeClick = (idx) => {
        if (!selectedActor) return;
        if (isSequencerOpen) setSequencerFrames(prev => [...prev, idx]);
        else updateActor('currentCostumeIdx', idx);
    };

    const saveAction = () => {
        if (sequencerFrames.length === 0) return;
        const name = prompt("Nom de l'action ?"); if (!name) return;
        const newAction = { id: `act_${Date.now()}`, name, frames: [...sequencerFrames], speed: 300, loop: true };
        setProject(prev => {
            const next = { ...prev };
            const act = next.scenes[activeSceneIdx].actors.find(a => a.id === selectedActorId);
            act.actions.push(newAction);
            return next;
        });
        setIsSequencerOpen(false); setSequencerFrames([]);
    };

    const runSequence = () => {
        if (playbackId) { clearInterval(playbackId); setPlaybackId(null); return; }
        if (sequencerFrames.length === 0) return;
        let i = 0;
        const id = setInterval(() => {
            updateActor('currentCostumeIdx', sequencerFrames[i]);
            i = (i + 1) % sequencerFrames.length;
        }, 300);
        setPlaybackId(id);
    };

    const handleStageDrag = (e) => {
        if (selectedActorId && e.buttons === 1) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
            const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
            updateActor('x', x); updateActor('y', y);
        }
    };

    const getEmoji = (name) => {
        const n = (name || '').toLowerCase();
        if (n.includes('mario')) return '🍄';
        if (n.includes('zomb')) return '🧟';
        if (n.includes('hero')) return '🧙‍♂️';
        return '👾';
    };

    // Helper pour afficher le nom de l'acteur dans la timeline
    const getActorName = (id) => {
        const a = activeScene.actors.find(act => act.id === id);
        return a ? a.name : 'Inconnu';
    };

    return (
        <div className="studio-wrapper">
            <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleImportFile} accept="image/*" />
            
            {processingMsg && <div className="overlay"><div className="modal-box"><h3 className="animate-pulse">{processingMsg}</h3></div></div>}

            {/* GAUCHE */}
            <div className="studio-sidebar">
                <div className="panel-header">BIBLIOTHÈQUE</div>
                {selectedActor ? (
                    <>
                        <div className="sidebar-tabs">
                            <button className="tab-btn active">COSTUMES</button>
                            <button className="tab-btn">SONS</button>
                        </div>
                        <div className="costume-list-vertical scroll-area">
                            <div className="add-btn-box" onClick={() => fileInputRef.current.click()}>+</div>
                            {selectedActor.costumes.map((c, i) => (
                                <div key={c.id} className={`costume-card ${i===selectedActor.currentCostumeIdx ? 'active' : ''} ${isSequencerOpen ? 'in-sequence' : ''}`} onClick={() => handleCostumeClick(i)}>
                                    <AssetThumb url={c.url} fallbackEmoji="🖼️" className="costume-img" />
                                    <div className="costume-label">{c.name}</div>
                                    <div className="delete-btn-mini" onClick={(e)=>deleteCostume(e,i)}>✕</div>
                                </div>
                            ))}
                        </div>
                        {!isSequencerOpen && (
                            <div style={{padding:'10px', borderTop:'1px solid #334155'}}>
                                <button style={{width:'100%', padding:'10px', background:'#3b82f6', border:'none', borderRadius:'6px', color:'white', fontWeight:'bold', fontSize:'0.7rem', cursor:'pointer'}} 
                                        onClick={() => setIsSequencerOpen(true)}>+ CRÉER ACTION</button>
                            </div>
                        )}
                    </>
                ) : <div className="p-4 text-center text-xs text-slate-500">Sélectionnez un Objet</div>}
            </div>

            {/* CENTRE */}
            <div className="studio-center">
                <div className="stage-toolbar">
                    <span>SCÈNE 1</span>
                    <button onClick={saveProject} style={{background:'#10b981', color:'white', border:'none', padding:'4px 12px', borderRadius:'4px', fontWeight:'bold', fontSize:'0.7rem', cursor:'pointer'}}>💾 SAUVER PROJET</button>
                </div>
                
                <div className="stage-wrapper" onClick={() => setSelectedActorId(null)}>
                    <div className="stage-canvas" onMouseMove={handleStageDrag}>
                        {activeScene.actors.map(actor => {
                            const costume = actor.costumes[actor.currentCostumeIdx];
                            return (
                                <div key={actor.id} className={`actor-on-stage ${selectedActorId === actor.id ? 'selected' : ''}`}
                                    style={{ left: actor.x+'%', top: actor.y+'%', transform: `translate(-50%, -50%) scale(${actor.scale})` }}
                                    onMouseDown={(e) => { e.stopPropagation(); setSelectedActorId(actor.id); }}
                                >
                                    <AssetThumb url={costume ? costume.url : ''} fallbackEmoji={getEmoji(actor.name)} className="" style={{width:'100%', height:'100%', objectFit:'contain', pointerEvents:'none'}} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* BAS : SÉQUENCEUR OU TIMELINE SCÉNARIO */}
                {isSequencerOpen ? (
                    <div className="sequencer-panel">
                        <div className="seq-header">
                            <span className="seq-title">MONTAGE ACTION ({sequencerFrames.length})</span>
                            <div className="seq-controls">
                                <button className="btn-seq run" onClick={runSequence}>{playbackId ? 'STOP' : '▶ TEST'}</button>
                                <button className="btn-seq save" onClick={saveAction}>💾</button>
                                <button className="btn-seq close" onClick={() => setIsSequencerOpen(false)}>✕</button>
                            </div>
                        </div>
                        <div className="seq-strip custom-scrollbar">
                            {sequencerFrames.map((costIdx, i) => (
                                <div key={i} className="seq-frame" onClick={() => setSequencerFrames(prev => prev.filter((_, idx) => idx !== i))}>
                                    <AssetThumb url={selectedActor.costumes[costIdx]?.url} fallbackEmoji="🎞️" className="" />
                                    <span className="seq-num">{i+1}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="sequencer-panel">
                        <div className="seq-header">
                            <span className="seq-title">SCÉNARIO ({activeScene.timeline.length} étapes)</span>
                            <div className="seq-controls">
                                <button className="btn-seq" style={{background:'#6366f1', color:'white'}} onClick={() => addScenarioEvent('MOVE')}>🏃 BOUGER</button>
                                <button className="btn-seq" style={{background:'#ec4899', color:'white'}} onClick={() => addScenarioEvent('SAY')}>💬 PARLER</button>
                                <button className="btn-seq" style={{background:'#f59e0b', color:'white'}} onClick={() => addScenarioEvent('ACTION')}>🎬 ACTION</button>
                            </div>
                        </div>
                        <div className="seq-strip custom-scrollbar" style={{justifyContent:'flex-start'}}>
                            {activeScene.timeline.length === 0 && <div className="text-xs text-slate-500 ml-4">Ajoutez des événements pour créer l'histoire...</div>}
                            {activeScene.timeline.map((evt, i) => (
                                <div key={i} className="seq-frame" style={{width:'100px', flexDirection:'column', gap:'2px', padding:'5px'}} onClick={(e) => deleteScenarioEvent(e, i)}>
                                    <span style={{fontSize:'0.55rem', fontWeight:'900', color:'#f472b6'}}>{evt.type}</span>
                                    <span style={{fontSize:'0.6rem', color:'white', fontWeight:'bold'}}>{getActorName(evt.target)}</span>
                                    <span style={{fontSize:'0.5rem', color:'#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%'}}>
                                        {evt.text || evt.actionName || `X:${evt.x} Y:${evt.y}`}
                                    </span>
                                    <div className="delete-btn-mini" style={{top:2, right:2}}>✕</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* DROITE */}
            <div className="studio-right-panel">
                <div className="panel-header">PROPRIÉTÉS</div>
                <div className="scroll-area" style={{height:'40%', borderBottom:'1px solid #334155'}}>
                    {selectedActor ? (
                        <>
                            <div className="prop-row"><label className="prop-label">NOM</label><input className="prop-input" value={selectedActor.name} onChange={e => updateActor('name', e.target.value)} /></div>
                            <div className="prop-row"><label className="prop-label">X</label><input type="number" className="prop-input" value={Math.round(selectedActor.x)} onChange={e => updateActor('x', parseInt(e.target.value))} /></div>
                            <div className="prop-row"><label className="prop-label">Y</label><input type="number" className="prop-input" value={Math.round(selectedActor.y)} onChange={e => updateActor('y', parseInt(e.target.value))} /></div>
                            <div className="prop-row"><label className="prop-label">TAILLE</label><input type="number" step="0.1" className="prop-input" value={selectedActor.scale} onChange={e => updateActor('scale', parseFloat(e.target.value))} /></div>
                            <div style={{marginTop:'15px', paddingTop:'10px', borderTop:'1px solid #334155'}}>
                                <label className="prop-label">ACTIONS DISPO</label>
                                {selectedActor.actions.length === 0 && <div className="text-center text-xs text-slate-600 italic">Aucune</div>}
                                {selectedActor.actions.map(act => (
                                    <div key={act.id} style={{background:'#020617', padding:'4px', borderRadius:'4px', marginBottom:'4px', fontSize:'0.7rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <span>{act.name}</span><span style={{color:'#64748b'}}>{act.frames.length}f</span>
                                    </div>
                                ))}
                            </div>
                            <button style={{width:'100%', marginTop:'10px', padding:'6px', background:'#ef4444', color:'white', border:'none', borderRadius:'4px', fontWeight:'bold', fontSize:'0.6rem', cursor:'pointer'}} onClick={(e) => deleteActor(e, selectedActor.id)}>SUPPRIMER</button>
                        </>
                    ) : <div className="text-center text-xs text-slate-500">Aucune sélection</div>}
                </div>

                <div className="panel-header">LUTINS</div>
                <div className="scroll-area objects-list">
                    <div className="create-obj-full" onClick={createActor}>+ NOUVEAU</div>
                    {activeScene.actors.map(actor => (
                        <div key={actor.id} className={`obj-card ${selectedActorId === actor.id ? 'selected' : ''}`} onClick={() => setSelectedActorId(actor.id)}>
                            <div className="obj-thumb-mini">
                                <AssetThumb url={actor.costumes[0]?.url} fallbackEmoji={getEmoji(actor.name)} className="" />
                            </div>
                            <div className="obj-name">{actor.name}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}