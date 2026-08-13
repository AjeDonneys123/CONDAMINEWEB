import React, { useEffect, useState } from 'react';

export default function GameLearningGuide({ frameRef, learningContext }) {
  const [open, setOpen] = useState(false);
  const [resource, setResource] = useState(null);
  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow || event.data?.source !== 'condamine-game') return;
      if (event.data.type === 'open-learning-guide') setOpen(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frameRef]);
  if (!open) return null;
  const resources = learningContext?.resources || {};
  const groups = [
    ['Fiche générale', resources.generalSheets || []],
    ['Fiches des leçons', resources.lessonSheets || []],
    ['Vidéo générale', resources.generalVideos || []],
    ['Séquences vidéo', resources.sequenceVideos || []],
  ];
  return <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/90 p-4" onClick={(event) => event.stopPropagation()}>
    <section className="flex max-h-[92%] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
      <header className="flex items-center justify-between border-b p-5"><div><div className="text-xs font-black uppercase tracking-widest text-indigo-600">Guide du chapitre</div><h2 className="text-2xl font-black">Fiches et vidéos</h2></div><button className="h-11 w-11 rounded-full bg-slate-100 font-black" onClick={() => { setOpen(false); setResource(null); }}>✕</button></header>
      <div className="grid min-h-0 flex-1 md:grid-cols-[300px_1fr]">
        <nav className="overflow-y-auto border-r bg-slate-50 p-3">{groups.map(([label, rows]) => <div key={label} className="mb-4"><h3 className="mb-2 text-xs font-black uppercase text-slate-500">{label}</h3>{rows.map((row) => <button key={row.id} onClick={() => setResource(row)} className="mb-2 block w-full rounded-xl bg-white p-3 text-left text-sm font-black shadow-sm hover:text-indigo-700">{row.title}</button>)}{!rows.length && <p className="px-2 text-xs font-bold text-slate-400">Aucune ressource</p>}</div>)}</nav>
        <main className="overflow-y-auto p-6">{!resource ? <div className="grid h-full place-items-center font-bold text-slate-400">Choisis une ressource auprès du guide.</div> : resource.url && !resource.text && !resource.html ? <iframe className="min-h-[520px] w-full rounded-xl bg-black" src={resource.url} title={resource.title} allowFullScreen /> : <article><h2 className="mb-5 text-2xl font-black">{resource.title}</h2>{resource.html ? <div className="prose max-w-none text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: resource.html }} /> : <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed">{resource.text}</pre>}</article>}</main>
      </div>
    </section>
  </div>;
}
