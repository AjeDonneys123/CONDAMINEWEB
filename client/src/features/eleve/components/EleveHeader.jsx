import React from 'react';
import './EleveHeader.css';

export default function EleveHeader({ user, onLogout, onBackToProf, activeTab, onTabChange }) {
  const isJean = user.firstName === 'Jean' && user.lastName === 'Vuillet';

  // --- LOGIQUE STATS ---
  // On récupère le dernier enregistrement actif (celui avec des croix ou des bonus)
  // Ou par défaut un objet vide.
  const record = (user.behaviorRecords && user.behaviorRecords.length > 0) 
      ? user.behaviorRecords[user.behaviorRecords.length - 1] 
      : { crosses: 0, bonuses: 0, weeksToRedemption: 3 };

  const crosses = record.crosses || 0;
  const weeksLeft = record.weeksToRedemption || 3;
  
  const totalBonuses = record.bonuses || 0;
  const currentBonuses = totalBonuses % 4; // 0, 1, 2, 3
  const nextAPlus = 4 - currentBonuses;

  // Génération des visuels (X et V)
  const crossVisual = "❌".repeat(crosses) + ".".repeat(3 - crosses); // Ex: ❌❌.
  const bonusVisual = "🌟".repeat(currentBonuses) + ".".repeat(4 - currentBonuses); // Ex: 🌟🌟..

  return (
    <div className="header-wrapper">
      {/* 1. TOP BAR (Identité) */}
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

      {/* 2. NAV BAR + MINI STATS */}
      <div className="nav-bar-container">
        {/* Onglets à Gauche */}
        <div className="nav-tabs">
            <button onClick={() => onTabChange('devoirs')} className={`tab-item ${activeTab === 'devoirs' ? 'tab-active' : ''}`}>📚 DEVOIRS</button>
            <button onClick={() => onTabChange('francais')} className={`tab-item ${activeTab === 'francais' ? 'tab-active' : ''}`}>🇫🇷 FRANÇAIS</button>
            <button onClick={() => onTabChange('jeux')} className={`tab-item ${activeTab === 'jeux' ? 'tab-active' : ''}`}>🎮 JEUX</button>
        </div>

        {/* Stats à Droite (Simple et discret) */}
        <div className="mini-stats-box">
            {/* LIGNE CROIX */}
            <div className="mini-stat-row row-cross">
                <span className="ms-label">CROIX:</span>
                <span className="ms-visual">{crosses > 0 ? crossVisual : "..."}</span>
                {crosses > 0 && <span className="ms-info">(Annul. {weeksLeft} sem.)</span>}
            </div>
            
            {/* LIGNE BONUS */}
            <div className="mini-stat-row row-bonus">
                <span className="ms-label">BONUS:</span>
                <span className="ms-visual">{currentBonuses > 0 ? bonusVisual : "...."}</span>
                <span className="ms-info">({nextAPlus} avant A+)</span>
            </div>
        </div>
      </div>
    </div>
  );
}