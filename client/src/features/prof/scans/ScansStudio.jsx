import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio() {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [activeTab, setActiveTab] = useState('scan');
    const [selectedClass, setSelectedClass] = useState("6D");
    const [showFolderPicker, setShowFolderPicker] = useState(null);

    const loadData = async () => {
        const [sRes, cRes] = await Promise.all([
            fetch('/api/scan-sessions').then(r => r.json()),
            fetch('/api/chapters-all').then(r => r.json())
        ]);
        setSessions(Array.isArray(sRes) ? sRes : []);
        setChapters(Array.isArray(cRes) ? cRes : []);
    };

    useEffect(() => { loadData(); }, []);

    const assignToFolder = async (sessionId, chapterId) => {
        await fetch(`/api/scan-sessions/${sessionId}/assign-chapter`, {
            method: 'PATCH',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ chapterId })
        });
        setShowFolderPicker(null);
        loadData(); // Le devoir disparaîtra car il aura maintenant un chapterId
    };

    // On ne montre que les devoirs qui n'ont pas encore été "classés" (chapterId vide)
    const filteredSessions = sessions.filter(s => s.classroom === selectedClass && !s.chapterId);
    const activeChapters = chapters.filter(c => c.classroom === selectedClass && !c.isArchived);

    return (
        <div className="p-2 space-y-4 max-w-5xl mx-auto sm:p-6">
            {/* TABS CLASSES */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {["6D", "5B", "5C", "2A", "2CD", "1BFI"].map(c => (
                    <button key={c} onClick={() => setSelectedClass(c)} className={`px-6 py-3 rounded-2xl font-black text-xs transition-all ${selectedClass === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}>{c}</button>
                ))}
            </div>

            {/* LISTE DES SCANS NON CLASSÉS */}
            <div className="space-y-2">
                {filteredSessions.map(s => {
                    const prefix = s.title.includes('_') ? s.title.split('_').slice(0, -1).join('_') : "";
                    return (
                        <div key={s._id} className="bg-white rounded-[25px] border-2 border-slate-50 shadow-sm overflow-hidden">
                            <div className="p-2 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                                <div className="flex items-center gap-3 px-2 flex-1">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs bg-indigo-50 text-indigo-400 cursor-pointer" onClick={() => setOpenId(openId === s._id ? null : s._id)}>▼</div>
                                    <b className="text-slate-700 font-extrabold">{prefix || s.title}</b>
                                    
                                    {/* BOUTON ENREGISTRER (À CÔTÉ DU NOM) */}
                                    <button 
                                        onClick={() => setShowFolderPicker(s._id)}
                                        className="ml-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-[9px] uppercase hover:bg-emerald-600 hover:text-white transition-all"
                                    >
                                        💾 Enregistrer
                                    </button>
                                </div>

                                <div className="flex items-center gap-1 px-2">
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('quest'); }} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase ${openId===s._id && activeTab==='quest'?'bg-indigo-600 text-white':'text-slate-400'}`}>❓ Q.</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('scan'); }} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase ${openId===s._id && activeTab==='scan'?'bg-indigo-600 text-white':'text-slate-400'}`}>📄 Scan</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('docs'); }} className={`px-3 py-2 rounded-xl font-black text-[8px] uppercase ${openId===s._id && activeTab==='docs'?'bg-indigo-600 text-white':'text-slate-400'}`}>📂 Copies {s.copyUrls?.length || 0}</button>
                                    
                                    {/* CROIX GRISE */}
                                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); loadData(); } }} className="text-slate-200 hover:text-slate-400 font-bold px-3">✕</button>
                                </div>
                            </div>

                            {/* PICKER DE DOSSIER (MENU DÉROULANT) */}
                            {showFolderPicker === s._id && (
                                <div className="p-4 bg-emerald-50 border-t border-emerald-100 animate-in slide-in-from-top-2">
                                    <p className="text-[9px] font-black text-emerald-700 uppercase mb-3 px-2">Choisir le dossier de destination :</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {activeChapters.map(chap => (
                                            <button 
                                                key={chap._id} 
                                                onClick={() => assignToFolder(s._id, chap._id)}
                                                className="p-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all text-left truncate"
                                            >
                                                📁 {chap.title}
                                            </button>
                                        ))}
                                        <button onClick={() => setShowFolderPicker(null)} className="p-3 bg-slate-100 rounded-xl text-xs font-black text-slate-400 uppercase">Annuler</button>
                                    </div>
                                </div>
                            )}

                            {openId === s._id && !showFolderPicker && (
                                <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100">
                                    <PilotArea currentSession={s} tab={activeTab} onClose={() => setOpenId(null)} onRefresh={loadData} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// (Reste du composant PilotArea inchangé)
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
                <div className="space-y-4">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {session.copyUrls?.map((id, i) => (
                            <div key={i} className="relative aspect-[3/4]">
                                <img src={getImgSrc(id)} className="w-full h-full object-cover rounded-2xl border-2 border-white shadow-md bg-slate-100" alt="copy" />
                                <button onClick={async () => { if(confirm("Supprimer ?")) { const res = await fetch('/api/scan-delete-photo', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionId: session._id, type: 'copy', url: id }) }); const upd = await res.json(); setSession(upd); onRefresh(); } }} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold shadow-md">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {tab === 'ia' && (
                <textarea className="w-full p-6 h-40 bg-white rounded-[25px] border-2 border-indigo-100 outline-none font-medium" defaultValue={session.teacherInstruction} onBlur={async (e) => { await fetch(`/api/scan-sessions/${session._id}/instructions`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text: e.target.value }) }); }} placeholder="Consignes IA..." />
            )}
            <div className="flex flex-col gap-2 pt-4">
                <button className="w-full py-5 bg-indigo-600 text-white rounded-[25px] font-black text-base shadow-xl">🚀 CORRIGER LE DEVOIR</button>
                <button onClick={onClose} className="w-full py-3 bg-white text-slate-300 rounded-xl font-bold text-[10px] uppercase">Fermer le volet</button>
            </div>
        </div>
    );
}