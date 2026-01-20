import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import AdminPage from './features/admin/AdminPage';
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
        if (!bootIdRef.current) bootIdRef.current = data.bootId;
        else if (data.bootId !== bootIdRef.current) {
          setIsSyncing(true);
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (e) {}
    };
    const timer = setInterval(checkUpdate, 5000);
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
  if (!user) return <div className="app-wrapper"><Login onLoginSuccess={setUser} /></div>;

  const isTestAccount = user.isTestAccount === true;

  return (
    <div className="app-wrapper">
      {/* BANDEAU DE SÉCURITÉ V99 (Pousse le contenu vers le bas) */}
      {isTestAccount && (
        <div className="v99-test-header">
           <span>🛠️ MODE TEST ACTIF : {user.firstName} {user.lastName}</span>
           <button className="btn-back-dev-mini" onClick={handleBackToDev}>⚡ RETOUR DÉVELOPPEUR</button>
        </div>
      )}

      {/* ROUTAGE PRINCIPAL */}
      {(user.isDeveloper || user.role === 'prof') ? (
          <ProfPage user={user} onLogout={handleLogout} />
      ) : user.role === 'admin' ? (
          <AdminPage user={user} onLogout={handleLogout} />
      ) : (
          <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => setUser({ ...user, role: "prof" })} />
      )}
    </div>
  );
}