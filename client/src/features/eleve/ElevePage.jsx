// @signatures: ElevePage, fetchFreshData
import React, { useState, useEffect } from 'react';
import EleveHeader from './components/EleveHeader';
import HomeworkList from './homework/HomeworkList';
import MistakesBook from './mistakes/MistakesBook';
import GamesGrid from './games/GamesGrid';
import StatusOverview from './status/StatusOverview';
import './ElevePage.css';

export default function ElevePage({ user, onLogout, onBackToProf }) {
  const [tab, setTab] = useState('status');
  const [freshUser, setFreshUser] = useState(user);

  useEffect(() => {
      const fetchFreshData = async () => {
          try {
              const id = user._id || user.id;
              // FIX V99 : Utilisation de la route HERMÉTIQUE ÉLÈVE
              const res = await fetch(`/api/eleve/auth/student-fresh/${id}`);
              if (res.ok) {
                  const data = await res.json();
                  setFreshUser(prev => ({ ...prev, ...data }));
              }
          } catch (e) { console.error("Sync behavior error", e); }
      };
      fetchFreshData();
      const interval = setInterval(fetchFreshData, 15000);
      return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="eleve-page-wrapper">
        <div className="eleve-page-container">
          <EleveHeader user={freshUser} onLogout={onLogout} onBackToProf={onBackToProf} activeTab={tab} onTabChange={setTab} />
          <div className="mt-8">
            {tab === 'status' && <StatusOverview user={freshUser} />}
            {tab === 'devoirs' && <HomeworkList user={freshUser} />}
            {tab === 'francais' && <MistakesBook user={freshUser} />}
            {tab === 'jeux' && <GamesGrid user={freshUser} />}
          </div>
        </div>
    </div>
  );
}
