// @signatures: GamesGrid, loadData, handleSelect
import React, { useState, useEffect } from 'react';
import DashboardFolder from '../components/DashboardFolder';
import GamePlayer from './GamePlayer'; // Le nouveau moteur universel
import './GamesGrid.css';

export default function GamesGrid({ user }) {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const myId = String(user._id || user.id);
    const myClass = (user.currentClass || "").trim().toUpperCase();
    
    try {
        // 1. Récupérer tous les jeux et les progressions
        const [allGames, allProgs] = await Promise.all([
            fetch('/api/games/all').then(r => r.json()),
            fetch('/api/games/progress').then(r => r.json())
        ]);

        // 2. FILTRAGE INTELLIGENT (V8.5)
        const filtered = allGames.filter(g => {
            const targets = (g.targetClassrooms || []).map(t => t.toUpperCase().trim());
            const assignedIds = (g.assignedStudents || []).map(id => String(id));

            // Julian voit le jeu si :
            // - Il est assigné individuellement
            // - OU sa classe (6D) est visée ET c'est pour toute la classe
            const isTargeted = targets.includes(myClass);
            const isIndividual = assignedIds.includes(myId);

            return isIndividual || (isTargeted && g.isAllClass);
        }).map(g => {
            const prog = allProgs.find(p => String(p.studentId) === myId && String(p.gameId) === String(g._id));
            return { 
                ...g, 
                status: (prog && prog.levelReached >= 1) ? 'done' : 'todo',
                actType: 'game' // Pour DashboardFolder
            };
        });

        setQuizzes(filtered);
    } catch(e) { console.error("GamesGrid Error:", e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  // Si un jeu est sélectionné, on lance le MOTEUR UNIVERSEL
  if (selectedGame) {
      return (
          <GamePlayer 
            user={user} 
            gameData={selectedGame} 
            onExit={() => { setSelectedGame(null); loadData(); }} 
          />
      );
  }

  return (
    <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center px-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {loading ? 'Recherche de défis...' : `${quizzes.length} Jeux disponibles`}
            </span>
            <button onClick={loadData} className="text-[10px] font-black text-pink-500 bg-white px-3 py-1 rounded-xl border border-pink-100 hover:bg-pink-50 transition-colors">
                🔄 ACTUALISER
            </button>
        </div>
        
        <DashboardFolder 
            items={quizzes} 
            type="game" 
            onSelect={(game) => setSelectedGame(game)} 
        />
    </div>
  );
}
