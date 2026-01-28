// @signatures: StageActor, StudioDashboard, executeConsole, handleActorMove, handleAddActor, handleAddScene, handleChange, handleDeleteProject, handleMouseDown, handleMouseMove, handleMouseUp, handleUploadCostume, loadProjects, saveProject
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';

const StageActor = ({ actor, isSelected, onSelect, onMove }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [pos, setPos] = useState({ x: actor.initialX, y: actor.initialY });
    const dragRef = useRef(null);
    const lastPosRef = useRef(null);

    useEffect(() => { setPos({ x: actor.initialX, y: actor.initialY }); }, [actor.initialX, actor.initialY]);

    const handleMouseDown = (e) => { 
        if (e.button !== 0) return;
        setIsDragging(true); 
        lastPosRef.current = { x: e.clientX, y: e.clientY }; 
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        
        // Calcul simple pour le mouvement fluide
        setPos(prev => ({ x: prev.x + (dx / 6), y: prev.y + (dy / 3.6) })); 
        lastPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            onMove(actor.id, pos.x, pos.y);
        }
    };

    const currentCostume = actor.costumes?.[actor.currentCostumeIdx || 0];

    return (
        <div 
            ref={dragRef}
            className={`actor-on-stage ${isSelected ? 'selected' : ''}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%, -50%) scale(${actor.scale || 1})` }}
            onClick={(e) => { e.stopPropagation(); onSelect(actor.id); }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {currentCostume ? (
                <img src={currentCostume.url} alt={actor.name} style={{ maxWidth: '100%', maxHeight: '100%', pointerEvents: 'none' }} />
            ) : (
                <div className="flex flex-col items-center justify-center opacity-20">
                    <span className="text-2xl">👤</span>
                    <span className="text-[8px] font-black uppercase">Sans Image</span>
                </div>
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
    const fileInputRef = useRef(null);

    const currentScene = selectedProject?.scenes[selectedSceneIndex];
    const selectedActor = currentScene?.actors.find(a => a.id === selectedActorId);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const data = await api.get(`/studio/projects/${user.id || user._id}`);
            setProjects(data);
            if (data.length > 0 && !selectedProject) { setSelectedProject(data[0]); }
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadProjects(); }, [user]);
    useEffect(() => { if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight; }, [consoleLog]);
    
    const handleChange = (field, value, targetType) => {
        const nextProject = { ...selectedProject };
        if (targetType === 'project') nextProject[field] = value;
        else if (targetType === 'scene') nextProject.scenes[selectedSceneIndex][field] = value;
        else if (targetType === 'actor') {
            const actorIndex = nextProject.scenes[selectedSceneIndex].actors.findIndex(a => a.id === selectedActorId);
            if (actorIndex !== -1) nextProject.scenes[selectedSceneIndex].actors[actorIndex][field] = value;
        }
        setSelectedProject(nextProject);
    };

    // --- IMPORT DEPUIS PC VERS DRIVE ---
    const handleUploadCostume = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedActorId) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            // 1. Envoi au serveur qui l'upload sur le Drive
            const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData });
            if (!res.ok) throw new Error("Upload Drive échoué");
            
            const assetData = await res.json(); // { url: "/api/structure/proxy/..." }

            // 2. Mise à jour locale de l'acteur
            const nextProject = { ...selectedProject };
            const actors = nextProject.scenes[selectedSceneIndex].actors;
            const actor = actors.find(a => a.id === selectedActorId);
            if (actor) {
                if (!actor.costumes) actor.costumes = [];
                actor.costumes.push({ id: `c-${Date.now()}`, name: file.name, url: assetData.url });
                actor.currentCostumeIdx = actor.costumes.length - 1;
                setSelectedProject(nextProject);
                // 3. Sauvegarde auto en BDD
                await saveProject(nextProject);
            }
        } catch (err) { 
            alert("Erreur critique d'upload vers le Cloud."); 
            console.error(err);
        }
        setLoading(false);
    };
    
    const saveProject = async (p = selectedProject) => {
        if (!p || loading) return;
        try {
            const saved = await api.post('/studio', { ...p, teacherId: user.id || user._id });
            setSelectedProject(saved);
            loadProjects();
            return saved;
        } catch(e) { console.error(e); }
    };

    const handleAddScene = () => {
        const nextProject = { ...selectedProject, scenes: [...selectedProject.scenes, { name: `Scene ${selectedProject.scenes.length + 1}`, actors: [], timeline: [] }] };
        setSelectedProject(nextProject);
        setSelectedSceneIndex(nextProject.scenes.length - 1);
    };

    const handleAddActor = () => {
        const newActor = { id: `actor-${Date.now()}`, name: `Perso ${currentScene?.actors.length + 1}`, costumes: [], initialX: 50, initialY: 50, scale: 1 };
        const nextProject = { ...selectedProject };
        nextProject.scenes[selectedSceneIndex].actors.push(newActor);
        setSelectedProject(nextProject);
        setSelectedActorId(newActor.id);
    };

    const handleActorMove = (actorId, newX, newY) => {
        const nextProject = { ...selectedProject };
        const actor = nextProject.scenes[selectedSceneIndex].actors.find(a => a.id === actorId);
        if (actor) { actor.initialX = newX; actor.initialY = newY; setSelectedProject(nextProject); }
    };

    const handleDeleteProject = async (id) => { if (confirm("Supprimer ce projet ?")) { await api.delete(`/studio/${id}`); setSelectedProject(null); loadProjects(); } };
    
    const executeConsole = async (e) => {
        e.preventDefault();
        const command = consoleInput.trim();
        if (!command) return;
        setConsoleLog(prev => [...prev, { type: 'input', text: `> ${command}` }]);
        setConsoleInput('');
        if (command === 'save') saveProject();
        if (command.startsWith('generate game')) {
            try {
                const res = await api.post('/studio/generate-game', { projectId: selectedProject._id, gameIdea: command.substring(13).trim() });
                setSelectedProject(prev => ({ ...prev, generatedCode: res.code }));
                setConsoleLog(prev => [...prev, { type: 'info', text: 'Jeu généré. Prêt à tester.' }]);
            } catch(e) { setConsoleLog(p => [...p, {type:'error', text:'Erreur Génération'}]); }
        }
    };

    if (loading && !selectedProject) return <div className="studio-wrapper"><div className="overlay"><div className="modal-box">☁️ SYNC DRIVE EN COURS...</div></div></div>;
    
    if (!selectedProject) {
        return (
            <div className="studio-wrapper">
                <div className="studio-center flex-col items-center justify-center">
                    <h1 className="text-white/10 font-black text-6xl mb-8 select-none">STUDIO</h1>
                    <button onClick={() => setSelectedProject({ title: 'Nouveau Projet', scenes: [{ name: 'Scene 1', actors: [], timeline: [] }], teacherId: user.id || user._id })} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-2xl font-black shadow-2xl transition-all hover:scale-105 active:scale-95 uppercase tracking-widest">+ CRÉER UN PROJET</button>
                    <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-2xl px-10">
                        {projects.map(p => <div key={p._id} className="obj-card !bg-slate-800/40 border-slate-700 hover:border-indigo-500 transition-all" onClick={() => setSelectedProject(p)}><span className="font-bold text-slate-300">{p.title}</span></div>)}
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="studio-wrapper animate-in fade-in">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadCostume} />
            
            {/* PANNEAU GAUCHE : SCÈNES */}
            <div className="studio-sidebar">
                <div className="panel-header">🎬 SCÈNES</div>
                <div className="scroll-area custom-scrollbar">
                    {selectedProject.scenes.map((s, i) => (
                        <div key={i} className={`obj-card ${selectedSceneIndex === i ? 'selected' : ''}`} onClick={() => { setSelectedSceneIndex(i); setSelectedActorId(null); }}>
                            <span>{s.name}</span>
                        </div>
                    ))}
                    <button className="create-obj-full" onClick={handleAddScene}>+ AJOUTER SCÈNE</button>
                </div>
            </div>

            {/* CENTRE : SCÈNE & CONSOLE */}
            <div className="studio-center">
                <div className="stage-toolbar">
                    <input type="text" value={selectedProject.title} onChange={e => handleChange('title', e.target.value, 'project')} className="bg-transparent text-white font-black text-center text-xs outline-none uppercase tracking-widest" style={{width:'300px'}} />
                    <div className="flex gap-4 ml-auto px-4">
                        <button onClick={() => saveProject()} className="text-[10px] font-black text-indigo-400 hover:text-white transition-colors">💾 SAUVER</button>
                        <button onClick={() => handleDeleteProject(selectedProject._id)} className="text-[10px] font-black text-red-500 hover:text-white transition-colors">✕ SUPPRIMER</button>
                    </div>
                </div>
                
                <div className="stage-wrapper">
                    <div className="stage-canvas">
                        {currentScene?.actors.map(a => (
                            <StageActor key={a.id} actor={a} isSelected={selectedActorId === a.id} onSelect={setSelectedActorId} onMove={handleActorMove} />
                        ))}
                    </div>
                </div>

                <div className="studio-console-wrapper">
                    <div ref={consoleRef} className="studio-console-logs custom-scrollbar">
                        {consoleLog.map((log, i) => <div key={i} className={`console-line ${log.type}`}>{log.text}</div>)}
                    </div>
                    <form onSubmit={executeConsole} className="studio-console-input-area">
                        <input className="console-input" placeholder="Tapez 'save' ou décrivez un jeu..." value={consoleInput} onChange={e => setConsoleInput(e.target.value)} />
                        <button type="submit" className="btn-console-fix">FIX/GO</button>
                    </form>
                </div>
            </div>

            {/* PANNEAU DROIT : ACTEURS & PROPS */}
            <div className="studio-right-panel">
                <div className="panel-header">🎭 PERSONNAGES</div>
                <div className="scroll-area custom-scrollbar">
                    {currentScene?.actors.map(a => (
                        <div key={a.id} className={`obj-card ${selectedActorId === a.id ? 'selected' : ''}`} onClick={() => setSelectedActorId(a.id)}>
                            <span>{a.name}</span>
                        </div>
                    ))}
                    <button className="create-obj-full" onClick={handleAddActor}>+ AJOUTER ACTEUR</button>
                    
                    {selectedActor && (
                        <div className="mt-6 p-4 bg-black/40 rounded-2xl border border-white/5 animate-in slide-in-from-right-4">
                            <label className="prop-label">NOM DU PERSONNAGE</label>
                            <input className="prop-input mb-4" value={selectedActor.name} onChange={e => handleChange('name', e.target.value, 'actor')} />
                            
                            <label className="prop-label mb-2">COSTUMES (CLOUD)</label>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {selectedActor.costumes?.map((c, i) => (
                                    <div key={i} className={`aspect-square bg-slate-900 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${selectedActor.currentCostumeIdx === i ? 'border-indigo-500 scale-105' : 'border-transparent opacity-60'}`} onClick={() => handleChange('currentCostumeIdx', i, 'actor')}>
                                        <img src={c.url} className="w-full h-full object-contain" alt="costume" />
                                    </div>
                                ))}
                                <button onClick={() => fileInputRef.current.click()} className="aspect-square bg-white/5 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center hover:bg-white/10 transition-all">
                                    <span className="text-xl">📁</span>
                                    <span className="text-[8px] font-black uppercase mt-1">Depuis PC</span>
                                </button>
                            </div>
                            
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">Taille</span>
                                    <input type="range" min="0.1" max="3" step="0.1" value={selectedActor.scale || 1} onChange={e => handleChange('scale', parseFloat(e.target.value), 'actor')} className="w-24" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
