import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio() {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]); 
    const [queue, setQueue] = useState([]);   
    const [status, setStatus] = useState("");
    const [hwTitle, setHwTitle] = useState("Trimestre 2");
    
    // --- ÉTATS CAMERA LIVE ---
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const loadList = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/google/drive/list').then(r => r.json());
            if (res.ok) setPhotos(res.files || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadList(); }, []);

    // --- DÉMARRER LE FLUX VIDÉO ---
    const startCamera = async () => {
        setShowCamera(true);
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        setShowCamera(false);
    };

    // --- CAPTURE INSTANTANÉE (SANS CONFIRMATION) ---
    const takeSnap = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
            const file = new File([blob], `snap_${Date.now()}.jpg`, { type: "image/jpeg" });
            const newItem = {
                file,
                preview: URL.createObjectURL(file),
                id: Math.random().toString(36).substr(2, 9)
            };
            setQueue(prev => [...prev, newItem]);
        }, 'image/jpeg', 0.9);
    };

    const uploadQueue = async () => {
        if (queue.length === 0) return;
        setLoading(true);
        stopCamera();
        const total = queue.length;
        for (let i = 0; i < queue.length; i++) {
            setStatus(`Envoi ${i + 1}/${total}...`);
            const fd = new FormData();
            fd.append('file', queue[i].file);
            try { await fetch('/api/manual-upload-scan', { method: 'POST', body: fd }); } catch (err) {}
        }
        setQueue([]);
        setStatus("✅ Envois terminés !");
        loadList();
        setLoading(false);
    };

    return (
        <div className="p-4 space-y-6 animate-in fade-in max-w-full overflow-hidden">
            {/* BARRE DE CONTROLE */}
            <div className="bg-white p-6 rounded-[35px] shadow-2xl border-b-4 border-indigo-600 sticky top-0 z-50">
                <div className="flex justify-between items-center gap-4">
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-slate-800 uppercase">Scanner Instantané</h2>
                        <input className="mt-1 bg-slate-50 p-2 rounded-lg font-bold text-indigo-600 text-xs w-full outline-none" value={hwTitle} onChange={e => setHwTitle(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        {!showCamera ? (
                            <button onClick={startCamera} className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-3xl shadow-xl">🎥</button>
                        ) : (
                            <button onClick={stopCamera} className="w-16 h-16 bg-red-500 text-white rounded-2xl flex items-center justify-center text-3xl shadow-xl">✕</button>
                        )}
                        {queue.length > 0 && (
                            <button onClick={uploadQueue} className="bg-emerald-500 text-white px-4 rounded-2xl font-black text-xs shadow-lg animate-bounce">ENVOYER ({queue.length})</button>
                        )}
                    </div>
                </div>
            </div>

            {/* FENÊTRE DE LA CAMERA EN DIRECT */}
            {showCamera && (
                <div className="relative rounded-[40px] overflow-hidden bg-black aspect-[3/4] shadow-2xl border-4 border-white">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* BOUTON SNAP MASSIF */}
                    <div className="absolute inset-x-0 bottom-10 flex justify-center">
                        <button 
                            onClick={takeSnap}
                            className="w-20 h-20 bg-white/20 backdrop-blur-md border-4 border-white rounded-full flex items-center justify-center active:scale-90 transition-all shadow-2xl"
                        >
                            <div className="w-14 h-14 bg-white rounded-full shadow-inner"></div>
                        </button>
                    </div>
                    <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase">Mode Rafale Actif</div>
                </div>
            )}

            {/* FILE D'ATTENTE */}
            {queue.length > 0 && (
                <div className="bg-indigo-50 p-4 rounded-[30px] border-2 border-dashed border-indigo-200">
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {queue.map((item) => (
                            <div key={item.id} className="relative flex-shrink-0">
                                <img src={item.preview} className="w-20 h-28 object-cover rounded-xl border-2 border-white shadow-sm" />
                                <button onClick={() => setQueue(queue.filter(q => q.id !== item.id))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {status && <div className="p-3 bg-yellow-400 text-black text-center font-black rounded-2xl text-[10px] uppercase">{status}</div>}

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 opacity-40">
                {photos.map(p => (
                    <div key={p.id} className="bg-white p-1 rounded-2xl border border-slate-100 aspect-[3/4] overflow-hidden">
                        <img src={`/api/view-thumbnail/${p.id}`} className="w-full h-full object-cover rounded-xl" />
                    </div>
                ))}
            </div>
        </div>
    );
}