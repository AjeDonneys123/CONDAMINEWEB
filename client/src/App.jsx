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
      alert("Message envoyé ! 🐞");
      setBugText('');
      setShowBugModal(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <div className={`app-wrapper ${showBugModal ? 'app-paused' : ''}`}>
      
      {/* CORRECTION : Le bouton est maintenant TOUJOURS visible, même pour le prof */}
      <button 
        onClick={() => setShowBugModal(true)}
        className="global-bug-trigger"
        title="Signaler un problème"
      >
        🐞
      </button>

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

      {showBugModal && (
          <div className="bug-modal-overlay">
            <div className="bug-modal-card animate-in zoom-in duration-200">
                <div className="bug-modal-header">
                    <h2>SIGNALER UN BUG</h2>
                    <span className="bug-icon">🐞</span>
                </div>
                <p className="bug-modal-desc">Décris le problème rencontré.</p>
                <textarea 
                    className="bug-textarea"
                    placeholder="Ex: L'IA ne charge pas..."
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