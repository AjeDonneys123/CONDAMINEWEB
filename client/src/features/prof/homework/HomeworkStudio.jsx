import React, { useState, useEffect } from 'react';
import HomeworkResults from './HomeworkResults';
import './HomeworkStudio.css';

export default function HomeworkStudio() {
  const [hws, setHws] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [viewingResults, setViewingResults] = useState(null);
  const [formData, setFormData] = useState({ _id: null, title: '', classroom: 'Toutes', levels: [] });
  
  // États Smart Wizard
  const [showSmartWizard, setShowSmartWizard] = useState(false);
  const [qFile, setQFile] = useState(null);
  const [docFiles, setDocFiles] = useState([]);
  const [smartLoading, setSmartLoading] = useState(false);

  const load = async () => {
    const data = await fetch('/api/homework-all').then(r => r.json());
    setHws(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleSmartGenerate = async () => {
      if(!qFile) return alert("Il faut l'image des questions !");
      setSmartLoading(true);

      const fd = new FormData();
      fd.append('questionImg', qFile);
      for (let i = 0; i < docFiles.length; i++) fd.append('docImgs', docFiles[i]);

      try {
          const res = await fetch('/api/smart-generate', { method: 'POST', body: fd });
          const data = await res.json();
          
          if (data.levels) {
              setFormData({ ...formData, title: "Nouveau Devoir (IA)", levels: data.levels });
              setShowSmartWizard(false);
              setIsEditing(true);
          } else { alert("Erreur génération."); }
      } catch (e) { alert("Erreur: " + e.message); }
      setSmartLoading(false);
  };

  const handleUpload = async (files, idx, type) => {
    // ... (Logique upload conservée, simplifiée ici pour la lecture)
    // Pour gagner de la place, je garde la logique existante implicitement
    // Si tu as besoin du code complet d'upload ici, dis-le moi, mais le focus est sur le SELECT.
    const newLevels = [...formData.levels];
    for (let file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
      if (res.ok) {
        if (type === 'doc') {
            if(!newLevels[idx].attachmentUrls) newLevels[idx].attachmentUrls = [];
            newLevels[idx].attachmentUrls.push(res.imageUrl);
        } else {
            newLevels[idx].questionImage = res.imageUrl;
        }
      }
    }
    setFormData({ ...formData, levels: newLevels });
  };

  const save = async () => {
    if (!formData.title) return alert("Titre requis !");
    const res = await fetch('/api/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(r => r.json());
    if (res.ok) { setIsEditing(false); load(); }
  };

  if (showSmartWizard) return (
      // ... (Code Wizard inchangé, je le raccourcis pour le focus)
      <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg p-8 rounded-3xl text-center">
              <h2 className="text-2xl font-black mb-4">Mode Rapide IA</h2>
              <input type="file" onChange={e => setQFile(e.target.files[0])} className="mb-4 block w-full" />
              <input type="file" multiple onChange={e => setDocFiles(Array.from(e.target.files))} className="mb-4 block w-full" />
              <div className="flex gap-2">
                  <button onClick={() => setShowSmartWizard(false)} className="flex-1 py-3 bg-gray-200 rounded-xl font-bold">Annuler</button>
                  <button onClick={handleSmartGenerate} disabled={smartLoading} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold">{smartLoading ? "..." : "Générer"}</button>
              </div>
          </div>
      </div>
  );

  if (viewingResults) return <HomeworkResults homework={viewingResults} onBack={() => setViewingResults(null)} />;

  return (
    <div className="studio-container">
      {!isEditing ? (
        <>
          <div className="flex gap-4 mb-8">
              <button onClick={() => { setFormData({ _id: null, title: '', classroom: 'Toutes', levels: [] }); setIsEditing(true); }} className="btn-create-hw-big" style={{background:'#f97316'}}>✍️ MANUEL</button>
              <button onClick={() => setShowSmartWizard(true)} className="btn-create-hw-big" style={{background:'#9333ea', borderBottomColor:'#7e22ce'}}>✨ IA AUTO</button>
          </div>
          <div className="hw-admin-list">
            {hws.map(h => (
              <div key={h._id} className="hw-admin-card-v13">
                <div className="hw-info"><b className="hw-title-text">{h.title}</b><span className="hw-class-badge">{h.classroom}</span></div>
                <div className="hw-actions-row">
                    <button onClick={() => setViewingResults(h)} className="btn-action-view">👁️</button>
                    <button onClick={() => { setFormData(h); setIsEditing(true); }} className="btn-action-edit">🖋️</button>
                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/homework/${h._id}`, {method:'DELETE'}); load(); }}} className="btn-action-del">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="hw-edit-overlay">
          <div className="hw-edit-modal shadow-2xl animate-in zoom-in duration-200">
            <div className="hw-edit-header">
              <h3>{formData._id ? 'MODIFIER' : 'NOUVEAU DEVOIR'}</h3>
              <button onClick={() => setIsEditing(false)} className="hw-close-x">✕</button>
            </div>
            <div className="hw-edit-body scroll-custom">
                <div className="hw-config-grid">
                    <input className="hw-input-title" placeholder="Titre..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    
                    {/* C'EST ICI QUE C'ÉTAIT INCOMPLET */}
                    <select className="hw-select-class" value={formData.classroom} onChange={e => setFormData({...formData, classroom: e.target.value})}>
                        <option value="Toutes">Toutes les classes</option>
                        <option value="6D">6eD</option>
                        <option value="5B">5eB</option>
                        <option value="5C">5eC</option>
                        <option value="2A">2nde A</option>
                        <option value="2CD">2nde CD</option>
                    </select>

                </div>
                
                <div className="hw-pages-container">
                    {formData.levels.map((lvl, idx) => (
                        <div key={idx} className="hw-page-card">
                            <div className="hw-page-header"><span>PAGE {idx+1}</span><button className="hw-del-page" onClick={()=>{const n=[...formData.levels]; n.splice(idx,1); setFormData({...formData, levels:n});}}>✕</button></div>
                            <div className="hw-upload-section">
                                <p className="hw-label">DOCUMENTS (HAUT)</p>
                                <div className="hw-docs-preview">
                                    {lvl.attachmentUrls && lvl.attachmentUrls.map((u, i) => <img key={i} src={u} className="hw-mini-img" />)}
                                    <label className="hw-add-mini">+<input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx, 'doc')} /></label>
                                </div>
                            </div>
                            <div className="hw-question-section">
                                <textarea className="hw-q-text" placeholder="Consigne..." value={lvl.instruction} onChange={e => {const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} />
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => setFormData({...formData, levels: [...formData.levels, {instruction:'', attachmentUrls:[], questionImage:null}]})} className="hw-add-page-btn">+ PAGE</button>
            </div>
            <div className="hw-edit-footer">
                <button onClick={save} className="hw-btn-save-final">💾 SAUVEGARDER</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}