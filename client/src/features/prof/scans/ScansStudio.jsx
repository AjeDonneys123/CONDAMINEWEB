import React, { useState, useEffect } from 'react';

export default function ScansStudio() {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]); // Photos déjà sur Drive
    const [queue, setQueue] = useState([]);   // Photos prises sur iPhone mais pas encore envoyées
    const [status, setStatus] = useState("");
    const [hwTitle, setHwTitle] = useState("Trimestre 2");

    const loadList = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/google/drive/list').then(r => r.json());
            if (res.ok) setPhotos(res.files || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadList(); }, []);

    // --- AJOUTER UNE PHOTO A LA QUEUE ---
    const handleAddPhoto = (e) => {
        const files = Array.from(e.target.files);
        const newItems = files.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            id: Math.random().toString(36).substr(2, 9)
        }));
        setQueue(prev => [...prev, ...newItems]);
        setStatus(`${queue.length + newItems.length} copies en attente d'envoi.`);
    };

    // --- TOUT ENVOYER AU SERVEUR ---
    const uploadQueue = async () => {
        if (queue.length === 0) return;
        setLoading(true);
        const total = queue.length;
        
        for (let i = 0; i < queue.length; i++) {
            setStatus(`Envoi copie ${i + 1}/${total}...`);
            const fd = new FormData();
            fd.append('file', queue[i].file);
            
            try {
                await fetch('/api/manual-upload-scan', { method: 'POST', body: fd });
            } catch (err) { console.error("Erreur envoi", err); }
        }

        setQueue([]);
        setStatus("✅ Toutes les copies ont été envoyées !");
        loadList();
        setLoading(false);
    };

    return (
        <div className="p-4 space-y-6 animate-in fade-in max-w-full overflow-hidden">
            {/* PANNEAU DE CONTROLE FIXE EN HAUT */}
            <div className="bg-white p-6 rounded-[35px] shadow-2xl border-b-4 border-indigo-600 sticky top-0 z-50">
                <div className="flex justify-between items-center gap-4">
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-slate-800 uppercase leading-none">Scanner Rafale</h2>
                        <input className="mt-2 bg-slate-50 p-2 rounded-lg font-bold text-indigo-600 text-sm w-full border-none outline-none" value={hwTitle} onChange={e => setHwTitle(e.target.value)} />
                    </div>
                    
                    <div className="flex gap-2">
                        {/* BOUTON CAMERA : TOUJOURS ACCESSIBLE */}
                        <div className="relative w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-3xl shadow-xl active:scale-90 transition-all">
                            📸
                            <input type="file" accept="image/*" capture="environment" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleAddPhoto} />
                        </div>
                        {/* BOUTON ENVOI : APPARAIT SI QUEUE > 0 */}
                        {queue.length > 0 && (
                            <button onClick={uploadQueue} disabled={loading} className="bg-emerald-500 text-white px-4 rounded-2xl font-black text-xs shadow-lg animate-bounce">
                                ENVOYER ({queue.length})
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ZONE DE TRANSIT (QUEUE) */}
            {queue.length > 0 && (
                <div className="bg-indigo-50 p-4 rounded-[30px] border-2 border-dashed border-indigo-200">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <b className="text-indigo-800 text-xs uppercase">Copies prêtes à l'envoi</b>
                        <button onClick={() => setQueue([])} className="text-red-500 text-[10px] font-bold">ANNULER TOUT</button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {queue.map((item) => (
                            <div key={item.id} className="relative flex-shrink-0">
                                <img src={item.preview} className="w-20 h-28 object-cover rounded-xl border-2 border-white shadow-sm" />
                                <button 
                                    onClick={() => setQueue(queue.filter(q => q.id !== item.id))}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold shadow-lg"
                                >✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {status && <div className="p-3 bg-yellow-400 text-black text-center font-black rounded-2xl text-[10px] uppercase shadow-md">{status}</div>}

            {/* GRILLE DES PHOTOS SUR DRIVE */}
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {photos.map(p => (
                    <div key={p.id} className="bg-white p-1 rounded-2xl border border-slate-100 aspect-[3/4] overflow-hidden opacity-60">
                        <img src={`/api/view-thumbnail/${p.id}`} className="w-full h-full object-cover rounded-xl" />
                    </div>
                ))}
            </div>
        </div>
    );
}