import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import AdminPage from './features/admin/AdminPage';
import './App.css';

/**
 * 🚀 APPLICATION CONDAMINE PRO - VERSION 55
 * Gestion du routage intelligent et de la backdoor développeur pour les tests.
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const bootIdRef = useRef(null);

  // --- 1. SYSTÈME DE SYNC (Auto-reload lors du déploiement) ---
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
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (e) {}
    };
    const timer = setInterval(checkUpdate, 5000);
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

  // BACKDOOR V55 : Retour Rapide vers Jean (Architecte)
  const handleBackToDev = async () => {
      try {
          const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ 
                  role: 'ADMIN', 
                  firstName: 'Jean', 
                  lastName: 'Vuillet', 
                  password: 'A' 
              })
          });
          const data = await res.json();
          if (res.ok) {
              localStorage.setItem('player', JSON.stringify(data.user));
              window.location.reload();
          } else {
              alert("Erreur retour : " + data.message);
          }
      } catch(e) { console.error(e); }
  };

  // --- 4. ROUTAGE ---
  if (isSyncing) return <div className="sync-overlay"><h2 style={{color:'white', fontWeight:900}}>SYNCHRONISATION...</h2></div>;

  if (!user) return <div className="app-wrapper"><Login onLoginSuccess={setUser} /></div>;

  // Détection des comptes de test (V55)
  const isTestAccount = user.isTestAccount === true || user.lastName === 'Test';

  // LOGIQUE DE ROUTAGE PAR RÔLE
  
  // A. SI DÉVELOPPEUR OU PROF -> Interface Prof (qui contient les outils de dév)
  if (user.isDeveloper || user.role === 'prof') {
      return (
          <div className="app-wrapper">
              <ProfPage user={user} onLogout={handleLogout} />
              {isTestAccount && <button className="btn-back-dev" onClick={handleBackToDev}>⚡ RETOUR JEAN</button>}
          </div>
      );
  }

  // B. SI ADMIN STAFF (Non développeur) -> Page Admin pure
  if (user.role === 'admin') {
      return (
          <div className="app-wrapper">
              <AdminPage user={user} onLogout={handleLogout} />
              {isTestAccount && <button className="btn-back-dev" onClick={handleBackToDev}>⚡ RETOUR JEAN</button>}
          </div>
      );
  }

  // C. SINON -> Interface Élève
  return (
    <div className="app-wrapper">
      <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => setUser({ ...user, role: "prof" })} />
      
      {/* BOUTON RETOUR : Vital pour sortir d'un élève test et revenir en mode Dév */}
      {isTestAccount && (
          <button className="btn-back-dev" onClick={handleBackToDev}>
              ⚡ RETOUR DÉVELOPPEUR
          </button>
      )}
    </div>
  );
}