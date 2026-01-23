import React, { useState, useEffect } from 'react';
import EleveHeader from './components/EleveHeader';
import HomeworkList from './homework/HomeworkList';
import MistakesBook from './mistakes/MistakesBook';
import GamesGrid from './games/GamesGrid';
// On supprime l'import de BehaviorTimer car il est intégré au header
import './ElevePage.css';

export default function ElevePage({ user, onLogout, onBackToProf }) {
  const [tab, setTab] = useState('devoirs');
  const [freshUser, setFreshUser] = useState(user);

  // On récupère les données fraîches (croix/bonus)
  useEffect(() => {
      const fetchFreshData = async () => {
          try {
              const id = user._id || user.id;
              const res = await fetch(`/api/auth/student-fresh/${id}`);
              if (res.ok) {
                  const data = await res.json();
                  setFreshUser(prev => ({ ...prev, ...data }));
              }
          } catch (e) { console.error("Sync behavior error", e); }
      };
      fetchFreshData();
  }, [user]);

  return (
    <div className="eleve-page-wrapper">
        <div className="eleve-page-container">
          {/* On passe freshUser au header pour afficher les stats */}
          <EleveHeader user={freshUser} onLogout={onLogout} onBackToProf={onBackToProf} activeTab={tab} onTabChange={setTab} />
          
          <div className="mt-8">
            {tab === 'devoirs' && <HomeworkList user={user} />}
            {tab === 'francais' && <MistakesBook user={user} />}
            {tab === 'jeux' && <GamesGrid user={user} />}
          </div>
        </div>
    </div>
  );
}