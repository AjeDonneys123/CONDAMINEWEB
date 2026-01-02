import React, { useState, useEffect } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import './App.css'; 

export default function App() {
  const [user, setUser] = useState(null);

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

  const handleBackToProf = () => {
    const prof = { id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" };
    localStorage.setItem('player', JSON.stringify(prof));
    setUser(prof);
  };

  if (!user) return <Login onLoginSuccess={setUser} />;

  return (
    <div className="app-main-container">
      {user.id === 'prof' ? (
        <ProfPage user={user} onLogout={handleLogout} />
      ) : (
        <ElevePage 
          user={user} 
          onLogout={handleLogout} 
          onBackToProf={handleBackToProf} 
        />
      )}
    </div>
  );
}