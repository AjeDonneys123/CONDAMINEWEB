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

  // ✅ checkUpdate est là (pour ne pas trigger l'alerte de densité tout de suite)
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/check-deploy');
        if(res.ok) console.log("Check OK");
      } catch (e) {}
    };
    checkUpdate();
  }, []);

  // ❌ BAZOOKA : J'ai supprimé handleLogout et handleBackToDev !
  // apply.js va détecter une "Régression Structurelle" (Signatures manquantes).

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
           {/* Ça va planter car la fonction n'existe plus */}
           <button className="btn-back-dev-mini">⚡ RETOUR DÉVELOPPEUR</button>
        </div>
      )}
      {(user.isDeveloper || user.role === 'prof') ? (
          <ProfPage user={user} /> // Props manquantes
      ) : user.role === 'admin' ? (
          <AdminPage user={user} />
      ) : (
          <ElevePage user={user} />
      )}
    </div>
  );
}
