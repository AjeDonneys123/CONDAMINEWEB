import React, { lazy, Suspense, useState, useEffect } from 'react';
import EleveHeader from './components/EleveHeader';
import StatusOverview from './status/StatusOverview';
import { STUDENT_STARS_EVENT } from './utils/studentStars';
import BugReportWidget from '../shared/BugReportWidget';
import './ElevePage.css';

const GamesGrid = lazy(() => import('./games/GamesGrid'));
const CommentsList = lazy(() => import('./comments/CommentsList'));
const ControlRecoveryList = lazy(() => import('./controlRecovery/ControlRecoveryList'));
const LearningList = lazy(() => import('./learning/LearningList'));
const HomeworkList = lazy(() => import('./homework/HomeworkList'));
const EleveChatWorkspace = lazy(() => import('./chat/EleveChatWorkspace'));
const EleveChatIa = lazy(() => import('./chat/EleveChatIa'));
const EleveCoursesList = lazy(() => import('./courses/EleveCoursesList'));
const ExamTrainingHub = lazy(() => import('./training/ExamTrainingHub'));
const DilWorkspace = lazy(() => import('./dil/DilWorkspace'));
const LearnedWorkspace = lazy(() => import('./learned/LearnedWorkspace'));

const TabLoading = () => (
  <div className="flex items-center justify-center p-12 text-slate-400 font-bold text-sm animate-pulse">
    Chargement…
  </div>
);

function GptCorrections({ user }) {
  const [entries, setEntries] = useState([]);
  const [openId, setOpenId] = useState('');

  useEffect(() => {
    if (user?.isVisitorPreview) return;
    const studentId = String(user?._id || user?.id || '').trim();
    if (!studentId) return;
    fetch(`/api/eleve/chat/gpt-feedback?studentId=${encodeURIComponent(studentId)}`)
      .then((response) => response.ok ? response.json() : { entries: [] })
      .then((data) => setEntries((data.entries || []).filter((entry) => String(entry.type || '').toLowerCase() === 'correction')))
      .catch(() => setEntries([]));
  }, [user?._id, user?.id, user?.isVisitorPreview]);

  if (!entries.length) return null;
  return <section className="mx-4 mb-4 rounded-3xl border-2 border-indigo-200 bg-indigo-50 p-4">
    <h2 className="m-0 text-xl font-black text-indigo-900">🤖 Mes corrections GPT</h2>
    <div className="mt-3 space-y-3">{entries.map((entry) => {
      const isOpen = openId === entry.id;
      const isRqp = String(entry.evaluationType || '').toLowerCase() === 'rqp_seconde' || entry.developpement != null || entry.expression != null;
      const noteTotal = isRqp ? 20 : 10;
      return <article key={entry.id} className="overflow-hidden rounded-2xl border border-indigo-200 bg-white">
        <button type="button" onClick={() => setOpenId(isOpen ? '' : entry.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
          <span><strong className="block text-sm text-slate-900">{entry.sujet || 'Correction de ta copie'}</strong><span className="text-xs font-bold text-slate-500">{entry.receivedAt ? new Date(entry.receivedAt).toLocaleDateString('fr-FR') : ''}</span></span>
          <span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-black text-white">{entry.note ?? entry.score ?? '—'}/{noteTotal}</span>
        </button>
        {isOpen && <div className="space-y-5 border-t border-indigo-100 p-4">
          <section><h3 className="text-sm font-black uppercase text-slate-500">Copie originale</h3><div className="mt-2 grid gap-3 md:grid-cols-2">{(entry.images || []).map((image, index) => <a key={`${entry.id}-page-${index}`} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={image.url} alt={`Page ${index + 1} de la copie`} className="block w-full object-contain" /><span className="block p-2 text-center text-xs font-black text-slate-500">Page {index + 1}</span></a>)}</div>{!(entry.images || []).length && <p className="mt-2 text-sm font-bold text-slate-400">Aucune image enregistrée.</p>}</section>
          <section><h3 className="text-sm font-black uppercase text-slate-500">Ta copie telle que l’IA l’a comprise</h3><div className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm font-semibold leading-relaxed text-slate-800">{entry.devoirComplet || 'Transcription non fournie.'}</div></section>
          <section><div className="text-2xl font-black text-indigo-700">{entry.note ?? entry.score ?? '—'}/{noteTotal}</div>{isRqp ? <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-black sm:grid-cols-4"><span>Introduction {entry.introduction ?? '—'}/5</span><span>Développement {entry.developpement ?? '—'}/10</span><span>Conclusion {entry.conclusion ?? '—'}/2</span><span>Expression {entry.expression ?? '—'}/3</span></div> : <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-black sm:grid-cols-5"><span>Forme {entry.forme ?? '—'}/2</span><span>Introduction {entry.introduction ?? '—'}/3</span><span>Arguments {entry.arguments ?? '—'}/2</span><span>Exemples {entry.exemples ?? '—'}/2</span><span>Conclusion {entry.conclusion ?? '—'}/1</span></div>}</section>
          <section><h3 className="text-sm font-black uppercase text-slate-500">Correction</h3><div className="mt-2 whitespace-pre-wrap rounded-xl bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-slate-800">{entry.message || '—'}</div></section>
          <section><h3 className="text-sm font-black uppercase text-slate-500">Conseils</h3><div className="mt-2 whitespace-pre-wrap rounded-xl bg-emerald-50 p-4 text-sm font-semibold leading-relaxed text-emerald-900">{entry.conseils || 'Aucun conseil supplémentaire.'}</div></section>
        </div>}
      </article>;
    })}</div>
  </section>;
}

export default function ElevePage({ user, onLogout, onBackToProf }) {
  // Les élèves DIL arrivent directement sur leur espace de traduction.
  // Les autres profils conservent l'ouverture habituelle sur le statut.
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('control') ? 'exams' : (user?.isDil === true ? 'dil' : 'status'));
  const [pendingActivity, setPendingActivity] = useState(null);
  const [freshUser, setFreshUser] = useState(user);
  const [showPunishmentSplash, setShowPunishmentSplash] = useState(false);
  const [openPunishmentDirect, setOpenPunishmentDirect] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
      if (user?.isVisitorPreview === true) {
          setFreshUser(user);
          return undefined;
      }
      const fetchFreshData = async () => {
          if (typeof document !== 'undefined' && document.hidden) return;
          try {
              const id = user._id || user.id;
              // FIX V99 : Utilisation de la route HERMÉTIQUE ÉLÈVE
              const res = await fetch(`/api/eleve/auth/student-fresh/${id}`);
              if (res.ok) {
                  const data = await res.json();
                  if (data) setFreshUser(prev => ({ ...prev, ...data }));
              }
          } catch (e) { console.error("Sync behavior error", e); }
      };
      fetchFreshData();
      const interval = setInterval(fetchFreshData, 20000);
      const onVisibilityChange = () => {
          if (!document.hidden) fetchFreshData();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => {
          clearInterval(interval);
          document.removeEventListener('visibilitychange', onVisibilityChange);
      };
  }, [user]);

  useEffect(() => {
      const onStarsUpdated = (event) => {
          const trainingStars = Number(event?.detail?.trainingStars);
          if (Number.isFinite(trainingStars)) setFreshUser(prev => ({ ...prev, trainingStars }));
      };
      window.addEventListener(STUDENT_STARS_EVENT, onStarsUpdated);
      return () => window.removeEventListener(STUDENT_STARS_EVENT, onStarsUpdated);
  }, []);

  // L'information DIL peut arriver avec le rafraîchissement du profil après
  // la connexion : on bascule alors une seule fois depuis l'écran d'accueil.
  useEffect(() => {
      if (freshUser?.isDil === true) {
          setTab(currentTab => (currentTab === 'status' ? 'dil' : currentTab));
      }
  }, [freshUser?.isDil]);

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
            <Suspense fallback={<TabLoading />}>
              {tab === 'status' && <><GptCorrections user={freshUser} /><StatusOverview user={freshUser} onOpenActivity={openActivityFromStatus} /></>}
              {tab === 'courses' && <EleveCoursesList user={freshUser} />}
              {tab === 'exams' && (
                <LearnedWorkspace
                  user={freshUser}
                  openItemId={new URLSearchParams(window.location.search).get('control') || ''}
                  onNavigate={(newTab) => setTab(newTab)}
                />
              )}
              {tab === 'controles' && (
                <ControlRecoveryList
                  user={freshUser}
                  pendingActivity={pendingActivity}
                  openPunishmentDirect={openPunishmentDirect}
                  onPunishmentOpened={() => setOpenPunishmentDirect(false)}
                  onActivityHandled={clearPendingIfMatch}
                />
              )}
              {tab === 'francais' && <DilWorkspace user={freshUser} frenchMode />}
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
              {tab === 'chat' && <EleveChatWorkspace user={freshUser} onQuit={() => setTab('status')} />}
              {tab === 'chatia' && <EleveChatIa user={freshUser} />}
              {tab === 'training' && <ExamTrainingHub user={freshUser} canCalibrate={Boolean(onBackToProf) && freshUser?.isVisitorPreview !== true} />}
              {tab === 'dil' && (freshUser?.isDil === true || freshUser?.isVisitorPreview === true) && <DilWorkspace user={freshUser} />}
              {tab === 'jeux' && (
                <GamesGrid
                  user={freshUser}
                  openItemId={pendingActivity?.type === 'game' ? pendingActivity?.id : ''}
                  onOpenHandled={() => clearPendingIfMatch('game')}
                />
              )}
            </Suspense>
          </div>
        </div>
        <BugReportWidget user={freshUser} />
    </div>
  );
}
