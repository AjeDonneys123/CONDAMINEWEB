import React, { useState, useEffect } from 'react';
import HomeworkResults from './HomeworkResults';
import './HomeworkStudio.css';

export default function HomeworkStudio() {
  const [hws, setHws] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [viewingResults, setViewingResults] = useState(null); // Contient le devoir sélectionné
  const [formData, setFormData] = useState({ _id: null, title: '', classroom: 'Toutes', levels: [] });

  const load = async () => {
    const data = await fetch('/api/homework-all').then(r => r.json());
    setHws(data || []);
  };
  useEffect(() => { load(); }, []);

  if (viewingResults) return <HomeworkResults homework={viewingResults} onBack={() => setViewingResults(null)} />;

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
                    <button onClick={() => setViewingResults(h)} className="btn-view-exam">👁️ EXAM</button>
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
            <input className="input-title" placeholder="Titre..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select className="select-class" value={formData.classroom} onChange={e => setFormData({...formData, classroom: e.target.value})}>
                <option value="Toutes">Toutes les classes</option><option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
            </select>
          </div>
          <button onClick={async () => { await fetch('/api/homework', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(formData)}); setIsEditing(false); load(); }} className="btn-save-final">💾 SAUVEGARDER</button>
        </div>
      )}
    </div>
  );
}