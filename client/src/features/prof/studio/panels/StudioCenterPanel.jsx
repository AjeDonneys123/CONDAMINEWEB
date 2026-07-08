// @signatures: StudioCenterPanel, openQuizManager, handleSetProduction
import React, { useState } from 'react';
import { api } from '../../../../services/api';

function buildStudioMultiplicationGame(multiplier) {
    const questions = Array.from({ length: 10 }, (_, index) => {
        const multiplicand = index + 1;
        const answer = multiplier * multiplicand;
        const options = [
            answer,
            answer + multiplier,
            Math.max(0, answer - multiplier),
            answer + multiplier * 2
        ]
            .filter((value, pos, arr) => arr.indexOf(value) === pos)
            .slice(0, 4);

        while (options.length < 4) {
            options.push(answer + multiplier * (options.length + 2));
        }

        const shuffled = options
            .map((value) => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map((item) => String(item.value));

        return {
            q: `${multiplier} x ${multiplicand}`,
            options: shuffled,
            a: shuffled.findIndex((value) => Number(value) === answer)
        };
    });

    return {
        title: `TABLE DE ${multiplier}`,
        type: 'zombie',
        subject: 'MATHEMATIQUES',
        levels: [
            {
                name: `Table de ${multiplier}`,
                questions,
                intro: {}
            }
        ],
        globalIntro: { sheetUrl: '', videoUrl: '' }
    };
}

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
    code, setCode, setIsPreviewPlaying
}) {
    const [showQuizManager, setShowQuizManager] = useState(false);
    const [testGame, setTestGame] = useState(null);
    const [loading, setLoading] = useState(false);
    const [bridgeBusy, setBridgeBusy] = useState(false);

    const projectKey = String(project?._id || project?.localSessionId || '').trim();

    const handleImportLocalCode = async () => {
        if (!projectKey) return alert("Projet local sans ID.");
        setBridgeBusy(true);
        try {
            const res = await fetch(`/api/studio/local-code/${encodeURIComponent(projectKey)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Import impossible');
            setCode(String(data.code || ''));
            alert("Code importé depuis fichier local.");
        } catch (e) {
            alert(`Import local échoué: ${e.message}`);
        }
        setBridgeBusy(false);
    };

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

    const applyMultiplicationPreset = (multiplier) => {
        setTestGame(buildStudioMultiplicationGame(multiplier));
        setShowQuizManager(true);
    };

    const toggleProjectProduction = async () => {
        if (!project) return;
        const next = { ...project, isProduction: !project.isProduction };
        await saveProject(next);
    };

    const isStarshipProject = /starship|bosscharge|supermissile|boss final/i.test(String(code || '') + ' ' + String(project?.title || ''));
    const selectedActorIdx = currentScene?.actors?.findIndex(a => a.id === selectedActorId) ?? -1;
    const isStarshipCoreActor = isStarshipProject && (selectedActorIdx === 0 || selectedActorIdx === 1);
    const expectedStarshipName = selectedActorIdx === 0 ? 'P1' : (selectedActorIdx === 1 ? 'P2' : '');

    const handleNameChange = (rawValue) => {
        const value = String(rawValue || '').trim();
        if (isStarshipCoreActor) {
            handleUpdateProp('name', expectedStarshipName);
            return;
        }
        if (!value) return;
        handleUpdateProp('name', value);
    };

    const handleScaleChange = (rawValue) => {
        const numeric = Number(rawValue);
        if (!Number.isFinite(numeric)) return;
        const clampedPct = Math.max(10, Math.min(300, numeric));
        handleUpdateProp('scale', clampedPct / 100);
    };

    const launchGameTest = async (quickTest = false) => {
        await saveProject();
        let activeTestGame = testGame;
        if (!activeTestGame) {
            try {
                activeTestGame = await api.get('/games/test-data');
                if (activeTestGame) setTestGame(activeTestGame);
            } catch (e) {
                console.error('Chargement des questions de test impossible', e);
            }
        }
        setIsPlaying({ testGame: activeTestGame || null, quickTest });
    };

    const handlePlayTest = () => launchGameTest(false);
    const handleQuickPlay = () => launchGameTest(true);

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
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                <button onClick={() => applyMultiplicationPreset(2)} className="py-4 bg-slate-100 text-slate-900 font-black rounded-2xl uppercase">
                                    Table de 2
                                </button>
                                <button onClick={() => applyMultiplicationPreset(5)} className="py-4 bg-slate-100 text-slate-900 font-black rounded-2xl uppercase">
                                    Table de 5
                                </button>
                                <button onClick={() => applyMultiplicationPreset(10)} className="py-4 bg-slate-100 text-slate-900 font-black rounded-2xl uppercase">
                                    Table de 10
                                </button>
                            </div>
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
                    <input
                        className="prop-input"
                        value={isStarshipCoreActor ? expectedStarshipName : (selectedActor?.name || "")}
                        onChange={e => handleNameChange(e.target.value)}
                        title={isStarshipCoreActor ? 'Starship: noms verrouillés sur P1/P2' : ''}
                    />
                </div>
                <div className="prop-item">
                    <span className="prop-label">Taille (%)</span>
                    <input
                        type="number"
                        min="10"
                        max="300"
                        className="prop-input"
                        value={Math.round((selectedActor?.scale || 1) * 100)}
                        onChange={e => handleScaleChange(e.target.value)}
                    />
                </div>
                
                <button onClick={openQuizManager} className={`btn-view-quiz ${loading ? 'animate-pulse' : ''}`}>
                    {loading ? '...' : '🎓 CONFIG TEST & PROD'}
                </button>
                <button
                    type="button"
                    onClick={handleQuickPlay}
                    title="Lancer immédiatement le jeu pour tester les déplacements"
                    style={{
                        marginLeft: 'auto',
                        minWidth: 118,
                        padding: '10px 16px',
                        border: 0,
                        borderRadius: 12,
                        background: '#0ea5e9',
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 950,
                        letterSpacing: '0.06em',
                        cursor: 'pointer',
                        opacity: 1,
                        boxShadow: '0 8px 18px rgba(14, 165, 233, 0.28)'
                    }}
                >
                    ▶ PLAY
                </button>
                <button onClick={handlePlayTest} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] shadow-lg tracking-widest">▶ TESTER</button>
            </div>

            <div className="code-editor-box">
                <div className="flex items-center gap-2 mb-2">
                    <button
                        onClick={handleImportLocalCode}
                        className="bg-slate-200 text-slate-800 px-3 py-1 rounded-lg text-[10px] font-black tracking-wider"
                        disabled={bridgeBusy || !projectKey}
                    >
                        {bridgeBusy ? '...' : '⬇ IMPORT LOCAL'}
                    </button>
                </div>
                <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" placeholder="Script Condamine Engine..." />
            </div>
        </div>
    );
}
