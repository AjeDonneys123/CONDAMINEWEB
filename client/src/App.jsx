import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import ConsoleHUD from './features/prof/components/ConsoleHUD';
import './App.css';

/**
 * 🔒 COMPOSANT RACINE (POROSITÉ ZÉRO)
 * US#2 : Isolation Prof/Élève
 * US#13 : Moniteur de déploiement sécurisé
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [appInfo, setAppInfo] = useState({ version: '2.3.5', build: 335, status: 'live' });
  const bootIdRef = useRef(null);

  // 🛡️ Logic de déploiement isolée pour ne pas bloquer l'UI
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/check-deploy');
        if (!res.ok) return;
        const data = await res.json();
        
        if (!bootIdRef.current) {
          bootIdRef.current = data.bootId;
        } else if (data.bootId !== bootIdRef.current) {
          setIsSyncing(true);
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (e) { /* Silencieux : n'impacte pas l'utilisateur */ }
    };

    const timer = setInterval(checkUpdate, 10000);
    return () => clearInterval(timer);
  }, []);

  // Persistance session
  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) setUser(parsed);
      } catch (e) { localStorage.removeItem('player'); }
    }
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };
  const isProf = user && (user.id === 'prof' || user.role === 'prof');

  if (isSyncing) return (
    <div className="sync-overlay">
      <div className="sync-card">
        <div className="sync-spinner"></div>
        <h2>MISE À JOUR BUILD {appInfo.build}</h2>
        <p>Synchronisation avec le serveur...</p>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper">
      <div className="version-banner">
          <span className="version-txt">BUILD {appInfo.build} (v{appInfo.version})</span>
          <div className="live-indicator"><span className="live-dot"></span> LIVE</div>
      </div>

      {!user ? (
        <Login onLoginSuccess={setUser} />
      ) : (
        isProf ? (
          <>
            <ProfPage user={user} onLogout={handleLogout} />
            <ConsoleHUD />
          </>
        ) : (
          <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => setUser({ id: "prof", role: "prof" })} />
        )
      )}
    </div>
  );
}