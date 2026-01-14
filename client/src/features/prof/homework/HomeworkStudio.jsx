import React, { useState, useEffect } from 'react';
import './HomeworkStudio.css';

export default function HomeworkStudio({ initialData, chapters, globalClass, onClose }) {
  const [players, setPlayers] = useState([]);
  const [stdSearch, setStdSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Utilisation de globalClass au lieu d'un sélecteur local
  const [formData, setFormData] = useState(initialData || { 
      title: '', 
      targetGrade: 'Tous', 
      targetPlayerIds: [], 
      chapterId: (chapters && chapters.length > 0) ? chapters[0]._id : 'none',
      levels: [{ instruction: '', attachmentUrls: [], questionImage: null, aiCorrectionHint: '' }] 
  });

  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then(data => setPlayers(data || []));
  }, []);

  // Fonction d'upload corrigée pour les documents
  const handleUpload = async (files, idx, type) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    
    // Deep clone des niveaux
    const newLevels = JSON.parse(JSON.stringify(formData.levels));
    
    for (let file of Array.from(files)) {
      const fd = new FormData(); 
      fd.append('file', file);
      
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
        if (res.ok) {
          if (type === 'doc') {
            newLevels[idx].attachmentUrls.push(res.imageUrl);
          } else {
            newLevels[idx].questionImage = res.imageUrl;
          }
        }
      } catch (e) {
        console.error("Erreur upload:", e);
      }
    }
    
    setFormData({ ...formData, levels: newLevels });
    setUploading(false);
  };

  const save = async () => {
    if (!formData.title) return alert("Veuillez donner un titre au devoir.");
    
    // On injecte globalClass au moment de la sauvegarde
    const finalData = { 
        ...formData, 
        classroom: globalClass,
        chapterId: formData.chapterId === 'none' ? null : formData.chapterId 
    };

    try {
        const res = await fetch('/api/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalData)
        });
        if (res.ok) onClose();
    } catch (e) {
        alert("Erreur lors de la sauvegarde.");
    }
  };

  const filteredPlayers = players.filter(p => 
    p.classroom === globalClass && 
    (p.firstName + " " + p.lastName).toLowerCase().includes(stdSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[6000] bg-slate-50 flex flex-col animate-in slide-in-from-bottom-4">
        <div className="p-6 bg-orange-500 text-white flex justify-between items-center shadow-lg">
            <div className="flex flex-col">
                <input 
                    className="text-2xl font-black bg-transparent outline-none w-full placeholder:text-orange-200" 
                    value={formData.title} 
                    onChange={e=>setFormData({...formData, title:e.target.value})} 
                    placeholder="TITRE DU DEVOIR" 
                />
                <span className="text-[10px] font-black opacity-70">CLASSE : {globalClass}</span>
            </div>
            <button onClick={onClose} className="w-10 h-10 bg-black/10 rounded-full font-black hover:bg-black/20 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header Grid : 2 Colonnes seulement maintenant */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="assign-card">
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Dossier de rattachement</label>
                        <select 
                            className="w-full font-bold outline-none bg-white p-3 rounded-xl border border-slate-200" 
                            value={formData.chapterId} 
                            onChange={e=>setFormData({...formData, chapterId: e.target.value})}
                        >
                            <option value="none">-- Aucun dossier --</option>
                            {chapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>
                    
                    <div className="assign-card relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Cibler des élèves spécifiques (optionnel)</label>
                        <input 
                            className="w-full outline-none bg-white p-3 rounded-xl border border-slate-200 font-bold" 
                            placeholder="Chercher un nom..." 
                            value={stdSearch} 
                            onChange={e=>setStdSearch(e.target.value)} 
                        />
                        {stdSearch && (
                            <div className="absolute top-full left-0 right-0 bg-white shadow-2xl z-50 rounded-xl max-h-40 overflow-auto border border-slate-100 mt-1">
                                {filteredPlayers.map(p => (
                                    <div key={p._id} onClick={()=>{ setFormData({...formData, targetPlayerIds:[...formData.targetPlayerIds, p._id]}); setStdSearch(''); }} className="p-3 hover:bg-orange-50 cursor-pointer font-bold text-slate-700 border-b last:border-none">{p.firstName} {p.lastName}</div>
                                ))}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {formData.targetPlayerIds.map(id => (
                            <span key={id} className="bg-orange-100 text-orange-600 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-2">
                                {players.find(x => x._id === id)?.firstName} 
                                <button onClick={()=>setFormData({...formData, targetPlayerIds: formData.targetPlayerIds.filter(x=>x!==id)})} className="hover:text-red-500">✕</button>
                            </span>
                          ))}
                        </div>
                    </div>
                </div>

                {/* Liste des Pages/Niveaux */}
                {formData.levels.map((lvl, idx) => (
                    <div key={idx} className="bg-white p-10 rounded-[50px] border border-slate-100 shadow-sm relative group">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div>
                                <label className="text-[10px] font-black uppercase text-blue-500 mb-2 block tracking-widest">Documents supports</label>
                                <div className="flex flex-wrap gap-3 p-5 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    {lvl.attachmentUrls?.map((u, i) => (
                                        <div key={i} className="relative group">
                                            <img src={u} className="w-20 h-20 object-cover rounded-2xl border-2 border-white shadow-md" />
                                            <button 
                                                onClick={() => {
                                                    const nl = [...formData.levels];
                                                    nl[idx].attachmentUrls.splice(i, 1);
                                                    setFormData({...formData, levels: nl});
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity"
                                            >✕</button>
                                        </div>
                                    ))}
                                    <label className="w-20 h-20 bg-white flex items-center justify-center rounded-2xl border border-slate-200 cursor-pointer text-slate-300 hover:text-blue-500 hover:border-blue-500 transition-all text-2xl font-black">
                                        +
                                        <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx, 'doc')} />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-orange-500 mb-2 block tracking-widest">Image de la Question</label>
                                <div className="h-40 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group">
                                    {lvl.questionImage ? (
                                        <>
                                            <img src={lvl.questionImage} className="h-full w-full object-contain" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white font-black text-xs">CHANGER LA PHOTO</span>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-slate-300 font-black text-xs">CLIQUE POUR AJOUTER LA PHOTO</span>
                                    )}
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleUpload(e.target.files, idx, 'qimg')} />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 space-y-4">
                            <textarea 
                                className="w-full p-6 rounded-3xl h-24 border border-slate-200 font-bold text-slate-600 outline-none focus:border-orange-500 transition-colors" 
                                value={lvl.instruction} 
                                onChange={e=>{const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} 
                                placeholder="Écris la consigne pour l'élève ici..." 
                            />
                            <textarea 
                                className="w-full p-6 rounded-3xl h-24 border bg-purple-50 font-bold text-purple-600 outline-none border-transparent focus:border-purple-300 transition-colors" 
                                value={lvl.aiCorrectionHint} 
                                onChange={e=>{const n=[...formData.levels]; n[idx].aiCorrectionHint=e.target.value; setFormData({...formData, levels:n});}} 
                                placeholder="Indices pour l'IA (Ex: Réponse attendue, mots clés...)" 
                            />
                        </div>
                    </div>
                ))}
                
                <button 
                    onClick={() => setFormData({...formData, levels: [...formData.levels, { instruction: '', attachmentUrls: [], questionImage: null, aiCorrectionHint: '' }]})}
                    className="w-full p-6 border-4 border-dashed border-slate-200 rounded-[40px] text-slate-300 font-black hover:text-orange-500 hover:border-orange-200 transition-all uppercase tracking-tighter"
                >
                    + Ajouter une page au devoir
                </button>
            </div>
        </div>

        <div className="p-8 bg-white border-t">
            <button 
                onClick={save} 
                disabled={uploading} 
                className="w-full p-6 bg-orange-500 text-white font-black text-2xl rounded-3xl shadow-xl hover:bg-orange-600 active:scale-95 transition-all uppercase"
            >
                {uploading ? "UPLOAD EN COURS..." : "💾 SAUVEGARDER LE DEVOIR"}
            </button>
        </div>
    </div>
  );
}