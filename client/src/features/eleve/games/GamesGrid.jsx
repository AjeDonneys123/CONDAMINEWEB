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
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    const myId = String(user._id || user.id);
    const myClass = (user.currentClass || "").trim().toUpperCase();
    
    const rawGroups = user.assignedGroups || [];
    const myGroupIds = rawGroups.map(g => (typeof g === 'object' && g !== null) ? String(g._id) : String(g));

    try {
        const [allGames, allProgs, allClasses] = await Promise.all([
            fetch('/api/games/all').then(r => r.json()),
            fetch('/api/games/progress').then(r => r.json()),
            fetch('/api/auth/config').then(r => r.json()).then(d => d.classrooms || [])
        ]);

        const myGroupNames = allClasses
            .filter(c => myGroupIds.includes(String(c._id)))
            .map(c => c.name.toUpperCase().trim());

        const myTargets = [myClass, ...myGroupNames];

        const filtered = allGames.filter(g => {
            const targets = (g.targetClassrooms || (g.classroom ? [g.classroom] : [])).map(t => t.toUpperCase().trim());
            const assignedIds = (g.assignedStudents || []).map(id => String(id));

            if (assignedIds.includes(myId)) return true;

            // Matching robuste (case insensitive, trim)
            const isTargetedGroup = targets.some(t => myTargets.includes(t));
            
            if (isTargetedGroup) {
                if (g.isAllClass === true) return true;
                // Si "AssignedStudents" est vide mais "isAllClass" est false (cas ambigu), on affiche quand même si cible
                if (assignedIds.length === 0) return true;
            }
            return false;
        }).map(g => {
            const prog = allProgs.find(p => String(p.studentId) === myId && String(p.gameId) === String(g._id));
            let status = 'todo'; 
            if (prog) {
                if (prog.levelReached >= 1) status = 'done'; 
                else status = 'inprogress'; 
            }
            return { ...g, status };
        });

        setQuizzes(filtered);
    } catch(e) { console.error("GamesGrid Error:", e); }
    setRefreshing(false);
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

  return (
    <div className="flex flex-col gap-4">
        <div className="flex justify-end">
            <button onClick={loadData} className="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-xl border border-slate-200 hover:text-slate-600 transition-colors">
                {refreshing ? '...' : '🔄 ACTUALISER'}
            </button>
        </div>
        <DashboardFolder items={quizzes} chapters={chapters} type="game" onSelect={setSelectedQuiz} />
    </div>
  );
}