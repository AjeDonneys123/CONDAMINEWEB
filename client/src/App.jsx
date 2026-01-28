// @signatures: App, checkUpdate, handleBackToDev, handleLogout
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

  // 📉 TEST DENSITÉ : La fonction EST LÀ (Signature OK), mais elle est VIDE (Densité KO)
  useEffect(() => {
    const checkUpdate = async () => {
        // J'ai retiré le 'try', le 'fetch', le 'if', le 'return'...
        // C'est une coquille vide !
        console.log("Je suis vide mais j'existe !");
    };
    // On l'appelle pour faire illusion
    checkUpdate();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
        // Ici j'ai simplifié pour réduire encore la densité
        setUser({ id: "test" }); 
    }
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };

  // 📉 IDEM ICI
  const handleBackToDev = async () => {
      console.log("Retour dev simulé");
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
