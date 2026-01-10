import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio() {
    const [sessions, setSessions] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [activeTab, setActiveTab] = useState('scan');
    const [newTitle, setNewTitle] = useState("");
    const [selectedClass, setSelectedClass] = useState("6D"); // Classe globale
    const [loading, setLoading] = useState(false);

    const classes = ["6D", "5B", "5C", "2A", "2CD", "1BFI"];

    const load = async () => {
        try {
            const res = await fetch('/api/scan-sessions');
            const data = await res.json();
            setSessions(Array.isArray(data) ? data : []);
        } catch (e) { console.error("Erreur chargement"); }
    };

    useEffect(() => { load(); }, []);

    const createSession = async () => {
        setLoading(true);
        const res = await fetch('/api/scan-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, classroom: selectedClass })
        });
        if (res.ok) { setNewTitle(""); load(); }
        setLoading(false);
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
        setActiveTab(tab);
        setOpenId(id === openId && tab === activeTab ? null : id);
    };

    // Filtrage des devoirs selon la classe sélectionnée en haut
    const filteredSessions = sessions.filter(s => s.classroom === selectedClass);

    return (
        <div className="p-2 space-y-4 max-w-5xl mx-auto sm:p-6">
            
            {/* 1. SÉLECTION DE LA CLASSE (TABS) */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {classes.map(c => (
                    <button 
                        key={c}
                        onClick={() => setSelectedClass(c)}
                        className={`px-6 py-3 rounded-2xl font-black text-xs transition-all flex-shrink-0 ${selectedClass === c ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white text-slate-400 border border-slate-100'}`}
                    >
                        {c}
                    </button>
                ))}
            </div>

            {/* 2. BARRE DE CREATION (Liée à la classe sélectionnée) */}
            <div className="bg-white p-4 rounded-[30px] border-2 border-indigo-100 shadow-sm flex items-center gap-3">
                <input 
                    className="flex-1 p-3 bg-slate-50 rounded-2xl outline-none font-bold" 
                    placeholder={`Nouveau devoir pour ${selectedClass}...`} 
                    value={newTitle} 
                    onChange={e=>setNewTitle(e.target.value)} 
                />
                <button onClick={createSession} disabled={loading} className="p-3 bg-indigo-600 text-white rounded-2xl font-black px-6 shadow-lg uppercase text-xs">
                    {loading ? '...' : 'Créer'}
                </button>
            </div>

            {/* 3. LISTE DES DEVOIRS FILTRÉS */}
            <div className="space-y-2">
                {filteredSessions.map(s => {
                    const prefix = s.title.includes('_') ? s.title.split('_').slice(0, -1).join('_') : "";
                    const datePart = s.title.split('_').pop();
                    const isLocalOpen = openId === s._id;
                    const copyCount = s.copyUrls?.length || 0;

                    return (
                        <div key={s._id} className={`bg-white rounded-[25px] border-2 transition-all ${isLocalOpen ? 'border-indigo-500 shadow-xl' : 'border-slate-50 shadow-sm'}`}>
                            
                            <div className="p-2 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                                <div className="flex items-center gap-3 px-2 flex-1">
                                    {/* On a remplacé le div 6D par une flèche de déploiement */}
                                    <div 
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl cursor-pointer transition-all ${isLocalOpen ? 'bg-indigo-600 text-white rotate-180' : 'bg-slate-50 text-indigo-200'}`}
                                        onClick={() => setOpenId(isLocalOpen ? null : s._id)}
                                    >
                                        ▾
                                    </div>
                                    <input 
                                        className="text-sm sm:text-lg font-bold text-slate-700 bg-transparent border-none outline-none w-full"
                                        defaultValue={prefix}
                                        placeholder={datePart}
                                        onBlur={(e) => handleRename(s._id, s.title, e.target.value)}
                                    />
                                </div>

                                {/* BOUTONS ACTIONS */}
                                <div className="flex items-center justify-around sm:justify-end gap-1 px-2 pb-1 lg:pb-0">
                                    <button onClick={() => openAction(s._id, 'quest')} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase transition-all ${isLocalOpen && activeTab==='quest' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>❓ Quest.</button>
                                    <button onClick={() => openAction(s._id, 'scan')} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase transition-all ${isLocalOpen && activeTab==='scan' ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600'}`}>📄 Scan</button>
                                    
                                    {/* NOUVEAU BOUTON : DEVOIRS (COPIES) */}
                                    <button onClick={() => openAction(s._id, 'docs')} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase transition-all flex items-center gap-1 ${isLocalOpen && activeTab==='docs' ? 'bg-indigo-600 text-white shadow-md' : 'bg-emerald-50 text-emerald-600'}`}>
                                        📂 Copies <span className={`px-1.5 rounded-md ${isLocalOpen && activeTab==='docs' ? 'bg-white text-indigo-600' : 'bg-emerald-600 text-white'}`}>{copyCount}</span>
                                    </button>

                                    <button onClick={() => openAction(s._id, 'ia')} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase transition-all ${isLocalOpen && activeTab==='ia' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>🤖 IA</button>
                                    <button onClick={async (e) => { if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); load(); } }} className="text-slate-200 hover:text-red-400 font-bold px-2 ml-1 text-lg">✕</button>
                                </div>
                            </div>

                            {isLocalOpen && (
                                <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 animate-in slide-in-from-top-2">
                                    <PilotArea currentSession={s} tab={activeTab} onClose={() => setOpenId(null)} onRefresh={load} />
                                </div>
                            )}
                        </div>
                    );
                })}
                {filteredSessions.length === 0 && (
                    <div className="text-center py-20 text-slate-300 font-black uppercase italic text-xs tracking-widest">Aucun devoir pour la classe {selectedClass}</div>
                )}
            </div>
        </div>
    );
}

function PilotArea({ currentSession, tab, onClose, onRefresh }) {
    const [session, setSession] = useState(currentSession);
    const [localPreviews, setLocalPreviews] = useState([]);
    const videoRef = useRef(null);

    const getImgSrc = (url) => {
        if (!url || url.startsWith('data:')) return url;
        const id = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/);
        return id ? `https://drive.google.com/thumbnail?id=${id[1]}&sz=w400` : url;
    };

    const startCamera = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
        if (videoRef.current) videoRef.current.srcObject = stream;
    };

    useEffect(() => {
        if (tab === 'quest' || tab === 'scan') startCamera();
        return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    }, [tab]);

    const takePhoto = async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.6);
        const tempId = Date.now();
        setLocalPreviews(p => [...p, { id: tempId, src: data, type: tab }]);
        
        const res = await fetch('/api/scan-upload-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: session._id, type: tab === 'quest'?'quest':'copy', imageBase64: data })
        });
        const updated = await res.json();
        if (updated._id) {
            setSession(updated);
            onRefresh(); // Met à jour les compteurs dans la liste parente
            setTimeout(() => setLocalPreviews(p => p.filter(x => x.id !== tempId)), 1000);
        }
    };

    const deletePhoto = async (url, type) => {
        if(!confirm("Supprimer ?")) return;
        const res = await fetch('/api/scan-delete-photo', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ sessionId: session._id, type, url })
        });
        const updated = await res.json();
        if(updated._id) { setSession(updated); onRefresh(); }
    };

    // LOGIQUE D'AFFICHAGE SELON L'ONGLET
    return (
        <div className="space-y-4">
            {(tab === 'quest' || tab === 'scan') && (
                <div className="space-y-4">
                    <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black rounded-[30px] overflow-hidden shadow-2xl border-4 border-white">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <button onClick={takePhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-8 border-white/30 shadow-2xl active:scale-90 z-20"></button>
                    </div>
                    {/* APERCU RAPIDE SOUS CAMERA */}
                    <div className="flex gap-2 overflow-x-auto py-2">
                        {localPreviews.filter(p => p.type === (tab==='quest'?'quest':'scan')).map(p => (
                            <img key={p.id} src={p.src} className="h-24 w-16 object-cover rounded-xl border-2 border-indigo-400 animate-pulse" />
                        ))}
                    </div>
                </div>
            )}

            {tab === 'docs' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h4 className="font-black text-emerald-600 text-[10px] uppercase tracking-widest">Copies Scannées ({session.copyUrls?.length || 0})</h4>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {session.copyUrls?.map((url, i) => (
                            <div key={i} className="relative group aspect-[3/4]">
                                <img src={getImgSrc(url)} className="w-full h-full object-cover rounded-2xl border-2 border-white shadow-md" alt="copy" />
                                <button onClick={() => deletePhoto(url, 'copy')} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold shadow-md">✕</button>
                            </div>
                        ))}
                        {session.copyUrls?.length === 0 && <p className="col-span-full py-10 text-center text-slate-300 italic text-xs">Aucune copie dans ce dossier</p>}
                    </div>
                </div>
            )}

            {tab === 'ia' && (
                <textarea 
                    className="w-full p-6 h-40 bg-white rounded-[25px] border-2 border-indigo-100 outline-none font-medium" 
                    defaultValue={session.teacherInstruction} 
                    onBlur={async (e) => {
                        await fetch(`/api/scan-sessions/${session._id}/instructions`, {
                            method: 'PATCH',
                            headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ text: e.target.value })
                        });
                    }}
                    placeholder="Tape tes consignes IA ici..." 
                />
            )}

            <div className="flex flex-col gap-2 pt-4">
                <button className="w-full py-5 bg-indigo-600 text-white rounded-[25px] font-black text-base shadow-xl shadow-indigo-100">🚀 CORRIGER LE DEVOIR</button>
                <button onClick={onClose} className="w-full py-3 bg-white text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest">Fermer le volet</button>
            </div>
        </div>
    );
}