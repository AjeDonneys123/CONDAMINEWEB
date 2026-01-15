import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import ConsoleHUD from './features/prof/components/ConsoleHUD';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  // ALIGNEMENT BUILD #133
  const [appInfo, setAppInfo] = useState({ version: '2.6.3', build: 133, status: 'live' });
  const bootIdRef = useRef(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/check-deploy');
        const data = await res.json();
        if (!bootIdRef.current) bootIdRef.current = data.bootId;
        else if (data.bootId !== bootIdRef.current) {
          setIsSyncing(true);
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (e) {}
    };
    const timer = setInterval(checkUpdate, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          if (!parsed.id && parsed._id) parsed.id = parsed._id.toString();
          setUser(parsed);
        }
      } catch (e) { localStorage.removeItem('player'); }
    }
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };
  const isProf = user && (user.id === 'prof' || user.role === 'prof');

  if (isSyncing) return <div className="sync-overlay"><div className="sync-card"><h2>SYNCHRONISATION...</h2><p>Mise à jour vers Build {appInfo.build}</p></div></div>;

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