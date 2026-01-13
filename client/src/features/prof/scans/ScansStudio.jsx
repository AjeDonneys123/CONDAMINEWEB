import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ globalClass }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [activeMode, setActiveMode] = useState('upload');
    const [activeTab, setActiveTab] = useState('subject');
    const [newTitle, setNewTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [showFolderPicker, setShowFolderPicker] = useState(null);
    const [driveFiles, setDriveFiles] = useState({ list: [], loading: false, type: null });

    const loadData = async () => {
        try {
            const [sRes, cRes] = await Promise.all([
                fetch('/api/scan-sessions'),
                fetch('/api/chapters-all')
            ]);
            if (sRes.ok) setSessions(await sRes.json());
            if (cRes.ok) setChapters(await cRes.json());
        } catch (e) { console.error("Data error:", e); }
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const fetchDriveFiles = async (sessionId, type) => {
        setDriveFiles({ list: [], loading: true, type });
        setOpenId(sessionId);
        try {
            const res = await fetch(`/api/scan-sessions/${sessionId}/files/${type}`);
            const data = await res.json();
            setDriveFiles({ list: Array.isArray(data) ? data : [], loading: false, type });
        } catch (e) { setDriveFiles({ list: [], loading: false, type: null }); }
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

    const deleteSession = async (id) => {
        if (!confirm("Supprimer cette production ?")) return;
        const res = await fetch(`/api/scan-sessions/${id}`, { method: 'DELETE' });
        if (res.ok) await loadData();
    };

    const normalize = (c) => c?.toString().toUpperCase().replace('E', '') || "";
    const filteredSessions = sessions.filter(s => normalize(s.classroom) === normalize(globalClass));

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-[35px] border-2 border-indigo-50 shadow-sm flex gap-4">
                <input className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" placeholder="Nom de la production..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
                <button onClick={createSession} disabled={loading} className="px-8 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs">Créer</button>
            </div>

            <div className="space-y-4">
                {filteredSessions.map(s => {
                    const isOpen = openId === s._id;
                    const assigned = chapters.find(c => c._id === s.chapterId);
                    return (
                        <div key={s._id} className={`bg-white rounded-[40px] border-2 transition-all ${isOpen ? 'border-indigo-500 shadow-xl' : 'border-slate-100'}`}>
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => { setOpenId(isOpen ? null : s._id); setDriveFiles({list:[], loading:false, type:null}); }}>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white ${isOpen ? 'bg-indigo-600' : 'bg-slate-200'}`}>{isOpen ? '▼' : '▶'}</div>
                                    <div>
                                        <h3 className="font-black text-slate-700 text-sm">{s.title || "Production"}</h3>
                                        {assigned && <span className="text-[9px] font-black text-emerald-500 uppercase">📁 {assigned.title}</span>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => fetchDriveFiles(s._id, 'subject')} className="tool-btn bg-indigo-50 text-indigo-600">📂 FILES</button>
                                    
                                    {/* CROIX DE SUPPRESSION VISIBLE */}
                                    <button onClick={() => deleteSession(s._id)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-xl font-black border border-red-100">✕</button>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="border-t-2 border-dashed border-slate-100 p-6 bg-slate-50/30">
                                    {driveFiles.type && (
                                        <div className="mb-8 p-6 bg-white rounded-[30px] border-2 border-indigo-100 animate-in zoom-in">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-black text-xs uppercase text-slate-400">Tiroir Drive : <span className="text-indigo-600">{driveFiles.type}</span></h4>
                                                <button onClick={() => setDriveFiles({list:[], loading:false, type:null})} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 rounded-full font-bold">✕</button>
                                            </div>
                                            {driveFiles.loading ? <div className="py-10 text-center animate-pulse text-indigo-400 font-black text-xs uppercase">Synchro...</div> : (
                                                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                                                    {driveFiles.list.map(f => (
                                                        <a key={f.id} href={f.webViewLink} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 group/item">
                                                            <div className="w-full aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden border-2 border-transparent group-hover/item:border-indigo-500 shadow-sm transition-all">
                                                                <img src={f.thumbnailLink} className="w-full h-full object-cover" />
                                                            </div>
                                                            <span className="text-[8px] font-bold text-slate-400 truncate w-full text-center">{f.name}</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2 mb-6">
                                        <button onClick={() => setActiveTab('subject')} className={`flex-1 py-3 rounded-2xl font-black text-[10px] transition-all ${activeTab === 'subject' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-400 border'}`}>1. CAPTURE SUJET</button>
                                        <button onClick={() => setActiveTab('copies')} className={`flex-1 py-3 rounded-2xl font-black text-[10px] transition-all ${activeTab === 'copies' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border'}`}>2. CAPTURE COPIES</button>
                                        <button onClick={() => setActiveTab('ia')} className={`flex-1 py-3 rounded-2xl font-black text-[10px] transition-all ${activeTab === 'ia' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 border'}`}>3. CORRECTION IA</button>
                                    </div>
                                    <PilotArea session={s} tab={activeTab} onRefresh={loadData} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PilotArea({ session, tab, onRefresh }) {
    const videoRef = useRef(null);
    const [capturing, setCapturing] = useState(false);
    const [flash, setFlash] = useState(false);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: 1280, height: 720 } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        }
    };

    useEffect(() => { if (tab !== 'ia') startCamera(); return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); }, [tab]);

    const takeSnap = async () => {
        if (capturing || !videoRef.current) return;
        setCapturing(true); setFlash(true); setTimeout(() => setFlash(false), 150);
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        await fetch('/api/scan-upload-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session._id, type: tab === 'subject' ? 'subject' : 'copy', imageBase64: data }) });
        onRefresh(); setCapturing(false);
    };

    if (tab === 'ia') {
        return (
            <div className="p-8 bg-white rounded-3xl border-2 border-emerald-100 text-center animate-in zoom-in">
                <button className="w-full py-8 bg-emerald-600 text-white rounded-[30px] font-black text-xl shadow-xl hover:scale-[1.02] transition-transform">🚀 LANCER L'ANALYSE IA</button>
            </div>
        );
    }

    const currentPhotos = tab === 'subject' ? session.subjectUrls : session.copyUrls;

    return (
        <div className="flex flex-col gap-6">
            <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black rounded-[40px] overflow-hidden border-8 border-white shadow-2xl">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {flash && <div className="absolute inset-0 bg-white z-50"></div>}
                <button onClick={takeSnap} disabled={capturing} className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-8 border-white/30 shadow-2xl transition-all active:scale-90 ${capturing ? 'bg-red-500 animate-pulse' : 'bg-white'}`} />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar px-2">
                {currentPhotos?.map((id, i) => (
                    <div key={id} className="relative min-w-[85px] h-[115px] bg-slate-200 rounded-xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0 animate-in slide-in-from-right-2">
                        <img src={`https://drive.google.com/thumbnail?id=${id}&sz=w200`} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1 bg-black/50 text-white text-[8px] font-black px-1.5 rounded-md">{i+1}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}