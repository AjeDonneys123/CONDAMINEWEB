import React, { useState, useEffect } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import ConsoleHUD from './features/prof/components/ConsoleHUD';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [sysStatus, setSysStatus] = useState({ status: 'OK' });
  const [appVersion, setAppVersion] = useState({ version: '1.0.0', build: 0 });

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) setUser(parsed);
      } catch (e) { localStorage.removeItem('player'); }
    }
    
    // Fetch Version
    fetch('/api/app-version')
        .then(r => r.json())
        .then(data => setAppVersion(data))
        .catch(() => {});
  }, []);

  useEffect(() => {
    const check = () => {
        fetch('/api/system-status')
            .then(r => r.ok ? r.json() : {status:'OK'})
            .then(data => setSysStatus(data))
            .catch(() => {});
    };
    const itv = setInterval(check, 5000);
    return () => clearInterval(itv);
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };

  return (
    <div className="app-wrapper">
      {/* VERSION BADGE - TOUT EN HAUT */}
      <div className="version-banner">
          v{appVersion.version} - build {appVersion.build} 🚀
      </div>

      {sysStatus.status === 'TRUNCATED' && (
          <div className="system-alert-bar">⚠️ FICHIER COMPROMIS ({sysStatus.file})</div>
      )}

      {!user ? (
        <Login onLoginSuccess={setUser} />
      ) : (
        (user.id === 'prof' || user.role === 'prof') ? (
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