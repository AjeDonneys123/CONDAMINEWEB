import React, { useState, useEffect } from 'react';

export default function HomeworkStudio() {
  const [hws, setHws] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ _id: null, title: '', classroom: 'Toutes', levels: [] });

  const load = async () => {
    const data = await fetch('/api/homework-all').then(r => r.json());
    setHws(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (file, idx, type) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
    if (res.ok) {
        const n = [...formData.levels];
        if (type === 'doc') n[idx].attachmentUrls.push(res.imageUrl);
        else n[idx].questionImage = res.imageUrl;
        setFormData({ ...formData, levels: n });
    }
  };

  const handleSave = async () => {
    const method = formData._id ? 'PUT' : 'POST';
    const url = formData._id ? `/api/homework/${formData._id}` : '/api/homework';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    alert("Devoir enregistré !"); setIsEditing(false); load();
  };

  return (
    <div className="space-y-6">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData({ _id: null, title: '', classroom: 'Toutes', levels: [{ instruction: '', attachmentUrls: [], aiPrompt: '', questionImage: null }] }); setIsEditing(true); }} 
                  className="w-full bg-orange-500 text-white py-6 rounded-[30px] font-black text-xl shadow-xl border-b-8 border-orange-700 active:translate-y-1 active:border-b-0 transition-all uppercase tracking-widest">
            ➕ Créer Devoir Maison
          </button>
          <div className="grid gap-4">
            {hws.map(h => (
              <div key={h._id} className="bg-white p-6 rounded-3xl border flex justify-between items-center shadow-sm hover:border-orange-300 transition-all">
                <div><b className="text-lg text-slate-800">{h.title}</b><p className="text-xs text-slate-400 font-bold uppercase">{h.classroom}</p></div>
                <div className="flex gap-2">
                    <button onClick={() => { setFormData(h); setIsEditing(true); }} className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl font-bold">🖋️</button>
                    <button onClick={async () => { if(confirm("Suppr ?")) { await fetch(`/api/homework/${h._id}`, {method:'DELETE'}); load(); }}} className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl font-bold">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[40px] border-2 border-orange-100 p-8 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-2xl font-black text-orange-600 italic">Édition du Devoir</h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 font-bold">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Titre" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-orange-600" value={formData.classroom} onChange={e => setFormData({...formData, classroom: e.target.value})}>
                <option value="Toutes">Toutes les classes</option><option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
            </select>
          </div>
          <div className="space-y-6">
            {formData.levels.map((lvl, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-[30px] border border-slate-200">
                    <div className="flex justify-between mb-4"><h4 className="font-black text-slate-400 text-xs uppercase">Page {idx + 1}</h4><button onClick={()=>{const n=[...formData.levels]; n.splice(idx,1); setFormData({...formData, levels:n});}} className="text-red-400 text-xs font-bold uppercase hover:underline">Supprimer</button></div>
                    <div className="flex flex-wrap gap-2 p-4 bg-white rounded-2xl border-2 border-dashed border-slate-200 min-h-[80px] mb-4">
                        {lvl.attachmentUrls.map((url, uIdx) => (
                            <div key={uIdx} className="relative w-14 h-14 rounded-lg overflow-hidden border">
                                <img src={url} className="w-full h-full object-cover" />
                                <button onClick={()=>{const n=[...formData.levels]; n[idx].attachmentUrls.splice(uIdx,1); setFormData({...formData, levels:n});}} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 text-[8px]">✕</button>
                            </div>
                        ))}
                        <label className="w-14 h-14 flex items-center justify-center bg-slate-50 rounded-lg cursor-pointer hover:bg-blue-50 text-blue-400 font-bold text-xl">+ <input type="file" className="hidden" multiple onChange={e => Array.from(e.target.files).forEach(f => handleUpload(f, idx, 'doc'))} /></label>
                    </div>
                    <div className="grid grid-cols-3 gap-4 bg-white p-4 rounded-2xl border">
                        <div className="h-24 bg-slate-50 rounded-xl border flex items-center justify-center overflow-hidden relative">
                            {lvl.questionImage ? <img src={lvl.questionImage} className="max-h-full" /> : <span className="text-[10px] text-slate-300 font-bold uppercase">Image Question</span>}
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleUpload(e.target.files[0], idx, 'qimg')} />
                        </div>
                        <textarea className="col-span-2 p-3 rounded-xl bg-slate-50 border-none text-sm shadow-inner" placeholder="Consigne élève..." rows="2" value={lvl.instruction} onChange={e => { const n = [...formData.levels]; n[idx].instruction = e.target.value; setFormData({...formData, levels:n}); }} />
                    </div>
                </div>
            ))}
          </div>
          <button onClick={() => setFormData({...formData, levels: [...formData.levels, { instruction:'', attachmentUrls:[], aiPrompt:'', questionImage:null }]})} className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-bold border-2 border-dashed hover:bg-slate-200 transition-all uppercase text-xs tracking-widest">+ AJOUTER UNE PAGE</button>
          <button onClick={handleSave} className="w-full bg-green-500 text-white py-6 rounded-[30px] font-black text-2xl shadow-xl shadow-green-100 border-b-8 border-green-700 active:translate-y-1 active:border-b-0 transition-all uppercase tracking-tighter">💾 Sauvegarder en BDD</button>
        </div>
      )}
    </div>
  );
}