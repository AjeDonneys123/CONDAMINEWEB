import React, { useState, useEffect } from 'react';

export default function ScansStudio() {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]); 
    const [status, setStatus] = useState("");
    const [selectedPhoto, setSelectedPhoto] = useState(null);

    const runDriveScan = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/google/drive/list').then(r => r.json());
            if (res.ok) {
                const images = (res.files || []).filter(f => 
                    f.mimeType.includes('image') || f.name.toLowerCase().endsWith('.heic')
                );
                setPhotos(images);
            }
        } catch (err) { setStatus("Erreur."); }
        setLoading(false);
    };

    useEffect(() => { runDriveScan(); }, []);

    // --- FONCTION DE SUPPRESSION ---
    const deleteFile = async (e, fileId) => {
        e.stopPropagation(); // Empêche d'ouvrir la modale
        if (!window.confirm("Supprimer définitivement cette copie de Google Drive ?")) return;

        try {
            const res = await fetch(`/api/google/drive/${fileId}`, { method: 'DELETE' }).then(r => r.json());
            if (res.ok) {
                // Mise à jour immédiate de l'interface
                setPhotos(photos.filter(p => p.id !== fileId));
            } else {
                alert("Erreur lors de la suppression.");
            }
        } catch (err) {
            alert("Erreur réseau.");
        }
    };

    return (
        <div className="p-6 space-y-8 animate-in fade-in">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border-b-8 border-indigo-600 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black uppercase text-slate-800 tracking-tighter">Scanner Intelligent</h2>
                    <p className="text-slate-400 font-bold">Gère tes archives Drive en direct.</p>
                </div>
                <button onClick={runDriveScan} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg">RAFRAÎCHIR</button>
            </div>

            {photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {photos.map(p => (
                        <div key={p.id} className="group relative bg-white p-3 rounded-[35px] border-2 border-slate-100 shadow-sm hover:border-indigo-400 transition-all cursor-pointer" onClick={() => setSelectedPhoto(p)}>
                            <div className="aspect-[3/4] rounded-[25px] overflow-hidden bg-slate-100 relative">
                                <img 
                                    src={`/api/view-thumbnail/${p.id}`} 
                                    className="w-full h-full object-cover" 
                                    alt={p.name}
                                />
                                <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="bg-white text-indigo-900 px-4 py-2 rounded-full text-xs font-black uppercase shadow-lg">Voir</span>
                                </div>
                            </div>
                            
                            {/* BOUTON SUPPRIMER (X) */}
                            <div className="mt-3 flex justify-between items-center px-2">
                                <p className="text-[9px] font-bold text-slate-400 truncate w-32">{p.name}</p>
                                <button 
                                    onClick={(e) => deleteFile(e, p.id)}
                                    className="w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center font-black hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                >
                                    ✕
                                </button>
                            </div>
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
                        <button className="bg-emerald-500 text-white px-10 py-4 rounded-2xl font-black uppercase shadow-lg">Lancer la correction IA ✨</button>
                        <button 
                            onClick={(e) => { deleteFile(e, selectedPhoto.id); setSelectedPhoto(null); }}
                            className="bg-red-500 text-white px-10 py-4 rounded-2xl font-black uppercase shadow-lg"
                        >
                            Supprimer 🗑️
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}