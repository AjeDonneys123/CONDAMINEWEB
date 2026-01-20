import React from 'react';
import './EleveHeader.css';

/**
 * 🎓 HEADER ÉLÈVE V97
 * Affichage robuste de l'identité et de la classe.
 */
export default function EleveHeader({ user, onLogout, onBackToProf, activeTab, onTabChange }) {
  const isJean = user.firstName === 'Jean' && user.lastName === 'Vuillet';

  return (
    <div className="header-wrapper">
      <div className="top-bar">
        <div className="flex items-center gap-4">
          <h1 className="brand-name">Condamine</h1>
          {(user.isDeveloper || isJean) && (
            <button onClick={onBackToProf} className="v80-back-prof">🎓 RETOUR PROF</button>
          )}
        </div>

        <div className="flex items-center gap-3">
            <div className="v80-user-info">
                <span className="v80-user-name">{user.firstName} {user.lastName}</span>
                <span className="v80-user-class">{user.currentClass || 'CLASSE NON DÉFINIE'}</span>
            </div>
            <button onClick={onLogout} className="v80-logout-btn">✕</button>
        </div>
      </div>

      <div className="nav-tabs">
        <button onClick={() => onTabChange('devoirs')} className={`tab-item ${activeTab === 'devoirs' ? 'tab-active' : ''}`}>📚 DEVOIRS</button>
        <button onClick={() => onTabChange('francais')} className={`tab-item ${activeTab === 'francais' ? 'tab-active' : ''}`}>🇫🇷 FRANÇAIS</button>
        <button onClick={() => onTabChange('jeux')} className={`tab-item ${activeTab === 'jeux' ? 'tab-active' : ''}`}>🎮 JEUX</button>
      </div>
    </div>
  );
}