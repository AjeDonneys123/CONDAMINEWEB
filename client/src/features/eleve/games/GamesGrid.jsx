import React, { useState, useEffect } from 'react';
import ZombieWrapper from './zombie/ZombieWrapper';
import StarshipWrapper from './starship/StarshipWrapper';
import DashboardFolder from '../components/DashboardFolder';

export default function GamesGrid({ user }) {
  const [quizzes, setQuizzes] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    const load = async () => {
        setLoading(true);
        try {
            // CORRECTIF : Synchronisation avec le point d'entrée modulaire /api/games/all
            const [lvlData, chapData] = await Promise.all([
                fetch('/api/games/all').then(r => r.json()),
                fetch('/api/chapters-all').then(r => r.json())
            ]);
            
            const userClass = user.classroom?.toString().trim() || "";
            // US #2 : Isolation
            setQuizzes((lvlData || []).filter(l => l.classroom === 'Toutes' || l.classroom === userClass));
            setChapters((chapData || []).filter(c => c.classroom === userClass));
        } catch (e) { 
            console.error("Erreur GamesGrid:", e); 
        }
        setLoading(false);
    }
    load();
  }, [user.classroom]);

  if (activeGame && selectedQuiz) {
      const close = () => { setActiveGame(null); setSelectedQuiz(null); };
      if (activeGame === 'zombie') return <ZombieWrapper user={user} level={selectedQuiz} onClose={close} />;
      if (activeGame === 'starship') return <StarshipWrapper user={user} level={selectedQuiz} onClose={close} />;
  }

  if (selectedQuiz) {
      return (
          <div className="game-selector-overlay animate-in fade-in">
              <div className="selector-card">
                  <h2 className="text-2xl font-black text-slate-700 mb-6 uppercase text-center">🕹️ {selectedQuiz.title}</h2>
                  <div className="selector-grid">
                      <button onClick={() => setActiveGame('zombie')} className="game-choice-btn zombie-btn">
                          <span className="text-5xl mb-2">🧟</span>
                          <span className="font-black text-lg">ZOMBIE</span>
                      </button>
                      <button onClick={() => setActiveGame('starship')} className="game-choice-btn starship-btn">
                          <span className="text-5xl mb-2">🚀</span>
                          <span className="font-black text-lg">STARSHIP</span>
                      </button>
                  </div>
                  <button onClick={() => setSelectedQuiz(null)} className="mt-8 font-black text-slate-400 hover:text-red-500 transition-colors uppercase text-[10px] tracking-widest">Retour</button>
              </div>
          </div>
      );
  }

  return (
    <div className="animate-in fade-in">
      {loading ? (
        <p className="text-center py-20 font-black text-purple-300 animate-pulse uppercase tracking-widest">Recherche des jeux...</p>
      ) : (
        <DashboardFolder 
          items={quizzes} 
          chapters={chapters} 
          type="game" 
          onSelect={setSelectedQuiz} 
          userClass={user.classroom} 
        />
      )}
    </div>
  );
}