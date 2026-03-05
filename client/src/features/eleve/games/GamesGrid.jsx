// @signatures: GamesGrid, loadData, handleSelectActivity, handleStartGame
import React, { useState, useEffect } from 'react';
import GamePlayer from './GamePlayer';
import DashboardFolder from '../components/DashboardFolder';

/**
 * 🎮 GRILLE ÉLÈVE FUSIONNÉE V2
 * REPAIRS:
 * - Fixed fallback levels check (length > 0).
 * - Correctly passing generatedCode for univers choice.
 */
export default function GamesGrid({ user, openItemId = '', onOpenHandled }) {
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
            fetch(`/api/eleve/games/skins?studentId=${sId}`).then(r => r.json())
        ]);
        
        setActivities((actRes || []).map(a => ({ ...a, actType: 'game' })));
        setSkins(skinRes || []);
    } catch(e) { console.error("Load Games Error", e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  useEffect(() => {
      const targetId = String(openItemId || '').trim();
      if (!targetId || selectedActivity || showSkinSelector || playingGame) return;
      const target = (activities || []).find((a) => String(a?._id || '') === targetId);
      if (!target) return;
      setSelectedActivity(target);
      setShowSkinSelector(true);
      if (onOpenHandled) onOpenHandled();
  }, [openItemId, activities, selectedActivity, showSkinSelector, playingGame, onOpenHandled]);

  const handleSelectActivity = (act) => {
      setSelectedActivity(act);
      setShowSkinSelector(true);
  };

  const handleStartGame = (skin) => {
      const finalGameData = {
          ...skin,
          levels: selectedActivity.levels && selectedActivity.levels.length > 0 
                  ? selectedActivity.levels 
                  : [{ name: "Niveau 1", questions: selectedActivity.questions || [] }],
          globalIntro: selectedActivity.globalIntro || {},
          title: selectedActivity.title,
          _id: selectedActivity._id,
          generatedCode: skin.generatedCode // On passe le script de l'univers
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
        <h2 className="text-base md:text-xl font-black text-slate-800 uppercase px-1 md:px-4">Mes Jeux Assignés</h2>
        <DashboardFolder items={activities} type="game" onSelect={handleSelectActivity} />

        {showSkinSelector && (
            <div className="fixed inset-0 z-[10000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6">
                <div className="bg-white rounded-[22px] md:rounded-[40px] w-full max-w-4xl p-4 md:p-8 animate-in zoom-in">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-lg md:text-2xl font-black text-slate-800 uppercase text-center flex-1">Choisis ton univers 🎮</h3>
                        <button onClick={() => setShowSkinSelector(false)} className="w-10 h-10 rounded-full bg-slate-100 font-black">✕</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {skins.map(skin => (
                            <div 
                                key={skin._id} 
                                onClick={() => handleStartGame(skin)}
                                className="group bg-slate-50 border-4 border-slate-100 hover:border-indigo-500 rounded-[35px] p-8 cursor-pointer transition-all hover:scale-[1.05] flex flex-col items-center text-center shadow-sm"
                            >
                                <div className="text-6xl mb-4 group-hover:animate-bounce">🎮</div>
                                <div className="font-black text-slate-700 uppercase text-sm leading-tight">{skin.title}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
