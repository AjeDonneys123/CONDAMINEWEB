import React, { useState, useEffect } from 'react';

export default function ScansStudio() {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]); 
    const [status, setStatus] = useState("");
    const [selectedPhoto, setSelectedPhoto] = useState(null);

    const runDriveScan = async () => {
        setLoading(true);
        setStatus("Synchronisation Drive...");
        try {
            const res = await fetch('/api/google/drive/list').then(r => r.json());
            if (res.ok) {
                const images = (res.files || []).filter(f => 
                    f.mimeType.includes('image') || 
                    f.name.toLowerCase().endsWith('.heic')
                );
                setPhotos(images);
                setStatus(`${images.length} copies détectées.`);
            }
        } catch (err) { setStatus("Erreur."); }
        setLoading(false);
    };

    useEffect(() => { runDriveScan(); }, []);

    return (
        <div className="p-6 space-y-8 animate-in fade-in">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border-b-8 border-indigo-600 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black uppercase text-slate-800 tracking-tighter">Scanner Intelligent</h2>
                    <p className="text-slate-400 font-bold">Flux direct depuis ton dossier Drive.</p>
                </div>
                <button onClick={runDriveScan} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg">RAFRAÎCHIR</button>
            </div>

            {photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {photos.map(p => (
                        <div key={p.id} className="group bg-white p-3 rounded-[35px] border-2 border-slate-100 shadow-sm hover:border-indigo-400 transition-all cursor-pointer" onClick={() => setSelectedPhoto(p)}>
                            <div className="aspect-[3/4] rounded-[25px] overflow-hidden bg-slate-100 relative">
                                {/* UTILISATION DU PROXY SERVEUR POUR L'IMAGE */}
                                <img 
                                    src={`/api/view-thumbnail/${p.id}`} 
                                    className="w-full h-full object-cover" 
                                    alt={p.name}
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="bg-white text-indigo-900 px-4 py-2 rounded-full text-xs font-black uppercase">Voir</span>
                                </div>
                            </div>
                            <p className="mt-2 text-[9px] font-bold text-slate-400 text-center truncate">{p.name}</p>
                        </div>
                    ))}
                </div>
            )}

            {selectedPhoto && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
                    <img 
                        src={`/api/view-thumbnail/${selectedPhoto.id}`} 
                        className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border-4 border-white/20" 
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="mt-6 flex gap-4" onClick={(e) => e.stopPropagation()}>
                        <button className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black uppercase shadow-lg">Lancer la correction IA ✨</button>
                    </div>
                </div>
            )}
        </div>
    );
}