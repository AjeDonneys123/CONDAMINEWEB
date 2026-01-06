import React, { useState, useEffect } from 'react';
import ZombieWrapper from './zombie/ZombieWrapper';
import StarshipWrapper from './starship/StarshipWrapper';
import DashboardFolder from '../components/DashboardFolder';
import { api } from '../../../services/api';

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
            const [lvlData, chapData] = await Promise.all([
                api.get('/game-levels/all'),
                fetch('/api/chapters-all').then(r => r.json())
            ]);

            const userClass = user.classroom.toString().trim(); // ex: "5B"
            const userGrade = userClass.substring(0, 2); // ex: "5e" (si le format est 5eB) ou "5"
            
            // FILTRAGE ROBUSTE DES JEUX
            const filteredQuizzes = (lvlData || []).filter(l => {
                const matchClass = l.classroom === 'Toutes' || l.classroom === userClass;
                const matchGrade = l.targetGrade === 'Tous' || userClass.includes(l.targetGrade);
                return matchClass || matchGrade;
            });

            setQuizzes(filteredQuizzes);
            
            // FILTRAGE DES CHAPITRES (doivent appartenir à la classe)
            setChapters((chapData || []).filter(c => c.classroom === userClass));
            
        } catch (e) { console.error(e); }
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
                          <span className="text-4xl mb-2">🧟</span>
                          <span>ZOMBIE</span>
                      </button>
                      <button onClick={() => setActiveGame('starship')} className="game-choice-btn starship-btn">
                          <span className="text-4xl mb-2">🚀</span>
                          <span>STARSHIP</span>
                      </button>
                  </div>
                  <button onClick={() => setSelectedQuiz(null)} className="mt-8 font-black text-slate-400 hover:text-red-500 transition-colors uppercase text-xs tracking-widest">Retour au menu</button>
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