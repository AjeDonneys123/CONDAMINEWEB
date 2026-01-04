import React, { useState, useEffect } from 'react';
import HomeworkResults from './HomeworkResults';
import './HomeworkStudio.css';

export default function HomeworkStudio() {
  const [hws, setHws] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [viewingResults, setViewingResults] = useState(null);
  const [formData, setFormData] = useState({ _id: null, title: '', classroom: 'Toutes', levels: [] });
  
  // Nouveaux états pour le Smart Wizard
  const [showSmartWizard, setShowSmartWizard] = useState(false);
  const [qFile, setQFile] = useState(null);
  const [docFiles, setDocFiles] = useState([]);
  const [smartLoading, setSmartLoading] = useState(false);

  const load = async () => {
    const data = await fetch('/api/homework-all').then(r => r.json());
    setHws(data || []);
  };
  useEffect(() => { load(); }, []);

  // --- SMART GENERATION ---
  const handleSmartGenerate = async () => {
      if(!qFile) return alert("Il faut l'image des questions !");
      setSmartLoading(true);

      const fd = new FormData();
      fd.append('questionImg', qFile);
      // Ajout de tous les docs
      for (let i = 0; i < docFiles.length; i++) {
          fd.append('docImgs', docFiles[i]);
      }

      try {
          const res = await fetch('/api/smart-generate', { method: 'POST', body: fd });
          const data = await res.json();
          
          if (data.levels) {
              setFormData({ 
                  ...formData, 
                  title: "Nouveau Devoir (Généré)", 
                  levels: data.levels 
              });
              setShowSmartWizard(false);
              setIsEditing(true); // Ouvre l'éditeur classique avec les données pré-remplies
          } else {
              alert("Erreur lors de la génération.");
          }
      } catch (e) { alert("Erreur technique : " + e.message); }
      setSmartLoading(false);
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

  // --- RENDU SMART WIZARD ---
  if (showSmartWizard) return (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[40px] p-8 border-4 border-purple-500 shadow-2xl animate-in zoom-in">
              <h2 className="text-3xl font-black text-purple-600 mb-2 uppercase text-center">✨ Création Magique</h2>
              <p className="text-center text-slate-500 mb-8 font-medium">Laisse l'IA assembler le devoir pour toi.</p>

              <div className="space-y-6">
                  {/* INPUT 1 : QUESTIONS */}
                  <div className="p-6 bg-purple-50 rounded-3xl border-2 border-dashed border-purple-200 text-center relative group hover:bg-white transition-all">
                      <span className="text-4xl block mb-2">📜</span>
                      <p className="font-bold text-purple-800">1. Photo des Questions</p>
                      <p className="text-xs text-purple-400 font-bold uppercase">{qFile ? "✅ " + qFile.name : "Glisse ou clique ici"}</p>
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setQFile(e.target.files[0])} accept="image/*" />
                  </div>

                  {/* INPUT 2 : DOCS */}
                  <div className="p-6 bg-orange-50 rounded-3xl border-2 border-dashed border-orange-200 text-center relative group hover:bg-white transition-all">
                      <span className="text-4xl block mb-2">📸</span>
                      <p className="font-bold text-orange-800">2. Photos des Documents (Vrac)</p>
                      <p className="text-xs text-orange-400 font-bold uppercase">{docFiles.length > 0 ? `✅ ${docFiles.length} fichiers sélectionnés` : "Sélectionne tout tes docs"}</p>
                      <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setDocFiles(Array.from(e.target.files))} accept="image/*" />
                  </div>
              </div>

              <div className="mt-8 flex gap-4">
                  <button onClick={() => setShowSmartWizard(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">ANNULER</button>
                  <button 
                      onClick={handleSmartGenerate} 
                      disabled={smartLoading} 
                      className="flex-[2] py-4 bg-purple-600 text-white rounded-2xl font-black shadow-xl shadow-purple-200 hover:scale-105 transition-all disabled:opacity-50"
                  >
                      {smartLoading ? "🧠 ANALYSE & ASSEMBLAGE..." : "GÉNÉRER L'EXAMEN 🚀"}
                  </button>
              </div>
          </div>
      </div>
  );

  // --- RENDU CLASSIQUE ---
  if (viewingResults) return <HomeworkResults homework={viewingResults} onBack={() => setViewingResults(null)} />;

  return (
    <div className="studio-container">
      {!isEditing ? (
        <>
          <div className="flex gap-4 mb-8">
              <button onClick={() => { setFormData({ _id: null, title: '', classroom: 'Toutes', levels: [] }); setIsEditing(true); }} 
                      className="flex-1 py-6 bg-orange-500 text-white rounded-[30px] font-black text-xl shadow-lg border-b-8 border-orange-700 active:border-b-0 active:translate-y-2 transition-all">
                  ✍️ MANUEL
              </button>
              <button onClick={() => setShowSmartWizard(true)} 
                      className="flex-1 py-6 bg-purple-600 text-white rounded-[30px] font-black text-xl shadow-lg border-b-8 border-purple-800 active:border-b-0 active:translate-y-2 transition-all">
                  ✨ IA AUTO
              </button>
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
                    <select className="hw-select-class" value={formData.classroom} onChange={e => setFormData({...formData, classroom: e.target.value})}>
                        <option value="Toutes">Toutes</option><option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                    </select>
                </div>
                
                {/* LISTE DES PAGES (LEVELS) */}
                <div className="hw-pages-container">
                    {formData.levels.map((lvl, idx) => (
                        <div key={idx} className="hw-page-card">
                            <div className="hw-page-header"><span>PAGE {idx+1}</span><button className="hw-del-page" onClick={()=>{const n=[...formData.levels]; n.splice(idx,1); setFormData({...formData, levels:n});}}>✕</button></div>
                            
                            {/* ZONE HAUTE : DOCS */}
                            <div className="hw-upload-section">
                                <p className="hw-label">DOCUMENTS (HAUT)</p>
                                <div className="hw-docs-preview">
                                    {lvl.attachmentUrls && lvl.attachmentUrls.map((u, i) => <img key={i} src={u} className="hw-mini-img" />)}
                                </div>
                            </div>
                            
                            {/* ZONE BASSE : TEXTE QUESTION */}
                            <div className="hw-question-section">
                                <textarea className="hw-q-text" placeholder="Consigne..." value={lvl.instruction} onChange={e => {const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} />
                            </div>
                        </div>
                    ))}
                </div>
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