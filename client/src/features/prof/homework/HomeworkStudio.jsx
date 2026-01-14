import React, { useState, useEffect } from 'react';
import './HomeworkStudio.css';

export default function HomeworkStudio({ initialData, chapters, onClose }) {
  const [players, setPlayers] = useState([]);
  const [stdSearch, setStdSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState(initialData || { 
      title: '', targetGrade: 'Tous', classroom: '6D', targetPlayerIds: [], 
      chapterId: (chapters && chapters.length > 0) ? chapters[0]._id : 'none',
      levels: [{ instruction: '', attachmentUrls: [], questionImage: null, aiCorrectionHint: '' }] 
  });

  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then(data => setPlayers(data || []));
  }, []);

  const handleUpload = async (files, idx, type) => {
    setUploading(true);
    const n = JSON.parse(JSON.stringify(formData.levels));
    for (let file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file);
      // Utilise le service d'upload générique
      const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
      if (res.ok) {
        if (type === 'doc') n[idx].attachmentUrls.push(res.imageUrl);
        else n[idx].questionImage = res.imageUrl;
      }
    }
    setFormData({ ...formData, levels: n });
    setUploading(false);
  };

  const save = async () => {
    if (!formData.title) return alert("Titre requis");
    await fetch('/api/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, chapterId: formData.chapterId === 'none' ? null : formData.chapterId })
    });
    onClose();
  };

  const filteredPlayers = players.filter(p => (p.firstName + " " + p.lastName).toLowerCase().includes(stdSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[6000] bg-slate-50 flex flex-col animate-in zoom-in">
        <div className="p-6 bg-orange-500 text-white flex justify-between items-center shadow-lg">
            <input className="text-2xl font-black bg-transparent outline-none w-full placeholder:text-orange-200" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="TITRE DU DEVOIR" />
            <button onClick={onClose} className="w-10 h-10 bg-black/10 rounded-full font-black">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="grid grid-cols-3 gap-6">
                    <div className="assign-card"><label>DOSSIER</label>
                        <select className="w-full font-bold outline-none" value={formData.chapterId} onChange={e=>setFormData({...formData, chapterId: e.target.value})}>
                            <option value="none">-- Aucun dossier --</option>
                            {chapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>
                    <div className="assign-card"><label>CLASSE</label>
                        <select className="w-full font-bold outline-none" value={formData.classroom} onChange={e=>setFormData({...formData, classroom: e.target.value})}>
                            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
                        </select>
                    </div>
                    <div className="assign-card relative"><label>CIBLER DES ÉLÈVES</label>
                        <input className="w-full outline-none" placeholder="Chercher..." value={stdSearch} onChange={e=>setStdSearch(e.target.value)} />
                        {stdSearch && (
                            <div className="absolute top-full left-0 right-0 bg-white shadow-xl z-50 rounded-xl max-h-40 overflow-auto border">
                                {filteredPlayers.map(p => (
                                    <div key={p._id} onClick={()=>{ setFormData({...formData, targetPlayerIds:[...formData.targetPlayerIds, p._id]}); setStdSearch(''); }} className="p-3 hover:bg-orange-50 cursor-pointer font-bold">{p.firstName} {p.lastName}</div>
                                ))}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {formData.targetPlayerIds.map(id => (
                            <span key={id} className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-[9px] font-bold">{players.find(x => x._id === id)?.firstName} <button onClick={()=>setFormData({...formData, targetPlayerIds: formData.targetPlayerIds.filter(x=>x!==id)})}>✕</button></span>
                          ))}
                        </div>
                    </div>
                </div>

                {formData.levels.map((lvl, idx) => (
                    <div key={idx} className="bg-white p-10 rounded-[50px] border shadow-sm">
                        <div className="grid grid-cols-2 gap-10">
                            <div>
                                <label className="text-[10px] font-black uppercase text-blue-500 mb-2">Documents</label>
                                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-3xl border-2 border-dashed">
                                    {lvl.attachmentUrls?.map((u, i) => <img key={i} src={u} className="w-16 h-16 object-cover rounded-xl" />)}
                                    <label className="w-16 h-16 bg-white flex items-center justify-center rounded-xl border cursor-pointer">+</label>
                                    <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx, 'doc')} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-orange-500 mb-2">Image Question</label>
                                <div className="h-32 bg-slate-50 rounded-3xl border-2 border-dashed flex items-center justify-center relative overflow-hidden">
                                    {lvl.questionImage ? <img src={lvl.questionImage} className="h-full w-full object-contain" /> : <span>PHOTO</span>}
                                    <input type="file" className="absolute inset-0 opacity-0" onChange={e => handleUpload(e.target.files, idx, 'qimg')} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 space-y-4">
                            <textarea className="w-full p-6 rounded-3xl h-24 border font-bold" value={lvl.instruction} onChange={e=>{const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} placeholder="Consigne..." />
                            <textarea className="w-full p-6 rounded-3xl h-24 border bg-purple-50 text-purple-600 font-bold" value={lvl.aiCorrectionHint} onChange={e=>{const n=[...formData.levels]; n[idx].aiCorrectionHint=e.target.value; setFormData({...formData, levels:n});}} placeholder="Indices IA..." />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="p-8 bg-white border-t">
            <button onClick={save} disabled={uploading} className="w-full p-6 bg-orange-500 text-white font-black text-2xl rounded-3xl shadow-xl">SAUVEGARDER LE DEVOIR</button>
        </div>
    </div>
  );
}