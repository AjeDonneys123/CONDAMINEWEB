import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import ConsoleHUD from './features/prof/components/ConsoleHUD';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [appInfo, setAppInfo] = useState({ version: '...', build: '...', status: 'live' });
  const bootIdRef = useRef(null);

  // --- MONITEUR DE DÉPLOIEMENT ---
  useEffect(() => {
    const monitor = async () => {
      try {
        // 1. Détection de redémarrage (Fin de déploiement)
        const bootRes = await fetch('/api/check-deploy');
        const bootData = await bootRes.json();
        
        if (!bootIdRef.current) {
          bootIdRef.current = bootData.bootId;
        } else if (bootData.bootId !== bootIdRef.current) {
          // Si le bootId change, c'est que Render a switché sur la nouvelle version !
          setIsSyncing(true);
          setTimeout(() => window.location.reload(), 2000);
          return;
        }

        // 2. Récupération du statut (Pulsation bleue)
        const statusRes = await fetch('/api/deploy-status');
        const statusData = await statusRes.json();
        setAppInfo(statusData);

      } catch (e) {
        // Erreur réseau normale pendant le redémarrage du serveur
      }
    };

    const interval = setInterval(monitor, 8000);
    monitor();
    return () => clearInterval(interval);
  }, []);

  // Sync session
  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) setUser(parsed);
      } catch (e) { localStorage.removeItem('player'); }
    }
  }, []);

  if (isSyncing) {
    return (
      <div className="sync-overlay">
        <div className="sync-card">
          <div className="sync-spinner"></div>
          <h2>SYNCHRONISATION...</h2>
          <p>La nouvelle version du site est maintenant disponible !</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => { localStorage.clear(); setUser(null); };
  const isProf = user && (user.id === 'prof' || user.role === 'prof');

  return (
    <div className="app-wrapper">
      {/* BANNIÈRE DE VERSION AVEC INDICATEUR LIVE/DEPLOYING */}
      <div className="version-banner">
          <span className="version-txt">BUILD {appInfo.build} (v{appInfo.version})</span>
          {appInfo.status === 'deploying' && (
              <div className="deploy-indicator">
                  <span className="deploy-dot"></span>
                  DÉPLOIEMENT EN COURS
              </div>
          )}
          {appInfo.status === 'live' && (
              <div className="live-indicator">
                  <span className="live-dot"></span>
                  SYSTÈME LIVE
              </div>
          )}
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