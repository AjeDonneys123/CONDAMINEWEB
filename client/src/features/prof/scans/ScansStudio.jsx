import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio() {
    const [sessions, setSessions] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [activeTab, setActiveTab] = useState('scan');
    const [newTitle, setNewTitle] = useState("");
    const [newClass, setNewClass] = useState("6D");

    const load = async () => {
        try {
            const res = await fetch('/api/scan-sessions');
            const data = await res.json();
            setSessions(Array.isArray(data) ? data : []);
        } catch (e) { console.error("Erreur chargement"); }
    };

    useEffect(() => { load(); }, []);

    const createSession = async () => {
        const res = await fetch('/api/scan-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, classroom: newClass })
        });
        if (res.ok) { setNewTitle(""); load(); }
    };

    const handleRename = async (id, oldTitle, newPrefix) => {
        const parts = oldTitle.split('_');
        const oldP = parts.length > 1 ? parts.slice(0, -1).join('_') : "";
        if (newPrefix === oldP) return;
        await fetch(`/api/scan-sessions/${id}/rename`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPrefix })
        });
        load();
    };

    const openAction = (id, tab) => {
        if (openId === id && activeTab === tab) {
            setOpenId(null); // Ferme si on reclique sur le même bouton
        } else {
            setActiveTab(tab);
            setOpenId(id);
        }
    };

    return (
        <div className="p-2 space-y-4 max-w-5xl mx-auto sm:p-6">
            {/* BARRE DE CREATION */}
            <div className="bg-white p-4 rounded-[30px] border-2 border-indigo-100 shadow-sm flex flex-col sm:flex-row items-center gap-3 sm:p-6">
                <input className="flex-1 p-3 sm:p-4 w-full bg-slate-50 rounded-2xl outline-none font-bold" placeholder="Nom du devoir..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
                <div className="flex w-full sm:w-auto gap-2">
                    <select className="flex-1 sm:w-32 p-3 sm:p-4 bg-slate-50 rounded-2xl font-black text-indigo-600 outline-none" value={newClass} onChange={e=>setNewClass(e.target.value)}>
                        <option value="6D">6D</option><option value="5B">5B</option><option value="1D">1BFI</option>
                    </select>
                    <button onClick={createSession} className="flex-1 sm:w-auto p-3 sm:p-4 bg-indigo-600 text-white rounded-2xl font-black px-6 shadow-lg">CRÉER</button>
                </div>
            </div>

            {/* LISTE DES DEVOIRS */}
            <div className="space-y-3 pb-20">
                {sessions.map(s => {
                    const parts = s.title.split('_');
                    const prefix = parts.length > 1 ? parts.slice(0, -1).join('_') : "";
                    const datePart = parts.pop();

                    return (
                        <div key={s._id} className={`bg-white rounded-[25px] sm:rounded-[35px] border-2 transition-all ${openId === s._id ? 'border-indigo-500 shadow-lg' : 'border-slate-50 shadow-sm'}`}>
                            
                            {/* BANDEAU FERMÉ */}
                            <div className="p-2 sm:p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                                <div className="flex items-center gap-3 px-2 flex-1">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-indigo-600 text-[9px] sm:text-[10px]" onClick={() => setOpenId(s._id === openId ? null : s._id)}>
                                        {s.classroom === '1D' ? 'BFI' : s.classroom}
                                    </div>
                                    <input 
                                        className="text-sm sm:text-lg font-bold text-slate-700 bg-transparent border-none outline-none w-full"
                                        defaultValue={prefix}
                                        placeholder={datePart}
                                        onBlur={(e) => handleRename(s._id, s.title, e.target.value)}
                                        onKeyDown={(e) => { if(e.key === 'Enter') e.target.blur(); }}
                                    />
                                </div>

                                <div className="flex items-center justify-around sm:justify-end gap-1 sm:gap-2 px-2 pb-2 lg:pb-0">
                                    <button onClick={() => openAction(s._id, 'quest')} className={`px-2 py-2 sm:px-4 rounded-xl font-black text-[8px] sm:text-[9px] uppercase transition-all ${openId===s._id && activeTab==='quest' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>❓ Quest.</button>
                                    <button onClick={() => openAction(s._id, 'scan')} className={`px-2 py-2 sm:px-4 rounded-xl font-black text-[8px] sm:text-[9px] uppercase transition-all ${openId===s._id && activeTab==='scan' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>📄 Scan</button>
                                    <button onClick={() => openAction(s._id, 'ia')} className={`px-4 py-2 sm:px-4 rounded-xl font-black text-[8px] sm:text-[9px] uppercase transition-all ${openId===s._id && activeTab==='ia' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>🤖 IA</button>
                                    <button onClick={async (e) => { if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); load(); } }} className="text-slate-200 hover:text-red-400 font-bold px-2 ml-1">✕</button>
                                </div>
                            </div>

                            {openId === s._id && (
                                <div className="p-4 sm:p-8 pt-2 bg-slate-50/50 border-t-2 border-dashed border-slate-100 relative">
                                    {/* Bouton Fermer Rapide en haut de zone */}
                                    <button onClick={() => setOpenId(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-slate-300 font-bold sm:hidden">✕</button>
                                    
                                    <PilotArea currentSession={s} tab={activeTab} onUpdateSession={(updated) => {
                                        setSessions(sessions.map(sess => sess._id === updated._id ? updated : sess));
                                    }} onClose={() => setOpenId(null)} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PilotArea({ currentSession, tab, onUpdateSession, onClose }) {
    const [session, setSession] = useState(currentSession);
    const [localPreviews, setLocalPreviews] = useState([]);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const getImgSrc = (id) => {
        if (!id || id.startsWith('data:')) return id;
        return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const startCamera = async () => {
        stopCamera();
        try {
            const constraints = { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } };
            let stream;
            try { stream = await navigator.mediaDevices.getUserMedia(constraints); } 
            catch { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setTimeout(() => { if(videoRef.current) videoRef.current.play().catch(()=>{}); }, 150);
            }
        } catch (e) { console.error("Caméra HS"); }
    };

    useEffect(() => {
        setSession(currentSession);
    }, [currentSession]);

    useEffect(() => {
        if (tab === 'quest' || tab === 'scan') startCamera();
        else stopCamera();
        return () => stopCamera();
    }, [tab]);

    const takePhoto = async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        const tempId = Date.now();
        setLocalPreviews(p => [...p, { id: tempId, src: data, type: tab }]);
        const res = await fetch('/api/scan-upload-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: session._id, type: tab === 'quest'?'quest':'copy', imageBase64: data })
        });
        const updated = await res.json();
        if (updated._id) {
            onUpdateSession(updated);
            setTimeout(() => setLocalPreviews(p => p.filter(x => x.id !== tempId)), 1000);
        }
    };

    const photos = (tab === 'quest' ? session.questionUrls : session.copyUrls) || [];
    const locals = localPreviews.filter(p => p.type === (tab === 'quest' ? 'quest' : 'scan'));

    return (
        <div className="space-y-4 sm:space-y-6">
            {tab !== 'ia' ? (
                <>
                    <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black rounded-[30px] sm:rounded-[40px] overflow-hidden shadow-2xl border-4 border-white">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <button onClick={takePhoto} className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full border-8 border-white/30 shadow-2xl active:scale-90 z-20"></button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto py-2 px-1">
                        {locals.map(p => (
                            <div key={p.id} className="relative flex-shrink-0 animate-pulse">
                                <img src={p.src} className="h-32 w-24 sm:h-40 sm:w-28 object-cover rounded-2xl border-2 border-indigo-400" />
                            </div>
                        ))}
                        {photos.map((id, i) => (
                            <div key={i} className="relative flex-shrink-0 group">
                                <img src={getImgSrc(id)} className="h-32 w-24 sm:h-40 sm:w-28 object-cover rounded-2xl border-2 border-white shadow-md bg-slate-200" />
                                <a href={`https://drive.google.com/uc?export=view&id=${id}`} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-2xl text-white">👁️</a>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Consignes IA</label>
                    <textarea 
                        className="w-full p-4 sm:p-6 h-32 sm:h-40 bg-white rounded-[20px] sm:rounded-[35px] border-2 border-indigo-100 outline-none font-medium shadow-inner"
                        defaultValue={session.teacherInstruction}
                        placeholder="Tape tes consignes ici..."
                        onBlur={async (e) => {
                            await fetch(`/api/scan-sessions/${session._id}/instructions`, {
                                method: 'PATCH',
                                headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({ text: e.target.value })
                            });
                        }}
                    />
                </div>
            )}

            {/* BOUTONS ACTIONS FINALES */}
            <div className="flex flex-col gap-3">
                <button className="w-full py-4 sm:py-6 bg-indigo-600 text-white rounded-2xl sm:rounded-[35px] font-black text-sm sm:text-xl shadow-xl shadow-indigo-100 active:scale-95 transition-all">
                    🚀 CORRIGER LE DEVOIR
                </button>
                <button 
                    onClick={onClose}
                    className="w-full py-3 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] sm:text-xs uppercase hover:bg-slate-200 transition-all"
                >
                    ✕ Fermer le volet
                </button>
            </div>
        </div>
    );
}