import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const bootIdRef = useRef(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/check-deploy');
        const data = await res.json();
        if (!bootIdRef.current) {
          bootIdRef.current = data.bootId;
        } 
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
        const parsed = JSON.parse(saved);
        setUser({ ...parsed, id: parsed._id || parsed.id });
    }
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };
  const isProf = user && (user.id === 'prof' || user.role === 'prof');

  if (isSyncing) return <div className="sync-overlay"><h2>SYNC EN COURS...</h2></div>;

  return (
    <div className="app-wrapper">
      {!user ? <Login onLoginSuccess={setUser} /> : 
       isProf ? <ProfPage user={user} onLogout={handleLogout} /> : 
       <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => setUser({ id: "prof", role: "prof" })} />}
    </div>
  );
}