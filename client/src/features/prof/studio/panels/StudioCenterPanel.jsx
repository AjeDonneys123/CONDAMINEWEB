// @signatures: StudioCenterPanel, handleUpdateMetaData, handleUploadTestSheet
import React, { useState } from 'react';
import { api } from '../../../../services/api';

export default function StudioCenterPanel({
    stageRef, currentScene, resolveUrl, selectedActorId, selectedAction,
    isPreviewPlaying, previewFrameIdx, selectedFrameIdx, handleStageMouseDown,
    selectedActor, handleUpdateProp, handleViewTestQuiz, saveProject, setIsPlaying,
    code, setCode
}) {
    const [showQuizManager, setShowQuizManager] = useState(false);
    const [testGame, setTestGame] = useState(null);
    const [loading, setLoading] = useState(false);

    // --- GESTION DES DONNÉES TEST ---
    const openQuizManager = async () => {
        setLoading(true);
        const data = await api.get('/games/test-data');
        if (data) setTestGame(data);
        setShowQuizManager(true);
        setLoading(false);
    };

    const handleUpdateMetaData = async (levelIdx, field, value) => {
        const next = { ...testGame };
        if (levelIdx === 'GLOBAL') {
            next.globalIntro = { ...next.globalIntro, [field]: value };
        } else {
            next.levels[levelIdx].intro = { ...next.levels[levelIdx].intro, [field]: value };
        }
        setTestGame(next);
        await api.post('/games', next); // On sauve directement dans le GameLevel de test
    };

    const handleUploadTestSheet = async (e, levelIdx) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/games/upload-asset', { method: 'POST', body: fd }).then(r => r.json());
        if (res.url) handleUpdateMetaData(levelIdx, 'sheetUrl', res.url);
    };

    return (
        <div className="studio-col-center custom-scrollbar relative">
            {/* MODALE DE GESTION DU QUIZ TEST (REMPLACE LA MODALE POURRIE) */}
            {showQuizManager && testGame && (
                <div className="fixed inset-0 z-[10000] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-10 animate-in zoom-in">
                    <div className="bg-white w-full max-w-5xl h-full rounded-[40px] shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase">Configuration du Quiz Test</h2>
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Contenu du jeu : {testGame.title}</p>
                            </div>
                            <button onClick={() => setShowQuizManager(false)} className="w-12 h-12 rounded-full bg-white border-2 flex items-center justify-center font-black hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                            {testGame.levels.map((lvl, idx) => (
                                <div key={idx} className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                                    <h3 className="text-lg font-black text-slate-700 mb-4 uppercase">📖 NIVEAU {idx + 1} : {lvl.name}</h3>
                                    <div className="grid grid-cols-2 gap-8">
                                        {/* GESTION FICHE */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Fiche d'étude (Image)</label>
                                            <div className="h-40 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                                                {lvl.intro?.sheetUrl ? (
                                                    <img src={resolveUrl(lvl.intro.sheetUrl)} className="w-full h-full object-contain" />
                                                ) : <span className="text-slate-300 font-bold uppercase text-[10px]">Aucune Fiche</span>}
                                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleUploadTestSheet(e, idx)} />
                                                    <span className="text-white font-black text-xs uppercase">Remplacer 📤</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* GESTION VIDÉO */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Lien Vidéo (YouTube)</label>
                                            <div className="flex flex-col gap-3">
                                                <input 
                                                    className="w-full p-4 rounded-xl border-2 border-slate-100 font-bold text-sm outline-none focus:border-indigo-500" 
                                                    placeholder="Collez l'URL YouTube ici..." 
                                                    value={lvl.intro?.videoUrl || ""}
                                                    onChange={(e) => handleUpdateMetaData(idx, 'videoUrl', e.target.value)}
                                                />
                                                {lvl.intro?.videoUrl && (
                                                    <div className="aspect-video rounded-xl bg-black overflow-hidden border-2 border-slate-200">
                                                        <iframe className="w-full h-full" src={lvl.intro.videoUrl.replace("watch?v=", "embed/")} frameBorder="0"></iframe>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 border-t pt-4">
                                        <span className="text-[9px] font-black text-slate-300 uppercase">Questions dans ce niveau : {lvl.questions?.length || 0}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="p-6 bg-slate-50 border-t flex justify-center">
                            <button onClick={() => setShowQuizManager(false)} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-xl hover:scale-105 transition-all">TERMINER LA CONFIGURATION</button>
                        </div>
                    </div>
                </div>
            )}

            <div ref={stageRef} className="stage-wrapper" style={{ backgroundImage: currentScene?.backdrops?.[currentScene.currentBackdropIdx || 0]?.url ? `url(${resolveUrl(currentScene.backdrops[currentScene.currentBackdropIdx].url)})` : 'none' }}>
                {currentScene?.actors?.map((a) => { 
                    const isSelected = selectedActorId === a.id; 
                    let action = isSelected ? selectedAction : (a.actions?.find(act => act.name.toUpperCase() === "IDLE") || a.actions?.[0]); 
                    let frameIdx = isSelected ? (isPreviewPlaying ? previewFrameIdx : (selectedFrameIdx !== null ? selectedFrameIdx : 0)) : 0; 
                    return (
                        <div key={a.id} onMouseDown={e => handleStageMouseDown(e, a.id)} className={`actor-sprite ${isSelected ? 'selected' : ''}`} style={{ left: `${a.initialX}%`, top: `${a.initialY}%`, width: `${150 * (a.scale || 1)}px`, height: `${150 * (a.scale || 1)}px`, transform: `translate(-50%, -50%) rotate(${a.direction || 0}deg)`, zIndex: isSelected ? 100 : 10 }}>
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
                {/* BOUTON MODIFIÉ ICI */}
                <button onClick={openQuizManager} className={`btn-view-quiz ${loading ? 'animate-pulse opacity-50' : ''}`}>
                    {loading ? '...' : '🎓 CONFIG QUIZ TEST'}
                </button>
                <button onClick={() => { saveProject(); setIsPlaying(true); }} className="ml-auto bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] shadow-lg">▶ TESTER</button>
            </div>

            <div className="code-editor-box">
                <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" />
            </div>
        </div>
    );
}
