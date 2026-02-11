// @signatures: StudioLeftPanel, handleSelectAction, handleAddAction
import React, { useState, useEffect, useRef } from 'react';
import SoundExpert from '../../../../services/SoundExpert';

export default function StudioLeftPanel({
    leftTab, setLeftTab, selectedActor, selectedActionIdx, setSelectedActionIdx, 
    selectedGlobalSoundIdx, setSelectedGlobalSoundIdx,
    setIsPreviewPlaying, saveProject, project, selectedSceneIdx, selectedActorId,
    selectedAction, handleUpdateActionSpeed, isPreviewPlaying,
    previewFrameIdx, selectedFrameIdx, setSelectedFrameIdx, setDraggedFrameIdx,
    handleReorderFrame, resolveUrl, handleDeleteFrame, frameUploadRef,
    setFrameToErase, setShowSoundModal, handleDeleteSound, handleEditSound,
    setPreviewFrameIdx
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
            if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

            if (selectedAction.frames?.length > 0) {
                visualInterval = setInterval(() => {
                    setPreviewFrameIdx(idx => (idx + 1) % selectedAction.frames.length);
                }, selectedAction.speed || 100);
            }

            if (selectedAction.sounds?.length > 0) {
                const play = async () => {
                    if (!isPlaying) return;
                    const snd = selectedAction.sounds[soundIndex];
                    const buf = await SoundExpert.decodeAudio(resolveUrl(snd.url), audioCtxRef.current);
                    if (buf) {
                        const source = audioCtxRef.current.createBufferSource();
                        source.buffer = buf; source.connect(audioCtxRef.current.destination);
                        source.onended = () => { soundIndex = (soundIndex + 1) % selectedAction.sounds.length; play(); };
                        source.start(0);
                        activeSourcesRef.current.push(source);
                    }
                };
                play();
            }
        } else {
            stopAllSounds();
            setPreviewFrameIdx(0);
        }
        return () => { isPlaying = false; clearInterval(visualInterval); stopAllSounds(); };
    }, [isPreviewPlaying, selectedAction]);

    const handleAddAction = () => {
        const name = prompt("Nom de l'action :"); if(!name) return;
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        actor.actions.push({ name: name.toUpperCase(), frames: [], sounds: [], speed: 100 });
        saveProject(next);
    };

    return (
        <div className="studio-col-left">
            <div className="studio-tab-header">
                <button className={`studio-tab-btn ${leftTab === 'actions' ? 'active' : ''}`} onClick={() => setLeftTab('actions')}>⚡ Actions</button>
                <button className={`studio-tab-btn ${leftTab === 'sounds' ? 'active' : ''}`} onClick={() => setLeftTab('sounds')}>🎵 Sons</button>
            </div>

            <div className="studio-action-list custom-scrollbar">
                {selectedActor?.actions?.map((act, idx) => (
                    <div key={idx} onClick={() => setSelectedActionIdx(idx)} className={`action-item ${selectedActionIdx === idx ? 'selected' : ''}`}>
                        <span>{act.name}</span>
                        <div className="flex gap-2 items-center">
                            <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-400">{act.frames?.length || 0}f</span>
                            {act.sounds?.length > 0 && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded">🎵</span>}
                        </div>
                    </div>
                ))}
                <button className="v84-add-btn-minimal" onClick={handleAddAction}>+ Action</button>
            </div>

            {selectedAction && (
                <div className="studio-sequencer-box">
                    <div className="seq-header">
                        <span className="seq-label">Séquenceur</span>
                        <div className="seq-controls">
                            <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(-20)}>-</button>
                            <span className="speed-indicator">{selectedAction.speed}ms</span>
                            <button className="btn-mini-ctrl" onClick={() => handleUpdateActionSpeed(20)}>+</button>
                            <button className="btn-preview-play" onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}>{isPreviewPlaying ? '⏹️' : '▶️'}</button>
                        </div>
                    </div>
                    <div className="seq-frames-grid">
                        {selectedAction.frames.map((f, i) => (
                            <div key={i} className={`seq-frame ${previewFrameIdx === i ? 'active' : ''}`} onClick={() => setSelectedFrameIdx(i)}>
                                <img src={resolveUrl(f.url)} />
                            </div>
                        ))}
                        <div className="seq-frame seq-frame-add" onClick={() => frameUploadRef.current.click()}>+</div>
                    </div>
                    <div className="eraser-bar">
                        <button className="btn-tool-pen" onClick={() => setShowSoundModal(true)}>🔊 AJOUTER SON</button>
                    </div>
                </div>
            )}
        </div>
    );
}
