import React, { useState, useEffect } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import ConsoleHUD from './features/prof/components/ConsoleHUD'; // <--- NOUVEAU
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    window.onerror = async (msg, url, line, col, error) => {
        if (!user || user.id !== 'prof') return;
        console.error(`BUG DÉTECTÉ: ${msg}`); // Sera capté par le HUD
        
        await fetch('/api/auto-repair', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                error: msg,
                stack: error?.stack,
                context: `URL: ${url}, Ligne: ${line}`
            })
        });
    };
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed._id)) setUser(parsed);
      } catch (e) { localStorage.removeItem('player'); }
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <div className="app-wrapper">
      {!user ? (
        <Login onLoginSuccess={setUser} />
      ) : (
        user.id === 'prof' ? (
          <>
            <ProfPage user={user} onLogout={handleLogout} />
            <ConsoleHUD /> {/* <--- AFFICHAGE DES ERREURS ICI */}
          </>
        ) : (
          <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => setUser({ id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" })} />
        )
      )}
    </div>
  );
}