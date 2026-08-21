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
  const hasDilMode = user?.isDil === true || user?.isVisitorPreview === true;

  // --- LOGIQUE STATS ---
  const behaviorRecords = Array.isArray(user.behaviorRecords) ? user.behaviorRecords : [];
  const primaryRecord = [...behaviorRecords].reverse().find((r) => Array.isArray(r?.scores) && r.scores.length)
    || behaviorRecords[behaviorRecords.length - 1]
    || {};
  const grades = Array.isArray(primaryRecord.scores) && primaryRecord.scores.length
    ? primaryRecord.scores
    : [{ id: 'legacy', value: Number(primaryRecord.baseScore ?? 15) + Number(primaryRecord.bonuses || 0) * 0.5 - Number(primaryRecord.crosses || 0) }];
  const visibleGrades = primaryRecord.forcedSix
    ? [...grades, { id: 'forced-six', value: 6, forced: true }]
    : grades;

  useEffect(() => {
    const needsPunishTimer = user.punishmentStatus === 'PENDING' && user.punishmentDueDate;
    if (!needsPunishTimer) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [user.punishmentStatus, user.punishmentDueDate]);

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
            {hasDilMode && <button onClick={() => onTabChange('dil')} className={`tab-item ${activeTab === 'dil' ? 'tab-active' : ''}`}>🌍 DIL</button>}
            <button onClick={() => onTabChange('jeux')} className={`tab-item ${activeTab === 'jeux' ? 'tab-active' : ''}`}>🎮 JEUX</button>
            <button onClick={() => onTabChange('chat')} className={`tab-item ${activeTab === 'chat' ? 'tab-active' : ''}`}>🔎 RECHERCHE</button>
        </div>

        {/* Stats à Droite (Simple et discret) */}
        <div className="mini-stats-box">
            <div className="mini-stat-row row-grades">
                <span className="ms-label">NOTES :</span>
                <span className="student-grade-list">{visibleGrades.map((grade) => <span key={grade.id} className={`student-grade-chip ${grade.forced ? 'forced' : ''}`}>{Number(grade.value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</span>)}</span>
            </div>
            {primaryRecord.workIncomplete && <div className="student-incomplete">TRAVAIL INCOMPLET</div>}
        </div>
      </div>
    </div>
  );
}
