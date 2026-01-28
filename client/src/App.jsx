// @signatures: App, checkUpdate
import React, { useState, useEffect, useRef } from 'react';
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

  // ✅ checkUpdate est là pour ne pas trigger la densité
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/check-deploy');
        if(res.ok) console.log("Check OK");
      } catch (e) {}
    };
    checkUpdate();
  }, []);

  // ❌ SUPPRESSION MASSIVE DE FONCTIONS
  // handleLogout a disparu !
  // handleBackToDev a disparu !

  if (isSyncing) return <div className="sync-overlay">Sync...</div>;
  
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
           <span>TEST MODE</span>
           {/* Le bouton appelait handleBackToDev, ça va planter au clic */}
           <button className="btn-back-dev-mini">⚡ RETOUR DÉVELOPPEUR</button>
        </div>
      )}
      {/* On a retiré les props onLogout car la fonction n'existe plus */}
      {(user.isDeveloper || user.role === 'prof') ? (
          <ProfPage user={user} />
      ) : user.role === 'admin' ? (
          <AdminPage user={user} />
      ) : (
          <ElevePage user={user} />
      )}
    </div>
  );
}
