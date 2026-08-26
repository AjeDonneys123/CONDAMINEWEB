import React, { useMemo, useState } from 'react';
import ZombieWrapper from './zombie/ZombieWrapper';
import StarshipWrapper from './starship/StarshipWrapper';
import ProtectedGameSurface from './ProtectedGameSurface';
import { awardStudentStars } from '../utils/studentStars';

const youtubeEmbed = (url = '') => {
  const source = String(url || '').trim();
  const match = source.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/i);
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : source;
};

const deploySafeUrl = (url = '') => String(url || '').replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i, '');

function SheetPreview({ resource }) {
  if (!resource) return <div className="grid h-full place-items-center text-sm font-black uppercase text-slate-500">Aucune fiche</div>;
  if (resource.html) return <div className="h-full overflow-auto bg-white p-4 text-left text-sm text-slate-900" dangerouslySetInnerHTML={{ __html: resource.html }} />;
  if (resource.text) return <pre className="h-full overflow-auto whitespace-pre-wrap bg-white p-4 text-left font-sans text-sm text-slate-900">{resource.text}</pre>;
  if (resource.url) return <img src={deploySafeUrl(resource.url)} className="h-full w-full object-contain" alt={resource.title || 'Fiche'} />;
  return <div className="grid h-full place-items-center text-sm font-black uppercase text-slate-500">Aucune fiche</div>;
}

export default function LearningArcadeGame({ user, gameData, onExit }) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const levels = Array.isArray(gameData?.levels) ? gameData.levels : [];
  const level = levels[levelIndex] || null;
  const resources = gameData?.learningContext?.resources || {};
  const generalSheet = resources.generalSheets?.[0] || (gameData?.globalIntro?.sheetText || gameData?.globalIntro?.sheetUrl ? {
    title: 'Fiche générale', text: gameData.globalIntro.sheetText, html: gameData.globalIntro.sheetHtml, url: gameData.globalIntro.sheetUrl
  } : null);
  const generalVideo = resources.generalVideos?.[0] || resources.sequenceVideos?.[0] || (gameData?.globalIntro?.videoUrl ? { title: 'Vidéo générale', url: gameData.globalIntro.videoUrl } : null);
  const lesson = useMemo(() => (gameData?.learningContext?.lessons || []).find((item) => item.id === level?.lessonId), [gameData, level]);
  const lessonSheet = (resources.lessonSheets || []).find((row) => !lesson?.sectionId || row.sectionId === lesson.sectionId);
  const lessonVideo = (resources.sequenceVideos || []).find((row) => !lesson?.sectionId || row.sectionId === lesson.sectionId);

  if (!level) return <ProtectedGameSurface><div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950 p-6 text-center text-white"><div><h2 className="text-3xl font-black">Aucun QCM disponible</h2><button onClick={onExit} className="mt-6 rounded-xl bg-white px-6 py-3 font-black text-slate-900">RETOUR</button></div></div></ProtectedGameSurface>;

  if (started) {
    const common = {
      user,
      level,
      gameData,
      onClose: onExit,
      onFinish: (success) => {
        if (success) awardStudentStars(user, { category: 'game', points: 5 });
        if (success && levelIndex < levels.length - 1) {
          setLevelIndex((index) => index + 1);
          setStarted(false);
        } else onExit();
      }
    };
    return <ProtectedGameSurface>{gameData.type === 'starship' ? <StarshipWrapper {...common} /> : <ZombieWrapper {...common} />}</ProtectedGameSurface>;
  }

  const shownSheet = levelIndex === 0 ? generalSheet : (lessonSheet || generalSheet);
  const shownVideo = levelIndex === 0 ? generalVideo : (lessonVideo || generalVideo);
  return <ProtectedGameSurface><div className="fixed inset-0 z-[9999] overflow-auto bg-slate-950 p-4 text-white md:p-8">
    <button onClick={onExit} className="fixed right-5 top-5 z-10 h-12 w-12 rounded-full border-2 border-slate-500 bg-slate-900 text-2xl font-black">✕</button>
    <main className="mx-auto flex min-h-full max-w-6xl flex-col items-center justify-center py-12">
      <div className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">{gameData.title} · {levelIndex + 1}/{levels.length}</div>
      <h1 className="my-5 max-w-4xl text-center text-3xl font-black uppercase md:text-5xl">{level.name}</h1>
      <div className="grid w-full gap-5 md:grid-cols-[.8fr_1.4fr]">
        <section><h2 className="mb-2 font-black uppercase">{levelIndex === 0 ? 'Fiche générale' : 'Fiche de la leçon'}</h2><div className="h-[320px] overflow-hidden rounded-3xl border-4 border-slate-700 bg-slate-800"><SheetPreview resource={shownSheet} /></div></section>
        <section><h2 className="mb-2 font-black uppercase">{levelIndex === 0 ? 'Vidéo générale' : 'Vidéo de la séquence'}</h2><div className="h-[320px] overflow-hidden rounded-3xl border-4 border-slate-700 bg-black">{shownVideo?.url ? <iframe className="h-full w-full" src={youtubeEmbed(shownVideo.url)} title={shownVideo.title || 'Vidéo'} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <div className="grid h-full place-items-center font-black uppercase text-slate-500">Aucune vidéo</div>}</div></section>
      </div>
      <button onClick={() => setStarted(true)} className="mt-8 rounded-full border-4 border-indigo-500 bg-white px-12 py-5 text-2xl font-black text-indigo-950 shadow-2xl">DÉMARRER 🚀</button>
    </main>
  </div></ProtectedGameSurface>;
}
