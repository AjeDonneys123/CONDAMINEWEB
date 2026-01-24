import React, { useState, useEffect } from 'react';
import EleveHeader from './components/EleveHeader';
import HomeworkList from './homework/HomeworkList';
import MistakesBook from './mistakes/MistakesBook';
import GamesGrid from './games/GamesGrid';
import './ElevePage.css';

export default function ElevePage({ user, onLogout, onBackToProf }) {
  const [tab, setTab] = useState('devoirs');
  const [freshUser, setFreshUser] = useState(user);

  // On récupère les données fraîches (croix/bonus/punitions)
  useEffect(() => {
      const fetchFreshData = async () => {
          try {
              const id = user._id || user.id;
              const res = await fetch(`/api/auth/student-fresh/${id}`);
              if (res.ok) {
                  const data = await res.json();
                  // On fusionne pour garder les infos de base (role, etc.)
                  setFreshUser(prev => ({ ...prev, ...data }));
              }
          } catch (e) { console.error("Sync behavior error", e); }
      };
      fetchFreshData();
      // Polling léger pour garder synchro si le prof met une croix en direct
      const interval = setInterval(fetchFreshData, 10000);
      return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="eleve-page-wrapper">
        <div className="eleve-page-container">
          {/* On passe freshUser partout pour avoir les états à jour */}
          <EleveHeader user={freshUser} onLogout={onLogout} onBackToProf={onBackToProf} activeTab={tab} onTabChange={setTab} />
          
          <div className="mt-8">
            {/* CORRECTION V222 : On passe freshUser à HomeworkList pour qu'il connaisse le statut Puni */}
            {tab === 'devoirs' && <HomeworkList user={freshUser} />}
            {tab === 'francais' && <MistakesBook user={freshUser} />}
            {tab === 'jeux' && <GamesGrid user={freshUser} />}
          </div>
        </div>
    </div>
  );
}