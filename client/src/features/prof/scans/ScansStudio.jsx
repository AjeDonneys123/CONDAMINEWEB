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

    return (
        <div className="p-2 space-y-4 max-w-5xl mx-auto sm:p-6">
            {/* BARRE DE CREATION - Plus compacte sur mobile */}
            <div className="bg-white p-4 rounded-[30px] border-2 border-indigo-100 shadow-sm flex flex-col sm:flex-row items-center gap-3 sm:p-6">
                <input className="w-full sm:flex-1 p-3 sm:p-4 bg-slate-50 rounded-2xl outline-none font-bold" placeholder="Nom du devoir..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
                <div className="flex w-full sm:w-auto gap-2">
                    <select className="flex-1 sm:w-32 p-3 sm:p-4 bg-slate-50 rounded-2xl font-black text-indigo-600 outline-none" value={newClass} onChange={e=>setNewClass(e.target.value)}>
                        <option value="6D">6D</option><option value="5B">5B</option><option value="1D">1BFI</option>
                    </select>
                    <button onClick={createSession} className="flex-1 sm:w-auto p-3 sm:p-4 bg-indigo-600 text-white rounded-2xl font-black px-6 shadow-lg">CRÉER</button>
                </div>
            </div>

            {/* LISTE DES DEVOIRS */}
            <div className="space-y-3">
                {sessions.map(s => {
                    const parts = s.title.split('_');
                    const prefix = parts.length > 1 ? parts.slice(0, -1).join('_') : "";
                    const datePart = parts.pop();

                    return (
                        <div key={s._id} className={`bg-white rounded-[25px] sm:rounded-[35px] border-2 transition-all ${openId === s._id ? 'border-indigo-500 shadow-lg' : 'border-slate-50'}`}>
                            
                            {/* BANDEAU ADAPTATIF */}
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
                                    />
                                </div>

                                {/* BOUTONS ACTIONS - S'empilent sur petit mobile */}
                                <div className="flex items-center justify-around sm:justify-end gap-1 sm:gap-2 px-2 pb-2 lg:pb-0">
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('quest'); }} className={`px-2 py-2 sm:px-4 rounded-xl font-black text-[8px] sm:text-[9px] uppercase transition-all ${openId===s._id && activeTab==='quest' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>❓ Quest.</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('scan'); }} className={`px-2 py-2 sm:px-4 rounded-xl font-black text-[8px] sm:text-[9px] uppercase transition-all ${openId===s._id && activeTab==='scan' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>📄 Scan</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('ia'); }} className={`px-2 py-2 sm:px-4 rounded-xl font-black text-[8px] sm:text-[9px] uppercase transition-all ${openId===s._id && activeTab==='ia' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>🤖 IA</button>
                                    <button onClick={async (e) => { if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); load(); } }} className="text-slate-200 hover:text-red-400 font-bold px-2 ml-1">✕</button>
                                </div>
                            </div>

                            {openId === s._id && (
                                <div className="p-4 sm:p-8 pt-2 bg-slate-50/50 border-t-2 border-dashed border-slate-100">
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

    const getImgSrc = (id) => {
        if (!id || id.startsWith('data:')) return id;
        return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
    };

    const startCamera = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
        if (videoRef.current) videoRef.current.srcObject = stream;
    };

    useEffect(() => {
        if (tab !== 'ia') startCamera();
        return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    }, [tab, session._id]);

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

    return (
        <div className="space-y-4">
            {tab !== 'ia' ? (
                <>
                    <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black rounded-[30px] overflow-hidden shadow-xl border-4 border-white">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <button onClick={takePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-8 border-white/30 active:scale-90 z-20"></button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto py-2">
                        {localPreviews.filter(p => p.type === (tab==='quest'?'quest':'scan')).map(p => (
                            <img key={p.id} src={p.src} className="h-24 w-16 sm:h-40 sm:w-28 object-cover rounded-xl border-2 border-indigo-400 animate-pulse" />
                        ))}
                        {((tab === 'quest' ? session.questionUrls : session.copyUrls) || []).map((id, i) => (
                            <img key={i} src={getImgSrc(id)} className="h-24 w-16 sm:h-40 sm:w-28 object-cover rounded-xl border-2 border-white shadow-sm" />
                        ))}
                    </div>
                </>
            ) : (
                <textarea 
                    className="w-full p-4 h-32 bg-white rounded-[20px] border-2 border-indigo-100 outline-none text-sm" 
                    defaultValue={session.teacherInstruction} 
                    onBlur={async (e) => {
                        await fetch(`/api/scan-sessions/${session._id}/instructions`, {
                            method: 'PATCH',
                            headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ text: e.target.value })
                        });
                    }}
                    placeholder="Consignes IA..." 
                />
            )}
            <button className="w-full py-4 sm:py-6 bg-indigo-600 text-white rounded-2xl sm:rounded-[35px] font-black text-sm sm:text-xl shadow-lg">🚀 CORRIGER</button>
        </div>
    );
}