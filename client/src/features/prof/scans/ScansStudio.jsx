import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ globalClass, user }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [openId, setOpenId] = useState(null); 
    const [activeMode, setActiveMode] = useState('upload'); 
    const [activeTab, setActiveTab] = useState('subject'); 
    const [newTitle, setNewTitle] = useState("");
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        try {
            // ALIGNEMENT : Appel de /api/scans/sessions (et non /api/scan-sessions)
            const [sRes, cRes] = await Promise.all([
                fetch('/api/scans/sessions'),
                fetch('/api/chapters-all')
            ]);
            if (sRes.ok) setSessions(await sRes.json());
            if (cRes.ok) setChapters(await cRes.json());
        } catch (e) { console.error("API Error", e); }
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const createSession = async () => {
        if (!newTitle.trim() || loading) return;
        setLoading(true);
        const res = await fetch('/api/scans/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, classroom: globalClass })
        });
        if (res.ok) { setNewTitle(""); loadData(); }
        setLoading(false);
    };

    const normalize = (c) => c?.toString().toUpperCase().replace('E', '') || "";
    const filteredSessions = sessions.filter(s => normalize(s.classroom) === normalize(globalClass));

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="bg-white p-3 rounded-[22px] border-2 border-indigo-50 shadow-sm flex items-center gap-2">
                <input 
                    className="flex-1 px-4 py-3 bg-slate-50 rounded-xl outline-none font-bold text-xs" 
                    placeholder="Nom de la production..." 
                    value={newTitle} 
                    onChange={e=>setNewTitle(e.target.value)} 
                />
                <button onClick={createSession} disabled={loading} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px]">Créer</button>
            </div>

            <div className="space-y-2">
                {filteredSessions.map(s => {
                    const isOpen = openId === s._id;
                    const assigned = chapters.find(c => c._id === s.chapterId);
                    return (
                        <div key={s._id} className={`bg-white rounded-[25px] border-2 transition-all ${isOpen ? 'border-indigo-500 shadow-lg' : 'border-slate-50'}`}>
                            <div className="p-2 px-3 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
                                <div className="flex-1 min-w-[80px] cursor-pointer" onClick={() => setOpenId(isOpen ? null : s._id)}>
                                    <h3 className="font-black text-slate-700 text-[10px] truncate uppercase">{s.title || "Titre"}</h3>
                                    {assigned && <div className="text-[7px] font-black text-emerald-500 uppercase truncate">📁 {assigned.title}</div>}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => { setOpenId(s._id); setActiveMode('upload'); }} className={`tool-btn ${isOpen && activeMode === 'upload' ? 'active-upload' : ''}`}>SNAP</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveMode('ia'); }} className={`tool-btn ${isOpen && activeMode === 'ia' ? 'active-ia' : ''}`}>IA</button>
                                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/scans/${s._id}`, {method:'DELETE'}); loadData(); } }} className="tool-btn-danger">✕</button>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="border-t border-slate-100 p-3 bg-slate-50/30">
                                    <div className="flex gap-1 mb-4 bg-white/60 p-1 rounded-xl shadow-inner">
                                        <button onClick={() => setActiveTab('subject')} className={`sub-tab ${activeTab === 'subject' ? 'active' : ''}`}>SUJET</button>
                                        <button onClick={() => setActiveTab('copies')} className={`sub-tab ${activeTab === 'copies' ? 'active' : ''}`}>COPIES</button>
                                    </div>
                                    <PilotSnap session={s} type={activeTab} onRefresh={loadData} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PilotSnap({ session, type, onRefresh }) {
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

    useEffect(() => { startCamera(); return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop()); }, [type]);

    const takeSnap = async () => {
        if (capturing || !videoRef.current) return;
        setCapturing(true); setFlash(true); setTimeout(() => setFlash(false), 150);
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        const res = await fetch('/api/scans/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session._id, type: type, imageBase64: data }) });
        if(res.ok) onRefresh();
        setCapturing(false);
    };

    const currentPhotos = type === 'subject' ? session.subjectUrls : session.copyUrls;

    return (
        <div className="flex flex-col gap-4 animate-in fade-in">
            <div className="relative aspect-[3/4] max-w-xs mx-auto bg-black rounded-[25px] overflow-hidden border-4 border-white shadow-md">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {flash && <div className="absolute inset-0 bg-white z-50"></div>}
                <button onClick={takeSnap} disabled={capturing} className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full border-4 border-white/30 shadow-xl ${capturing ? 'bg-red-500 animate-pulse' : 'bg-white'}`} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar px-1">
                {currentPhotos?.map((id, i) => (
                    <div key={id} className="relative min-w-[55px] h-[75px] bg-slate-200 rounded-lg overflow-hidden border border-white shadow-sm flex-shrink-0">
                        <img src={`https://drive.google.com/thumbnail?id=${id}&sz=w200`} className="w-full h-full object-cover" />
                        <div className="absolute top-0.5 left-0.5 bg-black/50 text-white text-[5px] font-black px-1 rounded-sm">{i+1}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}