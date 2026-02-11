// @signatures: GamesGrid, loadData, handleSelect
import React, { useState, useEffect } from 'react';
import DashboardFolder from '../components/DashboardFolder';
import GamePlayer from './GamePlayer';
import './GamesGrid.css';

export default function GamesGrid({ user }) {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const myId = String(user._id || user.id);
    
    try {
        // FIX V99 : Utilisation des routes HERMÉTIQUES ÉLÈVE
        // On récupère uniquement les jeux qui concernent Julian (via son ID)
        const resGames = await fetch(`/api/eleve/games/list/${myId}`);
        const allGames = await resGames.json();

        // On simplifie pour l'instant : on marque tout à faire
        // (On ajoutera le fetch de progression une fois la route créée)
        const mapped = allGames.map(g => ({
            ...g,
            status: 'todo',
            actType: 'game'
        }));

        setQuizzes(mapped);
    } catch(e) { console.error("GamesGrid Error:", e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

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
        <DashboardFolder items={quizzes} type="game" onSelect={(game) => setSelectedGame(game)} />
    </div>
  );
}
