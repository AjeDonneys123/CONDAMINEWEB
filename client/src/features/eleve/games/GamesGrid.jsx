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
    if (!user) return;
    setLoading(true);
    const myId = user._id || user.id;
    
    try {
        const resGames = await fetch(`/api/eleve/games/list/${myId}`);
        const allGames = await resGames.json();

        // On marque les jeux comme "JEU" pour l'affichage des badges
        const mapped = allGames.map(g => ({
            ...g,
            status: g.status || 'todo', 
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
    <div className="flex flex-col gap-4 animate-in">
        <div className="flex justify-between items-center px-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {loading ? 'Recherche...' : `${quizzes.length} Jeux pour vous`}
            </span>
            <button onClick={loadData} className="text-[10px] font-black text-pink-500 bg-white px-4 py-2 rounded-xl border-2 border-pink-100 hover:bg-pink-50 transition-all shadow-sm">
                {loading ? '...' : '🔄 ACTUALISER'}
            </button>
        </div>
        
        {quizzes.length > 0 ? (
            <DashboardFolder items={quizzes} type="game" onSelect={(game) => setSelectedGame(game)} />
        ) : (
            <div className="flex flex-col items-center justify-center p-20 bg-white/50 rounded-[40px] border-2 border-dashed border-slate-200">
                <span className="text-5xl mb-4">🏜️</span>
                <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Aucun jeu n'a été distribué à la classe {user.currentClass}</p>
            </div>
        )}
    </div>
  );
}
