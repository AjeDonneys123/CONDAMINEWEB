import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';

const AssetThumb = ({ url, className, fallbackEmoji, style }) => {
    const [hasError, setHasError] = useState(false);
    useEffect(() => { setHasError(false); }, [url]);
    if (!url || hasError) return <div className={`flex items-center justify-center w-full h-full text-2xl ${className}`} style={style}><span className="opacity-50 select-none">{fallbackEmoji || '📦'}</span></div>;
    return <img src={url} className={className} style={style} onError={() => setHasError(true)} draggable="false" alt="asset" />;
};

export default function StudioDashboard({ user }) {
    if (!user) return <div className="p-10 text-white font-bold">Chargement profil...</div>;

    const [project, setProject] = useState({
        _id: null,
        title: "Nouveau Jeu IA",
        teacherId: user.id || user._id, 
        scenes: [{ name: "Scène Principale", actors: [], timeline: [] }],
        generatedCode: ""
    });

    const [activeSceneIdx, setActiveSceneIdx] = useState(0);
    const [selectedActorId, setSelectedActorId] = useState(null);
    const [viewMode, setViewMode] = useState('DESIGN'); 
    const [processingMsg, setProcessingMsg] = useState("");
    
    // --- ETATS IA ---
    const [aiPrompt, setAiPrompt] = useState(""); 
    const [consoleInput, setConsoleInput] = useState(""); 
    const [gameInstance, setGameInstance] = useState(null);
    const [logs, setLogs] = useState([]);

    const fileInputRef = useRef(null);
    const remixInputRef = useRef(null);
    const directImportRef = useRef(null);
    const consoleEndRef = useRef(null); 

    const activeScene = project.scenes[activeSceneIdx];
    const selectedActor = activeScene.actors.find(a => a.id === selectedActorId);

    const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString().split(' ')[0];
        setLogs(prev => [...prev, { time, msg: String(msg), type }].slice(-50));
        if (type === 'error') {
            setAiPrompt(prev => prev.includes(String(msg)) ? prev : `Corrige cette erreur : ${msg}`);
        }
    };

    useEffect(() => {
        consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const uploadBlob = async (blob, filename) => {
        const formData = new FormData();
        formData.append('file', blob, filename);
        try {
            const res = await fetch('/api/studio/upload', { method: 'POST', body: formData });
            const data = await res.json();
            return data.url;
        } catch (e) { console.error(e); return null; }
    };

    const saveProject = async (silent = false) => {
        if (!silent) setProcessingMsg("Sauvegarde...");
        try {
            const tId = user.id || user._id;
            const payload = JSON.parse(JSON.stringify({ ...project, teacherId: tId }));
            
            if (!payload._id || payload._id === 'null' || payload._id.length < 10) delete payload._id;
            if (payload.scenes && Array.isArray(payload.scenes)) {
                payload.scenes = payload.scenes.map(s => {
                    if (s._id && (typeof s._id !== 'string' || s._id.length !== 24)) delete s._id;
                    if (s.id && (typeof s.id !== 'string' || s.id.length !== 24)) delete s.id;
                    return s;
                });
            }

            const res = await fetch('/api/studio/projects', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(!res.ok) throw new Error("Erreur serveur");
            
            const data = await res.json();
            const newId = data._id;
            setProject(prev => ({ ...prev, _id: newId }));
            
            if (!silent) { setProcessingMsg(""); alert("Sauvegardé ! 💾"); }
            return newId;
        } catch (e) { 
            console.error("SAVE ERROR:", e);
            setProcessingMsg(""); 
            if (!silent) alert("Erreur sauvegarde : " + e.message); 
            return null; 
        }
    };

    // --- MOTEUR IA CENTRAL (GÉNÉRATION OU FIX) ---
    const handleAiAction = async () => {
        if (!aiPrompt) return alert("Écrivez une idée ou une correction !");
        
        // 1. MODE RÉPARATION
        if (project.generatedCode && project.generatedCode.length > 50) {
            setProcessingMsg("Réparation / Modification par l'IA...");
            try {
                const res = await fetch('/api/studio/fix-code', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        code: project.generatedCode, 
                        error: aiPrompt, 
                        instruction: aiPrompt 
                    })
                });
                const data = await res.json();
                // NOUVEAU : Lecture du message IA
                if (data.ok && data.code.code) {
                    setProject(prev => ({ ...prev, generatedCode: data.code.code }));
                    setAiPrompt(""); 
                    addLog("IA : " + (data.code.message || "Code réparé."), "info"); // Le message de l'IA s'affiche ici
                    runGame(); 
                } else {
                    addLog("L'IA n'a pas renvoyé de code valide.", "error");
                }
            } catch(e) { addLog("Erreur Réparation : " + e.message, "error"); }
            setProcessingMsg("");
            return;
        }

        // 2. MODE CRÉATION
        if (activeScene.actors.length === 0) return alert("Ajoutez au moins un acteur !");
        setProcessingMsg("Génération du Jeu...");
        const targetId = await saveProject(true);
        if (!targetId) { setProcessingMsg(""); return; }
        
        try {
            const res = await fetch('/api/studio/generate-code', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ projectId: targetId, gameIdea: aiPrompt })
            });
            const data = await res.json();
            // NOUVEAU : Lecture du message IA
            if (data.ok && data.code.code) {
                setProject(prev => ({ ...prev, generatedCode: data.code.code }));
                setViewMode('CODE');
                setAiPrompt("");
                addLog("IA : " + (data.code.message || "Jeu généré."), "success"); // Le message de l'IA s'affiche ici
                runGame();
            } else {
                addLog("L'IA n'a pas renvoyé de code valide.", "error");
            }
        } catch(e) { 
            addLog("Erreur Génération : " + e.message, "error");
        }
        setProcessingMsg("");
    };

    const handleConsoleFix = async () => {
        if (!consoleInput) return;
        setAiPrompt(consoleInput); 
        setConsoleInput("");
        setTimeout(handleAiAction, 100); 
    };

    const runGame = () => {
        if (!project.generatedCode) return alert("Aucun code généré !");
        setViewMode('PLAY');
        setLogs([]);
        addLog("Initialisation...", "info");

        setTimeout(() => {
            const canvas = document.getElementById('game-canvas');
            if (!canvas) return;
            const assets = {};
            let loaded = 0;
            const actors = activeScene.actors;
            
            if(actors.length === 0) return launch(canvas, assets);
            
            const checkStart = () => { if (loaded === actors.length) launch(canvas, assets); };
            
            actors.forEach(a => {
                const url = (a.costumes && a.costumes[0]) ? a.costumes[0].url : null;
                if (url) {
                    const img = new Image(); 
                    img.crossOrigin = "Anonymous"; 
                    img.src = url;
                    img.onload = () => { assets[a.id] = img; loaded++; checkStart(); };
                    img.onerror = () => { 
                        addLog(`Asset manquant : ${a.name} (ID: ${a.id})`, "warn");
                        loaded++; checkStart(); 
                    };
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
            game.log = (msg) => addLog(msg, "info"); 

            setGameInstance(game);
            addLog("Moteur démarré.", "success");
            
            let lastTime = 0;
            let frameId;

            const loop = (time) => {
                try {
                    const dt = (time - lastTime) / 1000; 
                    lastTime = time;
                    if (game.update) game.update(dt);
                    if (game.draw) game.draw(canvas.getContext('2d'));
                    if (document.getElementById('game-canvas')) {
                        frameId = requestAnimationFrame(loop);
                    }
                } catch (runtimeErr) {
                    addLog(runtimeErr.message, "error");
                    cancelAnimationFrame(frameId);
                }
            };
            frameId = requestAnimationFrame(loop);

        } catch (e) { 
            addLog("Erreur Code : " + e.message, "error");
        }
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

    const handleRemix = async (e) => {
        const file = e.target.files[0];
        if(!file || !selectedActor) return;
        setProcessingMsg("Remix IA...");
        const fd = new FormData(); fd.append('file', file);
        try {
            const res = await fetch('/api/studio/remix-asset', { method: 'POST', body: fd });
            const data = await res.json();
            if(data.ok) injectCostumes([data.url], "Remix");
        } catch(e) { alert("Erreur Remix"); }
        setProcessingMsg("");
        e.target.value = null;
    };

    const hasCode = project.generatedCode && project.generatedCode.length > 50;
    const buttonLabel = hasCode ? "RÉPARER / MODIFIER 🔧" : "GÉNÉRER LE CODE 🚀";
    const buttonColor = hasCode ? "bg-orange-500 hover:bg-orange-600" : "bg-pink-600 hover:bg-pink-500";

    return (
        <div className="studio-wrapper">
            <input type="file" ref={remixInputRef} style={{display:'none'}} onChange={handleRemix} accept="image/*" />
            <input type="file" ref={directImportRef} style={{display:'none'}} onChange={handleDirectImport} accept="image/*" />
            
            {processingMsg && <div className="overlay"><div className="modal-box"><h3 className="animate-pulse">{processingMsg}</h3></div></div>}

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

            <div className="studio-center">
                <div className="stage-toolbar gap-4">
                    <button onClick={() => setViewMode('DESIGN')} className={viewMode==='DESIGN'?'active':''}>🎨 DESIGN</button>
                    <button onClick={() => setViewMode('CODE')} className={viewMode==='CODE'?'active':''}>💻 CODE</button>
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
                    <div className="flex-1 bg-black flex flex-col items-center justify-center p-4">
                        <canvas id="game-canvas" width="640" height="360" className="bg-white shadow-2xl rounded mb-0" />
                        
                        {/* CONSOLE INTERACTIVE */}
                        <div className="studio-console-wrapper">
                            <div className="studio-console-logs custom-scrollbar">
                                {logs.length === 0 && <span className="text-slate-600 italic">Console prête. Lancez le jeu pour voir les logs.</span>}
                                {logs.map((l, i) => (
                                    <div key={i} className={`console-line ${l.type}`}>
                                        <span className="opacity-50">[{l.time}]</span> {l.msg}
                                    </div>
                                ))}
                                <div ref={consoleEndRef} />
                            </div>
                            <div className="studio-console-input-area">
                                <input 
                                    className="console-input" 
                                    placeholder="Décrivez le bug ou l'amélioration (ex: 'Le joueur tombe à travers le sol')..." 
                                    value={consoleInput}
                                    onChange={e => setConsoleInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleConsoleFix()}
                                />
                                <button className="btn-console-fix" onClick={handleConsoleFix}>RÉPARER 🔧</button>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode !== 'PLAY' && (
                    <div className="h-[120px] bg-slate-900 border-t border-slate-700 p-4 flex flex-col gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">
                            {hasCode ? "ASSISTANT DE RÉPARATION & MODIFICATION" : "GÉNÉRATEUR DE JEU (GEMINI 2.0)"}
                        </span>
                        <div className="flex gap-2">
                            <input className={`flex-1 bg-slate-800 border rounded p-2 text-white text-sm ${logs.some(l => l.type==='error') ? 'border-red-500 animate-pulse' : 'border-slate-600'}`}
                                   placeholder={hasCode ? "Décrivez le bug ou la modification (ex: 'Fais sauter plus haut')..." : "Décrivez votre jeu..."}
                                   value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                            <button onClick={handleAiAction} className={`${buttonColor} text-white px-6 rounded font-black text-xs transition-colors uppercase`}>
                                {buttonLabel}
                            </button>
                        </div>
                    </div>
                )}
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