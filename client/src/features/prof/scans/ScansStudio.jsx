import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ globalClass }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [openId, setOpenId] = useState(null);
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
        const session = sessions.find(s => s._id === sessionId);
        let folderId = "";
        if (type === 'subject') folderId = session.subjectFolderId;
        if (type === 'copies') folderId = session.copiesFolderId;
        if (type === 'corrections') folderId = session.correctionsFolderId;

        if (!folderId) return alert("Dossier Drive non configuré pour cette session.");

        setDriveFiles({ list: [], loading: true, type });
        try {
            const res = await fetch(`/api/drive/files/${folderId}`);
            const data = await res.json();
            setDriveFiles({ list: data, loading: false, type });
        } catch (e) {
            setDriveFiles({ list: [], loading: false, type: null });
        }
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
                                        <h3 className="font-black text-slate-700">{s.title || "Production"}</h3>
                                        {assigned && <span className="text-[9px] font-black text-emerald-500 uppercase">📁 {assigned.title}</span>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {/* MENU FILES */}
                                    <div className="relative group">
                                        <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-600 hover:text-white transition-all">📂 FILES</button>
                                        <div className="absolute top-full right-0 mt-1 bg-white shadow-2xl rounded-2xl p-2 z-[100] border hidden group-hover:block min-w-[140px]">
                                            <button onClick={() => { setOpenId(s._id); fetchDriveFiles(s._id, 'subject'); }} className="w-full p-2 text-[9px] font-black text-left hover:bg-orange-50 text-orange-600 rounded-lg">📄 SUJETS</button>
                                            <button onClick={() => { setOpenId(s._id); fetchDriveFiles(s._id, 'copies'); }} className="w-full p-2 text-[9px] font-black text-left hover:bg-indigo-50 text-indigo-600 rounded-lg">📝 COPIES</button>
                                            <button onClick={() => { setOpenId(s._id); fetchDriveFiles(s._id, 'corrections'); }} className="w-full p-2 text-[9px] font-black text-left hover:bg-emerald-50 text-emerald-600 rounded-lg">✅ CORRECTIONS</button>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowFolderPicker(s._id)} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] uppercase">Classer</button>
                                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); await loadData(); } }} className="text-slate-300 font-bold p-2">✕</button>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="border-t-2 border-dashed border-slate-100 p-6 bg-slate-50/30">
                                    {/* AFFICHAGE DES FICHIERS DRIVE SI ACTIF */}
                                    {driveFiles.type && (
                                        <div className="mb-8 p-6 bg-white rounded-[30px] border-2 border-indigo-100 animate-in zoom-in">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-black text-xs uppercase text-slate-400">Contenu du dossier : <span className="text-indigo-600">{driveFiles.type}</span></h4>
                                                <button onClick={() => setDriveFiles({list:[], loading:false, type:null})} className="text-slate-300 font-bold">✕</button>
                                            </div>
                                            {driveFiles.loading ? (
                                                <div className="py-10 text-center animate-pulse text-indigo-300 font-black text-xs uppercase">Connexion Drive...</div>
                                            ) : (
                                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                                    {driveFiles.list.map(file => (
                                                        <a key={file.id} href={file.webViewLink} target="_blank" rel="noreferrer" className="group flex flex-col items-center">
                                                            <div className="w-full aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden border-2 border-transparent group-hover:border-indigo-500 transition-all shadow-sm">
                                                                <img src={file.thumbnailLink} className="w-full h-full object-cover" alt="thumb" />
                                                            </div>
                                                            <span className="text-[8px] font-bold text-slate-500 mt-2 truncate w-full text-center">{file.name}</span>
                                                        </a>
                                                    ))}
                                                    {driveFiles.list.length === 0 && <p className="col-span-full text-center py-10 text-slate-300 font-bold text-[10px] uppercase">Dossier vide</p>}
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

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        }
    };

    useEffect(() => { if (tab !== 'ia') startCamera(); return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); }, [tab]);

    const takeSnap = async () => {
        if (capturing) return;
        setCapturing(true);
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.7);

        await fetch('/api/scan-upload-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: session._id, type: tab === 'subject' ? 'subject' : 'copy', imageBase64: data })
        });
        onRefresh();
        setCapturing(false);
    };

    if (tab === 'ia') {
        return (
            <div className="space-y-6 animate-in zoom-in">
                <div className="p-6 bg-white rounded-3xl border-2 border-emerald-100 text-center">
                    <button className="w-full py-8 bg-emerald-600 text-white rounded-[30px] font-black text-xl shadow-xl hover:scale-[1.02] transition-transform">🚀 LANCER L'ANALYSE IA</button>
                    <p className="text-[10px] text-slate-400 mt-4 uppercase font-bold">L'IA corrigera toutes les copies présentes dans le dossier "Copies"</p>
                </div>
            </div>
        );
    }

    const currentPhotos = tab === 'subject' ? session.subjectUrls : session.copyUrls;

    return (
        <div className="flex flex-col gap-6">
            <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black rounded-[40px] overflow-hidden border-8 border-white shadow-2xl">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <button onClick={takeSnap} disabled={capturing} className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-8 border-white/30 shadow-2xl transition-all active:scale-90 ${capturing ? 'bg-red-500 animate-pulse' : 'bg-white'}`} />
            </div>

            <div className="space-y-2 px-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Photos enregistrées ({currentPhotos?.length || 0})</span>
                <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                    {currentPhotos?.map((id, i) => (
                        <div key={id} className="relative min-w-[85px] h-[115px] bg-slate-200 rounded-xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0 animate-in slide-in-from-right-2">
                            <img src={`https://drive.google.com/thumbnail?id=${id}&sz=w200`} className="w-full h-full object-cover" alt="prev" />
                            <div className="absolute top-1 left-1 bg-black/50 text-white text-[8px] font-black px-1.5 rounded-md">{i+1}</div>
                        </div>
                    ))}
                    {(!currentPhotos || currentPhotos.length === 0) && (
                        <div className="w-full py-10 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-white/50">
                            <span className="text-[10px] font-black text-slate-300 uppercase italic">Dossier vide</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}