import React, { useState, useEffect } from 'react';

export default function ScansStudio() {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]); 
    const [status, setStatus] = useState("");
    const [hwTitle, setHwTitle] = useState("Trimestre 2");
    
    // NOUVEL ÉTAT POUR LE CONTEXTE IA
    const [teacherPrompt, setTeacherPrompt] = useState("");
    const [questionsImg, setQuestionsImg] = useState(null);
    const [docImgs, setDocImgs] = useState([]);
    const [uploadingContext, setUploadingContext] = useState(false);

    const loadList = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/google/drive/list').then(r => r.json());
            if (res.ok) setPhotos((res.files || []).filter(f => f.thumbnailLink));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadList(); }, []);

    const handleContextUpload = async (files, type) => {
        setUploadingContext(true);
        const uploadedUrls = [];
        for (let file of Array.from(files)) {
            const fd = new FormData(); fd.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
            if (res.ok) uploadedUrls.push(res.imageUrl);
        }
        if (type === 'q') setQuestionsImg(uploadedUrls[0]);
        else setDocImgs(prev => [...prev, ...uploadedUrls]);
        setUploadingContext(false);
    };

    const processTurbo = async () => {
        if (!window.confirm(`Lancer la correction IA intelligente pour ${photos.length} copies ?`)) return;
        setLoading(true);
        const copies = [...photos];
        const chunkSize = 2;
        
        for (let i = 0; i < copies.length; i += chunkSize) {
            const chunk = copies.slice(i, i + chunkSize);
            setStatus(`Correction en cours (Groupe ${Math.floor(i/chunkSize) + 1})...`);
            await Promise.all(chunk.map(async (photo) => {
                await fetch('/api/process-copy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        fileId: photo.id, 
                        homeworkTitle: hwTitle,
                        teacherPrompt,
                        questionsUrl: questionsImg,
                        docUrls: docImgs
                    })
                });
                setPhotos(prev => prev.filter(p => p.id !== photo.id));
            }));
        }
        setLoading(false);
        setStatus("Toutes les copies ont été corrigées selon tes documents ! ✅");
    };

    return (
        <div className="p-6 space-y-8 animate-in fade-in">
            {/* PANNEAU DE COMMANDE ET CONFIG IA */}
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border-b-8 border-indigo-600 space-y-6">
                <div className="flex justify-between items-center gap-6">
                    <div className="flex-1">
                        <h2 className="text-3xl font-black uppercase text-slate-800 tracking-tighter italic">Scanner Intelligent Pro</h2>
                        <input className="mt-2 bg-slate-100 p-3 rounded-xl font-bold text-indigo-600 w-full outline-none" value={hwTitle} onChange={e => setHwTitle(e.target.value)} placeholder="Nom de l'examen..." />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={loadList} className="bg-slate-100 px-6 py-4 rounded-2xl font-black uppercase text-xs">Rafraîchir</button>
                        {photos.length > 0 && <button onClick={processTurbo} disabled={loading || uploadingContext} className="bg-emerald-500 text-white px-10 py-5 rounded-3xl font-black text-xl shadow-xl uppercase">Lancer la correction ✨</button>}
                    </div>
                </div>

                {/* ZONE DE CONTEXTE IA (Questions + Docs + Prompt) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-[35px] border-2 border-dashed border-slate-200">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">1. Consignes de correction</label>
                        <textarea 
                            className="w-full h-32 p-4 rounded-2xl border-none shadow-inner bg-white text-sm" 
                            placeholder="Ex: Sois exigeant sur les dates. La réponse doit mentionner l'exode rural..." 
                            value={teacherPrompt}
                            onChange={e => setTeacherPrompt(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-500 uppercase ml-2">2. Feuille de Questions (Photo)</label>
                        <div className="h-32 bg-white rounded-2xl border-2 border-dashed border-blue-200 flex items-center justify-center relative overflow-hidden">
                            {questionsImg ? <img src={questionsImg} className="h-full w-full object-contain" /> : <span className="text-[10px] font-bold text-blue-300 uppercase">Ajouter Photo</span>}
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleContextUpload(e.target.files, 'q')} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-500 uppercase ml-2">3. Documents Support (Photos)</label>
                        <div className="flex flex-wrap gap-2 p-2 bg-white rounded-2xl border-2 border-dashed border-emerald-200 min-h-[128px]">
                            {docImgs.map((url, i) => <img key={i} src={url} className="w-12 h-12 object-cover rounded-lg shadow-sm" />)}
                            <label className="w-12 h-12 bg-emerald-50 text-emerald-400 flex items-center justify-center rounded-lg border-2 border-dashed cursor-pointer">+</label>
                            <input type="file" multiple className="hidden" onChange={e => handleContextUpload(e.target.files, 'd')} />
                        </div>
                    </div>
                </div>
            </div>

            {status && <div className="p-4 bg-yellow-400 text-black text-center font-black rounded-3xl animate-pulse uppercase text-xs">{status}</div>}
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 opacity-60">
                {photos.map(p => (
                    <div key={p.id} className="bg-white p-2 rounded-[30px] border-2 border-slate-100 aspect-[3/4] overflow-hidden shadow-sm grayscale hover:grayscale-0 transition-all">
                        <img src={`/api/view-thumbnail/${p.id}`} className="w-full h-full object-cover rounded-[20px]" />
                    </div>
                ))}
            </div>
        </div>
    );
}