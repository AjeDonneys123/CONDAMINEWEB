import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio() {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [activeTab, setActiveTab] = useState('scan');
    const [selectedClass, setSelectedClass] = useState("6D");
    const [showFolderPicker, setShowFolderPicker] = useState(null);
    const [newTitle, setNewTitle] = useState("");
    const [loading, setLoading] = useState(false);

    const classes = ["6D", "5B", "5C", "2A", "2CD", "1BFI"];

    const loadData = async () => {
        const [sRes, cRes] = await Promise.all([
            fetch('/api/scan-sessions').then(r => r.json()),
            fetch('/api/chapters-all').then(r => r.json())
        ]);
        setSessions(Array.isArray(sRes) ? sRes : []);
        setChapters(Array.isArray(cRes) ? cRes : []);
    };

    useEffect(() => { loadData(); }, []);

    const createSession = async () => {
        setLoading(true);
        await fetch('/api/scan-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, classroom: selectedClass })
        });
        setNewTitle(""); loadData();
        setLoading(false);
    };

    const assignToFolder = async (sessionId, chapterId) => {
        await fetch(`/api/scan-sessions/${sessionId}/assign-chapter`, {
            method: 'PATCH',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ chapterId })
        });
        setShowFolderPicker(null);
        loadData();
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
        loadData();
    };

    const filteredSessions = sessions.filter(s => s.classroom === selectedClass && !s.chapterId);
    const activeChapters = chapters.filter(c => c.classroom === selectedClass && !c.isArchived);

    return (
        <div className="p-2 space-y-4 max-w-5xl mx-auto sm:p-6">
            {/* CLASSES EN HAUT */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {classes.map(c => (
                    <button key={c} onClick={() => setSelectedClass(c)} className={`px-6 py-3 rounded-2xl font-black text-xs transition-all ${selectedClass === c ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white text-slate-400 border border-slate-100'}`}>{c}</button>
                ))}
            </div>

            {/* CRÉATION */}
            <div className="bg-white p-4 rounded-[30px] border-2 border-indigo-100 shadow-sm flex items-center gap-3">
                <input className="flex-1 p-3 bg-slate-50 rounded-2xl outline-none font-bold" placeholder={`Nouveau devoir pour ${selectedClass}...`} value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
                <button onClick={createSession} disabled={loading} className="p-3 bg-indigo-600 text-white rounded-2xl font-black px-6 shadow-lg uppercase text-xs">Créer</button>
            </div>

            {/* LISTE DES SCANS */}
            <div className="space-y-2">
                {filteredSessions.map(s => {
                    const prefix = s.title.includes('_') ? s.title.split('_').slice(0, -1).join('_') : "";
                    const datePart = s.title.split('_').pop();
                    const isLocalOpen = openId === s._id;

                    return (
                        <div key={s._id} className={`bg-white rounded-[25px] border-2 transition-all ${isLocalOpen ? 'border-indigo-500 shadow-xl' : 'border-slate-50'}`}>
                            <div className="p-2 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                                <div className="flex items-center gap-3 px-2 flex-1 cursor-pointer" onClick={() => setOpenId(isLocalOpen ? null : s._id)}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${isLocalOpen ? 'bg-indigo-600 text-white rotate-180' : 'bg-indigo-50 text-indigo-400'}`}>▼</div>
                                    <input className="text-sm sm:text-lg font-bold text-slate-700 bg-transparent border-none outline-none w-full" defaultValue={prefix} placeholder={datePart} onBlur={(e) => handleRename(s._id, s.title, e.target.value)} onClick={e => e.stopPropagation()} />
                                    <button onClick={(e) => { e.stopPropagation(); setShowFolderPicker(s._id); }} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-[9px] uppercase">💾 Enregistrer</button>
                                </div>
                                <div className="flex items-center justify-around gap-1 px-2">
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('quest'); }} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase ${isLocalOpen && activeTab==='quest' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>❓ Q.</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('scan'); }} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase ${isLocalOpen && activeTab==='scan' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>📄 Scan</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('docs'); }} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase ${isLocalOpen && activeTab==='docs' ? 'bg-indigo-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>📂 Copies {s.copyUrls?.length || 0}</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('ia'); }} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase ${isLocalOpen && activeTab==='ia' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>🤖 IA</button>
                                    <button onClick={async (e) => { e.stopPropagation(); if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); loadData(); } }} className="text-slate-200 hover:text-red-400 font-bold px-3 text-lg">✕</button>
                                </div>
                            </div>

                            {showFolderPicker === s._id && (
                                <div className="p-4 bg-emerald-50 border-t border-emerald-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {activeChapters.map(chap => (
                                        <button key={chap._id} onClick={() => assignToFolder(s._id, chap._id)} className="p-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-600 hover:border-emerald-500">📁 {chap.title}</button>
                                    ))}
                                    <button onClick={() => setShowFolderPicker(null)} className="p-3 bg-slate-100 rounded-xl text-xs font-black text-slate-400 uppercase">Annuler</button>
                                </div>
                            )}

                            {isLocalOpen && !showFolderPicker && <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100"><PilotArea currentSession={s} tab={activeTab} onClose={() => setOpenId(null)} onRefresh={loadData} /></div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// (PilotArea reste identique aux versions précédentes fonctionnelles)
function PilotArea({ currentSession, tab, onClose, onRefresh }) {
    const [session, setSession] = useState(currentSession);
    const [localPreviews, setLocalPreviews] = useState([]);
    const videoRef = useRef(null);
    const getImgSrc = (id) => id.startsWith('data:') ? id : `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
    const startCamera = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
        if (videoRef.current) videoRef.current.srcObject = stream;
    };
    useEffect(() => { if (tab === 'quest' || tab === 'scan') startCamera(); return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); }, [tab]);
    const takePhoto = async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.6);
        const tempId = Date.now();
        setLocalPreviews(p => [...p, { id: tempId, src: data, type: tab }]);
        const res = await fetch('/api/scan-upload-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session._id, type: tab==='quest'?'quest':'copy', imageBase64: data }) });
        const updated = await res.json();
        if (updated._id) { setSession(updated); onRefresh(); setTimeout(() => setLocalPreviews(p => p.filter(x => x.id !== tempId)), 1500); }
    };
    return (
        <div className="space-y-4">
            {(tab === 'quest' || tab === 'scan') && (
                <div className="space-y-4">
                    <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black rounded-[30px] overflow-hidden shadow-2xl border-4 border-white">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <button onClick={takePhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-8 border-white/30 active:scale-90 z-20"></button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto py-2">
                        {localPreviews.filter(p => p.type === (tab==='quest'?'quest':'scan')).map(p => (
                            <img key={p.id} src={p.src} className="h-24 w-16 object-cover rounded-xl border-2 border-indigo-400 animate-pulse" />
                        ))}
                    </div>
                </div>
            )}
            {tab === 'docs' && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {session.copyUrls?.map((id, i) => (
                        <div key={i} className="relative aspect-[3/4]">
                            <img src={getImgSrc(id)} className="w-full h-full object-cover rounded-2xl border-2 border-white shadow-md bg-slate-100" />
                            <button onClick={async () => { if(confirm("Supprimer ?")) { const res = await fetch('/api/scan-delete-photo', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionId: session._id, type: 'copy', url: id }) }); const upd = await res.json(); setSession(upd); onRefresh(); } }} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold shadow-md">✕</button>
                        </div>
                    ))}
                </div>
            )}
            {tab === 'ia' && (
                <textarea className="w-full p-6 h-40 bg-white rounded-[25px] border-2 border-indigo-100 outline-none font-medium" defaultValue={session.teacherInstruction} onBlur={async (e) => { await fetch(`/api/scan-sessions/${session._id}/instructions`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text: e.target.value }) }); }} placeholder="Consignes IA..." />
            )}