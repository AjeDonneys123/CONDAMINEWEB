import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ globalClass }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [openId, setOpenId] = useState(null); 
    const [activeMode, setActiveMode] = useState('upload'); // 'upload', 'files'
    const [activeTab, setActiveTab] = useState('subject'); // 'subject', 'copies', 'ia', 'corrections'
    const [newTitle, setNewTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [showFolderPicker, setShowFolderPicker] = useState(null);
    const [driveFiles, setDriveFiles] = useState({ list: [], loading: false });

    const loadData = async () => {
        try {
            const [sRes, cRes] = await Promise.all([
                fetch('/api/scan-sessions'),
                fetch('/api/chapters-all')
            ]);
            if (sRes.ok) setSessions(await sRes.json());
            if (cRes.ok) setChapters(await cRes.json());
        } catch (e) { console.error("Load error:", e); }
    };

    useEffect(() => { loadData(); }, [globalClass]);

    // Chargement automatique des fichiers Drive en mode "files"
    useEffect(() => {
        if (openId && activeMode === 'files') {
            fetchDriveFiles(openId, activeTab);
        }
    }, [activeTab, activeMode, openId]);

    const fetchDriveFiles = async (sessionId, type) => {
        setDriveFiles({ list: [], loading: true });
        try {
            const res = await fetch(`/api/scan-sessions/${sessionId}/files/${type}`);
            const data = await res.json();
            setDriveFiles({ list: Array.isArray(data) ? data : [], loading: false });
        } catch (e) { setDriveFiles({ list: [], loading: false }); }
    };

    const createSession = async () => {
        if (!newTitle.trim() || loading) return;
        setLoading(true);
        const res = await fetch('/api/scan-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, classroom: globalClass })
        });
        if (res.ok) { setNewTitle(""); await loadData(); }
        setLoading(false);
    };

    const normalize = (c) => c?.toString().toUpperCase().replace('E', '') || "";
    const filteredSessions = sessions.filter(s => normalize(s.classroom) === normalize(globalClass));
    const availableChapters = chapters.filter(c => normalize(c.classroom) === normalize(globalClass) && !c.isArchived);

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* Barre de création épurée */}
            <div className="bg-white p-3 rounded-[22px] border-2 border-slate-50 flex gap-2 shadow-sm">
                <input className="flex-1 px-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" placeholder="Nouveau titre..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
                <button onClick={createSession} disabled={loading} className="px-6 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px]">Créer</button>
            </div>

            <div className="space-y-2">
                {filteredSessions.map(s => {
                    const isOpen = openId === s._id;
                    const assigned = chapters.find(c => c._id === s.chapterId);

                    return (
                        <div key={s._id} className={`bg-white rounded-[25px] border-2 transition-all ${isOpen ? 'border-indigo-500 shadow-lg' : 'border-slate-50'}`}>
                            
                            {/* BARRE D'OUTILS COMPACTE */}
                            <div className="p-2 px-3 flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setOpenId(isOpen ? null : s._id)}>
                                    <h3 className="font-black text-slate-700 text-xs truncate uppercase tracking-tight">{s.title || "Production"}</h3>
                                    {assigned && <div className="text-[8px] font-black text-emerald-500 uppercase truncate">📁 {assigned.title}</div>}
                                </div>

                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => { setOpenId(s._id); setActiveMode('upload'); if(activeTab === 'corrections') setActiveTab('subject'); }} 
                                        className={`tool-btn ${isOpen && activeMode === 'upload' ? 'active-upload' : ''}`}
                                    >
                                        🚀 UPLOAD
                                    </button>
                                    <button 
                                        onClick={() => { setOpenId(s._id); setActiveMode('files'); }} 
                                        className={`tool-btn ${isOpen && activeMode === 'files' ? 'active-files' : ''}`}
                                    >
                                        📂 FILES
                                    </button>
                                    <button onClick={() => setShowFolderPicker(s._id)} className="tool-btn bg-slate-50 text-slate-400">CLASS</button>
                                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); loadData(); } }} className="tool-btn text-red-200">✕</button>
                                </div>
                            </div>

                            {/* PICKER DOSSIER */}
                            {showFolderPicker === s._id && (
                                <div className="p-4 bg-emerald-50 border-t flex flex-wrap gap-2">
                                    {availableChapters.map(c => <button key={c._id} onClick={() => {
                                        fetch(`/api/scan-sessions/${s._id}/assign-chapter`, {
                                            method: 'PATCH',
                                            headers: {'Content-Type':'application/json'},
                                            body: JSON.stringify({ chapterId: c._id })
                                        }).then(() => { setShowFolderPicker(null); loadData(); });
                                    }} className="px-3 py-2 bg-white border border-emerald-200 rounded-xl text-[9px] font-bold">📁 {c.title}</button>)}
                                    <button onClick={() => setShowFolderPicker(null)} className="px-3 py-2 bg-slate-200 rounded-xl text-[9px] font-black uppercase">Fermer</button>
                                </div>
                            )}

                            {/* CONTENU OUVERT */}
                            {isOpen && !showFolderPicker && (
                                <div className="border-t border-slate-100 p-3 bg-slate-50/30">
                                    
                                    {/* Onglets selon le mode */}
                                    <div className="flex gap-1 mb-4 bg-white/60 p-1 rounded-xl shadow-inner">
                                        <button onClick={() => setActiveTab('subject')} className={`sub-tab ${activeTab === 'subject' ? 'active' : ''}`}>SUJET</button>
                                        <button onClick={() => setActiveTab('copies')} className={`sub-tab ${activeTab === 'copies' ? 'active' : ''}`}>COPIES</button>
                                        
                                        {activeMode === 'upload' ? (
                                            <button onClick={() => setActiveTab('ia')} className={`sub-tab ${activeTab === 'ia' ? 'active-ia-tab' : ''}`}>🤖 IA</button>
                                        ) : (
                                            <button onClick={() => setActiveTab('corrections')} className={`sub-tab ${activeTab === 'corrections' ? 'active' : ''}`}>CORRECTIONS</button>
                                        )}
                                    </div>

                                    {/* VUES DÉTAILLÉES */}
                                    {activeMode === 'upload' && (
                                        activeTab === 'ia' ? (
                                            <div className="space-y-3 animate-in zoom-in">
                                                <div className="bg-white p-4 rounded-2xl border-2 border-emerald-100 shadow-sm">
                                                    <label className="text-[9px] font-black text-emerald-600 uppercase mb-2 block">Instructions de correction</label>
                                                    <textarea className="w-full h-24 p-3 bg-slate-50 rounded-xl border-none outline-none text-xs font-medium" placeholder="Ex: Corriger l'orthographe..." defaultValue={s.teacherInstruction} />
                                                </div>
                                                <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg hover:scale-[1.02] active:scale-95 transition-all">🚀 CORRIGER LES COPIES</button>
                                            </div>
                                        ) : (
                                            <PilotSnap session={s} type={activeTab} onRefresh={loadData} />
                                        )
                                    )}
                                    
                                    {activeMode === 'files' && (
                                        <div className="animate-in zoom-in">
                                            {driveFiles.loading ? <div className="py-10 text-center animate-pulse font-black text-[10px] text-slate-300">SYNC DRIVE...</div> : (
                                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                                    {driveFiles.list.map(f => (
                                                        <a key={f.id} href={f.webViewLink} target="_blank" rel="noreferrer" className="flex flex-col items-center group">
                                                            <div className="w-full aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border-2 border-transparent group-hover:border-indigo-500 shadow-sm">
                                                                <img src={f.thumbnailLink} className="w-full h-full object-cover" alt="prev" />
                                                            </div>
                                                            <span className="text-[6px] font-bold text-slate-400 truncate w-full text-center mt-1">{f.name}</span>
                                                        </a>
                                                    ))}
                                                    {driveFiles.list.length === 0 && <p className="col-span-full text-center py-10 font-black text-[9px] text-slate-300 uppercase italic">Dossier vide</p>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PilotSnap({ session, type, onRefresh }) {
    const videoRef = useRef(null);
    const [capturing, setCapturing] = useState(false);
    const [flash, setFlash] = useState(false);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        }
    };

    useEffect(() => { startCamera(); return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); }, [type]);

    const takeSnap = async () => {
        if (capturing || !videoRef.current) return;
        setCapturing(true); setFlash(true); setTimeout(() => setFlash(false), 150);
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        await fetch('/api/scan-upload-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session._id, type: type, imageBase64: data }) });
        onRefresh(); setCapturing(false);
    };

    const currentPhotos = type === 'subject' ? session.subjectUrls : session.copyUrls;

    return (
        <div className="flex flex-col gap-4">
            <div className="relative aspect-[3/4] max-w-xs mx-auto bg-black rounded-[25px] overflow-hidden border-4 border-white shadow-md">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {flash && <div className="absolute inset-0 bg-white z-50 animate-pulse"></div>}
                <button onClick={takeSnap} disabled={capturing} className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full border-4 border-white/30 shadow-xl ${capturing ? 'bg-red-500 animate-pulse' : 'bg-white'}`} />
                <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[7px] font-black text-white uppercase ${type === 'subject' ? 'bg-orange-500' : 'bg-indigo-600'}`}>
                    {type === 'subject' ? 'SUJET' : 'COPIE'}
                </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar px-1">
                {currentPhotos?.map((id, i) => (
                    <div key={id} className="relative min-w-[55px] h-[75px] bg-slate-200 rounded-lg overflow-hidden border border-white shadow-sm flex-shrink-0">
                        <img src={`https://drive.google.com/thumbnail?id=${id}&sz=w200`} className="w-full h-full object-cover" alt="p" />
                        <div className="absolute top-0.5 left-0.5 bg-black/50 text-white text-[5px] font-black px-1 rounded-sm">{i+1}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}