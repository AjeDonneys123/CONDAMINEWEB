import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio() {
    const [view, setView] = useState("list");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [scans, setScans] = useState([]);
    const [queue, setQueue] = useState([]);
    
    const [hwConfig, setHwConfig] = useState({ title: "Trimestre 2", classroom: "all", teacherPrompt: "", questionsUrls: [] });
    const [showSettings, setShowSettings] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorder = useRef(null);
    const chunks = useRef([]);

    const loadScans = async () => {
        const res = await fetch('/api/scans').then(r => r.ok ? r.json() : []);
        setScans(res);
    };

    useEffect(() => { loadScans(); }, []);

    // --- AUDIO SIMPLIFIÉ ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            chunks.current = [];
            mediaRecorder.current.ondataavailable = e => chunks.current.push(e.data);
            mediaRecorder.current.onstop = async () => {
                const blob = new Blob(chunks.current, { type: 'audio/webm' });
                const fd = new FormData(); fd.append('file', blob);
                setStatus("IA transcrit...");
                const res = await fetch('/api/transcribe-audio', { method: 'POST', body: fd }).then(r => r.json());
                if(res.text) setHwConfig(p => ({...p, teacherPrompt: (p.teacherPrompt + " " + res.text).trim()}));
                setStatus("");
            };
            mediaRecorder.current.start();
            setIsRecording(true);
        } catch(err) { alert("Micro bloqué ou non disponible en HTTP (HTTPS requis)"); }
    };

    const stopRecording = () => {
        if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
        setIsRecording(false);
    };

    // --- CAMERA ---
    const startCamera = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) { videoRef.current.srcObject = stream; setShowCamera(true); }
    };

    const takeSnap = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => {
            const file = new File([blob], `snap_${Date.now()}.jpg`, { type: "image/jpeg" });
            setQueue(p => [...p, { file, preview: URL.createObjectURL(blob), id: Math.random() }]);
        }, 'image/jpeg', 0.9);
    };

    const startCorrection = async () => {
        setLoading(true);
        setStatus("Envoi Drive...");
        for (let item of queue) {
            const fd = new FormData(); fd.append('file', item.file);
            await fetch('/api/manual-upload-scan', { method: 'POST', body: fd });
        }
        setStatus("Analyse IA...");
        const resList = await fetch('/api/google/drive/list').then(r => r.json());
        for (let file of (resList.files || [])) {
            await fetch('/api/process-copy-v4', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: file.id, context: hwConfig }) });
        }
        setQueue([]); setLoading(false); setView("list"); loadScans();
    };

    if (view === "list") return (
        <div className="p-6 space-y-6 animate-in fade-in">
            <button onClick={() => setView("editor")} className="w-full p-8 bg-indigo-600 text-white rounded-[40px] font-black text-2xl shadow-xl">+ NOUVELLE SESSION</button>
            <div className="grid grid-cols-1 gap-3">
                {scans.map(s => <div key={s._id} className="bg-white p-4 rounded-2xl border shadow-sm"><b>Copie {s.grade}</b></div>)}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <div className="bg-white p-6 border-b-4 border-indigo-600 flex justify-between items-center sticky top-0 z-[100]">
                <button onClick={() => setView("list")} className="font-bold text-slate-400">RETOUR</button>
                <b className="text-indigo-600 uppercase">Correction IA</b>
                <button onClick={() => setShowSettings(!showSettings)} className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${showSettings ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>⚙️</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="bg-white p-6 rounded-[35px] shadow-lg border-2 border-indigo-100 space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Consignes</label>
                        <button onClick={() => setHwConfig({...hwConfig, teacherPrompt: ""})} className="text-red-400 font-bold text-[10px]">VIDER ✕</button>
                    </div>
                    <textarea className="w-full bg-slate-50 p-4 rounded-2xl text-sm italic outline-none border-none" rows="3" value={hwConfig.teacherPrompt} onChange={e => setHwConfig({...hwConfig, teacherPrompt: e.target.value})} placeholder="Parle ou écris tes consignes..." />
                    <button 
                        onTouchStart={startRecording} onTouchEnd={stopRecording}
                        onMouseDown={startRecording} onMouseUp={stopRecording}
                        className={`w-full p-6 rounded-3xl font-black text-xs uppercase shadow-lg transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-purple-600 text-white'}`}
                    >
                        {isRecording ? '🎙️ ENREGISTREMENT...' : '🎤 Maintenir pour parler'}
                    </button>
                </div>

                {showSettings && (
                    <div className="bg-white p-6 rounded-[35px] shadow-lg border-2 border-blue-100 space-y-4">
                        <label className="text-[10px] font-black text-blue-500 uppercase">Sujet (Multiple)</label>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {hwConfig.questionsUrls.map((u, i) => (
                                <div key={i} className="relative"><img src={u} className="w-16 h-16 object-cover rounded-lg border" /><button onClick={() => setHwConfig({...hwConfig, questionsUrls: hwConfig.questionsUrls.filter((_, idx) => idx !== i)})} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-[8px]">✕</button></div>
                            ))}
                            <label className="w-16 h-16 bg-blue-50 text-blue-400 flex items-center justify-center rounded-lg border-2 border-dashed cursor-pointer">+
                                <input type="file" multiple className="hidden" onChange={async e => {
                                    for(let file of Array.from(e.target.files)) {
                                        const fd = new FormData(); fd.append('file', file);
                                        const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
                                        if(res.ok) setHwConfig(p => ({...p, questionsUrls: [...p.questionsUrls, res.imageUrl]}));
                                    }
                                }} />
                            </label>
                        </div>
                    </div>
                )}

                <div className="relative rounded-[40px] overflow-hidden bg-black aspect-[3/4] shadow-2xl border-4 border-white">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-6 flex justify-center"><button onClick={takeSnap} className="w-16 h-16 bg-white rounded-full border-4 border-white/30 active:scale-90 shadow-xl transition-all"></button></div>
                    {!showCamera && <div onClick={startCamera} className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-black uppercase text-xs">Ouvrir Scanner</div>}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-4">
                    {queue.map(q => <img key={q.id} src={q.preview} className="w-20 h-28 object-cover rounded-xl border-2 border-white shadow-md" />)}
                </div>
            </div>

            <div className="p-6 bg-white border-t-2 border-slate-100 sticky bottom-0 z-[100]">
                <button onClick={startCorrection} disabled={loading || queue.length === 0} className="w-full py-6 bg-emerald-500 text-white rounded-3xl font-black text-xl shadow-xl shadow-emerald-50">
                    {loading ? status : `CORRIGER (${queue.length})`}
                </button>
            </div>
        </div>
    );
}