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

  // --- 1. SYSTÈME DE SYNC ---
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

  // --- 2. RESTAURATION SESSION ---
  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
        const parsed = JSON.parse(saved);
        setUser({ ...parsed, id: parsed._id || parsed.id });
    }
  }, []);

  // --- 3. FONCTIONS ---
  const handleLogout = () => { localStorage.clear(); setUser(null); };

  // BACKDOOR : Retour Rapide vers Jean (Dev)
  const handleBackToDev = async () => {
      try {
          const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ 
                  role: 'ADMIN', 
                  firstName: 'Jean', 
                  lastName: 'Vuillet', 
                  password: 'A' // Le MDP "A" est autorisé pour Jean dans auth.expert.js
              })
          });
          const data = await res.json();
          if (res.ok) {
              localStorage.setItem('player', JSON.stringify(data.user));
              window.location.reload();
          } else {
              alert("Erreur retour Dev");
          }
      } catch(e) { console.error(e); }
  };

  // --- 4. ROUTAGE ---
  if (isSyncing) return <div className="sync-overlay"><h2 style={{color:'white', fontWeight:900}}>SYNC EN COURS...</h2></div>;

  if (!user) return <div className="app-wrapper"><Login onLoginSuccess={setUser} /></div>;

  // Est-ce un compte de test ? (Nom de famille "Test")
  const isTestAccount = user.lastName === 'Test';

  // ROUTAGE INTELLIGENT
  // 1. Si Admin Pur (et pas Dev) -> Page Admin
  if (user.isAdmin && !user.isDeveloper) {
      return (
          <div className="app-wrapper">
              <AdminPage user={user} onLogout={handleLogout} />
              {isTestAccount && <button className="btn-back-dev" onClick={handleBackToDev}>⚡ RETOUR DEV</button>}
          </div>
      );
  }

  // 2. Si Prof ou Dev (Jean) -> Page Prof (qui inclut Admin si Dev)
  const isProfOrDev = (user.role === 'prof' || user.isDeveloper);
  if (isProfOrDev) {
      return (
          <div className="app-wrapper">
              <ProfPage user={user} onLogout={handleLogout} />
              {isTestAccount && <button className="btn-back-dev" onClick={handleBackToDev}>⚡ RETOUR DEV</button>}
          </div>
      );
  }

  // 3. Sinon -> Page Élève
  return (
    <div className="app-wrapper">
      <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => setUser({ id: "prof", role: "prof" })} />
      {isTestAccount && <button className="btn-back-dev" onClick={handleBackToDev}>⚡ RETOUR DEV</button>}
    </div>
  );
}