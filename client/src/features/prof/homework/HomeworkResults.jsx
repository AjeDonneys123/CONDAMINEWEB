import React, { useState, useEffect } from 'react';
import './HomeworkResults.css';

export default function HomeworkResults({ homework, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);

  useEffect(() => {
    fetch(`/api/submissions/${homework._id}`).then(r => r.json()).then(setSubmissions);
  }, [homework._id]);

  const handleSaveCorrection = async () => {
    const res = await fetch(`/api/submissions/${selectedSub._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelsResults: selectedSub.levelsResults })
    }).then(r => r.json());
    if (res.ok) alert("Correction mise à jour !");
  };

  return (
    <div className="results-container">
      <button onClick={onBack} className="btn-back">← Retour</button>
      <h2 className="title-exam">Copies : {homework.title}</h2>

      <div className="exam-layout">
        {/* Liste des élèves */}
        <div className="students-list">
          {submissions.map(s => (
            <button key={s._id} onClick={() => setSelectedSub(s)} className={`student-item ${selectedSub?._id === s._id ? 'active' : ''}`}>
               <b>{s.playerId?.firstName} {s.playerId?.lastName}</b>
               <span>{s.levelsResults[0]?.grade || "--"}</span>
            </button>
          ))}
          {submissions.length === 0 && <p className="empty">Aucune copie rendue.</p>}
        </div>

        {/* Détail de la copie */}
        <div className="copy-detail">
          {selectedSub ? (
            <div className="copy-card">
               <div className="copy-header">
                 <h3>Copie de {selectedSub.playerId?.firstName}</h3>
                 <input className="grade-input" value={selectedSub.levelsResults[0].grade} onChange={e => {
                   const n = {...selectedSub}; n.levelsResults[0].grade = e.target.value; setSelectedSub(n);
                 }} />
               </div>
               
               <div className="section-label">Réponse de l'élève :</div>
               <div className="user-text-area">{selectedSub.levelsResults[0].userText}</div>

               <div className="section-label">Correction (IA/Prof) :</div>
               <textarea className="feedback-editor" value={selectedSub.levelsResults[0].aiFeedback} onChange={e => {
                 const n = {...selectedSub}; n.levelsResults[0].aiFeedback = e.target.value; setSelectedSub(n);
               }} />

               <button onClick={handleSaveCorrection} className="btn-save-edit">💾 ENREGISTRER MA VERSION</button>
            </div>
          ) : <div className="placeholder-copy">Sélectionnez un élève pour voir sa copie</div>}
        </div>
      </div>
    </div>
  );
}