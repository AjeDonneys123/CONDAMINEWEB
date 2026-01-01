import React, { useState } from 'react';

export default function HomeworksTab() {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div>
      {!isCreating ? (
        <>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                <h3>📚 Gestion des Devoirs</h3>
                <button 
                    className="btn-primary" 
                    style={{width:'auto'}}
                    onClick={() => setIsCreating(true)}
                >
                    ➕ Nouveau Devoir
                </button>
            </div>
            <div style={{padding:'20px', background:'#f8fafc', borderRadius:'8px', border:'1px dashed #cbd5e1', textAlign:'center'}}>
                <p>Aucun devoir pour le moment.</p>
            </div>
        </>
      ) : (
        <div className="card" style={{border:'2px solid #2563eb'}}>
            <h3>Nouveau Devoir</h3>
            <div className="form-group">
                <label className="form-label">Titre</label>
                <input className="form-input" placeholder="Ex: Devoir sur le Passé Composé" />
            </div>
            <div className="form-group">
                <label className="form-label">Classe</label>
                <select className="form-select">
                    <option>Toutes</option>
                    <option>6D</option>
                    <option>5B</option>
                </select>
            </div>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button className="btn-primary" style={{backgroundColor:'#16a34a'}}>Enregistrer</button>
                <button 
                    className="btn-primary" 
                    style={{backgroundColor:'#94a3b8'}} 
                    onClick={() => setIsCreating(false)}
                >
                    Annuler
                </button>
            </div>
        </div>
      )}
    </div>
  );
}

