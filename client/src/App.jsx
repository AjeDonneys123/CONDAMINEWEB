import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import SystemStatus from './features/prof/components/SystemStatus';
import AutoConsoleBugReporter from './features/shared/AutoConsoleBugReporter';
import './App.css';

// The professor and student applications have large, unrelated editor/game
// trees. Do not fetch both trees when only one role is being used.
const ProfPage = lazy(() => import('./features/prof/ProfPage'));
const ElevePage = lazy(() => import('./features/eleve/ElevePage'));
const ControlRecoveryMobileCapture = lazy(() => import('./features/eleve/controlRecovery/ControlRecoveryMobileCapture'));
const PublicAssessmentControl = lazy(() => import('./features/eleve/controls/PublicAssessmentControl'));
const AppLoading = () => <div className="min-h-screen grid place-items-center bg-slate-50 font-black text-slate-400">CHARGEMENT…</div>;

const VISITOR_LEVELS = ['5e', '3e', '2de'];

function VisitorLevelChooser({ user, onChoose, onLogout }) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-5xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="text-sm font-black uppercase tracking-widest text-emerald-600">Professeur visiteur</div><h1 className="mt-2 text-4xl font-black text-slate-900">Choisissez le niveau à prévisualiser</h1><p className="mt-3 font-bold text-slate-500">Vous verrez exactement l’interface élève de ce niveau, en lecture et sans compte élève réel.</p></div>
          <button type="button" onClick={onLogout} className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white">Quitter</button>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {VISITOR_LEVELS.map((level) => <button key={level} type="button" onClick={() => onChoose(level)} className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 px-5 py-8 text-3xl font-black text-emerald-800 transition hover:-translate-y-1 hover:border-emerald-500 hover:bg-emerald-100">{level}</button>)}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const recoveryMobileToken = String(urlParams.get('recoveryMobile') || '').trim();
  if (recoveryMobileToken) {
    return <Suspense fallback={<AppLoading />}><ControlRecoveryMobileCapture token={recoveryMobileToken} /></Suspense>;
  }

  const publicControlId = String(urlParams.get('control') || '').trim();
  if (publicControlId) {
    return <Suspense fallback={<AppLoading />}><PublicAssessmentControl controlId={publicControlId} /></Suspense>;
  }

  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSessionOverride, setIsSessionOverride] = useState(false);
  const bootIdRef = useRef(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/check-deploy');
        const data = await res.json();
        if (!bootIdRef.current) bootIdRef.current = data.bootId;
        else if (data.bootId !== bootIdRef.current) {
          setIsSyncing(true);
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (e) {}
    };
    // Deployment checks are a safety net, not a live classroom channel.
    // Polling every five seconds across every open device creates needless
    // traffic during a lesson.
    const timer = setInterval(checkUpdate, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const sessionOverrideRaw = sessionStorage.getItem('player_override');
    if (sessionOverrideRaw) {
      try {
        const parsed = JSON.parse(sessionOverrideRaw);
        setUser({ ...parsed, id: parsed._id || parsed.id });
        setIsSessionOverride(true);
        return;
      } catch (e) {
        sessionStorage.removeItem('player_override');
      }
    }
    const saved = localStorage.getItem('player');
    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.isVisitorTeacher === true) {
          fetch('/api/auth/visitor-validate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: parsed.visitorSessionToken || '' })
          }).then((res) => {
            if (!res.ok) throw new Error('Session visiteur invalide');
            setUser({ ...parsed, id: parsed._id || parsed.id });
          }).catch(() => localStorage.removeItem('player'));
          return;
        }
        setUser({ ...parsed, id: parsed._id || parsed.id });
    }
  }, []);

  const handleLogout = () => {
    if (isSessionOverride) {
      sessionStorage.removeItem('player_override');
      setUser(null);
      return;
    }
    localStorage.clear();
    setUser(null);
  };

  const handleBackToDev = async () => {
      try {
          const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ role: 'ADMIN', firstName: 'Jean', lastName: 'Vuillet', password: 'A' })
          });
          const data = await res.json();
          if (res.ok) {
              localStorage.setItem('player', JSON.stringify(data.user));
              window.location.reload();
          }
      } catch(e) { console.error(e); }
  };

  if (isSyncing) return <div className="sync-overlay"><h2 style={{color:'white', fontWeight:900}}>SYNCHRONISATION...</h2></div>;
  
  if (!user) return (
      <div className="app-wrapper">
          <div className="public-home">
              <SystemStatus />
              <section className="public-hero">
                  <div className="public-hero-copy">
                      <p className="public-eyebrow">Plateforme scolaire Condamine</p>
                      <h1>CondaWeb centralise les devoirs, lectures, exposes et jeux pedagogiques.</h1>
                      <p className="public-lead">
                          CondaWeb est la plateforme scolaire utilisee par les eleves et les professeurs pour suivre le travail,
                          consulter les contenus de classe, remettre les devoirs et acceder aux activites pedagogiques.
                      </p>
                      <div className="public-points" aria-label="Fonctionnalites CondaWeb">
                          <span>Devoirs et suivi</span>
                          <span>Lectures et exposes</span>
                          <span>Jeux pedagogiques</span>
                          <span>Espace professeur</span>
                      </div>
                  </div>
                  <div className="public-hero-panel">
                      <Login onLoginSuccess={setUser} />
                  </div>
              </section>
          </div>
      </div>
  );

  const isTestAccount = user.isTestAccount === true;

  if (user.isVisitorTeacher === true && !user.currentClass) {
    return <VisitorLevelChooser user={user} onLogout={handleLogout} onChoose={(level) => {
      const nextUser = { ...user, currentClass: String(level).toUpperCase(), role: 'visitor-prof', isVisitorPreview: true };
      localStorage.setItem('player', JSON.stringify(nextUser));
      setUser(nextUser);
    }} />;
  }

  return (
    <div className="app-wrapper">
      <SystemStatus />
      <AutoConsoleBugReporter user={user} />
      
      {/* BANDEAU DE SÉCURITÉ V99 (Pousse le contenu vers le bas) */}
      {isTestAccount && (
        <div className="v99-test-header">
           <span>🛠️ MODE TEST ACTIF : {user.firstName} {user.lastName}</span>
           <button className="btn-back-dev-mini" onClick={handleBackToDev}>⚡ RETOUR DÉVELOPPEUR</button>
        </div>
      )}

      {/* ROUTAGE PRINCIPAL : PROF OU ÉLÈVE UNIQUEMENT */}
      <Suspense fallback={<AppLoading />}>
        {(user.isDeveloper || user.role === 'prof' || user.role === 'admin') ? (
            <ProfPage user={user} onLogout={handleLogout} />
        ) : (
            <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => {
              if (user.isVisitorTeacher === true) {
                const nextUser = { ...user, currentClass: '' };
                localStorage.setItem('player', JSON.stringify(nextUser));
                setUser(nextUser);
                return;
              }
              setUser({ ...user, role: "prof" });
            }} />
        )}
      </Suspense>
    </div>
  );
}
