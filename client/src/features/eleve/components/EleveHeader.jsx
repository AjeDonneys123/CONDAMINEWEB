import React from 'react';
import './EleveHeader.css';

export default function EleveHeader({ user, onLogout, onBackToProf, activeTab, onTabChange, onTogglePink }) {
  const isTestEleve = user.firstName === "Eleve" || user.id === "prof" || user.role === "prof";

  return (
    <div className="header-wrapper">
      <div className="top-bar">
        <div className="brand-zone flex items-center gap-4">
          <h1 className="brand-name">Condamine</h1>
          {isTestEleve && <button onClick={onBackToProf} className="btn-back-prof">🎓 PROF</button>}
          
          {/* BOUTON ANA VICTORIA */}
          <button onClick={onTogglePink} className="btn-ana-victoria">
            🌸 ANA VICTORIA
          </button>
        </div>
        <div className="user-zone">
            <span className="user-badge">{user.firstName} ({user.classroom || 'Prof'})</span>
            <button onClick={onLogout} className="logout-link">✕</button>
        </div>
      </div>

      <div className="nav-tabs">
        <button onClick={() => onTabChange('devoirs')} className={`tab-item ${activeTab === 'devoirs' ? 'tab-devoirs-active' : ''}`}>📚 DEVOIRS</button>
        <button onClick={() => onTabChange('francais')} className={`tab-item ${activeTab === 'francais' ? 'tab-francais-active' : ''}`}>🇫🇷 FRANÇAIS</button>
        <button onClick={() => onTabChange('jeux')} className={`tab-item ${activeTab === 'jeux' ? 'tab-jeux-active' : ''}`}>🎮 JEUX</button>
      </div>
    </div>
  );
}