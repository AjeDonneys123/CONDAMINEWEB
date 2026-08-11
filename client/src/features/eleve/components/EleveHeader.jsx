// @signatures: EleveHeader, record
import React, { useEffect, useMemo, useState } from 'react';
import './EleveHeader.css';

export default function EleveHeader({ user, onLogout, onBackToProf, activeTab, onTabChange, hidePunishmentAlert = false }) {
  const isJean = user.firstName === 'Jean' && user.lastName === 'Vuillet';
  const [nowMs, setNowMs] = useState(Date.now());
  const classKey = String(user.currentClass || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  const condaTutorCode = useMemo(() => {
    const raw = String(user?._id || user?.id || '').replace(/[^a-f0-9]/gi, '').slice(-8);
    if (!raw) return '';
    return String((parseInt(raw, 16) % 900000) + 100000);
  }, [user?._id, user?.id]);
  const trainingTabLabel = /^3/.test(classKey)
    ? '🎓 DNB'
    : /^(2|2DE|SECONDE)/.test(classKey)
      ? '🧠 ENTRAÎNEMENT'
      : '🧠 ENTRAÎNEMENT';

  // --- LOGIQUE STATS ---
  const behaviorRecords = Array.isArray(user.behaviorRecords) ? user.behaviorRecords : [];
  const primaryRecord = behaviorRecords
    .map((r) => ({
      ...r,
      _crosses: Number(r?.crosses || 0),
      _bonuses: Number(r?.bonuses || 0),
      _nextTs: r?.nextCrossRemovalAt ? new Date(r.nextCrossRemovalAt).getTime() : null
    }))
    .sort((a, b) => {
      // Priorité au même affichage que la carte prof: croix d'abord, puis bonus.
      if (b._crosses !== a._crosses) return b._crosses - a._crosses;
      if (b._bonuses !== a._bonuses) return b._bonuses - a._bonuses;
      const aTs = Number.isFinite(a._nextTs) ? a._nextTs : Number.MAX_SAFE_INTEGER;
      const bTs = Number.isFinite(b._nextTs) ? b._nextTs : Number.MAX_SAFE_INTEGER;
      return aTs - bTs;
    })[0] || { _crosses: 0, _bonuses: 0, weeksToRedemption: 3, _nextTs: null };

  const crosses = Math.max(0, Math.min(3, Number.isFinite(primaryRecord._crosses) ? primaryRecord._crosses : 0));
  const weeksLeft = Number(primaryRecord.weeksToRedemption || 3);
  const nextCrossRemovalAt = Number.isFinite(primaryRecord._nextTs) ? primaryRecord._nextTs : null;
  
  const totalBonuses = Math.max(0, Number.isFinite(primaryRecord._bonuses) ? primaryRecord._bonuses : 0);
  const currentBonuses = totalBonuses % 4; // 0, 1, 2, 3
  const nextAPlus = 4 - currentBonuses;

  const crossVisual = "❌".repeat(crosses) + ".".repeat(3 - crosses);
  const bonusVisual = "🌟".repeat(currentBonuses) + ".".repeat(4 - currentBonuses);

  useEffect(() => {
    const needsCrossTimer = crosses > 0 && nextCrossRemovalAt;
    const needsPunishTimer = user.punishmentStatus === 'PENDING' && user.punishmentDueDate;
    if (!needsCrossTimer && !needsPunishTimer) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [crosses, nextCrossRemovalAt, user.punishmentStatus, user.punishmentDueDate]);

  const crossCountdown = useMemo(() => {
    if (!(crosses > 0 && nextCrossRemovalAt)) return null;
    const target = nextCrossRemovalAt;
    if (!target || Number.isNaN(target)) return null;
    const diff = Math.max(0, target - nowMs);
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(days)}j:${pad(hours)}h:${pad(mins)}:${pad(secs)}`;
  }, [crosses, nextCrossRemovalAt, nowMs]);

  const punishmentCountdown = useMemo(() => {
    if (!(user.punishmentStatus === 'PENDING' && user.punishmentDueDate)) return null;
    const target = new Date(user.punishmentDueDate).getTime();
    if (!target || Number.isNaN(target)) return null;
    const diff = Math.max(0, target - nowMs);
    const totalSec = Math.floor(diff / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }, [user.punishmentStatus, user.punishmentDueDate, nowMs]);

  // --- LOGIQUE PUNITION (COMPTE À REBOURS) ---
  let punishmentAlert = null;
  
  if (!hidePunishmentAlert && (user.punishmentStatus === 'PENDING' || user.punishmentStatus === 'LATE')) {
      const isLate = user.punishmentStatus === 'LATE';

      punishmentAlert = (
          <div className={`punishment-alert ${isLate ? 'late' : ''}`}>
              <span className="text-2xl">{isLate ? '🚨' : '⚖️'}</span>
              <div className="flex flex-col">
                  <span>{isLate ? "PUNITION EN RETARD !" : "PUNITION EN COURS"}</span>
                  <span className="text-[10px] opacity-80 uppercase font-bold">
                      {isLate ? "Rendez votre travail immédiatement." : "Travail à rendre dans Récup contrôle."}
                  </span>
              </div>
              {!isLate && punishmentCountdown && (
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-xs font-bold opacity-60">IL RESTE</span>
                      <span className="punishment-days">{punishmentCountdown}</span>
                  </div>
              )}
          </div>
      );
  }

  // GESTION DES OPTIONS (Groupes)
  // Si assignedGroups contient des objets (peuplés par le backend), on affiche le nom.
  const groups = Array.isArray(user.assignedGroups) ? user.assignedGroups : [];

  const handlePasswordReset = async () => {
    const nextPassword = window.prompt("Nouveau mot de passe ?");
    if (!nextPassword) return;
    const confirmPassword = window.prompt("Confirme le nouveau mot de passe.");
    if (!confirmPassword) return;
    try {
      const studentId = user.id || user._id;
      const res = await fetch('/api/eleve/auth/student-password/reset-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, password: nextPassword, confirmPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Réinitialisation impossible.');
      alert(data?.message || 'Mot de passe mis à jour.');
    } catch (e) {
      alert(e.message || 'Réinitialisation impossible.');
    }
  };

  return (
    <div className="header-wrapper">
      
      {punishmentAlert}

      {/* 1. TOP BAR (Identité) */}
      <div className="top-bar">
        <div className="flex items-center gap-4">
          <h1 className="brand-name">Condamine</h1>
          {(user.isDeveloper || isJean || user.isVisitorPreview) && (
            <button onClick={onBackToProf} className="v80-back-prof">{user.isVisitorPreview ? '↩ CHANGER DE NIVEAU' : '🎓 RETOUR PROF'}</button>
          )}
        </div>

        <div className="flex items-center gap-3">
            {!user.isVisitorPreview && <button onClick={handlePasswordReset} className="v80-password-btn">RÉCUPÉRER MON MOT DE PASSE</button>}
            <div className="v80-user-info">
                <span className="v80-user-name">{user.firstName} {user.lastName}</span>
                <div className="v80-badges-row">
                    <span className="v80-user-class">{user.currentClass || 'CLASSE ?'}</span>
                    {condaTutorCode && <span className="v80-user-code">CODE {condaTutorCode}</span>}
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
            <button onClick={() => onTabChange('courses')} className={`tab-item ${activeTab === 'courses' ? 'tab-active' : ''}`}>📚 COURS</button>
            <button onClick={() => onTabChange('controles')} className={`tab-item ${activeTab === 'controles' ? 'tab-active' : ''}`}>📝 RÉCUP CONTRÔLE</button>
            <button onClick={() => onTabChange('training')} className={`tab-item ${activeTab === 'training' ? 'tab-active' : ''}`}>{trainingTabLabel}</button>
            <button onClick={() => onTabChange('jeux')} className={`tab-item ${activeTab === 'jeux' ? 'tab-active' : ''}`}>🎮 JEUX</button>
            <button onClick={() => onTabChange('chat')} className={`tab-item ${activeTab === 'chat' ? 'tab-active' : ''}`}>🔎 RECHERCHE</button>
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
