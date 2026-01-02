import React, { useState, useEffect } from 'react';
import './HomeworkStudio.css';

export default function HomeworkStudio() {
  const [hws, setHws] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ _id: null, title: '', classroom: 'Toutes', levels: [] });
  const [uploading, setUploading] = useState(false);

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
        else newLevels[idx].questionImage = res.imageUrl;
      }
    }
    setFormData({ ...formData, levels: newLevels });
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

  return (
    <div className="studio-container">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData({ _id: null, title: '', classroom: 'Toutes', levels: [{ instruction: '', attachmentUrls: [], questionImage: null }] }); setIsEditing(true); }} 
                  className="btn-create-hw">➕ NOUVEAU DEVOIR MAISON</button>
          <div className="hw-list-grid">
            {hws.map(h => (
              <div key={h._id} className="hw-admin-card">
                <div><b>{h.title}</b><p>{h.classroom} • {h.levels.length} Page(s)</p></div>
                <div className="hw-actions">
                    <button onClick={() => { setFormData(h); setIsEditing(true); }} className="btn-edit">🖋️</button>
                    <button onClick={async () => { if(confirm("Suppr ?")) { await fetch(`/api/homework/${h._id}`, {method:'DELETE'}); load(); }}} className="btn-delete">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="edit-modal-content">
          <div className="edit-header">
            <h3>{formData._id ? 'Modifier Devoir' : 'Nouveau Devoir'}</h3>
            <button onClick={() => setIsEditing(false)} className="btn-close">✕</button>
          </div>
          <div className="edit-grid-top">
            <input className="input-title" placeholder="Titre du devoir..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select className="select-class" value={formData.classroom} onChange={e => setFormData({...formData, classroom: e.target.value})}>
                <option value="Toutes">Toutes les classes</option><option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
            </select>
          </div>
          <div className="pages-list">
            {formData.levels.map((lvl, idx) => (
                <div key={idx} className="page-editor-card">
                    <div className="page-header"><span>PAGE {idx+1}</span><button onClick={()=>{const n=[...formData.levels]; n.splice(idx,1); setFormData({...formData, levels:n});}}>Supprimer</button></div>
                    <div className="upload-zone-top">
                        <p>Ligne 1 : Documents (PDF / Images)</p>
                        <div className="docs-preview">
                            {lvl.attachmentUrls.map((url, uIdx) => <img key={uIdx} src={url} className="doc-thumb" />)}
                            <label className="btn-add-file">+<input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files, idx, 'doc')} /></label>
                        </div>
                    </div>
                    <div className="upload-zone-bottom">
                        <div className="q-img-box">
                            {lvl.questionImage ? <img src={lvl.questionImage} /> : <span>Image Question</span>}
                            <input type="file" className="hidden-input" onChange={e => handleUpload(e.target.files, idx, 'qimg')} />
                        </div>
                        <textarea placeholder="Consigne élève..." value={lvl.instruction} onChange={e => {const n=[...formData.levels]; n[idx].instruction=e.target.value; setFormData({...formData, levels:n});}} />
                    </div>
                </div>
            ))}
          </div>
          <button onClick={() => setFormData({...formData, levels: [...formData.levels, {instruction:'', attachmentUrls:[], questionImage:null}]})} className="btn-add-page">+ AJOUTER UNE PAGE</button>
          <button onClick={save} disabled={uploading} className="btn-save-final">{uploading ? "UPLOAD EN COURS..." : "💾 SAUVEGARDER LE DEVOIR"}</button>
        </div>
      )}
    </div>
  );
}