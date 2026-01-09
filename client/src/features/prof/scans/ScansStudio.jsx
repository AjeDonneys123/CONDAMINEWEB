import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio() {
    const [sessions, setSessions] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [activeTab, setActiveTab] = useState('scan');
    const [newTitle, setNewTitle] = useState("");
    const [newClass, setNewClass] = useState("6D");

    const load = async () => {
        const res = await fetch('/api/scan-sessions').then(r => r.json());
        setSessions(Array.isArray(res) ? res : []);
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

    return (
        <div className="p-4 space-y-4 max-w-4xl mx-auto sm:p-6">
            <div className="bg-white p-4 rounded-[30px] border-2 border-indigo-100 shadow-sm flex flex-col sm:flex-row items-center gap-3">
                <input className="flex-1 p-3 w-full bg-slate-50 rounded-2xl outline-none font-bold" placeholder="Nom du devoir..." value={newTitle} onChange={e=>setNewTitle(e.target.value)} />
                <div className="flex w-full sm:w-auto gap-2">
                    <select className="flex-1 p-3 bg-slate-50 rounded-2xl font-black text-indigo-600 outline-none" value={newClass} onChange={e=>setNewClass(e.target.value)}>
                        <option value="6D">6D</option><option value="5B">5B</option><option value="1D">1BFI</option>
                    </select>
                    <button onClick={createSession} className="flex-1 p-3 bg-indigo-600 text-white rounded-2xl font-black px-6 shadow-lg">CRÉER</button>
                </div>
            </div>

            <div className="space-y-3">
                {sessions.map(s => {
                    const prefix = s.title.includes('_') ? s.title.split('_').slice(0, -1).join('_') : "";
                    const isLocalOpen = openId === s._id;

                    return (
                        <div key={s._id} className={`bg-white rounded-[25px] border-2 transition-all ${isLocalOpen ? 'border-indigo-500 shadow-xl' : 'border-slate-100'}`}>
                            <div className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1" onClick={() => setOpenId(isLocalOpen ? null : s._id)}>
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center font-black text-indigo-600 text-[10px]">
                                        {s.classroom === '1D' ? 'BFI' : s.classroom}
                                    </div>
                                    <b className="text-slate-700 text-sm sm:text-base truncate max-w-[120px]">{prefix || s.title}</b>
                                    <span className={`text-indigo-300 text-xs transition-transform ${isLocalOpen ? 'rotate-180' : ''}`}>▼</span>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('quest'); }} className={`px-2 py-2 rounded-xl font-black text-[8px] uppercase transition-all ${isLocalOpen && activeTab==='quest' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>❓ Q.</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('scan'); }} className={`px-2 py-2 rounded-xl font-black text-[8px] uppercase transition-all ${isLocalOpen && activeTab==='scan' ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600'}`}>📄 Scan</button>
                                    <button onClick={() => { setOpenId(s._id); setActiveTab('ia'); }} className={`px-2 py-2 rounded-xl font-black text-[8px] uppercase transition-all ${isLocalOpen && activeTab==='ia' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>🤖 IA</button>
                                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/scan-sessions/${s._id}`, {method:'DELETE'}); load(); } }} className="text-slate-200 hover:text-red-400 font-bold px-2 ml-1">✕</button>
                                </div>
                            </div>
                            {isLocalOpen && (
                                <div className="p-4 sm:p-8 pt-2 bg-slate-50/50 border-t-2 border-dashed border-slate-100">
                                    <PilotArea currentSession={s} tab={activeTab} onClose={() => setOpenId(null)} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PilotArea({ currentSession, tab, onClose }) {
    const [session, setSession] = useState(currentSession);
    const [localPreviews, setLocalPreviews] = useState([]);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const getImgSrc = (url) => {
        if (!url || url.startsWith('data:')) return url;
        const id = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/);
        return id ? `https://drive.google.com/thumbnail?id=${id[1]}&sz=w400` : url;
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const startCamera = async () => {
        stopCamera();
        try {
            const constraints = { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } };
            let stream;
            try { stream = await navigator.mediaDevices.getUserMedia(constraints); } 
            catch { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setTimeout(() => { if(videoRef.current) videoRef.current.play().catch(()=>{}); }, 200);
            }
        } catch (e) { console.error("Caméra bloquée"); }
    };

    useEffect(() => {
        if (tab !== 'ia') startCamera();
        else stopCamera();
        return () => stopCamera();
    }, [tab]);

    const takePhoto = async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.6); // Compression légère pour mobile
        
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
            setLocalPreviews(p => p.filter(x => x.id !== tempId));
        }
    };

    const deletePhoto = async (url, type) => {
        if(!confirm("Supprimer cette photo ?")) return;
        const res = await fetch('/api/scan-delete-photo', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ sessionId: session._id, type, url })
        });
        const updated = await res.json();
        if(updated._id) setSession(updated);
    };

    const photos = (tab === 'quest' ? session.questionUrls : session.copyUrls) || [];
    const locals = localPreviews.filter(p => p.type === (tab === 'quest' ? 'quest' : 'scan'));

    return (
        <div className="space-y-6">
            {tab !== 'ia' ? (
                <>
                    <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black rounded-[30px] overflow-hidden shadow-2xl border-4 border-white">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <button onClick={takePhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-8 border-white/30 shadow-2xl active:scale-90 z-20"></button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto py-2 px-1 custom-scrollbar">
                        {locals.map(p => (
                            <div key={p.id} className="relative flex-shrink-0 animate-pulse">
                                <img src={p.src} className="h-32 w-24 object-cover rounded-2xl border-2 border-indigo-400" />
                            </div>
                        ))}
                        {photos.map((url, i) => (
                            <div key={i} className="relative flex-shrink-0 group">
                                <img src={getImgSrc(url)} className="h-32 w-24 object-cover rounded-2xl border-2 border-white shadow-md bg-slate-200" />
                                <button onClick={() => deletePhoto(url, tab==='quest'?'quest':'copy')} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold shadow-md">✕</button>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <textarea 
                    className="w-full p-4 h-40 bg-white rounded-[25px] border-2 border-indigo-100 outline-none font-medium" 
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
            <div className="flex flex-col gap-2">
                <button className="w-full py-4 bg-indigo-600 text-white rounded-[25px] font-black text-base shadow-xl">🚀 CORRIGER LE DEVOIR</button>
                <button onClick={onClose} className="w-full py-3 bg-slate-100 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest">Fermer le volet</button>
            </div>
        </div>
    );
}