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

  const loadData = async () => {
    const myClass = (user.currentClass || "").trim().toUpperCase();
    const myId = String(user._id || user.id);

    try {
        const [allGames, allProgs] = await Promise.all([
            fetch('/api/games/all').then(r => r.json()),
            fetch('/api/games/progress').then(r => r.json())
        ]);

        // On filtre les jeux qui concernent l'élève
        const filtered = allGames.filter(g => {
            const targets = g.targetClassrooms || (g.classroom ? [g.classroom] : []);
            const assignedIds = g.assignedStudents || [];

            const isMyClassTargeted = targets.some(t => t.trim().toUpperCase() === myClass);
            const isAssignedIndividually = assignedIds.some(id => String(id) === myId);
            
            if (isAssignedIndividually) return true;
            if (isMyClassTargeted) {
                if (g.isAllClass === true) return true;
                if (g.isAllClass === undefined && assignedIds.length === 0) return true; 
            }
            return false;
        }).map(g => {
            // CALCUL DU STATUT (3 ÉTATS)
            const prog = allProgs.find(p => String(p.studentId) === myId && String(p.gameId) === String(g._id));
            
            let status = 'todo'; // Par défaut : À FAIRE (Rouge)
            if (prog) {
                if (prog.levelReached >= 1) status = 'done'; // FAIT (Vert/Violet)
                else status = 'inprogress'; // EN COURS / RATÉ (Bleu)
            }

            return { ...g, status };
        });

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
          loadData(); 
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