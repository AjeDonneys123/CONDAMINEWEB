import React, { useState } from 'react';

export default function HomeworkStudio({ initialData, chapters, globalClass, user, onClose }) {
  const [formData, setFormData] = useState(initialData || { 
      title: '', chapterId: (chapters && chapters[0]?._id) || '', classroom: globalClass, 
      levels: [{instruction: '', attachmentUrls: []}] 
  });
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    if (!formData.title || !formData.chapterId) return alert("Titre et Chapitre requis");
    
    setUploading(true);
    try {
        const response = await fetch('/api/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, teacherId: user.id || user._id })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Erreur lors de la création Cloud");
        }

        const result = await response.json();
        console.log("✅ Devoir sauvegardé:", result);
        onClose();
    } catch (e) { 
        console.error("❌ Erreur Studio:", e.message);
        alert(e.message); 
    } finally {
        setUploading(false); // GARANTIT LE DÉBLOCAGE DU BOUTON
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[6000] flex flex-col animate-in slide-in-from-bottom-4">
        <div className="p-8 bg-orange-500 text-white flex justify-between items-center shadow-lg">
            <input className="text-2xl font-black bg-transparent outline-none w-full placeholder:text-orange-200" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="TITRE DU DEVOIR" />
            <button onClick={onClose} className="text-2xl font-black">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-10">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="p-8 bg-slate-50 rounded-[30px] border">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Dossier Archive</label>
                    <select className="w-full p-4 rounded-2xl font-bold border-none shadow-inner" value={formData.chapterId} onChange={e=>setFormData({...formData, chapterId:e.target.value})}>
                        <option value="">-- Choisir un dossier --</option>
                        {chapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                    </select>
                </div>

                {formData.levels.map((lvl, i) => (
                    <div key={i} className="p-8 bg-white border rounded-[40px] shadow-sm">
                        <textarea className="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none h-32 mb-4" placeholder="Consigne pour les élèves..." value={lvl.instruction} onChange={e => {
                            const newL = [...formData.levels]; newL[i].instruction = e.target.value; setFormData({...formData, levels: newL});
                        }} />
                    </div>
                ))}
            </div>
        </div>

        <div className="p-8 border-t bg-slate-50">
            <button onClick={save} disabled={uploading} className="w-full p-6 bg-orange-500 text-white font-black text-2xl rounded-3xl shadow-xl uppercase transition-all active:scale-95">
                {uploading ? "CRÉATION DE L'ESPACE CLOUD..." : "LANCER LE DEVOIR"}
            </button>
        </div>
    </div>
  );
}