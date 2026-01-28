// @signatures: App, handleBackToDev, handleLogout
import React, { useState, useRef } from 'react'; // ❌ MANQUE useEffect
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import AdminPage from './features/admin/AdminPage';
import SystemStatus from './features/prof/components/SystemStatus';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const bootIdRef = useRef(null);

  // ❌ CRASH VOLONTAIRE : checkUpdate supprimé

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
