import React, { useState, useEffect } from 'react';

export default function ScansStudio() {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]); 
    const [status, setStatus] = useState("");
    const [hwTitle, setHwTitle] = useState("Trimestre 2");
    const [selectedScan, setSelectedScan] = useState(null);

    const loadList = async () => {
        setLoading(true);
        setStatus("Chargement des photos...");
        try {
            const res = await fetch('/api/google/drive/list').then(r => r.json());
            if (res.ok) {
                setPhotos(res.files || []);
                setStatus(res.files.length > 0 ? "" : "Dossier Drive vide.");
            } else {
                setStatus("Erreur : " + res.error);
            }
        } catch (e) { setStatus("Erreur réseau (serveur injoignable)."); }
        setLoading(false);
    };

    useEffect(() => { loadList(); }, []);

    const handleCameraCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true);
        setStatus("Envoi iPhone -> Drive...");
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch('/api/manual-upload-scan', { method: 'POST', body: fd }).then(r => r.json());
            if (res.ok) {
                setStatus("✅ Reçu !");
                setTimeout(loadList, 2000);
            } else { setStatus("❌ Échec envoi."); }
        } catch (e) { setStatus("❌ Erreur réseau."); }
        setLoading(false);
    };

    return (
        <div className="p-6 space-y-8 animate-in fade-in">
            {/* PANNEAU COMMANDE */}
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border-b-8 border-indigo-600 flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <div className="relative w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-3xl shadow-xl">
                        📸
                        <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleCameraCapture} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 uppercase">Scanner IA</h2>
                        <input className="mt-1 bg-slate-100 p-2 rounded-lg font-bold text-indigo-600 w-full outline-none" value={hwTitle} onChange={e => setHwTitle(e.target.value)} />
                    </div>
                </div>
                <button onClick={loadList} className="bg-slate-100 text-slate-500 px-8 py-4 rounded-2xl font-black uppercase text-xs">Rafraîchir</button>
            </div>

            {status && <div className="p-4 bg-yellow-400 text-black text-center font-black rounded-2xl uppercase text-xs">{status}</div>}

            {/* GRILLE PHOTOS */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {photos.map(p => (
                    <div key={p.id} className="bg-white p-2 rounded-[30px] border-2 border-slate-100 aspect-[3/4] overflow-hidden shadow-sm">
                        <img src={`/api/view-thumbnail/${p.id}`} className="w-full h-full object-cover rounded-[20px]" alt={p.name} />
                    </div>
                ))}
            </div>
        </div>
    );
}