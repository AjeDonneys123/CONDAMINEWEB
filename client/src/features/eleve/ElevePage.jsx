import React, { useState } from 'react';
import EleveHeader from './components/EleveHeader';
import HomeworkList from './homework/HomeworkList';
import MistakesBook from './mistakes/MistakesBook';
import GamesGrid from './games/GamesGrid';
import ProductionsList from './productions/ProductionsList';
import './ElevePage.css';

export default function ElevePage({ user, onLogout, onBackToProf }) {
  const [tab, setTab] = useState('devoirs');
  return (
    <div className="eleve-page-wrapper">
        <div className="eleve-page-container">
          <EleveHeader user={user} onLogout={onLogout} onBackToProf={onBackToProf} activeTab={tab} onTabChange={setTab} />
          <div className="mt-8">
            {tab === 'devoirs' && <HomeworkList user={user} />}
            {tab === 'francais' && <MistakesBook user={user} />}
            {tab === 'jeux' && <GamesGrid user={user} />}
          </div>
        </div>
    </div>
  );
}