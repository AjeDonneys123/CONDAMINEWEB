import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio({ globalClass }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [activeTab, setActiveTab] = useState('scan');
    const [showFolderPicker, setShowFolderPicker] = useState(null);
    const [newTitle, setNewTitle] = useState("");
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        try {
            const sRes = await fetch('/api/scan-sessions').then(r => r.ok ? r.json() : []);
            setSessions(Array.isArray(sRes) ? sRes : []);

            const cRes = await fetch('/api/chapters-all').then(r => r.ok ? r.json() : []);
            setChapters(Array.isArray(cRes) ? cRes : []);
        } catch (e) { console.error("ERREUR CHARGEMENT SCANS:", e); }
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const createSession = async () => {
        if (loading || !newTitle.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/scan-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, classroom: globalClass })
            });
            if (res.ok) {
                setNewTitle("");
                await loadData();
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const assignToFolder = async (sessionId, chapterId) => {
        try {
            await fetch(`/api/scan-sessions/${sessionId}/assign-chapter`, {
                method: 'PATCH',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ chapterId })
            });
            setShowFolderPicker(null);
            await loadData();
        } catch (e) { console.error(e); }
    };

    const normalize = (c) => c?.toString().toUpperCase().replace('E', '') || "";
    const filteredSessions = sessions.filter(s => normalize(s.classroom) === normalize(globalClass));
    const activeChapters = chapters.filter(c => normalize(c.classroom) === normalize(globalClass) && !c.isArchived);

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="bg-white p-4 rounded-[30px] border-2 border-indigo-100 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">Nouvelle Production {globalClass}</span>
                <div className="flex items-center gap-3">
                    <input className="flex-1 p-3 bg-slate-50 rounded-2xl outline-none font-bold" placeholder="Nom du travail (ex: Correction Dictée)..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
                    <button onClick={createSession} disabled={loading} className="p-3 bg-indigo-600 text-white rounded-2xl font-black px-6 shadow-lg uppercase text-xs">Créer</button>
                </div>
            </div>

            <div className="space-y-3">
                {filteredSessions.map(s => {
                    const isLocalOpen = openId === s._id;
                    const assignedChapter = chapters.find(c => c._id === s.chapterId);

                    return (
                        <div key={s._id} className={`bg-white rounded-[25px] border-2 transition-all ${isLocalOpen ? 'border-indigo-500 shadow-xl' : 'border-slate-50'}`}>
                            <div className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenId(isLocalOpen ? null : s._id)}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${isLocalOpen ? 'bg-indigo-600 text-white rotate-180' : 'bg-indigo-50 text-indigo-400'}`}>▼</div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-700">{s.title}</span>
                                        <span className="text-[9px] font-black text-emerald-500 uppercase">{assignedChapter ? `📁 Dossier : ${assignedChapter.title}` : '📂 Non classé'}</span>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2">
                                    <button onClick={() => setShowFolderPicker(s._id)} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-[9px] uppercase">Classer</button>
                                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); await loadData(); } }} className="text-slate-200 hover:text-red-400 font-bold px-3">✕</button>
                                </div>
                            </div>

                            {showFolderPicker === s._id && (
                                <div className="p-4 bg-emerald-50 border-t border-emerald-100 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                                    <p className="col-span-2 text-[9px] font-black text-emerald-700 uppercase mb-1">Choisir le dossier de destination :</p>
                                    {activeChapters.map(chap => (
                                        <button key={chap._id} onClick={() => assignToFolder(s._id, chap._id)} className="p-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-600 hover:border-emerald-500 text-left truncate">📁 {chap.title}</button>
                                    ))}
                                    <button onClick={() => setShowFolderPicker(null)} className="p-3 bg-slate-100 rounded-xl text-xs font-black text-slate-400 uppercase">Annuler</button>
                                </div>
                            )}

                            {isLocalOpen && !showFolderPicker && (
                                <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100">
                                    <div className="flex justify-around gap-2 mb-4">
                                        <button onClick={() => setActiveTab('scan')} className={`flex-1 py-2 rounded-xl font-black text-[10px] ${activeTab==='scan'?'bg-indigo-600 text-white':'bg-white text-slate-400'}`}>APPAREIL PHOTO</button>
                                        <button onClick={() => setActiveTab('docs')} className={`flex-1 py-2 rounded-xl font-black text-[10px] ${activeTab==='docs'?'bg-indigo-600 text-white':'bg-white text-slate-400'}`}>COPIES ({s.copyUrls?.length || 0})</button>
                                    </div>
                                    <PilotArea currentSession={s} tab={activeTab} onRefresh={loadData} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PilotArea({ currentSession, tab, onRefresh }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        }
    };

    useEffect(() => {
        if (tab === 'scan') startCamera();
        return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    }, [tab]);

    const takePhoto = async () => {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.6);

        await fetch('/api/scan-upload-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: currentSession._id, type: 'copy', imageBase64: data })
        });
        onRefresh();
    };

    if (tab === 'scan') {
        return (
            <div className="space-y-4">
                <div className="relative aspect-[3/4] max-w-xs mx-auto bg-black rounded-[30px] overflow-hidden border-4 border-white shadow-lg">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    <button onClick={takePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 bg-white rounded-full border-4 border-indigo-200 shadow-xl active:scale-90"></button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-4 gap-2">
            {currentSession.copyUrls?.map((url, i) => (
                <div key={i} className="relative aspect-[3/4] bg-slate-200 rounded-lg overflow-hidden border">
                    <img src={url.startsWith('http') ? url : `https://drive.google.com/thumbnail?id=${url}&sz=w200`} className="w-full h-full object-cover" />
                </div>
            ))}
            {(!currentSession.copyUrls || currentSession.copyUrls.length === 0) && <p className="col-span-4 text-center py-10 text-[10px] font-bold text-slate-300 uppercase">Aucune photo</p>}
        </div>
    );
}