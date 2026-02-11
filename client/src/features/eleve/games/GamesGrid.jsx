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
        // FIX MIROIR : On utilise la nouvelle route "Auto-détection"
        const res = await fetch(`/api/eleve/games/studio-mirror`);
        const project = await res.json();
        
        if (project) {
            setStudioGame({
                ...project,
                title: "🎮 " + (project.title || "PROJET STUDIO"),
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
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Zone de Test (Miroir)</h2>
            <button onClick={loadData} className="text-[10px] font-black text-indigo-500 bg-white px-4 py-2 rounded-xl border-2 border-indigo-100 shadow-sm hover:bg-indigo-50 transition-all">
                {loading ? 'SYNC EN COURS...' : '🔄 SYNCHRONISER STUDIO'}
            </button>
        </div>
        
        {studioGame ? (
            <div 
                onClick={() => setSelectedGame(studioGame)}
                className="mx-4 p-8 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[40px] shadow-2xl cursor-pointer hover:scale-[1.02] transition-all border-4 border-white/20 group"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center text-5xl shadow-inner group-hover:scale-110 transition-transform">
                            🧟
                        </div>
                        <div>
                            <div className="text-2xl font-black text-white uppercase tracking-tight">{studioGame.title}</div>
                            <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest mt-1">Moteur V8.3 • Branchement Direct</div>
                        </div>
                    </div>
                    <div className="w-12 h-12 bg-white text-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-2xl font-black">▶</span>
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center p-20 opacity-30 text-center">
                <span className="text-6xl mb-4">📡</span>
                <p className="font-black uppercase text-sm tracking-widest">En attente d'un enregistrement dans le Studio...</p>
                <p className="text-[10px] font-bold mt-2">Cliquez sur Sauver dans le Studio Prof pour envoyer ici.</p>
            </div>
        )}
    </div>
  );
}
