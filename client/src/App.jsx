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

  // --- SURVEILLANCE DU DÉPLOIEMENT ---
  useEffect(() => {
    const monitor = async () => {
      try {
        // 1. Vérifier si le serveur a redémarré (Fin de déploiement)
        const bootRes = await fetch('/api/check-deploy');
        const bootData = await bootRes.json();
        
        if (!bootIdRef.current) {
          bootIdRef.current = bootData.bootId;
        } else if (bootData.bootId !== bootIdRef.current) {
          setIsSyncing(true);
          setTimeout(() => window.location.reload(), 2000);
          return;
        }

        // 2. Vérifier si un déploiement est en cours (Signal BDD)
        const statusRes = await fetch('/api/deploy-status');
        const statusData = await statusRes.json();
        setAppInfo(statusData);

      } catch (e) {
        // Erreur réseau attendue pendant le swap Render
      }
    };

    const interval = setInterval(monitor, 8000); // Check toutes les 8s
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
          <h2>MISE À JOUR LIVE</h2>
          <p>Le serveur a redémarré avec une nouvelle version.</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => { localStorage.clear(); setUser(null); };
  const isProf = user && (user.id === 'prof' || user.role === 'prof');

  return (
    <div className="app-wrapper">
      {/* BANNIÈRE DE VERSION AVEC INDICATEUR DE DÉPLOIEMENT */}
      <div className="version-banner">
          <span className="version-txt">BUILD {appInfo.build} (v{appInfo.version})</span>
          {appInfo.status === 'deploying' && (
              <div className="deploy-indicator">
                  <span className="deploy-dot"></span>
                  DÉPLOIEMENT EN COURS
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