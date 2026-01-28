// @signatures: App, handleLogout
import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import AdminPage from './features/admin/AdminPage';
// SystemStatus est importé mais pas utilisé (Warning linter, mais l'Oracle le verra)
import SystemStatus from './features/prof/components/SystemStatus';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const bootIdRef = useRef(null);

  // ❌ ERREUR 1 : LOBOTOMIE
  // La logique a disparu.
  useEffect(() => {
    // ... vide ...
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
        const parsed = JSON.parse(saved);
        setUser({ ...parsed, id: parsed._id || parsed.id });
    }
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };

  // ❌ ERREUR 2 : SUPPRESSION DE FONCTION
  // handleBackToDev n'est plus là.

  if (isSyncing) return <div className="sync-overlay">...</div>;
  
  if (!user) return (
      <div className="app-wrapper">
          {/* ❌ ERREUR 3 : HUD DE SÉCURITÉ SUPPRIMÉ ICI */}
          <Login onLoginSuccess={setUser} />
      </div>
  );

  const isTestAccount = user.isTestAccount === true;

  return (
    <div className="app-wrapper">
      {/* ❌ ERREUR 3 BIS : HUD DE SÉCURITÉ SUPPRIMÉ AUSSI ICI */}
      
      {isTestAccount && (
        <div className="v99-test-header">
           <span>TEST MODE</span>
           {/* Ce bouton va crasher l'app car la fonction n'existe plus */}
           <button className="btn-back-dev-mini" onClick={() => console.log("Crash évité de justesse")}>⚡ RETOUR</button>
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
