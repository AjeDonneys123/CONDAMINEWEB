import React, { useState, useEffect } from 'react';

export default function ScansStudio() {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]); 
    const [status, setStatus] = useState("");
    const [hwTitle, setHwTitle] = useState("Trimestre 2");

    const loadList = async () => {
        setLoading(true);
        setStatus("Interrogation du dossier Drive...");
        try {
            const res = await fetch('/api/google/drive/list').then(r => r.json());
            if (res.ok) {
                // Filtre pour ne garder que les images
                const images = (res.files || []).filter(f => 
                    f.mimeType.includes('image') || 
                    f.name.toLowerCase().match(/\.(jpg|jpeg|png|heic)$/)
                );
                setPhotos(images);
                setStatus(images.length > 0 ? "" : "Aucune copie trouvée à la racine.");
            } else {
                setStatus("ERREUR : " + res.error);
            }
        } catch (e) { 
            setStatus("ERREUR DE LIAISON AVEC LE SERVEUR."); 
        }
        setLoading(false);
    };

    useEffect(() => { loadList(); }, []);

    return (
        <div className="p-6 space-y-8 animate-in fade-in">
            {/* PANNEAU DE COMMANDE */}
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border-b-8 border-indigo-600 flex justify-between items-center">
                <div className="flex-1">
                    <h2 className="text-3xl font-black uppercase text-slate-800 tracking-tighter">Scanner Intelligent</h2>
                    <p className="text-slate-400 font-bold">Synchronise tes photos du Drive école.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={loadList} 
                        disabled={loading}
                        className="bg-slate-100 text-slate-700 px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-slate-200"
                    >
                        Actualiser
                    </button>
                    {photos.length > 0 && (
                        <button className="bg-emerald-500 text-white px-10 py-4 rounded-3xl font-black text-xl shadow-xl hover:bg-emerald-600 transition-all uppercase">
                            Tout Corriger ✨
                        </button>
                    )}
                </div>
            </div>
            
            {status && (
                <div className={`p-5 text-center font-black rounded-3xl shadow-lg uppercase ${status.includes('ERREUR') ? 'bg-red-500 text-white' : 'bg-yellow-400 text-black animate-pulse'}`}>
                    {status}
                </div>
            )}

            {/* GRILLE DES VIGNETTES */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {photos.map(p => (
                    <div key={p.id} className="group bg-white p-2 rounded-[35px] border-2 border-slate-100 aspect-[3/4] overflow-hidden shadow-sm hover:border-indigo-400 transition-all cursor-pointer">
                        <img 
                            src={`/api/view-thumbnail/${p.id}`} 
                            className="w-full h-full object-cover rounded-[20px]" 
                            alt={p.name}
                        />
                    </div>
                ))}
            </div>

            {photos.length === 0 && !loading && !status && (
                <div className="py-20 text-center bg-slate-50 rounded-[50px] border-4 border-dashed border-slate-100">
                    <p className="text-slate-300 font-black text-xl uppercase">Dossier Drive vide.</p>
                </div>
            )}
        </div>
    );
}