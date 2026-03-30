// @signatures: ElevePage, fetchFreshData
import React, { useState, useEffect } from 'react';
import EleveHeader from './components/EleveHeader';
import MistakesBook from './mistakes/MistakesBook';
import GamesGrid from './games/GamesGrid';
import CommentsList from './comments/CommentsList';
import ControlRecoveryList from './controlRecovery/ControlRecoveryList';
import StatusOverview from './status/StatusOverview';
import LearningList from './learning/LearningList';
import HomeworkList from './homework/HomeworkList';
import EleveChatWorkspace from './chat/EleveChatWorkspace';
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
      if (type === 'game') {
          setPendingActivity({ type, id, title: String(item?.title || '') });
          setTab('jeux');
          return;
      }
      if (type === 'comment') {
          setPendingActivity({ type, id, title: String(item?.title || '') });
          setTab('comment');
          return;
      }
      if (type === 'learning') {
          setPendingActivity({ type, id, title: String(item?.title || '') });
          setTab('learning');
          return;
      }
      if (type === 'homework') {
          setPendingActivity({ type, id, title: String(item?.title || '') });
          setTab('homework');
          return;
      }
      setPendingActivity({ type, id, title: String(item?.title || '') });
      setTab('controles');
  };

  const clearPendingIfMatch = (type) => {
      if (!pendingActivity) return;
      if (String(pendingActivity.type || '') !== String(type || '')) return;
      setPendingActivity(null);
  };

  const userClass = String(freshUser?.currentClass || user?.currentClass || '').trim().toUpperCase();
  const is5eStudent = /^5/.test(userClass) || freshUser?.isTestAccount === true || user?.isTestAccount === true;
  const bridgeUser = encodeURIComponent(window.btoa(JSON.stringify({
    ...freshUser,
    id: freshUser?.id || freshUser?._id || user?.id || user?._id || ''
  })));
  const projet5eBaseUrl = String(
    import.meta.env.VITE_WEB5E_PUBLIC_URL || 'https://web5e-git-pro-jeanvuillets-projects.vercel.app'
  ).trim().replace(/\/+$/, '');
  const projet5eUrl = `${projet5eBaseUrl}?bridgeUser=${bridgeUser}`;

  return (
    <div className="eleve-page-wrapper">
        <div className="eleve-page-container">
          {showPunishmentSplash && (
            <div className={`punishment-splash ${freshUser?.punishmentStatus === 'LATE' ? 'late' : ''}`}>
              <div className="ps-title">{freshUser?.punishmentStatus === 'LATE' ? 'PUNITION EN RETARD' : 'PUNITION À FAIRE'}</div>
              <div className="ps-sub">Rends la punition dans l'onglet Récup contrôle.</div>
              {freshUser?.punishmentStatus === 'PENDING' && punishmentCountdown && (
                <div className="ps-timer">{punishmentCountdown}</div>
              )}
              <button
                className="ps-btn"
                onClick={() => {
                  setTab('controles');
                  setPendingActivity({ type: 'homework', id: '__punishment__', title: 'Punition' });
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
            {tab === 'controles' && (
              <ControlRecoveryList
                user={freshUser}
                pendingActivity={pendingActivity}
                openPunishmentDirect={openPunishmentDirect}
                onPunishmentOpened={() => setOpenPunishmentDirect(false)}
                onActivityHandled={clearPendingIfMatch}
              />
            )}
            {tab === 'comment' && (
              <CommentsList
                user={freshUser}
                openItemId={pendingActivity?.type === 'comment' ? pendingActivity?.id : ''}
                onOpenHandled={() => clearPendingIfMatch('comment')}
              />
            )}
            {tab === 'learning' && (
              <LearningList
                user={freshUser}
                openItemId={pendingActivity?.type === 'learning' ? pendingActivity?.id : ''}
                onOpenHandled={() => clearPendingIfMatch('learning')}
              />
            )}
            {tab === 'homework' && (
              <HomeworkList
                user={freshUser}
                openItemId={pendingActivity?.type === 'homework' ? pendingActivity?.id : ''}
                onOpenHandled={() => clearPendingIfMatch('homework')}
              />
            )}
            {tab === 'chat' && <EleveChatWorkspace user={freshUser} />}
            {tab === 'francais' && <MistakesBook user={freshUser} />}
            {tab === 'jeux' && (
              <GamesGrid
                user={freshUser}
                openItemId={pendingActivity?.type === 'game' ? pendingActivity?.id : ''}
                onOpenHandled={() => clearPendingIfMatch('game')}
              />
            )}
          </div>
          {is5eStudent && (
            <section className="eleve-external-link-card">
              <div className="eleve-external-link-copy">
                <div className="eleve-external-link-kicker">Projet 5e</div>
                <div className="eleve-external-link-title">Entrer dans Projet 5e</div>
                <div className="eleve-external-link-sub">
                  Le site public sur l’eau et l’énergie s’ouvre directement avec ta session élève. Tu arrives sur ton espace sans te reconnecter.
                </div>
              </div>
              <div className="eleve-external-link-actions">
                <a
                  className="eleve-external-link-btn"
                  href={projet5eUrl}
                >
                  Ouvrir Projet 5e
                </a>
              </div>
            </section>
          )}
        </div>
        <BugReportWidget user={freshUser} />
    </div>
  );
}
