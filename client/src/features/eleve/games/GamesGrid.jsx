import React, { useState, useEffect } from 'react';
import ZombieWrapper from './zombie/ZombieWrapper';
import StarshipWrapper from './starship/StarshipWrapper';
import DashboardFolder from '../components/DashboardFolder';
import './GamesGrid.css';

/**
 * 🎮 GRILLE JEUX ÉLÈVE V205 (STATUS CHECK)
 * Fix : Récupère la progression pour marquer les jeux comme faits.
 */
export default function GamesGrid({ user }) {
  const [quizzes, setQuizzes] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [activeGame, setActiveGame] = useState(null);

  const loadData = async () => {
    const myClass = (user.currentClass || "").toUpperCase().trim();
    const myId = String(user._id || user.id);

    try {
        const [allGames, allProgs] = await Promise.all([
            fetch('/api/games/all').then(r => r.json()),
            fetch('/api/games/progress').then(r => r.json())
        ]);

        // Quels jeux j'ai déjà touchés ?
        const myPlayedGameIds = allProgs
            .filter(p => String(p.studentId) === myId)
            .map(p => String(p.gameId)); // Attention: gameId stocké comme string ou ObjectId ? A vérifier

        const filtered = allGames.filter(q => {
            const qClass = (q.classroom || "").toUpperCase().trim();
            return qClass === myClass;
        }).map(g => ({
            ...g,
            isDone: myPlayedGameIds.includes(String(g._id))
        }));

        setQuizzes(filtered);
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    loadData();
    fetch('/api/structure/chapters').then(r => r.json()).then(setChapters);
  }, [user]);

  if (activeGame && selectedQuiz) {
      const close = () => { 
          setActiveGame(null); 
          setSelectedQuiz(null);
          loadData(); // Recharge pour la pastille
      };
      return activeGame === 'zombie' ? <ZombieWrapper user={user} level={selectedQuiz} onClose={close} /> : <StarshipWrapper user={user} level={selectedQuiz} onClose={close} />;
  }

  if (selectedQuiz) return (
      <div className="game-selector-overlay">
          <div className="selector-card">
              <div className="flex gap-4">
                  <button onClick={() => setActiveGame('zombie')} className="game-choice-btn zombie-btn">🧟 ZOMBIE</button>
                  <button onClick={() => setActiveGame('starship')} className="game-choice-btn starship-btn">🚀 STARSHIP</button>
              </div>
              <button onClick={() => setSelectedQuiz(null)} className="mt-8 font-black text-pink-300 border-none bg-transparent cursor-pointer">RETOUR</button>
          </div>
      </div>
  );

  return <DashboardFolder items={quizzes} chapters={chapters} type="game" onSelect={setSelectedQuiz} />;
}