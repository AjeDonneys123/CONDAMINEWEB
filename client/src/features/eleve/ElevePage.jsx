import React, { useState } from 'react';
import EleveHeader from './components/EleveHeader';
import HomeworkList from './homework/HomeworkList';
import MistakesBook from './mistakes/MistakesBook';
import GamesGrid from './games/GamesGrid';

export default function ElevePage({ user, onLogout, onBackToProf, onOpenBug }) {
  const [tab, setTab] = useState('devoirs');

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <EleveHeader 
        user={user} 
        onLogout={onLogout} 
        onBackToProf={onBackToProf} 
        onOpenBug={onOpenBug}
        activeTab={tab} 
        onTabChange={setTab} 
      />
      
      <div className="mt-8">
        {tab === 'devoirs' && <HomeworkList user={user} />}
        {tab === 'francais' && <MistakesBook user={user} />}
        {tab === 'jeux' && <GamesGrid user={user} />}
      </div>
    </div>
  );
}