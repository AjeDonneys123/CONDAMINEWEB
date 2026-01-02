import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function HomeworksTab() {
  const [homeworks, setHomeworks] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ _id: null, title: '', classroom: 'Toutes', levels: [] });

  const load = async () => {
    const data = await api.get('/homework-all');
    setHomeworks(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (file, lvlIdx, type) => {
    const fd = new FormData(); fd.append('file', file);
    try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
        if (res.ok) {
            const newLevels = [...formData.levels];
            if (type === 'doc') newLevels[lvlIdx].attachmentUrls.push(res.imageUrl);
            else newLevels[lvlIdx].questionImage = res.imageUrl;
            setFormData({ ...formData, levels: newLevels });
        }
    } catch(e) { alert("Erreur upload"); }
  };

  const handleSave = async () => {
    if (!formData.title || formData.levels.length === 0) {
        return alert("Il faut un titre et au moins une page de question !");
    }

    try {
        const url = formData._id ? `/homework/${formData._id}` : '/homework';
        const method = formData._id ? 'PUT' : 'POST';
        
        // On utilise notre service api.js qui gère les fetch
        const res = await fetch(`/api${url}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        }).then(r => r.json());

        if (res.ok) {
            alert("Devoir bien enregistré en BDD !");
            setIsCreating(false);
            load();
        } else {
            alert("Erreur serveur lors de la sauvegarde.");
        }
    } catch (e) {
        alert("Impossible de contacter le serveur.");
    }
  };

  return (
    <div className="space-y-6">
      {!isCreating ? (
        <>
          <button onClick={() => { setFormData({ _id: null, title: '', classroom: 'Toutes', levels: [{ instruction: '', attachmentUrls: [], aiPrompt: '', questionImage: null }] }); setIsCreating(true); }} 
                  className="w-full bg-orange-500 text-white py-6 rounded-[30px] font-black text-xl shadow-xl border-b-8 border-orange-700 active:translate-y-1 active:border-b-0 transition-all">
            ➕ CRÉER UN NOUVEAU DEVOIR
          </button>
          
          <div className="grid gap-4">
            {homeworks.map(hw => (
              <div key={hw._id} className="bg-white p-6 rounded-3xl border flex justify-between items-center shadow-sm group hover:border-orange-300 transition-all">
                <div>
                    <b className="text-lg text-slate-800">{hw.title}</b>
                    <p className="text-slate-400 text-sm font-bold uppercase">{hw.classroom} • {hw.levels.length} Page(s)</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setFormData(hw); setIsEditing(true); }} className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center font-bold">🖋️</button>
                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/homework/${hw._id}`, {method:'DELETE'}); load(); }}} className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center font-bold">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[40px] border-2 border-orange-100 p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-2xl font-black text-orange-600 italic">{formData._id ? 'Modifier Devoir' : 'Nouveau Devoir'}</h3>
            <button onClick={() => setIsCreating(false)} className="bg-slate-100 px-4 py-2 rounded-xl font-bold text-slate-400">ANNULER</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold shadow-inner" placeholder="Titre du devoir" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-orange-600 cursor-pointer shadow-inner" value={formData.classroom} onChange={e => setFormData({...formData, classroom: e.target.value})}>
                <option value="Toutes">Toutes les classes</option>
                <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                <option value="2A">2de A</option><option value="2CD">2de CD</option>
            </select>
          </div>

          {/* LISTE DES PAGES */}
          <div className="space-y-6">
            {formData.levels.map((lvl, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-[30px] border border-slate-200 relative">
                    <button onClick={() => { const n = [...formData.levels]; n.splice(idx,1); setFormData({...formData, levels:n}); }} className="absolute top-4 right-4 text-red-400 font-bold text-xs hover:text-red-600">SUPPRIMER PAGE</button>
                    <h4 className="font-black text-slate-300 mb-4 uppercase tracking-tighter">Page {idx + 1}</h4>
                    
                    {/* DOCS HAUT */}
                    <div className="mb-4">
                        <p className="text-xs font-black text-blue-500 mb-2 ml-2">LIGNE 1 : DOCUMENTS (HAUT)</p>
                        <div className="flex flex-wrap gap-2 p-4 bg-white rounded-2xl border-2 border-dashed border-slate-200 min-h-[80px]">
                            {lvl.attachmentUrls.map((url, uIdx) => (
                                <div key={uIdx} className="relative w-14 h-14 rounded-lg overflow-hidden border shadow-sm">
                                    <img src={url} className="w-full h-full object-cover" />
                                    <button onClick={() => { const n = [...formData.levels]; n[idx].attachmentUrls.splice(uIdx,1); setFormData({...formData, levels:n}); }} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 text-[8px]">✕</button>
                                </div>
                            ))}
                            <label className="w-14 h-14 flex items-center justify-center bg-slate-50 rounded-lg cursor-pointer hover:bg-blue-50 border border-slate-100">
                                <span className="text-blue-400 font-bold text-xl">+</span>
                                <input type="file" className="hidden" multiple onChange={e => { Array.from(e.target.files).forEach(f => handleUpload(f, idx, 'doc')) }} />
                            </label>
                        </div>
                    </div>

                    {/* QUESTION BAS */}
                    <div className="grid grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="col-span-1">
                            <p className="text-[10px] font-black text-orange-400 mb-1 text-center">IMAGE QUESTION</p>
                            <div className="h-24 bg-slate-50 rounded-xl border border-dashed flex items-center justify-center overflow-hidden relative">
                                {lvl.questionImage ? (
                                    <img src={lvl.questionImage} className="max-h-full" />
                                ) : <span className="text-[10px] text-slate-300 italic">Aucune</span>}
                                <label className="absolute inset-0 cursor-pointer"><input type="file" className="hidden" onChange={e => handleUpload(e.target.files[0], idx, 'qimg')} /></label>
                            </div>
                        </div>
                        <div className="col-span-2 space-y-2">
                             <textarea className="w-full p-3 rounded-xl bg-slate-50 border-none text-sm font-medium shadow-inner" placeholder="Consigne pour l'élève..." rows="2" value={lvl.instruction} onChange={e => { const n = [...formData.levels]; n[idx].instruction = e.target.value; setFormData({...formData, levels:n}); }} />
                             <textarea className="w-full p-3 rounded-xl bg-blue-50/50 border-none text-xs italic shadow-inner" placeholder="Instructions IA..." rows="1" value={lvl.aiPrompt} onChange={e => { const n = [...formData.levels]; n[idx].aiPrompt = e.target.value; setFormData({...formData, levels:n}); }} />
                        </div>
                    </div>
                </div>
            ))}
          </div>

          <button onClick={() => setFormData({...formData, levels: [...formData.levels, { instruction:'', attachmentUrls:[], aiPrompt:'', questionImage:null }]})} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold border-2 border-dashed hover:bg-slate-200 transition-all">+ AJOUTER UNE PAGE</button>

          <button onClick={handleSave} className="w-full bg-green-500 text-white py-6 rounded-[30px] font-black text-2xl shadow-xl shadow-green-100 border-b-8 border-green-700 active:translate-y-1 active:border-b-0 transition-all">
            💾 ENREGISTRER LE DEVOIR
          </button>
        </div>
      )}
    </div>
  );
}