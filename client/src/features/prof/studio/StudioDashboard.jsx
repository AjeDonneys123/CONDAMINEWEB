// @signatures: AssetThumb, StageActor, StudioDashboard, executeConsole, handleActorMove, handleAddActor, handleAddScene, handleChange, handleDeleteProject, handleDeleteScene, handleMouseDown, handleMouseMove, handleMouseUp, loadProjects, newX, newY, runGame, saveProject
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';

const AssetThumb = ({ url, onClick, onDelete }) => (
    <div className="obj-card" onClick={onClick}>
        <div className="obj-thumb-mini">
            <img src={url} alt="asset" style={{ maxWidth: '100%', maxHeight: '100%' }} />
        </div>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>Asset</span>
        {onDelete && <button onClick={onDelete} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>}
    </div>
);

// Composant Actor sur la scène
const StageActor = ({ actor, isSelected, onSelect, onMove }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [pos, setPos] = useState({ x: actor.initialX, y: actor.initialY });

    const dragRef = useRef(null);
    const lastPosRef = useRef(null);

    useEffect(() => {
        setPos({ x: actor.initialX, y: actor.initialY });
    }, [actor.initialX, actor.initialY]);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        
        setPos(prev => {
             // L'acteur suit la souris
             const stageRect = dragRef.current.closest('.stage-canvas').getBoundingClientRect();
             const newXpx = prev.x + dx;
             const newYpx = prev.y + dy;
             
             // Limiter la position à l'intérieur du canvas pour éviter de perdre l'acteur
             const boundedX = Math.max(0, Math.min(stageRect.width, newXpx));
             const boundedY = Math.max(0, Math.min(stageRect.height, newYpx));
             
             lastPosRef.current = { x: e.clientX, y: e.clientY };
             
             return { x: boundedX, y: boundedY };
        });
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            // Conversion de la position en % pour l'enregistrement
            const stageRect = dragRef.current.closest('.stage-canvas').getBoundingClientRect();
            
            // Calcul des pourcentages des coordonnées finales stockées dans le state local 'pos'
            const newX = (pos.x / stageRect.width) * 100;
            const newY = (pos.y / stageRect.height) * 100;
            
            // Appel de la fonction de déplacement (critique pour la sauvegarde)
            onMove(actor.id, newX, newY);
        }
    };

    // La position est maintenant calculée en % pour le style CSS
    const actorStyle = {
        left: `${(pos.x / dragRef.current?.closest('.stage-canvas')?.getBoundingClientRect().width || 0) * 100}%`,
        top: `${(pos.y / dragRef.current?.closest('.stage-canvas')?.getBoundingClientRect().height || 0) * 100}%`,
        transform: `translate(-50%, -50%) scale(${actor.scale || 1})`,
        width: '100px', // Taille fixe
        height: '100px',
    };

    const currentCostume = actor.costumes?.[actor.currentCostumeIdx || 0];

    return (
        <div 
            ref={dragRef}
            className={`actor-on-stage ${isSelected ? 'selected' : ''}`}
            style={actorStyle}
            onClick={(e) => { e.stopPropagation(); onSelect(actor.id); }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {currentCostume && (
                <img 
                    src={currentCostume.url} 
                    alt={actor.name} 
                    style={{ maxWidth: '100%', maxHeight: '100%', pointerEvents: 'none' }} 
                />
            )}
        </div>
    );
};


export default function StudioDashboard({ user }) {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
    const [selectedActorId, setSelectedActorId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [consoleLog, setConsoleLog] = useState([]);
    const [consoleInput, setConsoleInput] = useState('');
    const consoleRef = useRef(null);

    const currentScene = selectedProject?.scenes[selectedSceneIndex];
    const selectedActor = currentScene?.actors.find(a => a.id === selectedActorId);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const data = await api.get(`/studio/projects/${user.id || user._id}`);
            setProjects(data);
            if (data.length > 0 && !selectedProject) {
                setSelectedProject(data[0]);
                setSelectedSceneIndex(0);
                setSelectedActorId(null);
            }
        } catch(e) { console.error("Load Projects Error:", e); }
        setLoading(false);
    };

    useEffect(() => {
        loadProjects();
    }, [user]);

    useEffect(() => {
        if (selectedProject?.scenes.length > 0) {
            setSelectedSceneIndex(0);
            setSelectedActorId(null);
        }
    }, [selectedProject]);

    // SCROLL AUTO CONSOLE
    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [consoleLog]);
    
    const handleChange = (field, value, targetType) => {
        const nextProject = { ...selectedProject };
        
        if (targetType === 'project') {
            nextProject[field] = value;
        } else if (targetType === 'scene') {
            nextProject.scenes[selectedSceneIndex][field] = value;
        } else if (targetType === 'actor') {
            const actorIndex = nextProject.scenes[selectedSceneIndex].actors.findIndex(a => a.id === selectedActorId);
            if (actorIndex !== -1) {
                nextProject.scenes[selectedSceneIndex].actors[actorIndex][field] = value;
            }
        }
        
        setSelectedProject(nextProject);
    };
    
    // --- MODE EXPERT : Console Interactive ---
    const executeConsole = async (e) => {
        e.preventDefault();
        const command = consoleInput.trim();
        if (!command) return;

        setConsoleLog(prev => [...prev, { type: 'input', text: `> ${command}` }]);
        setConsoleInput('');
        
        if (command.startsWith('run')) {
            setConsoleLog(prev => [...prev, { type: 'info', text: 'COMMANDE : Lancement du jeu...' }]);
            runGame();
        } else if (command.startsWith('save')) {
            setConsoleLog(prev => [...prev, { type: 'info', text: 'COMMANDE : Sauvegarde en cours...' }]);
            saveProject();
        } else if (command.startsWith('generate game')) {
            const idea = command.substring('generate game'.length).trim();
            setConsoleLog(prev => [...prev, { type: 'warn', text: `COMMANDE : Génération du code pour: ${idea}` }]);
            if (!selectedProject?._id) {
                setConsoleLog(prev => [...prev, { type: 'error', text: 'ERREUR : Projet non sauvegardé. Sauvegardez d\'abord !' }]);
                return;
            }
            try {
                const res = await api.post('/studio/generate-game', { projectId: selectedProject._id, gameIdea: idea });
                setSelectedProject(prev => ({ ...prev, generatedCode: res.code }));
                setConsoleLog(prev => [...prev, { type: 'info', text: `IA OK : ${res.message}` }]);
                setConsoleLog(prev => [...prev, { type: 'info', text: 'Code généré. Tappez RUN pour tester.' }]);
            } catch(e) {
                setConsoleLog(prev => [...prev, { type: 'error', text: `ERREUR IA : ${e.message}` }]);
            }
        } else {
            setConsoleLog(prev => [...prev, { type: 'error', text: `ERREUR : Commande inconnue: ${command}` }]);
        }
    };
    
    // --- LOGIQUE SAUVEGARDE ET EXÉCUTION (Restaurée) ---
    const saveProject = async () => {
        if (!selectedProject || loading) return;
        setLoading(true);
        try {
            const saved = await api.post('/studio', { ...selectedProject, teacherId: user.id || user._id });
            setSelectedProject(saved);
            loadProjects(); // Reload projects list to update titles/meta
            setConsoleLog(prev => [...prev, { type: 'info', text: `PROJET SAUVEGARDÉ : ${saved.title}` }]);
        } catch(e) {
            setConsoleLog(prev => [...prev, { type: 'error', text: `ERREUR SAUVEGARDE : ${e.message}` }]);
        }
        setLoading(false);
    };

    const runGame = () => {
        if (!selectedProject?.generatedCode) {
            setConsoleLog(prev => [...prev, { type: 'error', text: 'ERREUR : Code non généré. Lancez l\'IA !' }]);
            return;
        }
        setConsoleLog(prev => [...prev, { type: 'info', text: 'JEU LANCE DANS UNE NOUVELLE FENÊTRE...' }]);
        // NOTE: La vraie implémentation de 'run' ouvrirait une modale/iframe avec le code.
        alert("Jeu lancé ! (Fonctionnalité complète bientôt disponible)");
    };
    
    const handleAddScene = () => {
        const newScene = { 
            name: `Scene ${selectedProject.scenes.length + 1}`, 
            actors: [], 
            timeline: [] 
        };
        setSelectedProject(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
        setSelectedSceneIndex(selectedProject.scenes.length);
    };

    const handleDeleteScene = () => {
        if (selectedProject.scenes.length <= 1) return alert("Au moins une scène requise.");
        if (!confirm("Supprimer cette scène ?")) return;
        
        const nextProject = { ...selectedProject };
        nextProject.scenes.splice(selectedSceneIndex, 1);
        
        // S'assurer que l'index sélectionné reste valide
        const nextIndex = Math.max(0, selectedSceneIndex - 1);
        
        setSelectedProject(nextProject);
        setSelectedSceneIndex(nextIndex);
        setSelectedActorId(null);
    };

    const handleAddActor = () => {
        if (!currentScene) return;
        // La position initiale est maintenant en % du canvas
        const newActor = {
            id: `actor-${Date.now()}`,
            name: `New Actor`,
            costumes: [],
            initialX: 50, // 50%
            initialY: 50, // 50%
            scale: 1,
        };
        const nextProject = { ...selectedProject };
        nextProject.scenes[selectedSceneIndex].actors.push(newActor);
        setSelectedProject(nextProject);
        setSelectedActorId(newActor.id);
    };
    
    // CORRECTION : L'ancienne version recevait des coordonnées en % du canvas
    const handleActorMove = (actorId, newXPct, newYPct) => {
        const nextProject = { ...selectedProject };
        const actors = nextProject.scenes[selectedSceneIndex].actors;
        const actor = actors.find(a => a.id === actorId);
        if (actor) {
            // Mise à jour des positions en % (pour la persistance)
            actor.initialX = newXPct;
            actor.initialY = newYPct;
            setSelectedProject(nextProject);
        }
    };
    
    const handleDeleteProject = async (id) => {
        if (!confirm("Supprimer ce projet ?")) return;
        await api.delete(`/studio/${id}`);
        setSelectedProject(null);
        loadProjects();
    };

    // --- RENDER ---
    
    if (loading && !selectedProject) return <div className="studio-wrapper"><div className="overlay"><div className="modal-box">Chargement des projets...</div></div></div>;
    
    if (!selectedProject) {
        return (
            <div className="studio-wrapper">
                <div className="studio-center flex-col items-center justify-center p-20">
                    <h1 className="text-4xl font-black text-white/50 mb-4">🎬 STUDIO</h1>
                    <button 
                        onClick={() => setSelectedProject({ title: 'Nouveau Projet', scenes: [{ name: 'Scene 1', actors: [], timeline: [] }], teacherId: user.id || user._id, generatedCode: '' })} 
                        className="bg-purple-600 text-white px-8 py-4 rounded-xl font-black text-sm uppercase shadow-lg hover:scale-105 transition-transform"
                    >
                        + NOUVEAU PROJET
                    </button>
                    <div className="mt-8 space-y-2 max-w-sm w-full">
                        <h2 className="text-sm font-black uppercase text-slate-400 mb-2">MES PROJETS ({projects.length})</h2>
                        {projects.map(p => (
                            <div key={p._id} className="obj-card" onClick={() => setSelectedProject(p)}>
                                <span>{p.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="studio-wrapper">
            
            {/* 1. GAUCHE : Scènes et Timeline */}
            <div className="studio-sidebar">
                <div className="panel-header">SCÈNES</div>
                <div className="scroll-area custom-scrollbar">
                    {selectedProject.scenes.map((scene, index) => (
                        <div 
                            key={index} 
                            className={`obj-card ${selectedSceneIndex === index ? 'selected' : ''}`}
                            onClick={() => { setSelectedSceneIndex(index); setSelectedActorId(null); }}
                        >
                            <span>{scene.name}</span>
                        </div>
                    ))}
                    <button className="create-obj-full" onClick={handleAddScene}>+ AJOUTER SCÈNE</button>
                    {selectedProject.scenes.length > 1 && (
                        <button className="create-obj-full" onClick={handleDeleteScene} style={{borderColor: '#ef4444', color: '#ef4444'}}>✕ SUPPRIMER SCÈNE</button>
                    )}
                </div>
                
                <div className="panel-header">TIMELINE</div>
                <div className="scroll-area custom-scrollbar">
                    {/* Logique Timeline simple ici */}
                    <div className="text-xs text-slate-500 p-2">Timeline non implémentée...</div>
                </div>
            </div>

            {/* 2. CENTRE : SCÈNE ET CONSOLE */}
            <div className="studio-center">
                
                {/* TOOLBAR SCENE */}
                <div className="stage-toolbar">
                    <input 
                        type="text" 
                        value={selectedProject.title} 
                        onChange={e => handleChange('title', e.target.value, 'project')} 
                        className="bg-transparent text-white font-black text-center text-sm outline-none" 
                        style={{ width: '200px' }}
                    />
                    <div className="w-px h-full bg-slate-700 mx-4"></div>
                    <button onClick={saveProject} disabled={loading}>{loading ? 'SAUVEGARDE...' : '💾 SAUVER PROJET'}</button>
                    <button onClick={runGame} className="text-green-400">▶ LANCER</button>
                    <button onClick={() => handleDeleteProject(selectedProject._id)} className="text-red-400">✕ SUPPRIMER</button>
                </div>
                
                {/* SCENE */}
                <div className="stage-wrapper">
                    <div className="stage-canvas">
                        {currentScene?.backgroundUrl && (
                            <img 
                                src={currentScene.backgroundUrl} 
                                alt="Background" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        )}
                        {currentScene?.actors.map(actor => (
                            <StageActor 
                                key={actor.id} 
                                actor={actor} 
                                isSelected={selectedActorId === actor.id} 
                                onSelect={setSelectedActorId}
                                onMove={handleActorMove}
                            />
                        ))}
                    </div>
                </div>
                
                {/* CONSOLE */}
                <div className="studio-console-wrapper">
                    <div ref={consoleRef} className="studio-console-logs custom-scrollbar">
                        {consoleLog.map((log, index) => (
                            <div key={index} className={`console-line ${log.type === 'error' ? 'error' : log.type === 'info' ? 'info' : 'input'}`}>
                                {log.text}
                            </div>
                        ))}
                    </div>
                    <form onSubmit={executeConsole} className="studio-console-input-area">
                        <input
                            type="text"
                            className="console-input"
                            placeholder="Entrez une commande ou une requête IA (ex: generate game idée)"
                            value={consoleInput}
                            onChange={e => setConsoleInput(e.target.value)}
                        />
                        <button type="submit" className="btn-console-fix">FIX/GO</button>
                    </form>
                </div>

            </div>

            {/* 3. DROITE : ACTEURS et PROPRIÉTÉS */}
            <div className="studio-right-panel">
                <div className="panel-header">ACTEURS & PROPS</div>
                <div className="scroll-area custom-scrollbar">
                    
                    {/* LISTE ACTEURS */}
                    {currentScene?.actors.map(actor => (
                        <div 
                            key={actor.id} 
                            className={`obj-card ${selectedActorId === actor.id ? 'selected' : ''}`}
                            onClick={() => setSelectedActorId(actor.id)}
                        >
                            <span>{actor.name}</span>
                        </div>
                    ))}
                    <button className="create-obj-full" onClick={handleAddActor}>+ AJOUTER ACTEUR</button>
                    <div style={{ height: '1px', background: '#334155', margin: '15px 0' }}></div>
                    
                    {/* PROPRIÉTÉS ACTEUR */}
                    {selectedActor ? (
                        <>
                            <h4 className="prop-label">{selectedActor.name.toUpperCase()}</h4>
                            <div className="prop-row">
                                <label className="prop-label">NOM</label>
                                <input 
                                    className="prop-input" 
                                    value={selectedActor.name} 
                                    onChange={e => handleChange('name', e.target.value, 'actor')} 
                                />
                            </div>
                            <div className="prop-row">
                                <label className="prop-label">TAILLE (SCALE)</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    className="prop-input" 
                                    value={selectedActor.scale} 
                                    onChange={e => handleChange('scale', parseFloat(e.target.value) || 1, 'actor')} 
                                />
                            </div>
                            <div className="prop-row">
                                <label className="prop-label">POSITION (X / Y %)</label>
                                <div className="flex gap-2">
                                    <input type="number" step="1" className="prop-input" value={Math.round(selectedActor.initialX)} onChange={e => handleChange('initialX', parseInt(e.target.value) || 0, 'actor')} />
                                    <input type="number" step="1" className="prop-input" value={Math.round(selectedActor.initialY)} onChange={e => handleChange('initialY', parseInt(e.target.value) || 0, 'actor')} />
                                </div>
                            </div>
                            
                            <h4 className="prop-label mt-4">COSTUMES</h4>
                            {selectedActor.costumes?.map((costume, index) => (
                                <div key={costume.id} className={`obj-card ${selectedActor.currentCostumeIdx === index ? 'selected' : ''}`} onClick={() => handleChange('currentCostumeIdx', index, 'actor')}>
                                    <div className="obj-thumb-mini">
                                        <img src={costume.url} alt={costume.name} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                    </div>
                                    <span>{costume.name}</span>
                                </div>
                            ))}

                        </>
                    ) : (
                        <div className="text-xs text-slate-500 p-2 text-center">Sélectionnez un acteur.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
