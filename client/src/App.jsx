// @signatures: App, handleBackToDev, handleLogout
import React, { useState, useEffect, useRef } from 'react'; // TEST CRASH FINAL (ID: 999)
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

  // ❌ LOBOTOMIE TOTALE : La fonction est là, mais vide.
  // Le moteur V14 va détecter ça via l'Oracle forcé.
  useEffect(() => {
    // Vide.
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };

  // ❌ FONCTION VIDÉE AUSSI
  const handleBackToDev = async () => {
      console.log("Rien.");
  };

  if (isSyncing) return <div className="sync-overlay">...</div>;
  if (!user) return <div className="app-wrapper"><SystemStatus /><Login onLoginSuccess={setUser} /></div>;

  return (
    <div className="app-wrapper">
      <SystemStatus />
      {(user.isDeveloper || user.role === 'prof') ? <ProfPage user={user} onLogout={handleLogout} /> : (user.role === 'admin' ? <AdminPage user={user} onLogout={handleLogout} /> : <ElevePage user={user} onLogout={handleLogout} />)}
    </div>
  );
}
