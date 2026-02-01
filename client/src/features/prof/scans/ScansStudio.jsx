import React, { useState, useEffect, useRef } from 'react';

export default function ScansStudio() {
    const [view, setView] = useState("list");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [scans, setScans] = useState([]);
    const [queue, setQueue] = useState([]);
    const [manualTarget, setManualTarget] = useState(null);
    const [manualText, setManualText] = useState("");
    
    const [hwConfig, setHwConfig] = useState({ 
        title: "Trimestre 2", 
        classroom: "all", 
        teacherPrompt: "", // Sera chargé depuis la BDD
        questionsUrls: [] 
    });
    
    const [showSettings, setShowSettings] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // --- CHARGEMENT DE LA MÉMOIRE AU DÉMARRAGE ---
    const loadTeacherMemory = async () => {
        const res = await fetch('/api/teacher-style').then(r => r.json());
        if (res.pedagogicalMemory) {
            setHwConfig(prev => ({ ...prev, teacherPrompt: res.pedagogicalMemory }));
        }
    };

    useEffect(() => {
        loadTeacherMemory();
        if(view === "list") {
            fetch('/api/scans').then(r => r.json()).then(setScans);
        }
    }, [view]);

    const takeSnap = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => {
            const file = new File([blob], `snap_${Date.now()}.jpg`, { type: "image/jpeg" });
            // On stocke aussi une transcription temporaire vide pour l'apprentissage
            setQueue(prev => [...prev, { file, preview: URL.createObjectURL(blob), id: Math.random() }]);
        }, 'image/jpeg', 0.85);
    };

    const saveManualCorrection = async () => {
        setLoading(true);
        setStatus("L'IA apprend de toi...");
        try {
            const res = await fetch('/api/ia-learn-style', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalText: "Texte détecté sur la copie", 
                    teacherCorrection: manualText
                })
            }).then(r => r.json());

            if (res.ok) {
                setHwConfig(prev => ({ ...prev, teacherPrompt: res.newPrompt }));
                setQueue(queue.filter(q => q.id !== manualTarget.id));
                setManualTarget(null);
                setManualText("");
                setStatus("Mémoire IA mise à jour ! 🧠");
            }
        } catch (e) { setStatus("Erreur apprentissage."); }
        setLoading(false);
    };

    if (view === "list") return (
        <div className="p-6 space-y-6">
            <button onClick={() => setView("editor")} className="w-full p-8 bg-indigo-600 text-white rounded-[40px] font-black text-2xl shadow-xl">+ NOUVELLE SESSION</button>
            <div className="space-y-3">{scans.map(s => <div key={s._id} className="bg-white p-4 rounded-2xl border shadow-sm flex justify-between"><b>Note: {s.grade}</b><span>{new Date(s.createdAt).toLocaleDateString()}</span></div>)}</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* HEADER COMPACT */}
            <div className="bg-white p-4 border-b-4 border-indigo-600 flex justify-between items-center sticky top-0 z-[100] gap-2">
                <button onClick={() => setView("list")} className="text-[10px] font-black text-slate-400 bg-slate-100 p-2 rounded-lg">ANNULER</button>
                <div className="flex-1 px-2 border-x text-center font-black text-indigo-600 uppercase text-sm truncate">{hwConfig.title}</div>
                <button onClick={() => setShowSettings(!showSettings)} className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ${showSettings ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>⚙️</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                {showSettings && (
                    <div className="bg-white p-6 rounded-[35px] shadow-xl border-4 border-indigo-500 space-y-4 animate-in zoom-in">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mémoire Pédagogique (Cumulative)</label>
                        <div className="bg-indigo-50 p-4 rounded-2xl text-xs text-indigo-900 leading-relaxed italic border border-indigo-100">
                            {hwConfig.teacherPrompt || "L'IA attend tes premières corrections pour apprendre ton style..."}
                        </div>
                        <button onClick={() => setHwConfig({...hwConfig, teacherPrompt: ""})} className="w-full text-[9px] font-black text-red-400 uppercase">Réinitialiser le cerveau</button>
                    </div>
                )}

                {/* MODE CORRECTION MANUELLE */}
                {manualTarget ? (
                    <div className="flex flex-col gap-4 animate-in slide-in-from-bottom">
                        <img src={manualTarget.preview} className="w-full h-64 object-contain rounded-2xl bg-white border shadow-inner" />
                        <div className="bg-white p-6 rounded-[35px] shadow-lg border-2 border-emerald-400 space-y-4">
                            <h3 className="text-sm font-black text-emerald-600 uppercase">Enseigner ma méthode</h3>
                            <textarea 
                                className="w-full h-48 bg-slate-50 p-4 rounded-2xl text-sm outline-none"
                                placeholder="Tape ta correction ici. Gemini va l'analyser pour enrichir sa mémoire pédagogique..."
                                value={manualText}
                                onChange={e => setManualText(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setManualTarget(null)} className="flex-1 p-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs">ANNULER</button>
                                <button onClick={saveManualCorrection} className="flex-2 p-4 bg-emerald-500 text-white rounded-2xl font-black text-xs">SAUVEGARDER & ENSEIGNER ✨</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* SCANNER */}
                        <div className="relative rounded-[40px] overflow-hidden bg-black aspect-[3/4] shadow-2xl">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-6 flex justify-center"><button onClick={takeSnap} className="w-16 h-16 bg-white rounded-full border-4 border-white/20 active:scale-90 shadow-xl"></button></div>
                            <canvas ref={canvasRef} className="hidden" />
                        </div>

                        {/* FILE D'ATTENTE */}
                        <div className="flex gap-3 overflow-x-auto pb-4">
                            {queue.map(q => (
                                <div key={q.id} className="relative flex-shrink-0" onClick={() => setManualTarget(q)}>
                                    <img src={q.preview} className="w-20 h-28 object-cover rounded-xl border-2 border-white shadow-md active:opacity-50" />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="bg-emerald-500/80 text-white text-[8px] font-black px-1 rounded">✍️ ÉDITER</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setQueue(queue.filter(x => x.id !== q.id)); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs">✕</button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ACTION FINALE IA */}
            {!manualTarget && (
                <div className="p-6 bg-white border-t-2 border-slate-100 sticky bottom-0 z-[100]">
                    <button onClick={() => setStatus("Lancement Correction Automatique...")} disabled={loading || queue.length === 0} className="w-full py-6 bg-indigo-600 text-white rounded-[30px] font-black text-xl shadow-xl">
                        {loading ? status : `CORRIGER IA (${queue.length})`}
                    </button>
                </div>
            )}
        </div>
    );
}
