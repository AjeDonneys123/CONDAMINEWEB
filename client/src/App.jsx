// @signatures: App, checkUpdate, handleBackToDev, handleLogout
import React, { useState, useEffect, useRef } from 'react'; // useRef est importé mais pas utilisé correctement
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import AdminPage from './features/admin/AdminPage';
import SystemStatus from './features/prof/components/SystemStatus';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  // ❌ OUBLI 1 : isSyncing n'est plus déclaré
  // ❌ OUBLI 2 : bootIdRef n'est plus déclaré

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/check-deploy');
        const data = await res.json();
        
        // ❌ BUG : Utilisation de bootIdRef qui n'existe pas dans le scope
        if (!bootIdRef.current) bootIdRef.current = data.bootId;
        else if (data.bootId !== bootIdRef.current) {
           // ❌ BUG : Utilisation de setIsSyncing qui n'existe pas
           setIsSyncing(true);
           setTimeout(() => window.location.reload(), 1000);
        }
      } catch (e) {}
    };
    const timer = setInterval(checkUpdate, 5000);
    return () => clearInterval(timer);
  }, []); // bootIdRef manquant dans les dépendances aussi

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
          // ❌ ERREUR 3 : URL imaginaire
          const res = await fetch('/api/auth/LOGIN_V2_BETA', {
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

  // ❌ BUG : isSyncing est undefined ici -> Crash immédiat de l'interface
  if (isSyncing) return <div className="sync-overlay"><h2 style={{color:'white', fontWeight:900}}>SYNCHRONISATION...</h2></div>;
  
  if (!user) return (
      <div className="app-wrapper">
          <SystemStatus />
          <Login onLoginSuccess={setUser} />
      </div>
  );

  const isTestAccount = user.isTestAccount === true;

  return (
    <div className="app-wrapper">
      <SystemStatus />
      {isTestAccount && (
        <div className="v99-test-header">
           <span>🛠️ MODE TEST ACTIF : {user.firstName} {user.lastName}</span>
           <button className="btn-back-dev-mini" onClick={handleBackToDev}>⚡ RETOUR DÉVELOPPEUR</button>
        </div>
      )}
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
