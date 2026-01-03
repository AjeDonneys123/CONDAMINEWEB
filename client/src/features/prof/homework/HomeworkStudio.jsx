import React, { useState, useEffect } from 'react';
import HomeworkResults from './HomeworkResults';
import './HomeworkStudio.css';

export default function HomeworkStudio() {
  const [hws, setHws] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [viewingResults, setViewingResults] = useState(null);
  const [formData, setFormData] = useState({ _id: null, title: '', classroom: 'Toutes', levels: [] });
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(null); // Index de la page en cours d'extraction

  const load = async () => {
    const data = await fetch('/api/homework-all').then(r => r.json());
    setHws(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (files, idx, type) => {
    setUploading(true);
    const newLevels = [...formData.levels];
    for (let file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
      if (res.ok) {
        if (type === 'doc') newLevels[idx].attachmentUrls.push(res.imageUrl);
        else newLevels[idx].questionImage = res.imageUrl; // Image Question
      }
    }
    setFormData({ ...formData, levels: newLevels });
    setUploading(false);
  };

  // NOUVELLE FONCTION : Extraire le texte et supprimer l'image
  const handleExtractQuestions = async (idx) => {
      const level = formData.levels[idx];
      if (!level.questionImage) return alert("Aucune image à extraire !");
      
      setExtracting(idx);
      try {
          const res = await fetch('/api/extract-text', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ imageUrl: level.questionImage })
          }).then(r => r.json());

          if (res.text) {
              const newLevels = [...formData.levels];
              newLevels[idx].instruction = res.text; // On met le texte
              newLevels[idx].questionImage = null;   // On supprime l'image (logique exclusive)
              setFormData({ ...formData, levels: newLevels });
          } else {
              alert("Impossible de lire le texte.");
          }
      } catch (e) { alert("Erreur extraction."); }
      setExtracting(null);
  };

  const save = async () => {
    if (!formData.title) return alert("Titre requis !");
    
    // Validation finale avant sauvegarde
    for (let i = 0; i < formData.levels.length; i++) {
        const lvl = formData.levels[i];
        if (lvl.questionImage && lvl.instruction && lvl.instruction.trim().length > 0) {
            return alert(`ERREUR PAGE ${i+1} : Vous ne pouvez pas avoir une IMAGE DE QUESTION et du TEXTE DE QUESTION en même temps. Choisissez l'un ou l'autre, ou utilisez "Extraire questions".`);
        }
    }

    const res = await fetch('/api/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    }).then(r => r.json());
    if (res.ok) { setIsEditing(false); load(); }
  };

  if (viewingResults) return <HomeworkResults homework={viewingResults} onBack={() => setViewingResults(null)} />;

  return (
    <div className="studio-container">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData({ _id: null, title: '', classroom: 'Toutes', levels: [{ instruction: '', attachmentUrls: [], questionImage: null }] }); setIsEditing(true); }} 
                  className="btn-create-hw-big">➕ NOUVEAU DEVOIR MAISON</button>
          <div className="hw-admin-list">
            {hws.map(h => (
              <div key={h._id} className="hw-admin-card-v13">
                <div className="hw-info">
                    <b className="hw-title-text">{h.title}</b>
                    <span className="hw-class-badge">{h.classroom}</span>
                </div>
                <div className="hw-actions-row">
                    <button onClick={() => setViewingResults(h)} className="btn-action-view">👁️ EXAM</button>
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
              <h3>{formData._id ? 'MODIFIER LE DEVOIR' : 'CRÉER UN DEVOIR'}</h3>
              <button onClick={() => setIsEditing(false)} className="hw-close-x">✕</button>
            </div>
            <div className="hw-edit-body scroll-custom">
                <div className="hw-config-grid">
                    <input className="hw-input-title" placeholder="Titre du devoir..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    <select className="hw-select-class" value={formData.classroom} onChange={e => setFormData({...formData, classroom: e.target.value})}>
                        <option value="Toutes">Toutes les classes</option><option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                    </select>
                </div>
                <div className="hw-pages-container">
                    {formData.levels.map((lvl, idx) => {
                        const hasConflict = lvl.questionImage && lvl.instruction && lvl.instruction.trim().length > 0;
                        return (
                            <div key={idx} className="hw-page-card" style={hasConflict ? {border: '3px solid #ef4444', background: '#fef2f2'} : {}}>
                                <div className="hw-page-header">
                                    <span>PAGE {idx+1}</span>
                                    <button className="hw-del-page" onClick={()=>{const n=[...formData.levels]; n.splice(idx,1); setFormData({...formData, levels:n});}}>✕ Supprimer la page</button>
                                </div>
                                
                                {hasConflict && (
                                    <div className="bg-red-500 text-white p-3 rounded-xl mb-4 font-bold text-center text-sm animate-pulse">
                                        ⚠️ CONFLIT : Choisissez soit l'image, soit le texte, pas les deux ! <br/>
                                        Utilisez le bouton "⚡ EXTRAIRE" pour convertir l'image en texte.
                                    </div>
                                )}

                                <div className="hw-upload-section">
                                    <p className="hw-label">Ligne 1 : Documents Liseuse (PDF/Images)</p>
                                    <div className="hw-docs-preview">
                                        {lvl.attachmentUrls.map((u, i) => <img key={i} src={u} className="hw-mini-img" />)}
                                        <label className="hw-add-mini">+<input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx, 'doc')} /></label>
                                    </div>
                                </div>
                                
                                <div className="hw-question-section">
                                    <div className="flex flex-col gap-2">
                                        <div className="hw-q-img-upload">
                                            {lvl.questionImage ? <img src={lvl.questionImage} /> : <span>IMAGE QUESTION</span>}
                                            <input type="file" className="hw-hidden-file" onChange={e => handleUpload(e.target.files, idx, 'qimg')} />
                                        </div>
                                        {/* BOUTON D'EXTRACTION */}
                                        {lvl.questionImage && (
                                            <button 
                                                onClick={() => handleExtractQuestions(idx)} 
                                                disabled={extracting === idx}
                                                className="bg-purple-600 text-white font-bold py-2 px-3 rounded-xl text-xs hover:bg-purple-700 transition-all shadow-md flex items-center justify-center gap-2"
                                            >
                                                {extracting === idx ? '⏳ ANALYSE...' : '⚡ EXTRAIRE QUESTIONS'}
                                            </button>
                                        )}
                                    </div>

                                    <textarea 
                                        className="hw-q-text" 
                                        placeholder="Consigne ou Questions (Texte)..." 
                                        value={lvl.instruction} 
                                        onChange={e => {const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} 
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button onClick={() => setFormData({...formData, levels: [...formData.levels, {instruction:'', attachmentUrls:[], questionImage:null}]})} className="hw-add-page-btn">+ AJOUTER UNE PAGE</button>
            </div>
            <div className="hw-edit-footer">
                <button onClick={save} disabled={uploading} className="hw-btn-save-final">{uploading ? "📦 UPLOAD EN COURS..." : "💾 SAUVEGARDER LE DEVOIR EN BDD"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}