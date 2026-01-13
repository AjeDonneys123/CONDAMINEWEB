import React, { useState, useEffect } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import ConsoleHUD from './features/prof/components/ConsoleHUD';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [sysStatus, setSysStatus] = useState({ status: 'OK' });

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) setUser(parsed);
      } catch (e) { localStorage.removeItem('player'); }
    }
  }, []);

  useEffect(() => {
    const check = () => {
        fetch('/api/system-status')
            .then(r => r.ok ? r.json() : {status:'OK'})
            .then(data => setSysStatus(data))
            .catch(() => {});
    };
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };
  const isProf = user && (user.id === 'prof' || user.role === 'prof');

  return (
    <div className="app-wrapper">
      {sysStatus.status === 'TRUNCATED' && (
          <div className="system-alert-bar">⚠️ ATTENTION : FICHIER COMPROMIS ({sysStatus.file})</div>
      )}

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