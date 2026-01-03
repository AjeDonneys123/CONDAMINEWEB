import React, { useState, useEffect } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugText, setBugText] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed._id)) setUser(parsed);
      } catch (e) { localStorage.removeItem('player'); }
    }
  }, []);

  const handleReportBug = async () => {
      if(!bugText) return;
      await fetch('/api/report-bug', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ 
              reporter: user ? user.firstName : "Visiteur (Login)", 
              classroom: user ? user.classroom : "Inconnue", 
              description: bugText 
          })
      });
      alert("Ton message a été envoyé au Maître ! 🐞");
      setBugText('');
      setShowBugModal(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
  };

  // ARCHITECTE : On définit si on doit afficher le bouton de signalement global
  // On le cache si l'utilisateur est le PROF (car il a son propre bouton de gestion)
  const showGlobalBugButton = !user || user.id !== 'prof';

  return (
    <div className={`app-wrapper ${showBugModal ? 'app-paused' : ''}`}>
      
      {/* BOUTON BUG GLOBAL (Caché pour le prof pour éviter le doublon) */}
      {showGlobalBugButton && (
        <button 
          onClick={() => setShowBugModal(true)}
          className="global-bug-trigger"
          title="Signaler un problème"
        >
          🐞
        </button>
      )}

      {/* ROUTAGE PRINCIPAL */}
      {!user ? (
        <Login onLoginSuccess={setUser} />
      ) : (
        user.id === 'prof' ? (
          <ProfPage user={user} onLogout={handleLogout} />
        ) : (
          <ElevePage 
            user={user} 
            onLogout={handleLogout} 
            onBackToProf={() => setUser({ id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" })}
            onOpenBug={() => setShowBugModal(true)}
          />
        )
      )}

      {/* MODALE BUG */}
      {showBugModal && (
          <div className="bug-modal-overlay">
            <div className="bug-modal-card animate-in zoom-in duration-200">
                <div className="bug-modal-header">
                    <h2>SIGNALER UN BUG</h2>
                    <span className="bug-icon">🐞</span>
                </div>
                <p className="bug-modal-desc">Explique au Maître ce qui ne fonctionne pas.</p>
                <textarea 
                    className="bug-textarea"
                    placeholder="Tape ton message ici..."
                    value={bugText}
                    onChange={e => setBugText(e.target.value)}
                    autoFocus
                />
                <div className="bug-modal-actions">
                    <button onClick={() => setShowBugModal(false)} className="btn-bug-cancel">ANNULER</button>
                    <button onClick={handleReportBug} className="btn-bug-send">ENVOYER</button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
}