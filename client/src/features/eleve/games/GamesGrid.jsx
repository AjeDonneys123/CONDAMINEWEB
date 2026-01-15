import React, { useState, useEffect } from 'react';
import ZombieWrapper from './zombie/ZombieWrapper';
import StarshipWrapper from './starship/StarshipWrapper';
import DashboardFolder from '../components/DashboardFolder';
import './GamesGrid.css';

export default function GamesGrid({ user }) {
  const [quizzes, setQuizzes] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    fetch('/api/games/all').then(r => r.json()).then(setQuizzes);
    fetch('/api/structure/chapters').then(r => r.json()).then(setChapters);
  }, []);

  if (activeGame && selectedQuiz) {
      const close = () => { setActiveGame(null); setSelectedQuiz(null); };
      return activeGame === 'zombie' ? <ZombieWrapper user={user} level={selectedQuiz} onClose={close} /> : <StarshipWrapper user={user} level={selectedQuiz} onClose={close} />;
  }

  if (selectedQuiz) return (
      <div className="game-selector-overlay">
          <div className="selector-card">
              <div className="flex gap-4">
                  <button onClick={() => setActiveGame('zombie')} className="game-choice-btn zombie-btn">🧟 ZOMBIE</button>
                  <button onClick={() => setActiveGame('starship')} className="game-choice-btn starship-btn">🚀 STARSHIP</button>
              </div>
              <button onClick={() => setSelectedQuiz(null)} className="mt-8 font-black text-pink-300">RETOUR</button>
          </div>
      </div>
  );

  return <DashboardFolder items={quizzes} chapters={chapters} type="game" onSelect={setSelectedQuiz} />;
}