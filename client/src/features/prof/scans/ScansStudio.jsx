import React, { useState, useEffect } from 'react';

export default function ScansStudio() {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]); 
    const [status, setStatus] = useState("");
    const [hwTitle, setHwTitle] = useState("Trimestre 2");
    
    // ÉTATS POUR LE CONTEXTE DE CORRECTION
    const [teacherPrompt, setTeacherPrompt] = useState("");
    const [questionsUrl, setQuestionsUrl] = useState(null);
    const [docUrls, setDocUrls] = useState([]);
    const [uploading, setUploading] = useState(false);

    const loadList = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/google/drive/list').then(r => r.json());
            if (res.ok) setPhotos((res.files || []).filter(f => f.thumbnailLink));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadList(); }, []);

    const handleFileUpload = async (files, type) => {
        setUploading(true);
        for (let file of Array.from(files)) {
            const fd = new FormData(); fd.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
            if (res.ok) {
                if (type === 'q') setQuestionsUrl(res.imageUrl);
                else setDocUrls(prev => [...prev, res.imageUrl]);
            }
        }
        setUploading(false);
    };

    const processTurbo = async () => {
        if (!window.confirm(`Lancer la correction intelligente pour ${photos.length} copies ?`)) return;
        setLoading(true);
        const copies = [...photos];
        
        for (let i = 0; i < copies.length; i++) {
            setStatus(`Correction fond/forme ${i + 1}/${copies.length}...`);
            await fetch('/api/process-copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    fileId: copies[i].id, 
                    homeworkTitle: hwTitle,
                    teacherPrompt,
                    questionsUrl,
                    docUrls
                })
            });
            setPhotos(prev => prev.filter(p => p.id !== copies[i].id));
        }
        setLoading(false);
        setStatus("Toutes les copies ont été corrigées avec succès ! ✅");
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in">
            {/* PANNEAU DE CONFIGURATION IA */}
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border-b-8 border-indigo-600 space-y-6">
                <div className="flex justify-between items-center gap-6">
                    <div className="flex-1">
                        <h2 className="text-3xl font-black uppercase text-slate-800 tracking-tighter italic">Scanner IA Intelligent</h2>
                        <input className="mt-2 bg-slate-100 p-3 rounded-xl font-bold text-indigo-600 w-full outline-none" value={hwTitle} onChange={e => setHwTitle(e.target.value)} />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={loadList} className="bg-slate-100 px-6 py-4 rounded-2xl font-black uppercase text-xs">Actualiser</button>
                        {photos.length > 0 && <button onClick={processTurbo} disabled={loading || uploading} className="bg-emerald-500 text-white px-10 py-5 rounded-3xl font-black text-xl shadow-xl uppercase">Lancer ✨</button>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. PROMPT */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">1. Consignes de correction</label>
                        <textarea className="w-full h-32 bg-slate-50 p-4 rounded-2xl border-none text-sm outline-none focus:ring-2 ring-indigo-500" placeholder="Ex: Vérifie que les 3 dates clés sont citées..." value={teacherPrompt} onChange={e => setTeacherPrompt(e.target.value)} />
                    </div>
                    {/* 2. FEUILLE DE QUESTIONS */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-500 uppercase ml-2">2. Sujet / Questions (Photo)</label>
                        <div className="h-32 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200 flex items-center justify-center relative overflow-hidden">
                            {questionsUrl ? <img src={questionsUrl} className="h-full w-full object-contain" /> : <span className="text-[10px] font-bold text-blue-300">FEUILLE QUESTIONS</span>}
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e.target.files, 'q')} />
                        </div>
                    </div>
                    {/* 3. DOCUMENTS ANNEXES */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-500 uppercase ml-2">3. Docs de référence (Support)</label>
                        <div className="h-32 bg-emerald-50 rounded-2xl border-2 border-dashed border-emerald-200 flex items-center justify-center relative overflow-hidden">
                            <div className="flex gap-1">
                                {docUrls.map((u, i) => <div key={i} className="w-8 h-8 bg-white rounded-md shadow-sm"></div>)}
                                <span className="text-[10px] font-bold text-emerald-400">DOCS SUPPORT ({docUrls.length})</span>
                            </div>
                            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e.target.files, 'd')} />
                        </div>
                    </div>
                </div>
            </div>

            {status && <div className="p-4 bg-indigo-600 text-white text-center font-black rounded-3xl uppercase text-xs animate-pulse">{status}</div>}
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 opacity-40">
                {photos.map(p => (
                    <div key={p.id} className="bg-white p-2 rounded-[30px] border-2 border-slate-100 aspect-[3/4] overflow-hidden">
                        <img src={`/api/view-thumbnail/${p.id}`} className="w-full h-full object-cover rounded-[20px]" />
                    </div>
                ))}
            </div>
        </div>
    );
}