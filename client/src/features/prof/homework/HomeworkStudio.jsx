import React, { useState, useEffect } from 'react';
import './HomeworkStudio.jsx';

export default function HomeworkStudio({ initialData, chapters, globalClass, onClose }) {
  const [players, setPlayers] = useState([]);
  const [stdSearch, setStdSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState(initialData || { 
      title: '', targetGrade: 'Tous', targetPlayerIds: [], 
      chapterId: (chapters && chapters.length > 0) ? chapters[0]._id : 'none',
      levels: [{ instruction: '', attachmentUrls: [], questionImage: null, aiCorrectionHint: '' }] 
  });

  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then(data => setPlayers(data || []));
  }, []);

  const handleUpload = async (files, idx, type) => {
    if (!files || files.length === 0) return;
    if (!formData.title) {
        alert("⚠️ Indique un TITRE d'abord pour créer le dossier sur le Drive.");
        return;
    }
    
    setUploading(true);
    const newLevels = JSON.parse(JSON.stringify(formData.levels));
    
    for (let file of Array.from(files)) {
      const fd = new FormData(); 
      fd.append('file', file);
      fd.append('classroom', globalClass);
      fd.append('title', formData.title);
      fd.append('type', type);
      
      try {
        const res = await fetch('/api/homework/upload-to-drive', { method: 'POST', body: fd }).then(r => r.json());
        if (res.ok) {
          if (type === 'doc') newLevels[idx].attachmentUrls.push(res.imageUrl);
          else newLevels[idx].questionImage = res.imageUrl;
        }
      } catch (e) { console.error("Upload crash:", e); }
    }
    setFormData({ ...formData, levels: newLevels });
    setUploading(false);
  };

  const save = async () => {
    if (!formData.title) return alert("Le titre est obligatoire.");
    setUploading(true);
    try {
        const res = await fetch('/api/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, classroom: globalClass, chapterId: formData.chapterId === 'none' ? null : formData.chapterId })
        });
        if (res.ok) onClose();
    } catch (e) { alert("Erreur sauvegarde."); }
    setUploading(false);
  };

  // On ne montre que les élèves de la classe sélectionnée
  const filteredPlayers = players.filter(p => 
    p.classroom === globalClass && 
    (p.firstName + " " + p.lastName).toLowerCase().includes(stdSearch.toLowerCase())
  );

  return (
    <div className="homework-studio-overlay animate-in slide-in-from-bottom-4">
        <div className="p-6 bg-orange-500 text-white flex justify-between items-center shadow-lg pt-12">
            <div className="flex flex-col">
                <input className="text-2xl font-black bg-transparent outline-none w-full placeholder:text-orange-200" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="TITRE DU DEVOIR..." />
                <span className="text-[10px] font-black opacity-80 uppercase tracking-widest">Aiguillage Drive : {globalClass} / {formData.targetPlayerIds.length > 0 ? 'Ciblé' : 'Toute la classe'}</span>
            </div>
            <button onClick={onClose} className="w-10 h-10 bg-black/10 rounded-full font-black">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="assign-card"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Dossier de cours</label>
                        <select className="w-full font-bold outline-none bg-white p-3 rounded-xl border border-slate-200" value={formData.chapterId} onChange={e=>setFormData({...formData, chapterId: e.target.value})}>
                            <option value="none">-- Aucun --</option>
                            {chapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>
                    <div className="assign-card relative"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Cibler des élèves spécifiques</label>
                        <input className="w-full outline-none bg-white p-3 rounded-xl border border-slate-200 font-bold" placeholder="Taper un nom..." value={stdSearch} onChange={e=>setStdSearch(e.target.value)} />
                        {stdSearch && (
                            <div className="absolute top-full left-0 right-0 bg-white shadow-2xl z-50 rounded-xl max-h-40 overflow-auto border border-slate-100 mt-1">
                                {filteredPlayers.map(p => (
                                    <div key={p._id} onClick={()=>{ setFormData({...formData, targetPlayerIds:[...formData.targetPlayerIds, p._id]}); setStdSearch(''); }} className="p-3 hover:bg-orange-50 cursor-pointer font-bold border-b last:border-none">{p.firstName} {p.lastName}</div>
                                ))}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {formData.targetPlayerIds.map(id => (
                            <span key={id} className="bg-orange-100 text-orange-600 px-3 py-1 rounded-lg text-[9px] font-black flex items-center gap-2">
                                {players.find(x => x._id === id)?.firstName} 
                                <button onClick={()=>setFormData({...formData, targetPlayerIds: formData.targetPlayerIds.filter(x=>x!==id)})} className="hover:text-red-500">✕</button>
                            </span>
                          ))}
                        </div>
                    </div>
                </div>

                {formData.levels.map((lvl, idx) => (
                    <div key={idx} className="bg-white p-10 rounded-[50px] border border-slate-100 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div>
                                <label className="text-[10px] font-black uppercase text-blue-500 mb-2 block tracking-widest">Documents Supports</label>
                                <div className="flex flex-wrap gap-3 p-5 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    {lvl.attachmentUrls?.map((u, i) => <img key={i} src={u} className="w-20 h-20 object-cover rounded-2xl border-2 border-white shadow-md" />)}
                                    <label className="w-20 h-20 bg-white flex items-center justify-center rounded-2xl border border-slate-200 cursor-pointer text-slate-300 hover:text-blue-500 transition-all text-2xl font-black">
                                        +
                                        <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx, 'doc')} />
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-orange-500 mb-2 block tracking-widest">Image Question</label>
                                <div className="h-40 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group">
                                    {lvl.questionImage ? <img src={lvl.questionImage} className="h-full w-full object-contain" /> : <span className="text-slate-300 font-black text-xs">AJOUTER IMAGE</span>}
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleUpload(e.target.files, idx, 'qimg')} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8">
                            <textarea className="w-full p-6 rounded-3xl h-24 border border-slate-200 font-bold text-slate-600 outline-none focus:border-orange-500 transition-colors" value={lvl.instruction} onChange={e=>{const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} placeholder="Écris la consigne..." />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="p-8 bg-white border-t">
            <button onClick={save} disabled={uploading} className="w-full p-6 bg-orange-500 text-white font-black text-2xl rounded-3xl shadow-xl hover:bg-orange-600 transition-all">
                {uploading ? "SYNC DRIVE & DISTRIBUTION..." : "💾 SAUVEGARDER ET DISTRIBUER"}
            </button>
        </div>
    </div>
  );
}