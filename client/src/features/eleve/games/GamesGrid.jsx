// @signatures: GamesGrid, loadData, handlePlayTapping, handleSelectActivity, handleStartGame
import React, { useState, useEffect, useMemo } from 'react';
import GamePlayer from './GamePlayer';
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
export default function GamesGrid({ user }) {
  const [skins, setSkins] = useState([]);
  const [builtInGameSettings, setBuiltInGameSettings] = useState({});
  const [playingGame, setPlayingGame] = useState(null);
  const [playingMultiplicationRpg, setPlayingMultiplicationRpg] = useState(false);
  const [playingWispguard, setPlayingWispguard] = useState(false);
  const [playingMonsterTamer, setPlayingMonsterTamer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [learningModules, setLearningModules] = useState([]);
  const [pendingLaunch, setPendingLaunch] = useState(null);
  const [selectedLearningContext, setSelectedLearningContext] = useState(null);
  const [expandedChapterId, setExpandedChapterId] = useState('');

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

  const requestLaunch = (type, payload = null) => {
      setExpandedChapterId('');
      setPendingLaunch({ type, payload });
  };

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
      title: family === 'starship' ? 'Starship' : family === 'jumper' ? 'Jumper' : 'Zombie',
      type: family,
      isLearningGame: true,
      selectedChapter: chapter,
      levels: buildLearningLevels(chapter),
      globalIntro: { sheetUrl: generalSheet?.url || '', sheetText: generalSheet?.text || '', sheetHtml: generalSheet?.html || '', videoUrl: generalVideo?.url || '' }
    });
  };

  const launchWithChapter = (chapter, selectedLesson = null) => {
      const selectedLessons = selectedLesson
          ? (chapter.lessons || []).filter((lesson) => String(lesson.id) === String(selectedLesson.id))
          : (Array.isArray(chapter.lessons) ? chapter.lessons : []);
      const selectedChapter = { ...chapter, lessons: selectedLessons };
      const context = {
          ...learningContext,
          activeChapterId: chapter.id,
          activeChapterTitle: chapter.title,
          activeLessonId: selectedLesson ? String(selectedLesson.id) : '',
          activeLessonTitle: selectedLesson ? String(selectedLesson.title || '') : '',
          chapters: [selectedChapter],
          lessons: selectedLessons,
          resources: Object.fromEntries(Object.entries(learningContext.resources || {}).map(([key, rows]) => [key, (rows || []).filter((row) => {
              if (row.chapterId !== chapter.id) return false;
              if (!selectedLesson || key === 'generalSheets' || key === 'generalVideos') return true;
              return !row.sectionId || String(row.sectionId) === String(selectedLesson.sectionId);
          })]))
      };
      setSelectedLearningContext(context);
      const launch = pendingLaunch;
      setPendingLaunch(null);
      if (launch?.type === 'monster') setPlayingMonsterTamer(true);
      if (launch?.type === 'wispguard') setPlayingWispguard(true);
      if (launch?.type === 'multiplication') setPlayingMultiplicationRpg(true);
      if (launch?.type === 'game') setPlayingGame({ ...launch.payload, learningContext: context, selectedChapter });
      if (launch?.type === 'learning-game') {
          const skin = (skins || []).find((item) => String(item?.title || '').toLowerCase().includes(launch.payload));
          setPlayingGame({ ...buildLearningGame(skin || {}, selectedChapter, launch.payload), learningContext: context });
      }
  };

  const loadData = async () => {
    setLoading(true);
    try {
        const sId = user._id || user.id;
        const [skinRes, learningRes, builtInSettingsRes] = await Promise.all([
            fetch(`/api/eleve/games/skins?studentId=${sId}`).then(r => r.json()),
            fetch(`/api/eleve/learning/list/${sId}?forGames=1&level=${encodeURIComponent(user.currentClass || '')}`).then(r => r.ok ? r.json() : []),
            fetch('/api/eleve/games/builtin-settings').then(r => r.ok ? r.json() : {})
        ]);
        setSkins(skinRes || []);
        setLearningModules(Array.isArray(learningRes) ? learningRes : []);
        setBuiltInGameSettings(builtInSettingsRes || {});
    } catch(e) { console.error("Load Games Error", e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const isBuiltInGameEnabled = (key) => builtInGameSettings[key] !== false;

  if (playingGame) {
      return (
          <GamePlayer 
            user={user} 
            gameData={playingGame} 
            onExit={() => { setPlayingGame(null); loadData(); }}
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
        <h2 className="text-base md:text-xl font-black text-slate-800 uppercase px-1 md:px-4">Jeux pédagogiques</h2>
        <div className="mx-1 grid gap-4 md:mx-4 md:grid-cols-2">
            {isBuiltInGameEnabled('zombie') && <button type="button" onClick={() => requestLaunch('learning-game', 'zombie')} className="rounded-[26px] border-4 border-lime-500 bg-gradient-to-br from-slate-950 via-emerald-950 to-lime-800 p-6 text-left text-white shadow-xl transition hover:scale-[1.01]">
                <div className="text-5xl">🧟</div><div className="mt-3 text-3xl font-black uppercase">Zombie</div><div className="mt-2 font-bold text-lime-100">Les parties de la fiche deviennent les niveaux du jeu.</div>
            </button>}
            {isBuiltInGameEnabled('starship') && <button type="button" onClick={() => requestLaunch('learning-game', 'starship')} className="rounded-[26px] border-4 border-cyan-400 bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-800 p-6 text-left text-white shadow-xl transition hover:scale-[1.01]">
                <div className="text-5xl">🚀</div><div className="mt-3 text-3xl font-black uppercase">Starship</div><div className="mt-2 font-bold text-cyan-100">Révise les QCM de chaque partie dans l’espace.</div>
            </button>}
            {isBuiltInGameEnabled('jumper') && <button type="button" onClick={() => requestLaunch('learning-game', 'jumper')} className="rounded-[26px] border-4 border-violet-400 bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-800 p-6 text-left text-white shadow-xl transition hover:scale-[1.01]">
                <div className="text-5xl">🦘</div><div className="mt-3 text-3xl font-black uppercase">Jumper</div><div className="mt-2 font-bold text-violet-100">Saute sur la bonne plateforme puis affronte le boss.</div>
            </button>}
        </div>
        {isBuiltInGameEnabled('creatures') && <button
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
        </button>}
        {isBuiltInGameEnabled('guardian') && <button
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
        </button>}
        {isBuiltInGameEnabled('forest') && <button
            type="button"
            onClick={() => requestLaunch('multiplication')}
            className="mx-1 md:mx-4 overflow-hidden rounded-[26px] border-4 border-emerald-800 bg-gradient-to-br from-emerald-700 via-emerald-600 to-lime-600 px-6 py-6 text-left shadow-xl shadow-emerald-200/70 transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5">
                    <div className="grid h-20 w-20 place-items-center rounded-2xl bg-emerald-950/40 text-5xl shadow-inner">🏹</div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-lime-100">Aventure de révision · tir et QCM</div>
                        <div className="mt-1 text-3xl md:text-5xl font-black leading-none text-white drop-shadow-lg">La forêt des savoirs</div>
                        <div className="mt-2 font-bold text-emerald-50">Explore, combats les monstres et recharge tes flèches avec les QCM du chapitre.</div>
                    </div>
                </div>
                <div className="rounded-2xl bg-white px-7 py-4 text-center text-xl font-black uppercase text-emerald-800 shadow-lg">Jouer</div>
            </div>
        </button>}
        {pendingLaunch && (
            <div className="fixed inset-0 z-[11000] grid place-items-center bg-slate-950/90 p-4 backdrop-blur-md">
                <section className="w-full max-w-5xl rounded-[30px] bg-white p-5 shadow-2xl md:p-8">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <div className="text-xs font-black uppercase tracking-[.2em] text-indigo-600">Révision du jeu</div>
                            <h3 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">Choisis une matière, puis une leçon ou un chapitre</h3>
                            <p className="mt-2 font-bold text-slate-500">Ouvre un chapitre pour choisir une seule leçon, ou révise tout le chapitre.</p>
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
                                    {chapterGroups[key].map((chapter) => {
                                        const expanded = String(expandedChapterId) === String(chapter.id);
                                        const lessons = Array.isArray(chapter.lessons) ? chapter.lessons : [];
                                        return (
                                            <div key={chapter.id} className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition ${expanded ? 'border-indigo-300' : 'border-white'}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedChapterId(expanded ? '' : String(chapter.id))}
                                                    className="flex w-full items-center gap-3 p-3 text-left text-sm font-black text-slate-800 hover:text-indigo-700"
                                                >
                                                    <span className="text-xl">📁</span>
                                                    <span className="min-w-0 flex-1">{chapter.title}</span>
                                                    <span className="shrink-0 text-xs text-slate-400">{lessons.length} leçon{lessons.length > 1 ? 's' : ''}</span>
                                                    <span className="shrink-0 text-lg">{expanded ? '⌃' : '⌄'}</span>
                                                </button>
                                                {expanded && (
                                                    <div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-3">
                                                        {lessons.map((lesson, lessonIndex) => (
                                                            <button
                                                                key={lesson.id}
                                                                type="button"
                                                                onClick={() => launchWithChapter(chapter, lesson)}
                                                                className="rounded-xl border-2 border-slate-100 bg-white px-3 py-3 text-left text-sm font-black text-slate-700 transition hover:border-indigo-400 hover:text-indigo-700"
                                                            >
                                                                📄 Leçon {lessonIndex + 1} · {lesson.title}
                                                            </button>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => launchWithChapter(chapter)}
                                                            className="mt-1 rounded-xl border-2 border-indigo-500 bg-indigo-600 px-3 py-3 text-left text-sm font-black text-white transition hover:bg-indigo-700"
                                                        >
                                                            📚 Tout le chapitre · {chapter.title}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {!chapterGroups[key].length && <div className="p-4 text-center text-sm font-bold text-slate-400">Aucun chapitre disponible</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        )}

    </div>
  );
}
