import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';

const AssetThumb = ({ url, className, fallbackEmoji, style }) => {
    const [hasError, setHasError] = useState(false);
    useEffect(() => { setHasError(false); }, [url]);
    if (!url || hasError) return <div className={`flex items-center justify-center w-full h-full text-2xl ${className}`} style={style}><span className="opacity-50 select-none">{fallbackEmoji || '📦'}</span></div>;
    return <img src={url} className={className} style={style} onError={() => setHasError(true)} draggable="false" alt="asset" />;
};

export default function StudioDashboard({ user }) {

    const [project, setProject] = useState({
        _id: null,
        title: "Nouveau Jeu IA",
        teacherId: user.id || user._id,
        scenes: [{ id: 1, name: "Scène Principale", actors: [], timeline: [] }],
        generatedCode: ""
    });

    const [activeSceneIdx, setActiveSceneIdx] = useState(0);
    const [selectedActorId, setSelectedActorId] = useState(null);
    
    // UI STATES
    const [viewMode, setViewMode] = useState('DESIGN'); 
    const [processingMsg, setProcessingMsg] = useState("");
    const [gameIdea, setGameIdea] = useState("");
    const [gameInstance, setGameInstance] = useState(null);

    const fileInputRef = useRef(null);
    const remixInputRef = useRef(null);
    const directImportRef = useRef(null);

    const activeScene = project.scenes[activeSceneIdx];
    const selectedActor = activeScene.actors.find(a => a.id === selectedActorId);

    // --- UPLOAD & PERSISTENCE ---
    const uploadBlob = async (blob, filename) => {
        const formData = new FormData();
        formData.append('file', blob, filename);
        try {
            const res = await fetch('/api/studio/upload', { method: 'POST', body: formData });
            const data = await res.json();
            return data.url;
        } catch (e) { console.error(e); return null; }
    };

    // SAUVEGARDE ROBUSTE ET NETTOYÉE
    const saveProject = async (silent = false) => {
        if (!silent) setProcessingMsg("Sauvegarde...");
        try {
            const payload = { ...project, teacherId: user.id || user._id };
            
            // NETTOYAGE CRITIQUE : Si l'ID est null ou "null", on le vire totalement
            if (!payload._id || payload._id === 'null') delete payload._id;

            const res = await fetch('/api/studio/projects', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(payload) 
            });
            
            if(!res.ok) {
                const errTxt = await res.text();
                throw new Error("Erreur serveur: " + errTxt);
            }
            
            const data = await res.json();
            
            // Mise à jour immédiate
            const newId = data._id;
            setProject(prev => ({ ...prev, _id: newId }));
            
            if (!silent) {
                setProcessingMsg("");
                alert("Sauvegardé ! 💾");
            }
            return newId;
        } catch (e) { 
            console.error("SAVE ERROR:", e);
            setProcessingMsg(""); 
            if (!silent) alert("Erreur sauvegarde : " + e.message); 
            return null; 
        }
    };

    // --- IMPORT DIRECT ---
    const handleDirectImport = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedActor) return;
        setProcessingMsg("Importation...");
        const url = await uploadBlob(file, file.name);
        if (url) injectCostumes([url], "Import");
        else alert("Erreur upload");
        setProcessingMsg("");
        e.target.value = null;
    };

    // --- AI GENERATION ---
    const handleRemix = async (e) => {
        const file = e.target.files[0];
        if(!file || !selectedActor) return;
        setProcessingMsg("Remix IA (Vision + Gen)...");
        const fd = new FormData(); fd.append('file', file);
        try {
            const res = await fetch('/api/studio/remix-asset', { method: 'POST', body: fd });
            const data = await res.json();
            if(data.ok) injectCostumes([data.url], "Remix");
        } catch(e) { alert("Erreur Remix"); }
        setProcessingMsg("");
        e.target.value = null;
    };

    const generateGameCode = async () => {
        if (!gameIdea) return alert("Décrivez votre idée de jeu !");
        if (activeScene.actors.length === 0) return alert("Ajoutez au moins un acteur !");
        
        setProcessingMsg("Sauvegarde & Génération...");

        // 1. FORCER LA SAUVEGARDE
        const targetId = await saveProject(true);
        
        if (!targetId) {
            setProcessingMsg("");
            return alert("Erreur critique : Impossible de sauvegarder avant génération. Vérifiez la console.");
        }
        
        // 2. APPEL IA
        try {
            const res = await fetch('/api/studio/generate-code', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ projectId: targetId, gameIdea })
            });
            
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erreur serveur IA");
            }

            const data = await res.json();
            if (data.ok) {
                setProject(prev => ({ ...prev, generatedCode: data.code }));
                setViewMode('CODE');
            }
        } catch(e) { 
            console.error(e);
            alert("Erreur IA : " + e.message); 
        }
        setProcessingMsg("");
    };

    // --- PLAY ENGINE ---
    const runGame = () => {
        if (!project.generatedCode) return alert("Aucun code généré !");
        setViewMode('PLAY');
        setTimeout(() => {
            const canvas = document.getElementById('game-canvas');
            if (!canvas) return;
            const assets = {};
            let loaded = 0;
            const actors = activeScene.actors;
            if(actors.length === 0) return alert("Pas d'acteurs !");
            const checkStart = () => { if (loaded === actors.length) launch(canvas, assets); };
            actors.forEach(a => {
                const url = (a.costumes && a.costumes[0]) ? a.costumes[0].url : null;
                if (url) {
                    const img = new Image(); img.src = url;
                    img.onload = () => { assets[a.id] = img; loaded++; checkStart(); };
                    img.onerror = () => { loaded++; checkStart(); };
                } else { loaded++; checkStart(); }
            });
        }, 100);
    };

    const launch = (canvas, assets) => {
        try {
            if (gameInstance && gameInstance.destroy) gameInstance.destroy();
            const code = project.generatedCode;
            const safeCode = code.replace(/window\.|document\.|alert\(|eval\(/g, '//blocked');
            const factory = new Function(` ${safeCode} return MiniGame; `);
            const GameClass = factory();
            const game = new GameClass(canvas, assets);
            setGameInstance(game);
            let lastTime = 0;
            const loop = (time) => {
                const dt = (time - lastTime) / 1000; lastTime = time;
                if (game.update) game.update(dt);
                if (game.draw) game.draw(canvas.getContext('2d'));
                if (document.getElementById('game-canvas')) requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        } catch (e) { alert("Erreur code :\n" + e.message); }
    };

    const injectCostumes = (urls, baseName) => {
        if (!selectedActor) return;
        setProject(prev => {
            const next = { ...prev };
            const act = next.scenes[activeSceneIdx].actors.find(a => a.id === selectedActorId);
            if (act) {
                urls.forEach((url, i) => act.costumes.push({ id: `c_${Date.now()}_${i}`, url, name: `${baseName}_${act.costumes.length + 1}` }));
                if (act.costumes.length === urls.length) act.currentCostumeIdx = 0;
            }
            return next;
        });
    };
    const createActor = () => {
        const newId = `a_${Date.now()}`;
        setProject(prev => {
            const next = { ...prev };
            next.scenes[activeSceneIdx].actors.push({ id: newId, name: "Nouvel Acteur", x: 50, y: 50, scale: 1, currentCostumeIdx: 0, costumes: [] });
            return next;
        });
        setSelectedActorId(newId);
    };
    const updateActor = (k, v) => {
        setProject(prev => {
            const next = { ...prev };
            const act = next.scenes[activeSceneIdx].actors.find(a => a.id === selectedActorId);
            if(act) act[k] = v;
            return next;
        });
    };

    return (
        <div className="studio-wrapper">
            <input type="file" ref={remixInputRef} style={{display:'none'}} onChange={handleRemix} accept="image/*" />
            <input type="file" ref={directImportRef} style={{display:'none'}} onChange={handleDirectImport} accept="image/*" />
            
            {processingMsg && <div className="overlay"><div className="modal-box"><h3 className="animate-pulse">{processingMsg}</h3></div></div>}

            {/* GAUCHE */}
            <div className="studio-sidebar">
                <div className="panel-header">ACTEURS</div>
                <div className="scroll-area">
                    <div className="create-obj-full" onClick={createActor}>+ AJOUTER ACTEUR</div>
                    {activeScene.actors.map(a => (
                        <div key={a.id} className={`obj-card ${selectedActorId === a.id ? 'selected' : ''}`} onClick={() => setSelectedActorId(a.id)}>
                            <div className="obj-thumb-mini"><AssetThumb url={a.costumes[0]?.url} /></div>
                            <div className="obj-name">{a.name}</div>
                        </div>
                    ))}
                </div>
                {selectedActor && (
                    <div className="p-4 border-t border-slate-700 flex flex-col gap-2">
                        <button className="w-full bg-purple-600 text-white py-2 rounded font-bold text-xs" onClick={() => remixInputRef.current.click()}>✨ REMIX IMAGE (IA)</button>
                        <button className="w-full bg-slate-600 text-white py-2 rounded font-bold text-xs" onClick={() => directImportRef.current.click()}>📂 IMPORT LOCAL</button>
                    </div>
                )}
            </div>

            {/* CENTRE */}
            <div className="studio-center">
                <div className="stage-toolbar gap-4">
                    <button onClick={() => setViewMode('DESIGN')} className={viewMode==='DESIGN'?'text-white':'text-slate-500'}>🎨 DESIGN</button>
                    <button onClick={() => setViewMode('CODE')} className={viewMode==='CODE'?'text-white':'text-slate-500'}>💻 CODE</button>
                    <button onClick={runGame} className="bg-green-500 text-white px-4 py-1 rounded font-bold">▶ JOUER</button>
                    <button onClick={() => saveProject(false)} className="bg-blue-600 text-white px-4 py-1 rounded font-bold ml-auto">💾 SAUVER</button>
                </div>

                {viewMode === 'DESIGN' && (
                    <div className="stage-wrapper" onClick={() => setSelectedActorId(null)}>
                        <div className="stage-canvas relative">
                            {activeScene.actors.map(a => (
                                <div key={a.id} className={`actor-on-stage ${selectedActorId === a.id ? 'selected' : ''}`}
                                     style={{ left: a.x+'%', top: a.y+'%', transform: `translate(-50%, -50%) scale(${a.scale})` }}
                                     onMouseDown={(e) => { e.stopPropagation(); setSelectedActorId(a.id); }}>
                                    <AssetThumb url={a.costumes[0]?.url} className="" style={{width:'100px', height:'100px', objectFit:'contain'}} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {viewMode === 'CODE' && (
                    <div className="flex-1 bg-slate-900 p-4 overflow-auto">
                        <textarea className="w-full h-full bg-black text-green-400 font-mono text-xs p-4 rounded border border-slate-700" 
                                  value={project.generatedCode} onChange={(e) => setProject({...project, generatedCode: e.target.value})} 
                                  placeholder="Le code généré par l'IA apparaîtra ici..." />
                    </div>
                )}

                {viewMode === 'PLAY' && (
                    <div className="flex-1 bg-black flex items-center justify-center">
                        <canvas id="game-canvas" width="640" height="360" className="bg-white shadow-2xl rounded" />
                    </div>
                )}

                <div className="h-[120px] bg-slate-900 border-t border-slate-700 p-4 flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">GÉNÉRATEUR DE JEU (GEMINI 2.0)</span>
                    <div className="flex gap-2">
                        <input className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm" 
                               placeholder="Décrivez votre jeu (ex: Le héros doit éviter les zombies et attraper les pièces...)" 
                               value={gameIdea} onChange={e => setGameIdea(e.target.value)} />
                        <button onClick={generateGameCode} className="bg-pink-600 text-white px-6 rounded font-black text-sm hover:bg-pink-500 transition-colors">GÉNÉRER LE CODE 🚀</button>
                    </div>
                </div>
            </div>

            {/* DROITE */}
            <div className="studio-right-panel">
                <div className="panel-header">PROPRIÉTÉS</div>
                {selectedActor ? (
                    <div className="p-4 space-y-2">
                        <div className="prop-row"><label className="prop-label">NOM</label><input className="prop-input" value={selectedActor.name} onChange={e => updateActor('name', e.target.value)} /></div>
                        <div className="prop-row"><label className="prop-label">TAILLE</label><input type="number" step="0.1" className="prop-input" value={selectedActor.scale} onChange={e => updateActor('scale', parseFloat(e.target.value))} /></div>
                    </div>
                ) : <div className="p-4 text-center text-xs text-slate-500">Sélectionnez un acteur</div>}
            </div>
        </div>
    );
}