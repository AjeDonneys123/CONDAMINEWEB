// @signatures: StudioDashboard, LiveEngine, handleAddAction, handleAddFrame, handleMoveFrame, handleDeleteActor, handleRemoveBgSingle, handleSaveCode, handleAddActor, handleUpdateProp, getImgUrl, handleCenterActor
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';
import { api } from '../../../services/api';

/**
 * 🕹️ ENGINE V115 (FULL ROTATION SUPPORT)
 * Gère parfaitement les styles Scratch : 360°, Miroir, et Fixe.
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
                            this.rotationStyle = data.rotationStyle || 'all';
                            this.currentAction = data.actions?.[0]?.name || 'IDLE';
                            this.frameIdx = 0;
                            this.animTick = 0;
                        }
                        center() { this.x = 50; this.y = 50; }
                        play(name) { 
                            if(this.currentAction.toUpperCase() !== name.toUpperCase()) {
                                this.currentAction = name; this.frameIdx = 0; this.animTick = 0;
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
                            window.onkeydown = (e) => { this.keys[e.code] = true; if(e.code === 'Space') e.preventDefault(); };
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
                                if(action && action.frames?.length > 0) {
                                    p.animTick++; if(p.animTick > 6) { p.animTick = 0; p.frameIdx = (p.frameIdx + 1) % action.frames.length; }
                                    const img = this.assets[action.frames[p.frameIdx].url];
                                    if(img) {
                                        let rx = (p.x / 100) * this.canvas.width;
                                        let ry = (p.y / 100) * this.canvas.height;
                                        this.ctx.save();
                                        this.ctx.translate(rx, ry);

                                        let normDir = ((p.dir % 360) + 360) % 360;

                                        if (p.rotationStyle === 'left-right') {
                                            // Mode Miroir (Scratch)
                                            if (normDir > 90 && normDir < 270) this.ctx.scale(-1, 1);
                                        } else if (p.rotationStyle === 'all') {
                                            // Mode 360° (Scratch)
                                            this.ctx.rotate(p.dir * Math.PI / 180);
                                        }

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
                    if (engineRef.current.update) engineRef.current.update();
                    engineRef.current._render();
                    requestAnimationFrame(loop);
                };
                loop();
            } catch(e) { setCrash("ERREUR: " + e.message); }
        }
        run();
        return () => { if(engineRef.current) engineRef.current.running = false; };
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
    const [code, setCode] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);

    const frameUploadRef = useRef(null);
    const actorUploadRef = useRef(null);

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

    const handleUpdateProp = (f, v) => {
        const next = { ...project };
        const actor = next.scenes?.[selectedSceneIdx]?.actors?.find(a => a.id === selectedActorId);
        if (actor) {
            actor[f] = isNaN(v) ? v : parseFloat(v);
            setProject(next);
        }
    };

    const currentScene = project?.scenes?.[selectedSceneIdx];
    const selectedActor = currentScene?.actors?.find(a => a.id === selectedActorId);

    return (
        <div className="studio-wrapper">
            <input type="file" ref={frameUploadRef} className="hidden" multiple onChange={async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0 || !selectedActorId) return;
                setLoading(true);
                const next = JSON.parse(JSON.stringify(project));
                const actor = next.scenes[selectedSceneIdx].actors.find(a => a.id === selectedActorId);
                const action = actor.actions[selectedActionIdx];
                for (const file of files) {
                    const formData = new FormData(); formData.append('file', file);
                    const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                    if (res.url) action.frames.push({ url: res.url, name: file.name });
                }
                await saveProject(next);
                setLoading(false);
            }} />
            
            <input type="file" ref={actorUploadRef} className="hidden" onChange={async (e) => {
                const file = e.target.files[0]; if(!file) return;
                setLoading(true);
                const formData = new FormData(); formData.append('file', file);
                const res = await fetch('/api/studio/upload-asset', { method: 'POST', body: formData }).then(r => r.json());
                const next = { ...project };
                if (!next.scenes[selectedSceneIdx].actors) next.scenes[selectedSceneIdx].actors = [];
                const newActor = { id: `actor-${Date.now()}`, name: "P" + (next.scenes[selectedSceneIdx].actors.length + 1), actions: [{ name: "IDLE", frames: [{url: res.url, name: "C1"}] }], initialX: 50, initialY: 50, scale: 1, direction: 0, rotationStyle: 'all' };
                next.scenes[selectedSceneIdx].actors.push(newActor);
                setSelectedActorId(newActor.id);
                await saveProject(next);
                setLoading(false);
            }} />

            <div className="studio-assets-panel">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <span className="text-[10px] font-black uppercase text-slate-400">Actions</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {selectedActor?.actions?.map((act, idx) => (
                        <div key={idx} onClick={() => setSelectedActionIdx(idx)} className={`action-card-square ${selectedActionIdx === idx ? 'active' : ''}`}>
                            <span className="font-black text-[10px] uppercase">{act.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="studio-center-column">
                <div className="stage-view" style={{ backgroundImage: currentScene?.backdrops?.[0]?.url ? `url(/api/proxy/${currentScene.backdrops[0].url.split('/').pop()})` : 'none' }}>
                    {isPlaying ? <LiveEngine code={code} project={project} activeSceneIdx={selectedSceneIdx} onStop={() => setIsPlaying(false)} /> : (
                        currentScene?.actors?.map((a, i) => (
                            <div key={a.id} onMouseDown={() => setSelectedActorId(a.id)} className={`actor-on-stage ${selectedActorId === a.id ? 'selected' : ''}`} style={{ left: `${a.initialX}%`, top: `${a.initialY}%` }}>
                                <img src={`/api/proxy/${(a.actions?.[0]?.frames?.[0]?.url || "").split('/').pop()}`} style={{transform: `scale(${a.scale}) rotate(${a.direction}deg)` }} />
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] px-1 rounded font-black uppercase">{a.name}</span>
                            </div>
                        ))
                    )}
                </div>

                <div className="properties-bar flex items-center gap-4 bg-white p-2 rounded-xl border">
                    <div className="flex flex-col"><span className="text-[8px] font-black opacity-30 uppercase">Nom</span><input className="prop-input-mini !w-16" value={selectedActor?.name || ""} onChange={e => handleUpdateProp('name', e.target.value)} /></div>
                    
                    <div className="flex flex-col border-l pl-4">
                        <span className="text-[8px] font-black opacity-30 uppercase mb-1">Style de Rotation</span>
                        <div className="flex gap-1">
                            <button title="360°" onClick={() => handleUpdateProp('rotationStyle', 'all')} className={`p-1.5 rounded-lg border-2 ${selectedActor?.rotationStyle === 'all' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>🔄</button>
                            <button title="Gauche/Droite" onClick={() => handleUpdateProp('rotationStyle', 'left-right')} className={`p-1.5 rounded-lg border-2 ${selectedActor?.rotationStyle === 'left-right' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>↔️</button>
                            <button title="Fixe" onClick={() => handleUpdateProp('rotationStyle', 'none')} className={`p-1.5 rounded-lg border-2 ${selectedActor?.rotationStyle === 'none' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>🚫</button>
                        </div>
                    </div>

                    <button onClick={() => setIsPlaying(true)} className="ml-auto bg-indigo-600 text-white px-6 py-1.5 rounded-lg text-[10px] font-black uppercase">▶ TESTER</button>
                </div>

                <div className="compact-code-editor h-[200px]">
                    <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck="false" />
                </div>
            </div>

            <div className="studio-library-panel">
                <div className="library-section-header p-4 bg-slate-50 border-b font-black text-[10px] uppercase text-slate-400">Personnages</div>
                <div className="library-grid custom-scrollbar">
                    {currentScene?.actors?.map((actor) => (
                        <div key={actor.id} className={`item-card relative ${selectedActorId === actor.id ? 'active' : ''}`} onClick={() => setSelectedActorId(actor.id)}>
                            <div className="item-name-tag">{actor.name}</div>
                        </div>
                    ))}
                    <div className="item-card !bg-indigo-50" onClick={() => actorUploadRef.current.click()}><span className="text-xl text-indigo-500 font-black">+</span></div>
                </div>
            </div>
        </div>
    );
}
