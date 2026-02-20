// @signatures: StudioCenterPanel, openQuizManager, handleSetProduction
import React, { useState } from 'react';
import { api } from '../../../../services/api';

/**
 * 🎬 PANNEAU CENTRAL STUDIO FUSIONNÉ V2
 * REPAIRS:
 * - Restored Actor Property Controls (Name/Scale).
 * - Maintains Production Mode Logic.
 */
export default function StudioCenterPanel({
    stageRef, currentScene, resolveUrl, selectedActorId, selectedAction,
    isPreviewPlaying, previewFrameIdx, selectedFrameIdx, handleStageMouseDown,
    selectedActor, handleUpdateProp, saveProject, setIsPlaying, project,
    code, setCode
}) {
    const [showQuizManager, setShowQuizManager] = useState(false);
    const [testGame, setTestGame] = useState(null);
    const [loading, setLoading] = useState(false);

    const openQuizManager = async () => {
        setLoading(true);
        try {
            const data = await api.get('/games/test-data');
            if (data) setTestGame(data);
            setShowQuizManager(true);
        } catch(e) {}
        setLoading(false);
    };

    const handleSetProduction = async () => {
        if (!testGame) return;
        try {
            await api.post('/games', { ...testGame, isTestGame: true });
            alert("✨ Univers mis en production !");
        } catch(e) { alert("Erreur prod"); }
    };

    const toggleProjectProduction = async () => {
        if (!project) return;
        const next = { ...project, isProduction: !project.isProduction };
        await saveProject(next);
    };

    return (
        <div className="studio-col-center custom-scrollbar relative">
            {showQuizManager && testGame && (
                <div className="fixed inset-0 z-[10000] bg-slate-900/95 flex items-center justify-center p-10 animate-in zoom-in">
                    <div className="bg-white w-full max-w-4xl rounded-[40px] p-10 flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black uppercase">Configuration de l'Univers</h2>
                            <button onClick={() => setShowQuizManager(false)} className="text-2xl font-black">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto mb-6">
                            <p className="bg-indigo-50 p-6 rounded-2xl text-indigo-700 font-bold mb-6 text-center">
                                L'univers visuel actuel sera testé avec l'activité :<br/> 
                                <span className="text-2xl uppercase">{testGame.title}</span>
                            </p>
                            <button onClick={handleSetProduction} className="w-full py-6 bg-emerald-500 text-white font-black rounded-3xl shadow-xl uppercase hover:scale-[1.02] transition-transform">
                                🌟 Déclarer comme univers de Production (Julian y aura accès)
                            </button>
                        </div>
                        <button onClick={() => setShowQuizManager(false)} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase">Fermer</button>
                    </div>
                </div>
            )}

            <div ref={stageRef} className="stage-wrapper" style={{ backgroundImage: currentScene?.backdrops?.[currentScene.currentBackdropIdx || 0]?.url ? `url(${resolveUrl(currentScene.backdrops[currentScene.currentBackdropIdx].url)})` : 'none' }}>
                <button
                    onClick={toggleProjectProduction}
                    className={`absolute top-3 right-3 z-20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${
                        project?.isProduction
                            ? 'bg-amber-500 text-white border-amber-400'
                            : 'bg-emerald-500 text-white border-emerald-400'
                    }`}
                    title="Basculer le statut du projet"
                >
                    {project?.isProduction ? '🟠 PRODUCTION' : '🟢 PRÊT'}
                </button>
                {currentScene?.actors?.map((a) => { 
                    const isSelected = selectedActorId === a.id; 
                    let action = isSelected ? selectedAction : (a.actions?.find(act => act.name.toUpperCase() === "IDLE") || a.actions?.[0]); 
                    let frameIdx = isSelected ? (isPreviewPlaying ? previewFrameIdx : (selectedFrameIdx !== null ? selectedFrameIdx : 0)) : 0; 
                    return (
                        <div key={a.id} onMouseDown={e => handleStageMouseDown(e, a.id)} className={`actor-sprite ${isSelected ? 'selected' : ''}`} style={{ left: `${a.initialX}%`, top: `${a.initialY}%`, width: `${150 * (a.scale || 1)}px`, height: `${150 * (a.scale || 1)}px`, transform: `translate(-50%, -50%) rotate(${a.direction || 0}deg)`, zIndex: isSelected ? 100 : 10 }}>
                            {action?.frames?.[frameIdx]?.url && <img src={resolveUrl(action.frames[frameIdx].url)} alt="" />}
                        </div>
                    ); 
                })}
            </div>

            <div className="props-bar">
                {/* RESTAURATION DES CONTRÔLES ACTEUR */}
                <div className="prop-item">
                    <span className="prop-label">Nom</span>
                    <input className="prop-input" value={selectedActor?.name || ""} onChange={e => handleUpdateProp('name', e.target.value)} />
                </div>
                <div className="prop-item">
                    <span className="prop-label">Taille (%)</span>
                    <input type="number" className="prop-input" value={Math.round((selectedActor?.scale || 1) * 100)} onChange={e => handleUpdateProp('scale', parseFloat(e.target.value)/100)} />
                </div>
                
                <button onClick={openQuizManager} className={`btn-view-quiz ${loading ? 'animate-pulse' : ''}`}>
                    {loading ? '...' : '🎓 CONFIG TEST & PROD'}
                </button>
                <button onClick={() => { saveProject(); setIsPlaying(true); }} className="ml-auto bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] shadow-lg tracking-widest">▶ TESTER</button>
            </div>

            <div className="code-editor-box">
                <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" placeholder="Script Condamine Engine..." />
            </div>
        </div>
    );
}
