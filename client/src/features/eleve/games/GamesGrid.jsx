// @signatures: GamesGrid, loadGames, loadSkins, handleSelectActivity, handleStartGame
import React, { useState, useEffect } from 'react';
import GamePlayer from './GamePlayer';
import DashboardFolder from '../components/DashboardFolder';

export default function GamesGrid({ user }) {
  const [activities, setActivities] = useState([]);
  const [skins, setSkins] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showSkinSelector, setShowSkinSelector] = useState(false);
  const [playingGame, setPlayingGame] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
        const sId = user._id || user.id;
        const [actRes, skinRes] = await Promise.all([
            fetch(`/api/eleve/games/list/${sId}`).then(r => r.json()),
            fetch(`/api/eleve/games/skins`).then(r => r.json())
        ]);
        setActivities((actRes || []).map(a => ({ ...a, actType: 'game' })));
        setSkins(skinRes || []);
    } catch(e) { console.error("Load Games Error", e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleSelectActivity = (act) => {
      setSelectedActivity(act);
      setShowSkinSelector(true);
  };

  const handleStartGame = (skin) => {
      // On fusionne les questions de l'activité avec les visuels du skin choisi
      const finalGameData = {
          ...skin,
          levels: selectedActivity.levels || [],
          title: selectedActivity.title
      };
      setPlayingGame(finalGameData);
      setShowSkinSelector(false);
  };

  if (playingGame) {
      return (
          <GamePlayer 
            user={user} 
            gameData={playingGame} 
            onExit={() => { setPlayingGame(null); setSelectedActivity(null); loadData(); }} 
          />
      );
  }

  return (
    <div className="flex flex-col gap-4 animate-in">
        <div className="flex justify-between items-center px-4">
            <h2 className="text-xl font-black text-slate-800 uppercase">Mes Jeux Assignés</h2>
            <button onClick={loadData} className="text-[10px] font-black text-purple-500 bg-white px-3 py-1 rounded-xl border border-purple-100">
                {loading ? '...' : '🔄 ACTUALISER'}
            </button>
        </div>

        {/* Liste des activités (leçons/quiz) */}
        <DashboardFolder items={activities} type="game" onSelect={handleSelectActivity} />

        {/* Overlay de choix de l'univers (Skin) */}
        {showSkinSelector && (
            <div className="fixed inset-0 z-[10000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6">
                <div className="bg-white rounded-[40px] w-full max-w-2xl p-8 shadow-2xl animate-in zoom-in">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase">Choisis ton monde 🌍</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase">Activité : {selectedActivity?.title}</p>
                        </div>
                        <button onClick={() => setShowSkinSelector(false)} className="w-10 h-10 rounded-full bg-slate-100 font-black">✕</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {skins.map(skin => (
                            <div 
                                key={skin._id} 
                                onClick={() => handleStartGame(skin)}
                                className="group relative bg-slate-50 border-4 border-transparent hover:border-purple-500 rounded-3xl p-6 cursor-pointer transition-all hover:scale-[1.02]"
                            >
                                <div className="text-4xl mb-2">🎮</div>
                                <div className="font-black text-slate-700 uppercase text-sm">{skin.title}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-1">CLIQUE POUR ENTRER</div>
                            </div>
                        ))}
                    </div>
                    
                    {skins.length === 0 && (
                        <div className="text-center p-10 text-slate-300 font-bold italic">Aucun univers disponible dans le Studio.</div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}
