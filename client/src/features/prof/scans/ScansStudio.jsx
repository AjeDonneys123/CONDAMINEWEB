import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio() {
    const [view, setView] = useState("list");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [scans, setScans] = useState([]);
    const [queue, setQueue] = useState([]);
    
    // Config session
    const [hwConfig, setHwConfig] = useState({ 
        title: "Trimestre 2", 
        classroom: "all", 
        teacherPrompt: "", 
        questionsUrls: [], 
        questionsText: "" 
    });
    
    const [showSettings, setShowSettings] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);

    const loadScans = async () => {
        try {
            const res = await fetch('/api/scans').then(r => r.ok ? r.json() : []);
            setScans(Array.isArray(res) ? res : []);
        } catch(e) { setScans([]); }
    };

    useEffect(() => { loadScans(); }, []);

    // --- CAMERA ---
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setShowCamera(true);
            }
        } catch (err) { alert("Accès caméra refusé."); }
    };

    const takeSnap = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => {
            const file = new File([blob], `snap_${Date.now()}.jpg`, { type: "image/jpeg" });
            setQueue(prev => [...prev, { file, preview: URL.createObjectURL(blob), id: Math.random() }]);
        }, 'image/jpeg', 0.9);
    };

    // --- AUDIO ---
    const handleStartAudio = async (e) => {
        e.preventDefault();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];
            mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data);
            mediaRecorder.current.onstop = async () => {
                const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
                const fd = new FormData(); fd.append('file', blob);
                setStatus("IA transcrit...");
                try {
                    const res = await fetch('/api/transcribe-audio', { method: 'POST', body: fd }).then(r => r.json());
                    if(res.ok && res.text) {
                        setHwConfig(prev => ({...prev, teacherPrompt: (prev.teacherPrompt + " " + res.text).trim()}));
                    }
                    setStatus("");
                } catch (e) { setStatus("Erreur audio"); }
            };
            mediaRecorder.current.start();
            setStatus("Micro actif... 🎙️");
        } catch(err) { setStatus("Micro bloqué par Safari"); }
    };

    const handleStopAudio = () => {
        if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
    };

    const startCorrection = async () => {
        setLoading(true);
        setStatus("Envoi Drive...");
        for (let item of queue) {
            const fd = new FormData(); fd.append('file', item.file);
            await fetch('/api/manual-upload-scan', { method: 'POST', body: fd });
        }
        setStatus("Correction IA...");
        const listRes = await fetch('/api/google/drive/list').then(r => r.json());
        for (let file of (listRes.files || [])) {
            await fetch('/api/process-copy-v4', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: file.id, context: hwConfig })
            });
        }
        setQueue([]); setLoading(false); setView("list"); loadScans();
    };

    if (view === "list") return (
        <div className="p-6 space-y-6 animate-in fade-in">
            <button onClick={() => setView("editor")} className="w-full p-8 bg-indigo-600 text-white rounded-[40px] font-black text-2xl shadow-xl shadow-indigo-100">+ NOUVELLE SESSION</button>
            <div className="space-y-4">
                {scans.map(s => (
                    <div key={s._id} className="bg-white p-5 rounded-3xl border shadow-sm flex justify-between items-center">
                        <div>
                            <b className="text-slate-700 block">{s.playerId?.firstName || "Inconnu"}</b>
                            <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg text-[10px] font-black">{s.grade}</span>
                        </div>
                        <span className="text-slate-300 text-xs font-bold">{new Date(s.createdAt).toLocaleDateString()}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col animate-in slide-in-from-right">
            {/* ATELIER HEADER */}
            <div className="bg-white p-6 border-b-4 border-indigo-600 flex justify-between items-center sticky top-0 z-[100]">
                <button onClick={() => setView("list")} className="font-bold text-slate-400">RETOUR</button>
                <input className="font-black text-indigo-600 uppercase text-center outline-none bg-transparent" value={hwConfig.title} onChange={e => setHwConfig({...hwConfig, title: e.target.value})} />
                <button onClick={() => setShowSettings(!showSettings)} className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${showSettings ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>⚙️</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                {/* PANNEAU PARAMETRES (CACHE/MONTRE) */}
                {showSettings && (
                    <div className="bg-white p-6 rounded-[35px] shadow-lg border-2 border-indigo-100 space-y-6 animate-in zoom-in">
                        <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none" value={hwConfig.classroom} onChange={e => setHwConfig({...hwConfig, classroom: e.target.value})}>
                            <option value="all">Toutes les classes</option><option value="6D">6eD</option><option value="5B">5eB</option><option value="1D">1D</option>
                        </select>
                        
                        {/* ZONE DIALOGUE DANS PARAMETRES */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consignes (IA)</label>
                                <button onClick={() => setHwConfig({...hwConfig, teacherPrompt: ""})} className="text-red-400 font-bold text-[10px]">VIDER ✕</button>
                            </div>
                            <textarea 
                                className="w-full bg-slate-50 p-4 rounded-2xl text-sm italic text-slate-600 outline-none border-none focus:ring-2 ring-indigo-100"
                                rows="3"
                                value={hwConfig.teacherPrompt}
                                onChange={(e) => setHwConfig({...hwConfig, teacherPrompt: e.target.value})}
                                placeholder="Parle ou écris tes consignes..."
                            />
                            <button 
                                onTouchStart={handleStartAudio} onTouchEnd={handleStopAudio}
                                onMouseDown={handleStartAudio} onMouseUp={handleStopAudio}
                                className="w-full p-5 bg-purple-600 text-white rounded-3xl font-black text-xs uppercase shadow-lg select-none active:scale-95 transition-all"
                            >🎤 Maintenir pour parler</button>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <label className="text-[10px] font-black text-blue-500 uppercase ml-2">Photos du Sujet (Plusieurs pages)</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 min-h-[64px]">
                                {hwConfig.questionsUrls && hwConfig.questionsUrls.map((u, i) => (
                                    <div key={i} className="relative flex-shrink-0">
                                        <img src={u} className="w-16 h-16 object-cover rounded-lg border shadow-sm" />
                                        <button onClick={() => setHwConfig({...hwConfig, questionsUrls: hwConfig.questionsUrls.filter((_, idx) => idx !== i)})} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-[8px]">✕</button>
                                    </div>
                                ))}
                                <label className="w-16 h-16 bg-blue-50 text-blue-400 flex items-center justify-center rounded-lg border-2 border-dashed cursor-pointer">
                                    + <input type="file" multiple className="hidden" onChange={async e => {
                                        setStatus("Upload...");
                                        const files = Array.from(e.target.files);
                                        for(let file of files) {
                                            const fd = new FormData(); fd.append('file', file);
                                            const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
                                            if(res.ok) setHwConfig(prev => ({...prev, questionsUrls: [...prev.questionsUrls, res.imageUrl]}));
                                        }
                                        setStatus("");
                                    }} />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                <div className="relative rounded-[40px] overflow-hidden bg-black aspect-[3/4] shadow-2xl border-4 border-white">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-6 flex justify-center">
                        <button onClick={takeSnap} className="w-16 h-16 bg-white rounded-full border-4 border-white/20 active:scale-90 transition-all shadow-xl"></button>
                    </div>
                    {!showCamera && <div onClick={startCamera} className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-4"><span className="text-5xl">📸</span><b>Ouvrir Scanner</b></div>}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-4">
                    {queue.map(q => <img key={q.id} src={q.preview} className="w-24 h-32 object-cover rounded-xl border-2 border-white shadow-md" />)}
                </div>
            </div>

            <div className="p-6 bg-white border-t-2 border-slate-100 sticky bottom-0 z-[100]">
                <button onClick={startCorrection} disabled={loading || queue.length === 0} className="w-full py-6 bg-emerald-500 text-white rounded-[30px] font-black text-xl shadow-xl shadow-emerald-50 active:scale-95 transition-all">
                    {loading ? status : `LANCER (${queue.length} COPIES)`}
                </button>
            </div>
        </div>
    );
}