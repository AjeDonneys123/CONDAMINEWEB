// @signatures: StudioDashboard, LiveEngine, handleAddAction, handleAddFrame, handleMoveFrame, handleDeleteActor, handleRemoveBgSingle, handleSaveCode, handleAddActor, handleUpdateProp, getImgUrl, handleCenterActor
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';

/**
 * 🕹️ ENGINE V111 (ANIMATION SAFE)
 * Empêche les crashs "undefined url" lors du changement d'action.
 */
const LiveEngine = ({ code, project, activeSceneIdx, onStop }) => {
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const [crash, setCrash] = useState(null);

    function resolveUrl(url) {
        if (!url) return "";
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    useEffect(() => {
        if (!canvasRef.current || !code || !project) return;
        const canvas = canvasRef.current;
        const assets = {};
        
        async function run() {
            try {
                const scene = project?.scenes?.[activeSceneIdx];
                if (!scene) return;
                const resources = (scene.actors || []).flatMap(a => 
                    (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))
                ).concat((scene.backdrops || []).map(b => b.url));
                
                await Promise.all([...new Set(resources)].filter(Boolean).map(url => new Promise(resolve => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => { assets[url] = img; resolve(); };
                    img.onerror = () => resolve();
                    img.src = resolveUrl(url);
                    setTimeout(resolve, 2000);
                })));

                const engineLogic = `
                    const { canvas, ctx, assets, project, sceneIdx } = arguments[0];
                    
                    class ActorProxy {
                        constructor(data) {
                            this.x = data.initialX || 50;
                            this.y = data.initialY || 50;
                            this.dir = data.direction || 0;
                            this.scale = data.scale || 1;
                            this.currentAction = data.actions?.[0]?.name || 'IDLE';
                            this.frameIdx = 0;
                            this.animTick = 0;
                        }
                        center() { this.x = 50; this.y = 50; }
                        play(name) { 
                            if(this.currentAction.toUpperCase() !== name.toUpperCase()) {
                                this.currentAction = name; 
                                this.frameIdx = 0; // REINITIALISATION CRITIQUE
                                this.animTick = 0;
                            }
                        }
                    }

                    class MiniGameBase {
                        constructor() {
                            this.canvas = canvas; this.ctx = ctx; this.assets = assets;
                            this.keys = {}; this.running = true;
                            project.scenes[sceneIdx].actors.forEach((a, i) => {
                                this['P' + (i + 1)] = new ActorProxy(a);
                            });
                            window.onkeydown = (e) => this.keys[e.code] = true;
                            window.onkeyup = (e) => this.keys[e.code] = false;
                        }

                        _render() {
                            if(!this.ctx) return;
                            this.ctx.fillStyle = 'white';
                            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                            const s = project.scenes[sceneIdx];
                            const bd = s.backdrops?.[s.currentBackdropIdx || 0];
                            if(bd && this.assets[bd.url]) this.ctx.drawImage(this.assets[bd.url], 0, 0, this.canvas.width, this.canvas.height);

                            s.actors.forEach((a, i) => {
                                const p = this['P' + (i + 1)];
                                const action = (a.actions || []).find(act => act.name.toUpperCase() === p.currentAction.toUpperCase()) || a.actions?.[0];
                                
                                // FIX V111 : Vérification robuste de la frame
                                if(action && action.frames && action.frames.length > 0) {
                                    p.animTick++; 
                                    if(p.animTick > 6) { 
                                        p.animTick = 0; 
                                        p.frameIdx = (p.frameIdx + 1) % action.frames.length; 
                                    }
                                    
                                    const frame = action.frames[p.frameIdx];
                                    if(frame && frame.url && this.assets[frame.url]) {
                                        const img = this.assets[frame.url];
                                        let rx = (p.x / 100) * this.canvas.width;
                                        let ry = (p.y / 100) * this.canvas.height;
                                        this.ctx.save();
                                        this.ctx.translate(rx, ry);
                                        this.ctx.rotate(p.dir * Math.PI / 180);
                                        let sz = 150 * p.scale;
                                        this.ctx.drawImage(img, -sz/2, -sz/2, sz, sz);
                                        this.ctx.restore();
                                    }
                                }
                            });
                        }
                    }

                    ${code}

                    return typeof MiniGame !== 'undefined' ? MiniGame : MiniGameBase;
                `;

                const ctx = canvas.getContext('2d');
                const GameFactory = new Function(engineLogic);
                const FinalClass = GameFactory({ canvas, ctx, assets, project, sceneIdx: activeSceneIdx });
                
                engineRef.current = new FinalClass();
                if (engineRef.current.start) engineRef.current.start();

                const loop = () => {
                    if (!engineRef.current || !engineRef.current.running) return;
                    try {
                        if (engineRef.current.update) engineRef.current.update();
                        engineRef.current._render();
                        requestAnimationFrame(loop);
                    } catch(e) { setCrash("RUNTIME: " + e.message); }
                };
                loop();
            } catch(e) { setCrash("SYNTAXE: " + e.message); }
        }
        run();
        return () => { if(engineRef.current) engineRef.current.running = false; window.onkeydown = null; window.onkeyup = null; };
    }, [code, project, activeSceneIdx]);

    return (
        <div className="absolute inset-0 z-[100] bg-black">
            {crash && <div className="absolute top-0 left-0 right-0 bg-red-600 text-white p-2 text-[10px] font-mono z-[120]">{crash}</div>}
            <canvas ref={canvasRef} width={800} height={450} className="w-full h-full object-contain" />
            <button onClick={onStop} className="absolute top-4 right-4 bg-white text-black px-4 py-1 rounded-full font-black text-xs z-[130]">STOP</button>
        </div>
    );
};

export default function StudioDashboard({ user }) {
    const [projects, setProjects] = useState([]);
    const [project, setProject] = useState(null);
    const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
    const [selectedActorId, setSelectedActorId] = useState(null);
    const [selectedActionIdx, setSelectedActionIdx] = useState(0);
    
    const [code, setCode] = useState(`class MiniGame extends MiniGameBase {
  start() {
    this.P1.x = 20;
    this.P1.y = 50;
  }

  update() {
    const vitesse = 0.8;
    let bouge = false;

    if (this.keys.Space) {
      this.P1.play("TAPPER");
    } else {
      if (this.keys.ArrowLeft)  { this.P1.x -= vitesse; bouge = true; }
      if (this.keys.ArrowRight) { this.P1.x += vitesse; bouge = true; }
      if (this.keys.ArrowUp)    { this.P1.y -= vitesse; bouge = true; }
      if (this.keys.ArrowDown)  { this.P1.y += vitesse; bouge = true; }

      if (bouge) this.P1.play("MARCHER");
      else this.P1.play("IDLE");
    }
  }
}`);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const frameUploadRef = useRef(null);
    const actorUploadRef = useRef(null);
    const stageRef = useRef(null);

    useEffect(() => { loadProjects(); }, [user]);

    async function loadProjects() {
        const data = await api.get(`/studio/projects/${user.id || user._id}`);
        setProjects(data); 
        if (data && data.length > 0) {
            const p = data[0];
            setProject(p);
            if (p.generatedCode) setCode(p.generatedCode);
            if (!selectedActorId && p.scenes?.[0]?.actors?.[0]) setSelectedActorId(p.scenes[0].actors[0].id);
        }
    }

    async function saveProject(p = project) {
        if (!p) return;
        setLoading(true);
        try {
            const saved = await api.post('/studio', { ...p, teacherId: user.id || user._id, generatedCode: code });
            setProject(saved);
        } catch(e) { console.error("Save Error", e); }
        setLoading(false);
    }

    function getImgUrl(url) {
        if (!url) return "";
        const id = url.split('/').pop();
        return `/api/proxy/${id}`;
    }

    const handleUpdateProp = (f, v) => {
        const next = { ...project };
        const actor = next.scenes?.[selectedSceneIdx]?.actors?.find(a => a.id === selectedActorId);
        if (actor) {
            actor[f] = isNaN(v) ? v : parseFloat(v);
            setProject(next);
        }
    };

    const handleCenterActor = () => {
        const next = { ...project };
        const actor = next.scenes?.[selectedSceneIdx]?.actors?.find(a => a.id === selectedActorId);
        if (actor) { actor.initialX = 50; actor.initialY = 50; setProject(next); saveProject(next); }
    };

    const handleAddFrame = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0 || !selectedActorId) return;
        setLoading(true);
        const next = JSON.parse(JSON.stringify(project));
        const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
        const action = actor.actions[selectedActionIdx];
        if (!action.frames) action.frames = [];
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                if (res.url) action.frames.push({ url: res.url, name: file.name });
            }
            await saveProject(next);
        } catch(e) { console.error("Upload failed", e); }
        setLoading(false);
        e.target.value = null; 
    };

    const handleDeleteActor = async (e, actorId) => {
        e.stopPropagation();
        if (!confirm("Supprimer ce personnage ?")) return;
        const next = { ...project };
        next.scenes[selectedSceneIdx].actors = next.scenes[selectedSceneIdx].actors.filter(a => a.id !== actorId);
        if (selectedActorId === actorId) setSelectedActorId(null);
        await saveProject(next);
    };

    const currentScene = project?.scenes?.[selectedSceneIdx];
    const selectedActor = currentScene?.actors?.find(a => a.id === selectedActorId);
    const selectedAction = selectedActor?.actions?.[selectedActionIdx];

    if (!project) return <div className="p-20 text-center font-black animate-pulse">CHARGEMENT DU STUDIO...</div>;

    return (
        <div className="studio-wrapper">
            <input type="file" ref={frameUploadRef} className="hidden" multiple onChange={handleAddFrame} />
            <input type="file" ref={actorUploadRef} className="hidden" onChange={async (e) => {
                const file = e.target.files[0]; if(!file) return;
                setLoading(true);
                const formData = new FormData(); formData.append('file', file);
                const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                const next = { ...project };
                if (!next.scenes[selectedSceneIdx].actors) next.scenes[selectedSceneIdx].actors = [];
                const newActor = { id: `actor-${Date.now()}`, name: "P" + (next.scenes[selectedSceneIdx].actors.length + 1), actions: [{ name: "IDLE", frames: [{url: res.url, name: "C1"}] }], initialX: 50, initialY: 50, scale: 1, direction: 0 };
                next.scenes[selectedSceneIdx].actors.push(newActor);
                setSelectedActorId(newActor.id);
                await saveProject(next);
                setLoading(false);
            }} />

            <div className="studio-assets-panel">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <span className="text-[10px] font-black uppercase text-slate-400">Actions : {selectedActor?.name || '...'}</span>
                    {selectedActor && (
                        <button onClick={() => {
                            const n = prompt("Nom action:");
                            if(!n) return;
                            const next = {...project};
                            next.scenes[selectedSceneIdx].actors.find(a=>a.id===selectedActorId).actions.push({name:n.toUpperCase(), frames:[]});
                            saveProject(next);
                        }} className="bg-indigo-600 text-white w-6 h-6 rounded-full font-black">+</button>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {selectedActor?.actions?.map((act, idx) => (
                        <div key={idx} onClick={() => setSelectedActionIdx(idx)} className={`action-card-square ${selectedActionIdx === idx ? 'active' : ''}`}>
                            <div className="flex justify-between items-center">
                                <span className="font-black text-[10px] uppercase text-slate-700">{act.name}</span>
                                <span className="text-[8px] font-bold text-slate-300">{(act.frames || []).length} Frames</span>
                            </div>
                            <div className="action-preview-row">
                                {act.frames?.length > 0 ? act.frames.slice(0, 5).map((f, i) => (
                                    <img key={i} src={getImgUrl(f.url)} alt="preview" />
                                )) : <div className="text-[8px] opacity-20 italic">0 frames</div>}
                            </div>
                        </div>
                    ))}
                </div>

                {selectedAction && (
                    <div className="h-[250px] border-t bg-slate-50 flex flex-col">
                        <div className="p-2 bg-slate-900 text-white flex justify-between items-center">
                            <span className="text-[8px] font-black uppercase ml-2">Sprites : {selectedAction.name}</span>
                            <button onClick={() => frameUploadRef.current.click()} className="bg-emerald-500 text-[8px] px-2 py-1 rounded font-black">+ FRAMES</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
                            {selectedAction.frames?.map((f, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-lg border group">
                                    <img src={getImgUrl(f.url)} className="w-8 h-8 object-contain" alt="sprite" />
                                    <span className="text-[9px] font-bold truncate flex-1">{f.name}</span>
                                    <button onClick={() => { 
                                        const n={...project}; 
                                        n.scenes[selectedSceneIdx].actors.find(a=>a.id===selectedActorId).actions[selectedActionIdx].frames.splice(i, 1); 
                                        setProject(n); saveProject(n); 
                                    }} className="text-red-400 font-black px-1">✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="studio-center-column">
                <div 
                    className="stage-view" 
                    ref={stageRef}
                    style={{ backgroundImage: `url(${getImgUrl(currentScene?.backdrops?.[currentScene?.currentBackdropIdx || 0]?.url)})` }}
                    onMouseMove={(e) => { if(!isDragging || isPlaying) return; const r=stageRef.current.getBoundingClientRect(); handleUpdateProp('initialX', Math.round(((e.clientX-r.left)/r.width)*100)); handleUpdateProp('initialY', Math.round(((e.clientY-r.top)/r.height)*100)); }} 
                    onMouseUp={() => setIsDragging(false)}
                >
                    {isPlaying ? <LiveEngine code={code} project={project} activeSceneIdx={selectedSceneIdx} onStop={() => setIsPlaying(false)} /> : (
                        currentScene?.actors?.map((a, i) => {
                            const frameUrl = a.actions?.[selectedActionIdx]?.frames?.[0]?.url || a.actions?.[0]?.frames?.[0]?.url;
                            return (
                                <div key={a.id} onMouseDown={() => { setSelectedActorId(a.id); setIsDragging(true); }} className={`actor-on-stage ${selectedActorId === a.id ? 'selected' : ''}`} style={{ left: `${a.initialX}%`, top: `${a.initialY}%` }}>
                                    {frameUrl ? (
                                        <img src={getImgUrl(frameUrl)} style={{transform: `scale(${a.scale}) rotate(${a.direction}deg)`}} alt="actor" />
                                    ) : <div className="w-12 h-12 bg-white/80 border-2 border-dashed border-slate-300 rounded flex items-center justify-center text-[7px] font-black text-slate-300">VIDE</div>}
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] px-1 rounded uppercase font-black whitespace-nowrap">{a.name} (P{i+1})</span>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="properties-bar">
                    <div className="prop-group"><span className="prop-label">ID</span><input className="prop-input-mini !w-24" value={selectedActor?.name || ""} onChange={(e) => handleUpdateProp('name', e.target.value)} /></div>
                    <div className="prop-group"><span className="prop-label">X</span><input className="prop-input-mini" value={selectedActor?.initialX || 0} onChange={e => handleUpdateProp('initialX', e.target.value)} /></div>
                    <div className="prop-group"><span className="prop-label">Y</span><input className="prop-input-mini" value={selectedActor?.initialY || 0} onChange={e => handleUpdateProp('initialY', e.target.value)} /></div>
                    {selectedActor && <button onClick={handleCenterActor} className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">🎯 Centre</button>}
                    <button onClick={() => setIsPlaying(true)} className="ml-auto bg-indigo-600 text-white px-6 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-lg">▶ TESTER</button>
                </div>
                <div className="compact-code-editor">
                    <div className="bg-slate-800 p-2 flex justify-between items-center">
                        <span className="text-[8px] font-black text-slate-400 uppercase ml-2">🧠 Logique du Jeu (Script)</span>
                        <button onClick={() => saveProject()} className="bg-emerald-500 text-white px-3 py-1 rounded text-[8px] font-black uppercase">{loading ? '...' : 'Sauver le code'}</button>
                    </div>
                    <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck="false" />
                </div>
            </div>

            <div className="studio-library-panel">
                <div className="library-section-header p-4 bg-slate-50 border-b font-black text-[10px] uppercase text-slate-400">Personnages</div>
                <div className="library-grid custom-scrollbar">
                    {currentScene?.actors?.map((actor) => (
                        <div key={actor.id} className={`item-card relative ${selectedActorId === actor.id ? 'active' : ''}`} onClick={() => setSelectedActorId(actor.id)}>
                            <button className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[8px] font-black z-10" onClick={(e) => handleDeleteActor(e, actor.id)}>✕</button>
                            <div className="item-img-container">
                                {actor.actions?.[0]?.frames?.[0]?.url ? <img src={getImgUrl(actor.actions[0].frames[0].url)} className="item-img" alt="thumb" /> : <div className="text-[10px] opacity-20">👤</div>}
                            </div>
                            <div className="item-name-tag">{actor.name}</div>
                        </div>
                    ))}
                    <div className="item-card !bg-indigo-50" onClick={() => actorUploadRef.current.click()}><span className="text-xl text-indigo-500 font-black">+</span></div>
                </div>
            </div>
        </div>
    );
}
