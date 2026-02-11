// @signatures: GamesGrid, loadData
import React, { useState, useEffect } from 'react';
import GamePlayer from './GamePlayer';
import './GamesGrid.css';

export default function GamesGrid({ user }) {
  const [studioGame, setStudioGame] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
        // ON IGNORE LES JEUX PUBLIÉS
        // On va chercher directement le projet du Studio (le dernier travaillé)
        const res = await fetch(`/api/studio/projects/67915ec2da279cba002c38af`); // ID du compte prof par défaut
        const projects = await res.json();
        
        if (projects && projects.length > 0) {
            const p = projects[0];
            setStudioGame({
                ...p,
                title: "🎮 TEST ZOMBI (STUDIO)",
                actType: 'game',
                status: 'todo'
            });
        }
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
    <div className="flex flex-col gap-6 animate-in">
        <div className="flex justify-between items-center px-4">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Zone de Test</h2>
            <button onClick={loadData} className="text-[10px] font-black text-pink-500 bg-white px-4 py-2 rounded-xl border-2 border-pink-100">
                {loading ? 'SYNC...' : '🔄 SYNCHRONISER STUDIO'}
            </button>
        </div>
        
        {studioGame ? (
            <div 
                onClick={() => setSelectedGame(studioGame)}
                className="mx-4 p-8 bg-white border-4 border-indigo-600 rounded-[40px] shadow-xl cursor-pointer hover:scale-[1.02] transition-transform flex items-center justify-between"
            >
                <div className="flex items-center gap-6">
                    <span className="text-5xl">🧟</span>
                    <div>
                        <div className="text-2xl font-black text-slate-900 uppercase">{studioGame.title}</div>
                        <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Moteur V8.3 • Prêt pour le test</div>
                    </div>
                </div>
                <span className="text-3xl text-slate-300">▶</span>
            </div>
        ) : (
            <div className="text-center p-20 opacity-30 font-black uppercase">En attente du Studio...</div>
        )}
    </div>
  );
}
