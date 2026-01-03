import React, { useState, useEffect } from 'react';
import './HomeworkResults.css';

export default function HomeworkResults({ homework, onBack }) {
  const [allPlayers, setAllPlayers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState(homework.classroom === 'Toutes' ? 'all' : homework.classroom);

  useEffect(() => {
    const loadData = async () => {
        // Charger tous les élèves et toutes les copies en parallèle
        const [playersRes, subsRes] = await Promise.all([
            fetch('/api/players').then(r => r.json()),
            fetch(`/api/submissions/${homework._id}`).then(r => r.json())
        ]);
        setAllPlayers(playersRes || []);
        setSubmissions(subsRes || []);
    };
    loadData();
  }, [homework._id]);

  const handleSaveCorrection = async () => {
    const res = await fetch(`/api/submissions/${selectedSub._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelsResults: selectedSub.levelsResults })
    }).then(r => r.json());
    if (res.ok) alert("Correction validée !");
  };

  // --- LOGIQUE DE FUSION (PLAYERS + SUBMISSIONS) ---
  const studentsStatus = allPlayers
    .filter(p => (classFilter === 'all' || p.classroom === classFilter))
    .filter(p => (p.firstName + ' ' + p.lastName).toLowerCase().includes(search.toLowerCase()))
    .map(player => {
        const sub = submissions.find(s => s.playerId?._id === player._id);
        return { player, sub, isRendu: !!sub };
    });

  return (
    <div className="results-container">
      <div className="results-header-nav">
        <button onClick={onBack} className="btn-back-minimal">← RETOUR</button>
        <div className="exam-info">
            <h2>EXAMEN : {homework.title}</h2>
            <span className="badge-target">Cible : {homework.classroom}</span>
        </div>
      </div>

      {/* BARRE DE FILTRES */}
      <div className="results-filters">
        <input 
            className="filter-search" 
            placeholder="🔍 Trouver un élève..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
        />
        <select 
            className="filter-select" 
            value={classFilter} 
            onChange={e => setClassFilter(e.target.value)}
        >
            <option value="all">Toutes les classes</option>
            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
            <option value="2A">2A</option><option value="2CD">2CD</option>
        </select>
      </div>

      <div className="exam-layout">
        {/* LISTE DES ELEVES (RENDU / NON RENDU) */}
        <div className="students-sidebar scroll-custom">
          {studentsStatus.map(({ player, sub, isRendu }) => (
            <button 
                key={player._id} 
                onClick={() => isRendu ? setSelectedSub(sub) : alert("Cet élève n'a pas encore rendu sa copie.")}
                className={`student-row ${isRendu ? 'rendu' : 'non-rendu'} ${selectedSub?._id === sub?._id ? 'active' : ''}`}
            >
               <div className="std-info">
                   <b className="std-name">{player.firstName} {player.lastName}</b>
                   <small className="std-class">{player.classroom}</small>
               </div>
               <div className="std-status">
                   {isRendu ? <span className="status-label">RENDU • {sub.levelsResults[0]?.grade}</span> : <span className="status-label">ABSENT</span>}
               </div>
            </button>
          ))}
        </div>

        {/* ZONE DE CORRECTION */}
        <div className="correction-main">
          {selectedSub ? (
            <div className="copy-editor-card animate-in slide-in-from-right-4">
               <div className="copy-editor-header">
                 <div>
                    <h3>Copie de {selectedSub.playerId?.firstName}</h3>
                    <p className="sub-date">Reçu le {new Date(selectedSub.submittedAt).toLocaleString()}</p>
                 </div>
                 <div className="grade-box">
                    <label>NOTE :</label>
                    <input className="grade-field" value={selectedSub.levelsResults[0].grade} onChange={e => {
                        const n = {...selectedSub}; n.levelsResults[0].grade = e.target.value; setSelectedSub(n);
                    }} />
                 </div>
               </div>
               
               <div className="editor-section">
                   <label>TRAVAIL DE L'ÉLÈVE</label>
                   <div className="readonly-text">{selectedSub.levelsResults[0].userText}</div>
               </div>

               <div className="editor-section">
                   <label>COMMENTAIRE DU MAÎTRE (MODIFIABLE)</label>
                   <textarea className="textarea-feedback" value={selectedSub.levelsResults[0].aiFeedback} onChange={e => {
                       const n = {...selectedSub}; n.levelsResults[0].aiFeedback = e.target.value; setSelectedSub(n);
                   }} />
               </div>

               <button onClick={handleSaveCorrection} className="btn-confirm-correction">💾 VALIDER MA CORRECTION</button>
            </div>
          ) : (
            <div className="empty-placeholder">
                <span className="icon-large">📂</span>
                <p>Sélectionnez un élève marqué <b>"RENDU"</b> pour corriger sa copie.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}