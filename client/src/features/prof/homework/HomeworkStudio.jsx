import React, { useState, useEffect } from 'react';

export default function HomeworkStudio({ initialData, chapters, onClose }) {
  const [formData, setFormData] = useState(initialData || { 
      title: '', targetGrade: 'Tous', classroom: '6D', targetPlayerIds: [], 
      chapterId: 'none', levels: [{ instruction: '', attachmentUrls: [], aiCorrectionHint: '' }] 
  });
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files, idx) => {
    setUploading(true);
    const n = JSON.parse(JSON.stringify(formData.levels)); // Deep copy pour forcer React
    for (let file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
      if (res.ok) {
        if (!n[idx].attachmentUrls) n[idx].attachmentUrls = [];
        n[idx].attachmentUrls.push(res.imageUrl);
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

  return (
    <div className="fixed inset-0 z-[6000] bg-slate-50 flex flex-col overflow-hidden">
        <div className="p-6 bg-orange-500 text-white flex justify-between items-center shadow-lg">
            <input className="text-2xl font-black bg-transparent outline-none w-full" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="TITRE DU DEVOIR" />
            <button onClick={onClose} className="text-xl font-bold px-4">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border">
                        <label className="text-[10px] font-black text-slate-400 block mb-2">DOSSIER</label>
                        <select className="w-full font-bold outline-none" value={formData.chapterId} onChange={e=>setFormData({...formData, chapterId: e.target.value})}>
                            <option value="none">-- Aucun --</option>
                            {chapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border">
                        <label className="text-[10px] font-black text-slate-400 block mb-2">CLASSE</label>
                        <select className="w-full font-bold outline-none" value={formData.classroom} onChange={e=>setFormData({...formData, classroom: e.target.value})}>
                            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                        </select>
                    </div>
                </div>

                {formData.levels.map((lvl, idx) => (
                    <div key={idx} className="bg-white p-8 rounded-[40px] border shadow-sm">
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <p className="font-black text-xs text-blue-500 mb-4 uppercase tracking-widest">Documents (+)</p>
                                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                    {lvl.attachmentUrls?.map((u, i) => <img key={i} src={u} className="w-16 h-16 object-cover rounded-xl shadow-sm" />)}
                                    <label className="w-16 h-16 bg-white flex items-center justify-center text-3xl text-slate-300 cursor-pointer border-2 border-slate-100 rounded-xl">+</label>
                                    <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx)} />
                                </div>
                            </div>
                            <div>
                                <p className="font-black text-xs text-slate-400 mb-4 uppercase tracking-widest">Consigne élève</p>
                                <textarea className="w-full p-4 h-32 bg-slate-50 border-none rounded-2xl shadow-inner" value={lvl.instruction} onChange={e=>{const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} />
                            </div>
                        </div>
                    </div>
                ))}
                <button onClick={()=>setFormData({...formData, levels:[...formData.levels, {instruction:'', attachmentUrls:[]}]})} className="w-full p-6 border-4 border-dashed rounded-[35px] text-slate-300 font-black">+ AJOUTER PAGE</button>
            </div>
        </div>
        <div className="p-6 bg-white border-t"><button onClick={save} disabled={uploading} className="w-full p-6 bg-orange-500 text-white font-black text-xl rounded-3xl shadow-xl">{uploading ? 'UPLOAD...' : '💾 ENREGISTRER LE DEVOIR'}</button></div>
    </div>
  );
}