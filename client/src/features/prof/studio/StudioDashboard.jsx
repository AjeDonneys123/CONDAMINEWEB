// @signatures: GamePreview, StageActor, StudioDashboard, executeConsole, handleActorMove, handleAddActor, handleAddScene, handleChange, handleDeleteProject, handleMouseDown, handleMouseMove, handleMouseUp, handleUploadCostume, loadAssets, loadProjects, saveProject
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
                </div>
            )}
        </div>
    );
};

const GamePreview = ({ code, project, onClose }) => {
    const canvasRef = useRef(null);
    const engineRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !code) return;
        const assets = {};
        const actors = project.scenes.flatMap(s => s.actors);
        const loadAssets = async () => {
            const promises = actors.map(actor => {
                const costume = actor.costumes?.[actor.currentCostumeIdx || 0];
                if (!costume) return Promise.resolve();
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => { assets[actor.id] = img; resolve(); };
                    img.onerror = () => resolve();
                    img.src = costume.url;
                });
            });
            await Promise.all(promises);
            try {
                const GameClass = new Function('assets', 'canvas', `${code}; return MiniGame;`)(assets, canvasRef.current);
                engineRef.current = new GameClass();
                engineRef.current.start?.();
            } catch (e) { console.error(e); }
        };
        loadAssets();
        return () => engineRef.current?.destroy?.();
    }, [code]);

    return (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center p-10">
            <div className="bg-slate-900 p-2 rounded-xl border border-white/20 relative shadow-2xl">
                <canvas ref={canvasRef} width={800} height={450} className="bg-white rounded-lg" />
                <button onClick={onClose} className="absolute -top-12 right-0 text-white font-black text-xl">✕ FERMER</button>
            </div>
        </div>
    );
};

export default function StudioDashboard({ user }) {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
    const [selectedActorId, setSelectedActorId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState([{ role: 'ai', text: "Salut ! Je suis ton assistant. Décris-moi ton jeu." }]);
    const [consoleInput, setConsoleInput] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const currentScene = selectedProject?.scenes?.[selectedSceneIndex];
    const selectedActor = currentScene?.actors?.find(a => a.id === selectedActorId);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const data = await api.get(`/studio/projects/${user.id || user._id}`);
            setProjects(data);
            if (data.length > 0 && !selectedProject) setSelectedProject(data[0]);
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadProjects(); }, [user]);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);
    
    const handleChange = (field, value, targetType) => {
        const nextProject = { ...selectedProject };
        if (targetType === 'project') nextProject[field] = value;
        else if (targetType === 'scene') nextProject.scenes[selectedSceneIndex][field] = value;
        else if (targetType === 'actor') {
            const actorIdx = nextProject.scenes[selectedSceneIndex].actors.findIndex(a => a.id === selectedActorId);
            if (actorIdx !== -1) nextProject.scenes[selectedSceneIndex].actors[actorIdx][field] = value;
        }
        setSelectedProject(nextProject);
    };

    const handleUploadCostume = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedActorId) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData });
            const assetData = await res.json();
            const nextProject = { ...selectedProject };
            const actor = nextProject.scenes[selectedSceneIndex].actors.find(a => a.id === selectedActorId);
            if (actor) {
                if (!actor.costumes) actor.costumes = [];
                actor.costumes.push({ id: `c-${Date.now()}`, name: file.name, url: assetData.url });
                actor.currentCostumeIdx = actor.costumes.length - 1;
                setSelectedProject(nextProject);
                await saveProject(nextProject);
            }
        } catch (err) { alert("Erreur upload"); }
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

    const executeConsole = async (e) => {
        e.preventDefault();
        const msg = consoleInput.trim();
        if (!msg || loading) return;
        setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
        setConsoleInput('');
        setLoading(true);
        try {
            const endpoint = !selectedProject.generatedCode ? '/studio/generate-game' : '/studio/fix-code';
            const payload = !selectedProject.generatedCode ? { projectId: selectedProject._id, gameIdea: msg } : { projectId: selectedProject._id, code: selectedProject.generatedCode, userInstruction: msg };
            const res = await api.post(endpoint, payload);
            setSelectedProject(prev => ({ ...prev, generatedCode: res.code }));
            setChatHistory(prev => [...prev, { role: 'ai', text: res.message, hasAction: true }]);
            await saveProject({ ...selectedProject, generatedCode: res.code });
        } catch(e) { setChatHistory(prev => [...prev, { role: 'ai', text: "Erreur technique." }]); }
        setLoading(false);
    };

    const handleAddScene = () => {
        const next = { ...selectedProject, scenes: [...selectedProject.scenes, { name: `Scene ${selectedProject.scenes.length + 1}`, actors: [], timeline: [] }] };
        setSelectedProject(next);
        setSelectedSceneIndex(next.scenes.length - 1);
    };

    const handleAddActor = () => {
        const newActor = { id: `actor-${Date.now()}`, name: `Perso`, costumes: [], initialX: 50, initialY: 50, scale: 1 };
        const next = { ...selectedProject };
        next.scenes[selectedSceneIndex].actors.push(newActor);
        setSelectedProject(next);
        setSelectedActorId(newActor.id);
    };
    
    const handleActorMove = (actorId, newX, newY) => {
        const next = { ...selectedProject };
        const actor = next.scenes[selectedSceneIndex].actors.find(a => a.id === actorId);
        if (actor) { actor.initialX = newX; actor.initialY = newY; setSelectedProject(next); }
    };

    const handleDeleteProject = async (id) => { if (confirm("Supprimer ?")) { await api.delete(`/studio/${id}`); setSelectedProject(null); loadProjects(); } };

    if (!selectedProject) return (
        <div className="studio-wrapper">
            <div className="studio-center flex-col items-center justify-center p-20">
                <h1 className="text-4xl font-black text-white/20 mb-8 uppercase tracking-widest">Studio de Création</h1>
                <button onClick={() => setSelectedProject({ title: 'Nouveau Projet', scenes: [{ name: 'Scene Principale', actors: [], timeline: [] }], teacherId: user.id || user._id })} className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">+ CRÉER UN PROJET</button>
                <div className="mt-10 grid grid-cols-2 gap-4 w-full max-w-xl">
                    {projects.map(p => <div key={p._id} className="obj-card !bg-slate-800/50 border-slate-700" onClick={() => setSelectedProject(p)}><span className="font-bold">{p.title}</span></div>)}
                </div>
            </div>
        </div>
    );

    return (
        <div className="studio-wrapper" id="studio-root">
            {showPreview && <GamePreview code={selectedProject.generatedCode} project={selectedProject} onClose={() => setShowPreview(false)} />}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadCostume} />
            
            {/* GAUCHE : SCÈNES */}
            <div className="studio-sidebar" id="sidebar-scenes">
                <div className="panel-header">🎬 SCÈNES</div>
                <div className="scroll-area">
                    {selectedProject.scenes.map((s, i) => <div key={i} className={`obj-card ${selectedSceneIndex === i ? 'selected' : ''}`} onClick={() => { setSelectedSceneIndex(i); setSelectedActorId(null); }}>{s.name}</div>)}
                    <button className="create-obj-full" onClick={handleAddScene}>+ AJOUTER SCÈNE</button>
                </div>
            </div>

            {/* CENTRE : ÉCRAN & CHAT */}
            <div className="studio-center">
                <div className="stage-toolbar">
                    <input type="text" value={selectedProject.title} onChange={e => handleChange('title', e.target.value, 'project')} className="bg-transparent text-white font-black text-xs outline-none uppercase w-64" />
                    <div className="flex gap-4 ml-auto px-4">
                        <button onClick={() => saveProject()} className="text-[10px] font-black text-indigo-400">💾 SAUVER</button>
                        <button onClick={() => handleDeleteProject(selectedProject._id)} className="text-[10px] font-black text-red-500">✕</button>
                    </div>
                </div>
                
                <div className="stage-wrapper" id="stage-viewport">
                    <div className="stage-canvas">
                        {currentScene?.actors.map(a => <StageActor key={a.id} actor={a} isSelected={selectedActorId === a.id} onSelect={setSelectedActorId} onMove={handleActorMove} />)}
                    </div>
                </div>

                <div className="studio-chat-wrapper">
                    <div className="studio-chat-messages custom-scrollbar">
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`chat-bubble ${msg.role}`}>
                                <div className="chat-text">{msg.text}</div>
                                {msg.hasAction && <button onClick={() => setShowPreview(true)} className="btn-test-game">▶ TESTER LE JEU</button>}
                            </div>
                        ))}
                        {loading && <div className="chat-bubble ai opacity-50 italic">IA en cours...</div>}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={executeConsole} className="studio-chat-input-area">
                        <input className="chat-input" placeholder="Décris une modification..." value={consoleInput} onChange={e => setConsoleInput(e.target.value)} disabled={loading} />
                        <button type="submit" className="btn-send-chat" disabled={loading}>ENVOYER</button>
                    </form>
                </div>
            </div>

            {/* DROITE : ACTEURS */}
            <div className="studio-right-panel" id="sidebar-actors">
                <div className="panel-header">🎭 PERSONNAGES</div>
                <div className="scroll-area">
                    {currentScene?.actors.map(a => <div key={a.id} className={`obj-card ${selectedActorId === a.id ? 'selected' : ''}`} onClick={() => setSelectedActorId(a.id)}>{a.name}</div>)}
                    <button className="create-obj-full" onClick={handleAddActor}>+ AJOUTER ACTEUR</button>
                    
                    {selectedActor && (
                        <div className="mt-6 p-4 bg-black/40 rounded-2xl border border-white/5 animate-in slide-in-from-right-4">
                            <label className="prop-label">NOM</label>
                            <input className="prop-input mb-4" value={selectedActor.name} onChange={e => handleChange('name', e.target.value, 'actor')} />
                            <label className="prop-label mb-2">IMAGE (CLOUD)</label>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {selectedActor.costumes?.map((c, i) => (
                                    <div key={i} className={`aspect-square bg-slate-900 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${selectedActor.currentCostumeIdx === i ? 'border-indigo-500 scale-105' : 'border-transparent'}`} onClick={() => handleChange('currentCostumeIdx', i, 'actor')}>
                                        <img src={c.url} className="w-full h-full object-contain" alt="costume" />
                                    </div>
                                ))}
                                <button onClick={() => fileInputRef.current.click()} className="aspect-square bg-white/5 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center hover:bg-white/10 transition-all">
                                    <span className="text-xl">📁</span>
                                    <span className="text-[8px] font-black uppercase mt-1">PC</span>
                                </button>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                <span className="text-[10px] font-black text-slate-500 uppercase">Taille</span>
                                <input type="range" min="0.1" max="3" step="0.1" value={selectedActor.scale || 1} onChange={e => handleChange('scale', parseFloat(e.target.value), 'actor')} className="w-24" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
