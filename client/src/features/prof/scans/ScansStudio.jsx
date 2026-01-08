import React, { useState, useEffect } from 'react';

export default function ScansStudio() {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]); 
    const [status, setStatus] = useState("");
    const [hwTitle, setHwTitle] = useState("Trimestre 2");

    const loadList = async () => {
        setLoading(true);
        setStatus("Interrogation du serveur...");
        try {
            const res = await fetch('/api/google/drive/list').then(r => r.json());
            if (res.ok) {
                const images = (res.files || []).filter(f => f.mimeType.includes('image') || f.name.toLowerCase().endsWith('.heic'));
                setPhotos(images);
                setStatus(images.length > 0 ? "" : "Dossier vide à la racine.");
            } else {
                // Affiche l'erreur précise renvoyée par le serveur
                setStatus("ERREUR : " + (res.error || "Problème inconnu"));
            }
        } catch (e) { 
            setStatus("SERVEUR HORS-LIGNE."); 
        }
        setLoading(false);
    };

    useEffect(() => { loadList(); }, []);

    const runInit = async () => {
        setLoading(true);
        setStatus("Construction des dossiers...");
        try {
            const res = await fetch('/api/init-drive-structure', { method: 'POST' }).then(r => r.json());
            if (res.ok) alert(res.message);
            else setStatus("ERREUR INIT : " + res.error);
        } catch (e) { setStatus("ERREUR RESEAU."); }
        setLoading(false);
    };

    return (
        <div className="p-6 space-y-8 animate-in fade-in">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border-b-8 border-indigo-600 flex justify-between items-center">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-black uppercase text-slate-800">Scanner Intelligent</h2>
                        <button onClick={runInit} className="ml-4 bg-slate-800 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-black transition-all">🏗️ Créer Dossiers 1D/6D/2A</button>
                    </div>
                    <input className="mt-2 bg-slate-100 p-2 rounded-lg font-bold text-indigo-600 outline-none border-none w-1/2" value={hwTitle} onChange={e => setHwTitle(e.target.value)} />
                </div>
                <button 
                    onClick={loadList} 
                    disabled={loading}
                    className="bg-slate-100 text-slate-700 px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-slate-200"
                >
                    Actualiser
                </button>
            </div>
            
            {status && (
                <div className={`p-5 text-center font-black rounded-3xl shadow-lg uppercase ${status.includes('ERREUR') ? 'bg-red-500 text-white' : 'bg-yellow-400 text-black animate-pulse'}`}>
                    {status}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {photos.map(p => (
                    <div key={p.id} className="bg-white p-2 rounded-[35px] border-2 border-slate-100 aspect-[3/4] overflow-hidden shadow-sm">
                        <img src={`/api/view-thumbnail/${p.id}`} className="w-full h-full object-cover rounded-[20px]" />
                    </div>
                ))}
            </div>
        </div>
    );
}