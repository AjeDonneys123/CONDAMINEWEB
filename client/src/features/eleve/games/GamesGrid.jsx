// @signatures: GamesGrid, loadData, handlePlayTapping, handleSelectActivity, handleStartGame
import React, { useState, useEffect, useMemo } from 'react';
import GamePlayer from './GamePlayer';
import DashboardFolder from '../components/DashboardFolder';
import MultiplicationRpg from './rpg/MultiplicationRpg';
import WispguardGame from './rpg/WispguardGame';
import MonsterTamerGame from './rpg/MonsterTamerGame';

/**
 * 🎮 GRILLE ÉLÈVE FUSIONNÉE V2
 * REPAIRS:
 * - Fixed fallback levels check (length > 0).
 * - Correctly passing generatedCode for univers choice.
 */
export default function GamesGrid({ user, openItemId = '', onOpenHandled }) {
  const [activities, setActivities] = useState([]);
  const [skins, setSkins] = useState([]);
  const [tappingProject, setTappingProject] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showSkinSelector, setShowSkinSelector] = useState(false);
  const [playingGame, setPlayingGame] = useState(null);
  const [playingMultiplicationRpg, setPlayingMultiplicationRpg] = useState(false);
  const [playingWispguard, setPlayingWispguard] = useState(false);
  const [playingMonsterTamer, setPlayingMonsterTamer] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
        const sId = user._id || user.id;
        const [actRes, skinRes, tappingRes] = await Promise.all([
            fetch(`/api/eleve/games/list/${sId}`).then(r => r.json()),
            fetch(`/api/eleve/games/skins?studentId=${sId}`).then(r => r.json()),
            fetch('/api/eleve/games/tapping-project').then(r => r.ok ? r.json() : null)
        ]);
        
        setActivities((actRes || []).map(a => ({ ...a, actType: 'game' })));
        setSkins(skinRes || []);
        setTappingProject(tappingRes || null);
    } catch(e) { console.error("Load Games Error", e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const tappingActivity = useMemo(() => {
      return (activities || []).find((act) => /tapping/i.test(String(act?.title || act?.name || act?.type || ''))) || null;
  }, [activities]);

  const buildGameData = (activity, skin = null) => {
      const selectedSkin = skin || activity || {};
      return {
          ...selectedSkin,
          levels: activity?.levels && activity.levels.length > 0
                  ? activity.levels
                  : [{ name: "Niveau 1", questions: activity?.questions || [] }],
          globalIntro: activity?.globalIntro || {},
          title: activity?.title || selectedSkin.title || 'Tapping',
          _id: activity?._id || selectedSkin._id,
          generatedCode: selectedSkin.generatedCode || activity?.generatedCode || ''
      };
  };

  const buildTappingProjectData = (project) => ({
      ...project,
      title: 'Tapping',
      _id: project?._id,
      generatedCode: project?.generatedCode || '',
      scenes: project?.scenes || [],
      globalIntro: project?.globalIntro || {},
      levels: project?.levels && project.levels.length > 0
          ? project.levels
          : [{ name: 'Tapping', questions: [] }],
      isStudioTapping: true
  });

  useEffect(() => {
      const targetId = String(openItemId || '').trim();
      if (!targetId || selectedActivity || showSkinSelector || playingGame) return;
      if (tappingProject && (targetId === '__tapping__' || targetId === String(tappingProject._id || ''))) {
          setPlayingGame(buildTappingProjectData(tappingProject));
          if (onOpenHandled) onOpenHandled();
          return;
      }
      const target = (activities || []).find((a) => String(a?._id || '') === targetId);
      if (!target) return;
      setPlayingGame(buildGameData(target, target));
      if (onOpenHandled) onOpenHandled();
  }, [openItemId, activities, tappingProject, selectedActivity, showSkinSelector, playingGame, onOpenHandled]);

  const handleSelectActivity = (act) => {
      setSelectedActivity(act);
      setShowSkinSelector(true);
  };

  const handleStartGame = (skin) => {
      setPlayingGame(buildGameData(selectedActivity, skin));
      setShowSkinSelector(false);
  };

  const handlePlayTapping = () => {
      if (!tappingProject && !tappingActivity) return;
      setSelectedActivity(null);
      setShowSkinSelector(false);
      if (tappingProject) {
          setPlayingGame(buildTappingProjectData(tappingProject));
          return;
      }
      setPlayingGame(buildGameData(tappingActivity, tappingActivity));
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

  if (playingMultiplicationRpg) {
      return <MultiplicationRpg onExit={() => setPlayingMultiplicationRpg(false)} />;
  }

  if (playingWispguard) {
      return <WispguardGame onExit={() => setPlayingWispguard(false)} />;
  }

  if (playingMonsterTamer) {
      return <MonsterTamerGame onExit={() => setPlayingMonsterTamer(false)} />;
  }

  return (
    <div className="flex flex-col gap-4 animate-in">
        <h2 className="text-base md:text-xl font-black text-slate-800 uppercase px-1 md:px-4">Mes Jeux Assignés</h2>
        <button
            type="button"
            onClick={() => setPlayingMonsterTamer(true)}
            className="mx-1 md:mx-4 overflow-hidden rounded-[26px] border-4 border-blue-800 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 px-6 py-6 text-left shadow-xl shadow-blue-200/60 transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5">
                    <div className="grid h-20 w-20 place-items-center rounded-2xl bg-black/40 text-5xl shadow-inner">🔴</div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">Nouveau prototype · capture et combats</div>
                        <div className="mt-1 text-3xl md:text-5xl font-black leading-none text-white drop-shadow-lg">Le monde des créatures</div>
                        <div className="mt-2 font-bold text-blue-50">Explore le monde, rencontre des créatures et combats au tour par tour.</div>
                    </div>
                </div>
                <div className="rounded-2xl bg-yellow-300 px-7 py-4 text-center text-xl font-black uppercase text-blue-950 shadow-lg">Tester</div>
            </div>
        </button>
        <button
            type="button"
            onClick={() => setPlayingWispguard(true)}
            className="mx-1 md:mx-4 overflow-hidden rounded-[26px] border-4 border-amber-700 bg-gradient-to-br from-slate-950 via-emerald-950 to-amber-900 px-6 py-6 text-left shadow-xl shadow-amber-200/60 transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5">
                    <div className="grid h-20 w-20 place-items-center rounded-2xl bg-black/40 text-5xl shadow-inner">⚔️</div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">Nouveau niveau · vrai donjon Zelda-like</div>
                        <div className="mt-1 text-3xl md:text-5xl font-black leading-none text-white drop-shadow-lg">La légende du Gardien</div>
                        <div className="mt-2 font-bold text-emerald-50">Épée, monstres, coffres, clés, objets à lancer et boss final.</div>
                    </div>
                </div>
                <div className="rounded-2xl bg-amber-300 px-7 py-4 text-center text-xl font-black uppercase text-amber-950 shadow-lg">Tester</div>
            </div>
        </button>
        <button
            type="button"
            onClick={() => setPlayingMultiplicationRpg(true)}
            className="mx-1 md:mx-4 overflow-hidden rounded-[26px] border-4 border-emerald-800 bg-gradient-to-br from-emerald-700 via-emerald-600 to-lime-600 px-6 py-6 text-left shadow-xl shadow-emerald-200/70 transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5">
                    <div className="grid h-20 w-20 place-items-center rounded-2xl bg-emerald-950/40 text-5xl shadow-inner">🏹</div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-lime-100">Ancien prototype · conservé pour comparaison</div>
                        <div className="mt-1 text-3xl md:text-5xl font-black leading-none text-white drop-shadow-lg">La forêt des multiplications</div>
                        <div className="mt-2 font-bold text-emerald-50">Explore, combats les monstres et gagne des pouvoirs grâce au calcul mental.</div>
                    </div>
                </div>
                <div className="rounded-2xl bg-white px-7 py-4 text-center text-xl font-black uppercase text-emerald-800 shadow-lg">Jouer</div>
            </div>
        </button>
        {(tappingProject || tappingActivity) && (
            <button
                type="button"
                onClick={handlePlayTapping}
                className="mx-1 md:mx-4 rounded-lg border-4 border-red-600 bg-red-600 px-6 py-6 md:py-8 text-left shadow-xl shadow-red-200/70 transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/80">Jeu disponible pour tous</div>
                        <div className="mt-1 text-4xl md:text-6xl font-black uppercase leading-none text-white drop-shadow-lg">Tapping</div>
                    </div>
                    <div className="rounded-lg bg-white px-6 py-4 text-center text-xl md:text-2xl font-black uppercase text-red-700 shadow-lg">
                        Jouer
                    </div>
                </div>
            </button>
        )}
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
