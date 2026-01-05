import React, { useState, useEffect } from 'react';
import HomeworkResults from './HomeworkResults';
import './HomeworkStudio.css';

export default function HomeworkStudio() {
  const [hws, setHws] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [viewingResults, setViewingResults] = useState(null);
  
  // Données
  const [formData, setFormData] = useState({ _id: null, title: '', classroom: 'Toutes', levels: [] });
  const [uploading, setUploading] = useState(false);

  // États Wizard IA
  const [showSmartWizard, setShowSmartWizard] = useState(false);
  const [qFile, setQFile] = useState(null);
  const [docFiles, setDocFiles] = useState([]);
  const [smartLoading, setSmartLoading] = useState(false);

  const load = async () => {
    const data = await fetch('/api/homework-all').then(r => r.json());
    setHws(data || []);
  };
  useEffect(() => { load(); }, []);

  // --- LOGIQUE WIZARD (Génération Auto) ---
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
              // On ajoute le champ aiCorrectionHint vide par défaut sur les niveaux générés
              const enhancedLevels = data.levels.map(l => ({ ...l, aiCorrectionHint: '' }));
              setFormData({ ...formData, title: "Nouveau Devoir (IA)", levels: enhancedLevels });
              setShowSmartWizard(false);
              setIsEditing(true);
          } else { alert("Erreur génération."); }
      } catch (e) { alert("Erreur: " + e.message); }
      setSmartLoading(false);
  };

  // --- LOGIQUE MANUELLE ---
  const handleUpload = async (files, idx, type) => {
    setUploading(true);
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
            newLevels[idx].instruction = ""; 
        }
      }
    }
    setFormData({ ...formData, levels: newLevels });
    setUploading(false);
  };

  const handleOCR = async (idx) => {
      const level = formData.levels[idx];
      if(!level.questionImage) return alert("Pas d'image !");
      setUploading(true);
      try {
          const res = await fetch('/api/extract-text', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ imageUrl: level.questionImage })
          }).then(r => r.json());
          
          if(res.text) {
              const newLevels = [...formData.levels];
              newLevels[idx].instruction = res.text;
              newLevels[idx].questionImage = null;
              setFormData({ ...formData, levels: newLevels });
          }
      } catch(e) { alert("Erreur OCR"); }
      setUploading(false);
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

  if (viewingResults) return <HomeworkResults homework={viewingResults} onBack={() => setViewingResults(null)} />;

  if (showSmartWizard) return (
      <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl p-8 rounded-[40px] shadow-2xl border-4 border-purple-500 animate-in zoom-in">
              <h2 className="text-3xl font-black text-purple-600 mb-6 text-center uppercase">✨ Générateur Magique</h2>
              <div className="space-y-6 mb-8">
                  <div className="p-6 bg-purple-50 rounded-2xl border-2 border-dashed border-purple-200 text-center relative hover:bg-white transition-colors">
                      <p className="font-bold text-purple-800 text-lg">1. Photo des Questions</p>
                      <input type="file" onChange={e => setQFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  </div>
                  <div className="p-6 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 text-center relative hover:bg-white transition-colors">
                      <p className="font-bold text-orange-800 text-lg">2. Photos des Documents</p>
                      <input type="file" multiple onChange={e => setDocFiles(Array.from(e.target.files))} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  </div>
              </div>
              <div className="flex gap-4">
                  <button onClick={() => setShowSmartWizard(false)} className="flex-1 py-4 font-bold text-slate-400 bg-slate-100 rounded-xl">ANNULER</button>
                  <button onClick={handleSmartGenerate} disabled={smartLoading} className="flex-[2] py-4 bg-purple-600 text-white rounded-xl font-black shadow-lg">
                      {smartLoading ? "Analyse..." : "GÉNÉRER 🚀"}
                  </button>
              </div>
          </div>
      </div>
  );

  return (
    <div className="studio-container">
      {!isEditing ? (
        <>
          <div className="flex gap-4 mb-8">
              <button onClick={() => { setFormData({ _id: null, title: '', classroom: 'Toutes', levels: [] }); setIsEditing(true); }} className="flex-1 py-8 bg-orange-500 text-white rounded-[30px] font-black text-2xl shadow-xl border-b-8 border-orange-700">✍️ MANUEL</button>
              <button onClick={() => setShowSmartWizard(true)} className="flex-1 py-8 bg-purple-600 text-white rounded-[30px] font-black text-2xl shadow-xl border-b-8 border-purple-800">✨ IA AUTO</button>
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
          <div className="hw-edit-modal animate-in zoom-in">
            <div className="hw-edit-header">
              <h3>{formData._id ? 'MODIFIER' : 'CRÉER'}</h3>
              <button onClick={() => setIsEditing(false)} className="hw-close-x">✕</button>
            </div>
            <div className="hw-edit-body custom-scrollbar">
                <div className="hw-config-grid">
                    <input className="hw-input-title" placeholder="Titre..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    <select className="hw-select-class" value={formData.classroom} onChange={e => setFormData({...formData, classroom: e.target.value})}>
                        <option value="Toutes">Toutes</option><option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
                    </select>
                </div>
                
                <div className="hw-pages-container">
                    {formData.levels.map((lvl, idx) => (
                        <div key={idx} className="hw-page-card">
                            <div className="hw-page-header">
                                <span>PAGE {idx+1}</span>
                                <button className="hw-del-page" onClick={()=>{const n=[...formData.levels]; n.splice(idx,1); setFormData({...formData, levels:n});}}>Supprimer</button>
                            </div>
                            
                            <p className="hw-label">DOCUMENTS</p>
                            <div className="hw-docs-preview">
                                {lvl.attachmentUrls && lvl.attachmentUrls.map((u, i) => <img key={i} src={u} className="hw-mini-img" />)}
                                <label className="hw-add-mini">+<input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx, 'doc')} /></label>
                            </div>
                            
                            <div className="hw-question-section">
                                <div className="hw-left-col">
                                    <p className="hw-label">IMAGE QUESTION</p>
                                    <div className="hw-q-img-upload">
                                        {lvl.questionImage ? <img src={lvl.questionImage} /> : <span>📷 Ajouter</span>}
                                        <input type="file" className="hw-hidden-file" onChange={e => handleUpload(e.target.files, idx, 'qimg')} />
                                    </div>
                                    {lvl.questionImage && <button onClick={() => handleOCR(idx)} className="btn-ocr-trigger">⚡ EXTRAIRE</button>}
                                </div>
                                <div className="hw-right-col">
                                    <p className="hw-label">CONSIGNE ÉLÈVE (TEXTE)</p>
                                    <textarea className="hw-q-text" placeholder="Écris la consigne..." value={lvl.instruction} onChange={e => {const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} />
                                    
                                    {/* NOUVEAU : CHAMP DE CORRECTION IA */}
                                    <div className="hw-ai-hint-box">
                                        <p className="hw-label-ai">🤖 INSTRUCTIONS POUR L'IA (SECRET)</p>
                                        <textarea 
                                            className="hw-ai-hint-text" 
                                            placeholder="Ex: Sois sévère sur la conjugaison. Accepte les réponses courtes..." 
                                            value={lvl.aiCorrectionHint || ''} 
                                            onChange={e => {
                                                const n=[...formData.levels]; 
                                                n[idx].aiCorrectionHint=e.target.value; 
                                                setFormData({...formData, levels:n});
                                            }} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => setFormData({...formData, levels: [...formData.levels, {instruction:'', attachmentUrls:[], questionImage:null, aiCorrectionHint:''}]})} className="hw-add-page-btn">+ AJOUTER UNE PAGE</button>
            </div>
            <div className="hw-edit-footer">
                <button onClick={save} disabled={uploading} className="hw-btn-save-final">{uploading ? "..." : "💾 SAUVEGARDER"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}