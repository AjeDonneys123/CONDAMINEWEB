// @signatures: GamesGrid, loadData, handlePlayTapping, handleSelectActivity, handleStartGame
import React, { useState, useEffect, useMemo } from 'react';
import GamePlayer from './GamePlayer';
import DashboardFolder from '../components/DashboardFolder';
import MultiplicationRpg from './rpg/MultiplicationRpg';
import WispguardGame from './rpg/WispguardGame';
import MonsterTamerGame from './rpg/MonsterTamerGame';
import { buildGameLearningContext } from './rpg/gameLearningContext';

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
  const [learningModules, setLearningModules] = useState([]);
  const [pendingLaunch, setPendingLaunch] = useState(null);
  const [selectedLearningContext, setSelectedLearningContext] = useState(null);

  const learningContext = useMemo(
      () => buildGameLearningContext(learningModules, user),
      [learningModules, user]
  );

  const chapterGroups = useMemo(() => {
      const groups = { HISTOIRE: [], GEOGRAPHIE: [], EMC: [] };
      const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      (learningContext.chapters || []).forEach((chapter) => {
          const section = normalize(chapter.section);
          const key = section.includes('GEO') ? 'GEOGRAPHIE' : section.includes('EMC') || section.includes('CIVIQUE') ? 'EMC' : section.includes('HIST') ? 'HISTOIRE' : '';
          if (key) groups[key].push(chapter);
      });
      return groups;
  }, [learningContext]);

  const requestLaunch = (type, payload = null) => setPendingLaunch({ type, payload });

  const buildLearningLevels = (chapter) => (chapter?.lessons || []).map((lesson, index) => ({
      name: `Partie ${['I', 'II', 'III', 'IV', 'V', 'VI'][index] || index + 1} · ${lesson.title}`,
      lessonId: lesson.id,
      intro: (() => {
          const sheets = (learningContext.resources?.lessonSheets || []).filter((row) => row.chapterId === chapter.id && (!row.sectionId || row.sectionId === lesson.sectionId));
          const videos = (learningContext.resources?.sequenceVideos || []).filter((row) => row.chapterId === chapter.id && (!row.sectionId || row.sectionId === lesson.sectionId));
          return { sheetUrl: sheets[0]?.url || '', sheetText: sheets[0]?.text || '', videoUrl: videos[0]?.url || '' };
      })(),
      questions: (lesson.quiz || []).map((question) => ({
          q: question.question,
          options: question.choices,
          a: question.correctIndex
      }))
  })).filter((level) => level.questions.length > 0);

  const buildLearningGame = (skin, chapter, family) => {
    const generalSheet = (learningContext.resources?.generalSheets || []).find((row) => row.chapterId === chapter.id);
    const generalVideo = (learningContext.resources?.generalVideos || []).find((row) => row.chapterId === chapter.id)
      || (learningContext.resources?.sequenceVideos || []).find((row) => row.chapterId === chapter.id);
    return ({
      ...skin,
      _id: `learning-${family}-${chapter.id}`,
      title: family === 'starship' ? 'Starship' : 'Zombie',
      type: family,
      isLearningGame: true,
      selectedChapter: chapter,
      levels: buildLearningLevels(chapter),
      globalIntro: { sheetUrl: generalSheet?.url || '', sheetText: generalSheet?.text || '', sheetHtml: generalSheet?.html || '', videoUrl: generalVideo?.url || '' }
    });
  };

  const launchWithChapter = (chapter) => {
      const context = {
          ...learningContext,
          activeChapterId: chapter.id,
          activeChapterTitle: chapter.title,
          chapters: [chapter],
          lessons: Array.isArray(chapter.lessons) ? chapter.lessons : [],
          resources: Object.fromEntries(Object.entries(learningContext.resources || {}).map(([key, rows]) => [key, (rows || []).filter((row) => row.chapterId === chapter.id)]))
      };
      setSelectedLearningContext(context);
      const launch = pendingLaunch;
      setPendingLaunch(null);
      if (launch?.type === 'monster') setPlayingMonsterTamer(true);
      if (launch?.type === 'wispguard') setPlayingWispguard(true);
      if (launch?.type === 'multiplication') setPlayingMultiplicationRpg(true);
      if (launch?.type === 'game') setPlayingGame({ ...launch.payload, learningContext: context, selectedChapter: chapter });
      if (launch?.type === 'learning-game') {
          const skin = (skins || []).find((item) => String(item?.title || '').toLowerCase().includes(launch.payload));
          setPlayingGame({ ...buildLearningGame(skin || {}, chapter, launch.payload), learningContext: context });
      }
  };

  const loadData = async () => {
    setLoading(true);
    try {
        const sId = user._id || user.id;
        const [actRes, skinRes, tappingRes, learningRes] = await Promise.all([
            fetch(`/api/eleve/games/list/${sId}${user?.isVisitorPreview ? `?visitor=1&level=${encodeURIComponent(user.currentClass || '')}` : ''}`).then(r => r.json()),
            fetch(`/api/eleve/games/skins?studentId=${sId}`).then(r => r.json()),
            fetch('/api/eleve/games/tapping-project').then(r => r.ok ? r.json() : null),
            fetch(`/api/eleve/learning/list/${sId}?forGames=1&level=${encodeURIComponent(user.currentClass || '')}`).then(r => r.ok ? r.json() : [])
        ]);
        
        setActivities((actRes || []).map(a => ({ ...a, actType: 'game' })));
        setSkins(skinRes || []);
        setTappingProject(tappingRes || null);
        setLearningModules(Array.isArray(learningRes) ? learningRes : []);
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
          requestLaunch('game', buildTappingProjectData(tappingProject));
          if (onOpenHandled) onOpenHandled();
          return;
      }
      const target = (activities || []).find((a) => String(a?._id || '') === targetId);
      if (!target) return;
      requestLaunch('game', buildGameData(target, target));
      if (onOpenHandled) onOpenHandled();
  }, [openItemId, activities, tappingProject, selectedActivity, showSkinSelector, playingGame, onOpenHandled]);

  const handleSelectActivity = (act) => {
      setSelectedActivity(act);
      setShowSkinSelector(true);
  };

  const handleStartGame = (skin) => {
      requestLaunch('game', buildGameData(selectedActivity, skin));
      setShowSkinSelector(false);
  };

  const handlePlayTapping = () => {
      if (!tappingProject && !tappingActivity) return;
      setSelectedActivity(null);
      setShowSkinSelector(false);
      if (tappingProject) {
          requestLaunch('game', buildTappingProjectData(tappingProject));
          return;
      }
      requestLaunch('game', buildGameData(tappingActivity, tappingActivity));
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
      return <MultiplicationRpg onExit={() => setPlayingMultiplicationRpg(false)} learningContext={selectedLearningContext} />;
  }

  if (playingWispguard) {
      return <WispguardGame onExit={() => setPlayingWispguard(false)} learningContext={selectedLearningContext} />;
  }

  if (playingMonsterTamer) {
      return (
          <MonsterTamerGame
            onExit={() => setPlayingMonsterTamer(false)}
            learningContext={selectedLearningContext || learningContext}
          />
      );
  }

  return (
    <div className="flex flex-col gap-4 animate-in">
        <h2 className="text-base md:text-xl font-black text-slate-800 uppercase px-1 md:px-4">Mes Jeux Assignés</h2>
        <div className="mx-1 grid gap-4 md:mx-4 md:grid-cols-2">
            <button type="button" onClick={() => requestLaunch('learning-game', 'zombie')} className="rounded-[26px] border-4 border-lime-500 bg-gradient-to-br from-slate-950 via-emerald-950 to-lime-800 p-6 text-left text-white shadow-xl transition hover:scale-[1.01]">
                <div className="text-5xl">🧟</div><div className="mt-3 text-3xl font-black uppercase">Zombie</div><div className="mt-2 font-bold text-lime-100">Les parties de la fiche deviennent les niveaux du jeu.</div>
            </button>
            <button type="button" onClick={() => requestLaunch('learning-game', 'starship')} className="rounded-[26px] border-4 border-cyan-400 bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-800 p-6 text-left text-white shadow-xl transition hover:scale-[1.01]">
                <div className="text-5xl">🚀</div><div className="mt-3 text-3xl font-black uppercase">Starship</div><div className="mt-2 font-bold text-cyan-100">Révise les QCM de chaque partie dans l’espace.</div>
            </button>
        </div>
        <button
            type="button"
            onClick={() => requestLaunch('monster')}
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
            onClick={() => requestLaunch('wispguard')}
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
            onClick={() => requestLaunch('multiplication')}
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

        {pendingLaunch && (
            <div className="fixed inset-0 z-[11000] grid place-items-center bg-slate-950/90 p-4 backdrop-blur-md">
                <section className="w-full max-w-5xl rounded-[30px] bg-white p-5 shadow-2xl md:p-8">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <div className="text-xs font-black uppercase tracking-[.2em] text-indigo-600">Révision du jeu</div>
                            <h3 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">Choisis une matière puis un chapitre</h3>
                            <p className="mt-2 font-bold text-slate-500">Uniquement les chapitres actifs de ton niveau qui contiennent un apprentissage.</p>
                        </div>
                        <button type="button" onClick={() => setPendingLaunch(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-xl font-black">✕</button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        {[
                            ['HISTOIRE', '🏰', 'from-amber-500 to-orange-600'],
                            ['GEOGRAPHIE', '🌍', 'from-emerald-500 to-cyan-600'],
                            ['EMC', '⚖️', 'from-indigo-500 to-violet-600']
                        ].map(([key, icon, colors]) => (
                            <div key={key} className="overflow-hidden rounded-3xl border-2 border-slate-100 bg-slate-50">
                                <div className={`bg-gradient-to-br ${colors} p-5 text-white`}>
                                    <div className="text-4xl">{icon}</div>
                                    <div className="mt-2 text-xl font-black">{key === 'GEOGRAPHIE' ? 'GÉOGRAPHIE' : key}</div>
                                    <div className="text-xs font-bold opacity-80">{chapterGroups[key].length} chapitre{chapterGroups[key].length > 1 ? 's' : ''}</div>
                                </div>
                                <div className="grid max-h-72 gap-2 overflow-y-auto p-3">
                                    {chapterGroups[key].map((chapter) => (
                                        <button key={chapter.id} type="button" onClick={() => launchWithChapter(chapter)} className="rounded-2xl border-2 border-white bg-white p-3 text-left text-sm font-black text-slate-800 shadow-sm transition hover:border-indigo-400 hover:text-indigo-700">
                                            {chapter.title}
                                        </button>
                                    ))}
                                    {!chapterGroups[key].length && <div className="p-4 text-center text-sm font-bold text-slate-400">Aucun chapitre disponible</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        )}

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
