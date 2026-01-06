import React, { useState, useEffect } from 'react';
import './HomeworkStudio.css';

export default function HomeworkStudio({ initialData, chapters, onClose }) {
  const [players, setPlayers] = useState([]);
  const [stdSearch, setStdSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showSmartWizard, setShowSmartWizard] = useState(false);
  const [qFile, setQFile] = useState(null);
  const [docFiles, setDocFiles] = useState([]);
  const [smartLoading, setSmartLoading] = useState(false);
  
  const [formData, setFormData] = useState(initialData || { 
      title: '', targetGrade: 'Tous', classroom: '6D', targetPlayerIds: [], 
      chapterId: (chapters && chapters.length > 0) ? chapters[0]._id : 'none',
      levels: [{ instruction: '', attachmentUrls: [], questionImage: null, aiCorrectionHint: '' }] 
  });

  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then(data => setPlayers(data || []));
  }, []);

  const handleSmartGenerate = async () => {
    if (!qFile) return alert("Photo de la question requise");
    setSmartLoading(true);
    const fd = new FormData();
    fd.append('questionImg', qFile);
    docFiles.forEach(f => fd.append('docImgs', f));

    try {
        const res = await fetch('/api/smart-generate', { method: 'POST', body: fd }).then(r => r.json());
        if (res.levels) {
            setFormData({ ...formData, levels: res.levels });
            setShowSmartWizard(false);
        }
    } catch (e) { alert("Erreur IA"); }
    setSmartLoading(false);
  };

  const handleUpload = async (files, idx, type) => {
    setUploading(true);
    const n = JSON.parse(JSON.stringify(formData.levels));
    for (let file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file);
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
    <div className="fixed inset-0 z-[6000] bg-slate-50 flex flex-col animate-in slide-in-from-bottom-4">
        <div className="p-6 bg-orange-500 text-white flex justify-between items-center">
            <input className="text-2xl font-black bg-transparent outline-none w-full placeholder:text-orange-200" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="NOM DU DEVOIR" />
            <div className="flex gap-4">
                <button onClick={() => setShowSmartWizard(true)} className="bg-white/20 px-4 py-2 rounded-xl font-black text-xs uppercase">✨ SMART GENERATE</button>
                <button onClick={onClose} className="w-10 h-10 bg-black/10 rounded-full font-black">✕</button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="grid grid-cols-3 gap-6">
                    <div className="assign-card"><label>DOSSIER</label>
                        <select className="w-full font-bold" value={formData.chapterId} onChange={e=>setFormData({...formData, chapterId: e.target.value})}>
                            <option value="none">-- Aucun --</option>
                            {chapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>
                    <div className="assign-card"><label>CLASSE</label>
                        <select className="w-full font-bold" value={formData.classroom} onChange={e=>setFormData({...formData, classroom: e.target.value})}>
                            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                        </select>
                    </div>
                    <div className="assign-card relative"><label>CIBLER ÉLÈVES (OPTIONNEL)</label>
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
                            <span key={id} className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-[10px] font-bold">{players.find(x => x._id === id)?.firstName}</span>
                          ))}
                        </div>
                    </div>
                </div>

                {formData.levels.map((lvl, idx) => (
                    <div key={idx} className="bg-white p-10 rounded-[50px] border shadow-sm">
                        <h4 className="font-black text-slate-300 uppercase mb-6">Page {idx+1}</h4>
                        <div className="grid grid-cols-2 gap-10">
                            <div>
                                <label className="text-[10px] font-black uppercase text-blue-500">Documents</label>
                                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-3xl border-2 border-dashed">
                                    {lvl.attachmentUrls?.map((u, i) => <img key={i} src={u} className="w-16 h-16 object-cover rounded-xl" />)}
                                    <label className="w-16 h-16 bg-white flex items-center justify-center rounded-xl border cursor-pointer">+</label>
                                    <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx, 'doc')} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-orange-500">Photo Question</label>
                                <div className="h-32 bg-slate-50 rounded-3xl border-2 border-dashed flex items-center justify-center relative overflow-hidden">
                                    {lvl.questionImage ? <img src={lvl.questionImage} className="h-full w-full object-contain" /> : <span>PHOTO</span>}
                                    <input type="file" className="absolute inset-0 opacity-0" onChange={e => handleUpload(e.target.files, idx, 'qimg')} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 space-y-4">
                            <textarea className="w-full p-6 rounded-3xl h-24 border" value={lvl.instruction} onChange={e=>{const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} placeholder="Consigne manuelle..." />
                            <textarea className="w-full p-6 rounded-3xl h-24 border bg-purple-50" value={lvl.aiCorrectionHint} onChange={e=>{const n=[...formData.levels]; n[idx].aiCorrectionHint=e.target.value; setFormData({...formData, levels:n});}} placeholder="Indices IA (ex: Réponse attendue...)" />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="p-8 bg-white border-t">
            <button onClick={save} disabled={uploading} className="w-full p-6 bg-orange-500 text-white font-black text-2xl rounded-3xl shadow-xl">SAUVEGARDER</button>
        </div>

        {showSmartWizard && (
          <div className="fixed inset-0 bg-slate-900/95 z-[7000] flex items-center justify-center p-6">
              <div className="bg-white p-12 rounded-[60px] max-w-2xl w-full border-[10px] border-purple-500">
                  <h2 className="text-3xl font-black text-purple-600 mb-8 text-center uppercase">Smart Generate ✨</h2>
                  <div className="space-y-6 mb-10">
                      <div className="p-10 bg-purple-50 rounded-[40px] border-4 border-dashed relative">
                          <p className="font-black text-purple-800 text-center">{qFile ? "✅ Photo Question OK" : "1. PHOTO DE LA QUESTION"}</p>
                          <input type="file" className="absolute inset-0 opacity-0" onChange={e => setQFile(e.target.files[0])} />
                      </div>
                      <div className="p-10 bg-orange-50 rounded-[40px] border-4 border-dashed relative">
                          <p className="font-black text-orange-800 text-center">{docFiles.length > 0 ? `✅ ${docFiles.length} Docs OK` : "2. PHOTOS DES DOCUMENTS"}</p>
                          <input type="file" multiple className="absolute inset-0 opacity-0" onChange={e => setDocFiles(Array.from(e.target.files))} />
                      </div>
                  </div>
                  <button onClick={handleSmartGenerate} disabled={smartLoading} className="w-full p-6 bg-purple-600 text-white font-black text-xl rounded-3xl">{smartLoading ? 'ANALYSE...' : 'GÉNÉRER LE DEVOIR 🚀'}</button>
                  <button onClick={()=>setShowSmartWizard(false)} className="w-full mt-4 text-slate-400 font-bold">Annuler</button>
              </div>
          </div>
        )}
    </div>
  );
}