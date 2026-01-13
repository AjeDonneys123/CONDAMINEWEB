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

    const handleAssign = async (sessionId, chapterId) => {
        const res = await fetch(`/api/scan-sessions/${sessionId}/assign-chapter`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterId })
        });
        if (res.ok) {
            setShowFolderPicker(null);
            await loadData();
        }
    };

    const normalize = (c) => c?.toString().toUpperCase().replace('E', '') || "";
    const filteredSessions = sessions.filter(s => normalize(s.classroom) === normalize(globalClass));
    const availableChapters = chapters.filter(c => normalize(c.classroom) === normalize(globalClass) && !c.isArchived);

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-[35px] border-2 border-indigo-50 shadow-sm flex gap-4">
                <input className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" placeholder="Nom de la production..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
                <button onClick={createSession} disabled={loading} className="px-8 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg">Créer</button>
            </div>

            <div className="space-y-4">
                {filteredSessions.map(s => {
                    const isOpen = openId === s._id;
                    const assigned = chapters.find(c => c._id === s.chapterId);
                    return (
                        <div key={s._id} className={`bg-white rounded-[40px] border-2 transition-all ${isOpen ? 'border-indigo-500 shadow-xl' : 'border-slate-100'}`}>
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setOpenId(isOpen ? null : s._id)}>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white ${isOpen ? 'bg-indigo-600' : 'bg-slate-200'}`}>{isOpen ? '▼' : '▶'}</div>
                                    <div>
                                        <h3 className="font-black text-slate-700">{s.title || "Production"}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.subjectUrls?.length || 0} SUJET • {s.copyUrls?.length || 0} COPIES</span>
                                            {assigned && <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-md uppercase border border-emerald-200">📁 {assigned.title}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowFolderPicker(s._id)} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${assigned ? 'bg-slate-100 text-slate-400' : 'bg-emerald-500 text-white shadow-md'}`}>Classer</button>
                                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); await loadData(); } }} className="text-slate-300 font-bold p-2 hover:text-red-500 transition-colors">✕</button>
                                </div>
                            </div>

                            {/* PICKER DE DOSSIER (FIXED) */}
                            {showFolderPicker === s._id && (
                                <div className="p-6 bg-emerald-50 border-t border-emerald-100 animate-in slide-in-from-top-2">
                                    <p className="text-[10px] font-black text-emerald-800 uppercase mb-3">Sélectionner un dossier de destination :</p>
                                    <div className="flex flex-wrap gap-2">
                                        {availableChapters.map(c => (
                                            <button key={c._id} onClick={() => handleAssign(s._id, c._id)} className="px-4 py-2 bg-white border-2 border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all">📁 {c.title}</button>
                                        ))}
                                        <button onClick={() => setShowFolderPicker(null)} className="px-4 py-2 bg-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase">Annuler</button>
                                    </div>
                                </div>
                            )}

                            {isOpen && !showFolderPicker && (
                                <div className="border-t-2 border-dashed border-slate-100 p-6 bg-slate-50/30">
                                    <div className="flex gap-2 mb-6">
                                        <button onClick={() => setActiveTab('subject')} className={`flex-1 py-3 rounded-2xl font-black text-[10px] transition-all ${activeTab === 'subject' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-400 border'}`}>1. LE SUJET</button>
                                        <button onClick={() => setActiveTab('copies')} className={`flex-1 py-3 rounded-2xl font-black text-[10px] transition-all ${activeTab === 'copies' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border'}`}>2. LES COPIES</button>
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
    const [showFlash, setShowFlash] = useState(false);

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
        setCapturing(true);
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 100);

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; 
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const data = canvas.toDataURL('image/jpeg', 0.7);

        try {
            const res = await fetch('/api/scan-upload-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session._id, type: tab === 'subject' ? 'subject' : 'copy', imageBase64: data })
            });
            if(res.ok) onRefresh();
        } catch(e) { console.error("Upload error:", e); }
        
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
                
                {/* EFFET FLASH */}
                {showFlash && <div className="absolute inset-0 bg-white z-50 animate-flash"></div>}
                
                <button 
                    onClick={takeSnap} 
                    disabled={capturing} 
                    className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-8 border-white/30 shadow-2xl transition-all active:scale-90 ${capturing ? 'bg-red-500 animate-pulse' : 'bg-white'}`} 
                />
                
                <div className={`absolute top-6 right-6 px-4 py-1 rounded-full text-[10px] font-black text-white uppercase ${tab === 'subject' ? 'bg-orange-500' : 'bg-indigo-600'}`}>
                    {tab === 'subject' ? 'Sujet' : 'Copies'}
                </div>
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