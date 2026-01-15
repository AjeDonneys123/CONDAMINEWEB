import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import ConsoleHUD from './features/prof/components/ConsoleHUD';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [appInfo, setAppInfo] = useState({ version: '2.2.1', build: 321, status: 'live' });
  const bootIdRef = useRef(null);

  useEffect(() => {
    const monitor = async () => {
      try {
        const bootRes = await fetch('/api/check-deploy');
        const bootData = await bootRes.json();
        if (!bootIdRef.current) bootIdRef.current = bootData.bootId;
        else if (bootData.bootId !== bootIdRef.current) {
          setIsSyncing(true);
          setTimeout(() => window.location.reload(), 2000);
          return;
        }
        const statusRes = await fetch('/api/deploy-status');
        const statusData = await statusRes.json();
        setAppInfo(statusData);
      } catch (e) {}
    };
    const interval = setInterval(monitor, 8000);
    monitor();
    return () => clearInterval(interval);
  }, []);

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

  if (isSyncing) return <div className="sync-overlay"><div className="sync-card"><h2>SYNCHRONISATION BUILD {appInfo.build}...</h2></div></div>;

  return (
    <div className="app-wrapper">
      <div className="version-banner">
          <span className="version-txt">BUILD {appInfo.build} (v{appInfo.version})</span>
          <div className="live-indicator"><span className="live-dot"></span> LIVE</div>
      </div>
      {!user ? <Login onLoginSuccess={setUser} /> : 
       isProf ? <><ProfPage user={user} onLogout={handleLogout} /><ConsoleHUD /></> : 
       <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => setUser({ id: "prof", role: "prof" })} />}
    </div>
  );
}