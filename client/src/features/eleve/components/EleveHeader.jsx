// @signatures: EleveHeader, record
import React, { useEffect, useMemo, useState } from 'react';
import './EleveHeader.css';

export default function EleveHeader({ user, onLogout, onBackToProf, activeTab, onTabChange }) {
  const isJean = user.firstName === 'Jean' && user.lastName === 'Vuillet';
  const [nowMs, setNowMs] = useState(Date.now());

  // --- LOGIQUE STATS ---
  const record = (user.behaviorRecords && user.behaviorRecords.length > 0) 
      ? user.behaviorRecords[user.behaviorRecords.length - 1] 
      : { crosses: 0, bonuses: 0, weeksToRedemption: 3 };

  const crosses = record.crosses || 0;
  const weeksLeft = record.weeksToRedemption || 3;
  
  const totalBonuses = record.bonuses || 0;
  const currentBonuses = totalBonuses % 4; // 0, 1, 2, 3
  const nextAPlus = 4 - currentBonuses;

  const crossVisual = "❌".repeat(crosses) + ".".repeat(3 - crosses);
  const bonusVisual = "🌟".repeat(currentBonuses) + ".".repeat(4 - currentBonuses);

  useEffect(() => {
    if (!(crosses > 0 && record.nextCrossRemovalAt)) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [crosses, record.nextCrossRemovalAt]);

  const crossCountdown = useMemo(() => {
    if (!(crosses > 0 && record.nextCrossRemovalAt)) return null;
    const target = new Date(record.nextCrossRemovalAt).getTime();
    if (!target || Number.isNaN(target)) return null;
    const diff = Math.max(0, target - nowMs);
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(days)}:${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }, [crosses, record.nextCrossRemovalAt, nowMs]);

  // --- LOGIQUE PUNITION (COMPTE À REBOURS) ---
  let punishmentAlert = null;
  
  if (user.punishmentStatus === 'PENDING' || user.punishmentStatus === 'LATE') {
      const dueDate = user.punishmentDueDate ? new Date(user.punishmentDueDate) : new Date();
      const now = new Date();
      const diffTime = dueDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isLate = diffDays < 0 || user.punishmentStatus === 'LATE';

      punishmentAlert = (
          <div className={`punishment-alert ${isLate ? 'late' : ''}`}>
              <span className="text-2xl">{isLate ? '🚨' : '⚖️'}</span>
              <div className="flex flex-col">
                  <span>{isLate ? "PUNITION EN RETARD !" : "PUNITION EN COURS"}</span>
                  <span className="text-[10px] opacity-80 uppercase font-bold">
                      {isLate ? "Rendez votre travail immédiatement." : "Travail à rendre dans la section Devoirs."}
                  </span>
              </div>
              {!isLate && (
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-xs font-bold opacity-60">IL RESTE</span>
                      <span className="punishment-days">{diffDays}j</span>
                  </div>
              )}
          </div>
      );
  }

  // GESTION DES OPTIONS (Groupes)
  // Si assignedGroups contient des objets (peuplés par le backend), on affiche le nom.
  const groups = Array.isArray(user.assignedGroups) ? user.assignedGroups : [];

  return (
    <div className="header-wrapper">
      
      {punishmentAlert}

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
                <div className="v80-badges-row">
                    <span className="v80-user-class">{user.currentClass || 'CLASSE ?'}</span>
                    {groups.map((grp, i) => (
                        <span key={i} className="v80-user-option">
                            {typeof grp === 'object' ? grp.name : 'OPTION'}
                        </span>
                    ))}
                </div>
            </div>
            <button onClick={onLogout} className="v80-logout-btn">✕</button>
        </div>
      </div>

      {/* 2. NAV BAR + MINI STATS */}
      <div className="nav-bar-container">
        {/* Onglets à Gauche */}
        <div className="nav-tabs">
            <button onClick={() => onTabChange('status')} className={`tab-item ${activeTab === 'status' ? 'tab-active' : ''}`}>📊 STATUS</button>
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
                {crosses > 0 && crossCountdown && <span className="ms-countdown">{crossCountdown}</span>}
                {crosses > 0 && !crossCountdown && <span className="ms-info">(Annul. {weeksLeft} sem.)</span>}
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
