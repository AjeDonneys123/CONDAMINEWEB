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
        if (res.ok) {
            setNewTitle("");
            load();
        }
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

    // FIX : Fermeture propre du div
    const toggleSession = (id) => {
        setOpenId(prev => prev === id ? null : id);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation(); // Empeche l'ouverture du div
        if(!confirm("Supprimer définitivement ce devoir et son dossier Drive ?")) return;
        try {
            const res = await fetch(`/api/scan-sessions/${id}`, { method: 'DELETE' });
            if (res.ok) load();
        } catch (e) { alert("Erreur lors de la suppression"); }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-[40px] border-2 border-indigo-100 shadow-sm flex items-center gap-4">
                <input className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none font-bold" placeholder="Nouveau devoir..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
                <select className="p-4 bg-slate-50 rounded-2xl font-black text-indigo-600 outline-none" value={newClass} onChange={e=>setNewClass(e.target.value)}>
                    <option value="6D">6D</option><option value="5B">5B</option><option value="5C">5C</option><option value="2A">2A</option><option value="1D">1BFI</option>
                </select>
                <button onClick={createSession} className="p-4 bg-indigo-600 text-white rounded-2xl font-black px-6 shadow-lg">CRÉER</button>
            </div>

            <div className="space-y-3">
                {sessions.map(s => {
                    const parts = s.title.split('_');
                    const prefix = parts.length > 1 ? parts.slice(0, -1).join('_') : "";
                    const datePart = parts[parts.length - 1];

                    return (
                        <div key={s._id} className={`bg-white rounded-[35px] border-2 transition-all ${openId === s._id ? 'border-indigo-500 shadow-xl' : 'border-slate-50 shadow-sm'}`}>
                            <div className="p-3 pl-5 flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center font-black text-indigo-600 text-[10px]" onClick={() => toggleSession(s._id)}>
                                        {s.classroom === '1D' ? 'BFI' : s.classroom}
                                    </div>
                                    <input 
                                        className="text-lg font-bold text-slate-700 bg-transparent border-none outline-none w-full max-w-[200px]"
                                        defaultValue={prefix}
                                        placeholder={datePart}
                                        onBlur={(e) => handleRename(s._id, s.title, e.target.value)}
                                        onKeyDown={(e) => { if(e.key === 'Enter') e.target.blur(); }}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { toggleSession(s._id); setActiveTab('quest'); }} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${openId===s._id && activeTab==='quest' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-indigo-50'}`}>❓ Questions</button>
                                    <button onClick={() => { toggleSession(s._id); setActiveTab('scan'); }} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${openId===s._id && activeTab==='scan' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>📄 Scanner</button>
                                    <button onClick={() => { toggleSession(s._id); setActiveTab('ia'); }} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${openId===s._id && activeTab==='ia' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-indigo-50'}`}>🤖 IA</button>
                                    <button onClick={(e) => handleDelete(s._id, e)} className="text-slate-200 hover:text-red-400 font-bold px-3">✕</button>
                                </div>
                            </div>
                            {openId === s._id && (
                                <div className="p-8 pt-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 animate-in slide-in-from-top-4">
                                    <PilotArea currentSession={s} tab={activeTab} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PilotArea({ currentSession, tab }) {
    const [session, setSession] = useState(currentSession);
    const [localPreviews, setLocalPreviews] = useState([]);
    const videoRef = useRef(null);

    // FIX : Génération de vignette via l'ID Drive
    const getThumb = (id) => {
        if (!id || id.startsWith('data:')) return id;
        return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if(videoRef.current) videoRef.current.srcObject = stream;
        } catch(e) { console.error("Caméra bloquée"); }
    };

    useEffect(() => {
        if (tab === 'quest' || tab === 'scan') startCamera();
        return () => { if(videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop()); };
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
            setSession(updated);
            setTimeout(() => setLocalPreviews(p => p.filter(x => x.id !== tempId)), 1000);
        }
    };

    const photos = (tab === 'quest' ? session.questionUrls : session.copyUrls) || [];
    const locals = localPreviews.filter(p => p.type === (tab === 'quest' ? 'quest' : 'scan'));

    return (
        <div className="space-y-6">
            {tab !== 'ia' ? (
                <>
                    <div className="relative aspect-[3/4] max-w-md mx-auto bg-black rounded-[40px] overflow-hidden shadow-2xl border-4 border-white">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <button onClick={takePhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 bg-white rounded-full border-8 border-white/30 shadow-2xl active:scale-90 z-20"></button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto py-2">
                        {locals.map(p => (
                            <div key={p.id} className="relative flex-shrink-0 animate-pulse">
                                <img src={p.src} className="h-40 w-28 object-cover rounded-2xl border-2 border-indigo-400" />
                            </div>
                        ))}
                        {photos.map((id, i) => (
                            <div key={i} className="relative flex-shrink-0 group">
                                <img src={getThumb(id)} className="h-40 w-28 object-cover rounded-2xl border-2 border-white shadow-md bg-slate-200" />
                                <a href={`https://drive.google.com/uc?export=view&id=${id}`} target="_blank" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-2xl text-white">👁️</a>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <textarea 
                    className="w-full p-6 h-40 bg-white rounded-[35px] border-2 border-indigo-100 outline-none font-medium shadow-inner"
                    defaultValue={session.teacherInstruction}
                    placeholder="Consignes IA..."
                    onBlur={async (e) => {
                        await fetch(`/api/scan-sessions/${session._id}/instructions`, {
                            method: 'PATCH',
                            headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ text: e.target.value })
                        });
                    }}
                />
            )}
            <button className="w-full py-6 bg-indigo-600 text-white rounded-[35px] font-black text-xl shadow-xl shadow-indigo-100">🚀 CORRIGER LE DEVOIR</button>
        </div>
    );
}