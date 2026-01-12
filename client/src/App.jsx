import React, { useState, useEffect } from 'react';
import Login from './features/auth/Login';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
import ConsoleHUD from './features/prof/components/ConsoleHUD';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [sysStatus, setSysStatus] = useState({ status: 'OK' });

  // Reset function qui appelle le serveur
  const handleAckError = async () => {
      await navigator.clipboard.writeText(`⚡_FIX_REQ_⚡ Le fichier ${sysStatus.file} est incomplet. Peux-tu me le renvoyer en entier s'il te plait ?`);
      await fetch('/api/reset-status', { method: 'POST' });
      setSysStatus({ status: 'OK' });
  };

  useEffect(() => {
    window.onerror = async (msg, url, line, col, error) => {
        if (!user || user.role !== 'prof') return; // Seul le prof voit les logs
        console.error(`BUG DÉTECTÉ: ${msg}`);
        await fetch('/api/auto-repair', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ error: msg, stack: error?.stack, context: `URL: ${url}, Ligne: ${line}` })
        });
    };
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
        fetch('/api/system-status')
            .then(r => r.json())
            .then(data => setSysStatus(data))
            .catch(() => {});
    }, 1000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed._id)) setUser(parsed);
      } catch (e) { localStorage.removeItem('player'); }
    }
  }, []);

  const handleLogout = () => { localStorage.clear(); setUser(null); };

  // CORRECTION ICI : On vérifie le ROLE ou l'ID spécial
  const isProf = user && (user.id === 'prof' || user.role === 'prof');

  return (
    <div className="app-wrapper">
      {sysStatus.status === 'TRUNCATED' && (
          <div className="system-alert-bar">
              <span>⚠️ ALERTE : Le fichier <u>{sysStatus.file}</u> a été coupé !</span>
              <button className="system-alert-btn" onClick={handleAckError}>
                COPIER & ACQUITTER
              </button>
          </div>
      )}

      {!user ? (
        <Login onLoginSuccess={setUser} />
      ) : (
        isProf ? (
          <>
            <ProfPage user={user} onLogout={handleLogout} />
            <ConsoleHUD />
          </>
        ) : (
          <ElevePage user={user} onLogout={handleLogout} onBackToProf={() => setUser({ id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur", role: "prof" })} />
        )
      )}
    </div>
  );
}