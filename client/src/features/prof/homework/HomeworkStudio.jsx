import React, { useState, useEffect } from 'react';
import './HomeworkStudio.css';

export default function HomeworkStudio({ initialData, chapters, globalClass, onClose }) {
  const [players, setPlayers] = useState([]);
  const [stdSearch, setStdSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ active: false, path: '', message: '' });
  
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
    if (!formData._id) {
        alert("⚠️ Cliquez d'abord sur 'INITIALISER' en bas pour créer l'espace Drive.");
        return;
    }
    
    setUploading(true);
    const newLevels = JSON.parse(JSON.stringify(formData.levels));
    
    for (let file of Array.from(files)) {
      const fd = new FormData(); 
      fd.append('file', file);
      fd.append('homeworkId', formData._id);
      fd.append('type', type);
      
      try {
        const res = await fetch('/api/homework/upload-to-drive', { method: 'POST', body: fd }).then(r => r.json());
        if (res.ok) {
          if (type === 'doc') newLevels[idx].attachmentUrls.push(res.imageUrl);
          else newLevels[idx].questionImage = res.imageUrl;
        }
      } catch (e) { console.error(e); }
    }
    setFormData({ ...formData, levels: newLevels });
    setUploading(false);
  };

  const save = async () => {
    if (!formData.title) return alert("Le titre est requis.");
    setUploading(true);
    try {
        const res = await fetch('/api/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, classroom: globalClass })
        });
        const data = await res.json();
        if (res.ok) {
            setFormData(data);
            // US #13 / US #4 : Affichage du succès et du chemin complet
            setSaveStatus({ active: true, path: data.drivePath, message: data.message });
            
            // Fermeture automatique après 5 secondes
            setTimeout(() => {
                onClose();
            }, 5000);
        }
    } catch (e) { alert("Erreur sauvegarde."); }
    setUploading(false);
  };

  const filteredPlayers = players.filter(p => p.classroom === globalClass && (p.firstName + " " + p.lastName).toLowerCase().includes(stdSearch.toLowerCase()));

  return (
    <div className="homework-studio-overlay animate-in slide-in-from-bottom-4">
        {/* BANDEAU DE SUCCÈS (US #4) */}
        {saveStatus.active && (
            <div className="fixed inset-0 z-[7000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                <div className="bg-white rounded-[40px] p-10 max-w-2xl w-full text-center shadow-2xl border-4 border-emerald-500 animate-in zoom-in">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✓</div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase mb-2">{saveStatus.message}</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase mb-6">Le studio se fermera dans 5 secondes...</p>
                    
                    <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 text-left">
                        <span className="text-[10px] font-black text-emerald-500 uppercase block mb-2">Chemin Google Drive :</span>
                        <code className="text-xs font-mono font-bold text-slate-600 break-all">{saveStatus.path}</code>
                    </div>
                </div>
            </div>
        )}

        <div className="p-6 bg-orange-500 text-white flex justify-between items-center shadow-lg pt-12">
            <div className="flex flex-col">
                <input className="text-2xl font-black bg-transparent outline-none w-full placeholder:text-orange-200 uppercase" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="TITRE DU DEVOIR" />
                <span className="text-[10px] font-black opacity-80 uppercase tracking-widest">
                   UNITÉ DRIVE : {globalClass}
                </span>
            </div>
            <button onClick={onClose} className="w-10 h-10 bg-black/10 rounded-full font-black hover:bg-black/20 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="assign-card"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Dossier de cours</label>
                        <select className="w-full font-bold outline-none bg-white p-3 rounded-xl border border-slate-200" value={formData.chapterId} onChange={e=>setFormData({...formData, chapterId: e.target.value})}>
                            <option value="none">-- Aucun dossier --</option>
                            {chapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>
                    <div className="assign-card relative"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Cibler des élèves (Optionnel)</label>
                        <input className="w-full outline-none bg-white p-3 rounded-xl border border-slate-200 font-bold" placeholder="Chercher un nom..." value={stdSearch} onChange={e=>setStdSearch(e.target.value)} />
                        <div className="flex flex-wrap gap-1 mt-2">
                          {formData.targetPlayerIds.map(id => (
                            <span key={id} className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1">{players.find(x => x._id === id)?.firstName} <button onClick={()=>setFormData({...formData, targetPlayerIds: formData.targetPlayerIds.filter(x=>x!==id)})}>✕</button></span>
                          ))}
                        </div>
                    </div>
                </div>

                {formData.levels.map((lvl, idx) => (
                    <div key={idx} className="bg-white p-10 rounded-[50px] border border-slate-100 shadow-sm relative">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div>
                                <label className="text-[10px] font-black uppercase text-blue-500 mb-2 block tracking-widest">Documents Supports (Tableau/Livre)</label>
                                <div className="flex flex-wrap gap-3 p-5 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    {lvl.attachmentUrls?.map((u, i) => <img key={i} src={u} className="w-20 h-20 object-cover rounded-2xl border-2 border-white shadow-sm" />)}
                                    <label className="w-20 h-20 bg-white flex items-center justify-center rounded-2xl border border-slate-200 cursor-pointer text-slate-300 hover:text-blue-500 transition-all text-2xl font-black">
                                        +
                                        <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx, 'doc')} />
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-orange-500 mb-2 block tracking-widest">Image Question (Enoncé précis)</label>
                                <div className="h-40 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden">
                                    {lvl.questionImage ? <img src={lvl.questionImage} className="h-full w-full object-contain" /> : <span className="text-slate-300 font-black text-xs uppercase">Photo Question</span>}
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleUpload(e.target.files, idx, 'qimg')} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8">
                            <textarea className="w-full p-6 rounded-3xl h-24 border border-slate-200 font-bold text-slate-600 outline-none focus:border-orange-500 transition-colors" value={lvl.instruction} onChange={e=>{const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} placeholder="Saisissez la consigne ici..." />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="p-8 bg-white border-t">
            <button onClick={save} disabled={uploading} className="w-full p-6 bg-orange-500 text-white font-black text-2xl rounded-3xl shadow-xl hover:bg-orange-600 transition-all uppercase">
                {!formData._id ? "🚀 INITIALISER LE DEVOIR & LE DRIVE" : (uploading ? "SYNCHRONISATION..." : "💾 SAUVEGARDER LES MODIFICATIONS")}
            </button>
        </div>
    </div>
  );
}