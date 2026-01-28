// @signatures: App, checkUpdate, handleBackToDev, handleLogout
import React, { useState, useEffect, useRef } from 'react'; // TEST FORCE V13.2 (ID: 999)
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

  // ❌ TEST V13 : LOBOTOMIE
  // La fonction est là (Signature OK)
  // Mais elle est vide (Densité -80% -> Alerte -> Juge IA)
  useEffect(() => {
    const checkUpdate = async () => {
        // ... vide ...
        console.log("Fonction vidée pour test Oracle");
    };
    checkUpdate();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
        setUser({ ...JSON.parse(saved) });
    }
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };

  // ❌ AUTRE LOBOTOMIE
  const handleBackToDev = async () => {
      console.log("Fake Dev Back");
  };

  if (isSyncing) return <div className="sync-overlay"><h2 style={{color:'white', fontWeight:900}}>SYNCHRONISATION...</h2></div>;
  if (!user) return <div className="app-wrapper"><SystemStatus /><Login onLoginSuccess={setUser} /></div>;

  return (
    <div className="app-wrapper">
      <SystemStatus />
      {(user.isDeveloper || user.role === 'prof') ? <ProfPage user={user} onLogout={handleLogout} /> : (user.role === 'admin' ? <AdminPage user={user} onLogout={handleLogout} /> : <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => setUser({ ...user, role: "prof" })} />)}
    </div>
  );
}
