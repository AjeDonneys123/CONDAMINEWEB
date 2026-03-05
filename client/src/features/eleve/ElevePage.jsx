// @signatures: ElevePage, fetchFreshData
import React, { useState, useEffect } from 'react';
import EleveHeader from './components/EleveHeader';
import HomeworkList from './homework/HomeworkList';
import LearningList from './learning/LearningList';
import MistakesBook from './mistakes/MistakesBook';
import GamesGrid from './games/GamesGrid';
import ExposeList from './exposes/ExposeList';
import LectureList from './lectures/LectureList';
import StatusOverview from './status/StatusOverview';
import BugReportWidget from '../shared/BugReportWidget';
import './ElevePage.css';

export default function ElevePage({ user, onLogout, onBackToProf }) {
  const [tab, setTab] = useState('status');
  const [pendingActivity, setPendingActivity] = useState(null);
  const [freshUser, setFreshUser] = useState(user);
  const [showPunishmentSplash, setShowPunishmentSplash] = useState(false);
  const [openPunishmentDirect, setOpenPunishmentDirect] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
      const fetchFreshData = async () => {
          try {
              const id = user._id || user.id;
              // FIX V99 : Utilisation de la route HERMÉTIQUE ÉLÈVE
              const res = await fetch(`/api/eleve/auth/student-fresh/${id}`);
              if (res.ok) {
                  const data = await res.json();
                  setFreshUser(prev => ({ ...prev, ...data }));
              }
          } catch (e) { console.error("Sync behavior error", e); }
      };
      fetchFreshData();
      const interval = setInterval(fetchFreshData, 5000);
      return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
      const active = freshUser?.punishmentStatus === 'PENDING' || freshUser?.punishmentStatus === 'LATE';
      setShowPunishmentSplash(active);
  }, [freshUser?.punishmentStatus, freshUser?.punishmentDueDate]);

  useEffect(() => {
      if (!(freshUser?.punishmentStatus === 'PENDING' && freshUser?.punishmentDueDate)) return;
      const t = setInterval(() => setNowMs(Date.now()), 1000);
      return () => clearInterval(t);
  }, [freshUser?.punishmentStatus, freshUser?.punishmentDueDate]);

  const punishmentCountdown = (() => {
      if (!(freshUser?.punishmentStatus === 'PENDING' && freshUser?.punishmentDueDate)) return null;
      const target = new Date(freshUser.punishmentDueDate).getTime();
      if (!target || Number.isNaN(target)) return null;
      const diff = Math.max(0, target - nowMs);
      const totalSec = Math.floor(diff / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  })();

  const openActivityFromStatus = (item) => {
      const type = String(item?.type || '').toLowerCase();
      const id = String(item?.id || '').trim();
      if (!type || !id) return;
      const tabMap = {
          homework: 'devoirs',
          game: 'jeux',
          learning: 'apprentissage',
          expose: 'exposes',
          lecture: 'lectures'
      };
      const nextTab = tabMap[type];
      if (!nextTab) return;
      setPendingActivity({ type, id, title: String(item?.title || '') });
      setTab(nextTab);
  };

  const clearPendingIfMatch = (type) => {
      if (!pendingActivity) return;
      if (String(pendingActivity.type || '') !== String(type || '')) return;
      setPendingActivity(null);
  };

  return (
    <div className="eleve-page-wrapper">
        <div className="eleve-page-container">
          {showPunishmentSplash && (
            <div className={`punishment-splash ${freshUser?.punishmentStatus === 'LATE' ? 'late' : ''}`}>
              <div className="ps-title">{freshUser?.punishmentStatus === 'LATE' ? 'PUNITION EN RETARD' : 'PUNITION À FAIRE'}</div>
              <div className="ps-sub">Rends la punition dans l'onglet Devoirs.</div>
              {freshUser?.punishmentStatus === 'PENDING' && punishmentCountdown && (
                <div className="ps-timer">{punishmentCountdown}</div>
              )}
              <button
                className="ps-btn"
                onClick={() => {
                  setTab('devoirs');
                  setOpenPunishmentDirect(true);
                  setShowPunishmentSplash(false);
                }}
              >
                Aller à ma punition
              </button>
            </div>
          )}
          <EleveHeader
            user={freshUser}
            onLogout={onLogout}
            onBackToProf={onBackToProf}
            activeTab={tab}
            onTabChange={setTab}
            hidePunishmentAlert={showPunishmentSplash}
          />
          <div className="eleve-main-content">
            {tab === 'status' && <StatusOverview user={freshUser} onOpenActivity={openActivityFromStatus} />}
            {tab === 'devoirs' && (
              <HomeworkList
                user={freshUser}
                openPunishmentDirect={openPunishmentDirect}
                onPunishmentOpened={() => setOpenPunishmentDirect(false)}
                openItemId={pendingActivity?.type === 'homework' ? pendingActivity?.id : ''}
                onOpenHandled={() => clearPendingIfMatch('homework')}
              />
            )}
            {tab === 'apprentissage' && (
              <LearningList
                user={freshUser}
                openItemId={pendingActivity?.type === 'learning' ? pendingActivity?.id : ''}
                onOpenHandled={() => clearPendingIfMatch('learning')}
              />
            )}
            {tab === 'lectures' && (
              <LectureList
                user={freshUser}
                openItemId={pendingActivity?.type === 'lecture' ? pendingActivity?.id : ''}
                onOpenHandled={() => clearPendingIfMatch('lecture')}
              />
            )}
            {tab === 'francais' && <MistakesBook user={freshUser} />}
            {tab === 'jeux' && (
              <GamesGrid
                user={freshUser}
                openItemId={pendingActivity?.type === 'game' ? pendingActivity?.id : ''}
                onOpenHandled={() => clearPendingIfMatch('game')}
              />
            )}
            {tab === 'exposes' && (
              <ExposeList
                user={freshUser}
                openItemId={pendingActivity?.type === 'expose' ? pendingActivity?.id : ''}
                onOpenHandled={() => clearPendingIfMatch('expose')}
              />
            )}
          </div>
        </div>
        <BugReportWidget user={freshUser} />
    </div>
  );
}
