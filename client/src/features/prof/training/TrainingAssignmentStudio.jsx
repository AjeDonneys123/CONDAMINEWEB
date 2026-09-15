import React, { useRef, useState } from 'react';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';
import ExamTrainingHub from '../../eleve/training/ExamTrainingHub';

const makePage = (index) => ({ id: `page-${Date.now()}-${index}`, title: `Page ${index + 1}`, blocks: [], exercise: null, elementOrder: [] });
const youtubeEmbed = (value = '') => {
  const match = String(value).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&/]+)/i);
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : '';
};

export default function TrainingAssignmentStudio({ user, allClasses, allStudents, chapters, globalClass, globalClassId, globalLevel, targetSection, initialData, onClose }) {
  const [title, setTitle] = useState('Nouvel entraînement');
  const [pages, setPages] = useState([makePage(0)]);
  const [activePageId, setActivePageId] = useState(pages[0].id);
  const sourceChapterId = String(initialData?.chapterId || '');
  const [distribution, setDistribution] = useState(() => globalClass ? { [globalClass]: { chapterId: sourceChapterId, studentIds: [] } } : {});
  const [viewingClass, setViewingClass] = useState(globalClass || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorMode, setEditorMode] = useState('pages');
  const [existingSelection, setExistingSelection] = useState(new Map());
  const [draggedElementId, setDraggedElementId] = useState('');
  const fileRef = useRef(null);
  const activePage = pages.find((page) => page.id === activePageId) || pages[0];
  const chapter = (chapters || []).find((row) => String(row._id) === sourceChapterId);
  const previewUser = { ...user, currentClass: globalClass, className: globalClass, classId: globalClassId };
  const toggleExisting = (item, checked) => setExistingSelection((current) => { const next = new Map(current); if (checked) next.set(item.id, item); else next.delete(item.id); return next; });

  const updatePage = (updater) => setPages((current) => current.map((page) => page.id === activePage.id ? updater(page) : page));
  const addBlock = (type) => updatePage((page) => {
    const block = { id: `${type}-${Date.now()}`, type, value: '' };
    return { ...page, blocks: [...page.blocks, block], elementOrder: [...(page.elementOrder || []), block.id] };
  });
  const updateBlock = (id, patch) => updatePage((page) => ({ ...page, blocks: page.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) }));
  const removeBlock = (id) => updatePage((page) => ({ ...page, blocks: page.blocks.filter((block) => block.id !== id), elementOrder: (page.elementOrder || []).filter((entry) => entry !== id) }));
  const moveElement = (sourceId, targetId) => updatePage((page) => {
    const fallback = [...page.blocks.map((block) => block.id), ...(page.exercise ? ['exercise'] : [])];
    const order = (page.elementOrder?.length ? page.elementOrder : fallback).filter((id) => id !== sourceId);
    const targetIndex = order.indexOf(targetId);
    order.splice(targetIndex < 0 ? order.length : targetIndex, 0, sourceId);
    return { ...page, elementOrder: order };
  });
  const addPage = () => {
    const page = makePage(pages.length);
    setPages((current) => [...current, page]);
    setActivePageId(page.id);
  };
  const removePage = (id) => {
    if (pages.length === 1) return;
    const next = pages.filter((page) => page.id !== id);
    setPages(next);
    if (activePageId === id) setActivePageId(next[0].id);
  };
  const movePage = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    setPages((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  };
  const uploadImages = async (files) => {
    const images = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    setUploading(true);
    try {
      for (const file of images) {
        const form = new FormData(); form.append('image', file);
        const response = await fetch('/api/prof/training/upload-image', { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok || !data.url) throw new Error(data.error || 'Image impossible à envoyer');
        updatePage((page) => {
          const block = { id: `image-${Date.now()}-${file.name}`, type: 'image', value: data.url, name: file.name };
          return { ...page, blocks: [...page.blocks, block], elementOrder: [...(page.elementOrder || []), block.id] };
        });
      }
    } catch (error) { window.alert(error.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const setExerciseType = (type) => updatePage((page) => ({
    ...page,
    exercise: type ? { type, question: '', expected: '', choices: ['', '', ''], correctIndex: 0 } : null,
    elementOrder: type
      ? ((page.elementOrder || []).includes('exercise') ? page.elementOrder : [...(page.elementOrder || []), 'exercise'])
      : (page.elementOrder || []).filter((id) => id !== 'exercise')
  }));
  const updateExercise = (patch) => updatePage((page) => ({ ...page, exercise: { ...page.exercise, ...patch } }));

  const publish = async () => {
    if (!Object.keys(distribution).length) return window.alert('Sélectionne au moins un destinataire.');
    if (!title.trim()) return window.alert('Donne un titre à l’entraînement.');
    setSaving(true);
    try {
      const assignmentId = globalThis.crypto?.randomUUID?.() || `training-${Date.now()}`;
      const customItems = pages.filter((page) => page.blocks.length || page.exercise).map((page, index) => ({
        id: `${assignmentId}-page-${index + 1}`, type: 'custom', title: page.title || `Page ${index + 1}`,
        section: String(targetSection || chapter?.section || 'GÉNÉRAL').toUpperCase(), subject: title.trim(), questionType: 'custom_page',
        images: page.blocks.filter((block) => block.type === 'image').map((block) => ({ url: block.value, caption: block.name || page.title })),
        content: { pageIndex: index, pageCount: pages.length, blocks: page.blocks, exercise: page.exercise, elementOrder: page.elementOrder }
      }));
      const items = [...existingSelection.values(), ...customItems];
      if (!items.length) throw new Error('Ajoute une page ou sélectionne un entraînement existant.');
      await Promise.all(Object.entries(distribution).map(async ([className, config]) => {
        const classroom = (allClasses || []).find((row) => row.name === className);
        if (!classroom?._id) return;
        const response = await fetch(`/api/prof/training/class/${encodeURIComponent(classroom._id)}/assignment`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId, title: title.trim(), chapterId: sourceChapterId, items, teacherId: user?._id || user?.id, assignedStudentIds: config.studentIds || [] })
        });
        if (!response.ok) throw new Error(`Publication impossible pour ${className}`);
      }));
      window.alert('Entraînement multipage publié.'); onClose();
    } catch (error) { window.alert(error.message); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[80] flex flex-col bg-slate-100">
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <div><div className="text-[10px] font-black uppercase text-violet-500">Nouvelle activité</div><input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-[min(70vw,620px)] border-0 bg-transparent text-2xl font-black text-slate-900 outline-none" /></div>
      <button type="button" onClick={onClose} className="h-11 w-11 rounded-full border bg-slate-50 text-xl font-black">✕</button>
    </header>
    <div className="grid min-h-0 flex-1 grid-cols-[150px_minmax(0,1fr)_360px]">
      <aside className="overflow-auto border-r bg-slate-900 p-3 text-white">
        <div className="mb-3 text-[10px] font-black uppercase text-slate-400">Pages</div>
        {pages.map((page, index) => <div key={page.id} className="mb-2 flex gap-1">
          <button type="button" onClick={() => setActivePageId(page.id)} className={`min-w-0 flex-1 rounded-xl px-2 py-3 text-left text-xs font-black ${page.id === activePage.id ? 'bg-violet-600' : 'bg-slate-800'}`}>{index + 1}. {page.title}</button>
          <div className="flex flex-col"><button type="button" onClick={() => movePage(index, -1)} className="text-[10px]">↑</button><button type="button" onClick={() => movePage(index, 1)} className="text-[10px]">↓</button></div>
        </div>)}
        <button type="button" onClick={addPage} className="mt-2 w-full rounded-xl border border-dashed border-violet-400 px-2 py-3 text-xs font-black">＋ Page</button>
      </aside>
      <main className="overflow-auto p-5">
        <div className="mx-auto mb-4 flex max-w-4xl gap-2 rounded-2xl bg-white p-2 shadow-sm"><button type="button" onClick={() => setEditorMode('pages')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-black ${editorMode === 'pages' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>✏️ Composer des pages</button><button type="button" onClick={() => setEditorMode('existing')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-black ${editorMode === 'existing' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>📚 Choisir dans l’existant ({existingSelection.size})</button></div>
        {editorMode === 'existing' ? <div className="mx-auto max-w-6xl rounded-[30px] border bg-white p-4 shadow-sm"><ExamTrainingHub user={previewUser} canCalibrate={false} assignmentMode selectedAssignmentIds={new Set(existingSelection.keys())} onAssignmentToggle={toggleExisting} /></div> :
        <div className="mx-auto max-w-4xl rounded-[30px] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><input value={activePage.title} onChange={(event) => updatePage((page) => ({ ...page, title: event.target.value }))} className="min-w-0 flex-1 rounded-xl border p-3 text-xl font-black" /><button type="button" onClick={() => removePage(activePage.id)} disabled={pages.length === 1} className="rounded-xl border border-red-200 px-3 py-3 text-red-500 disabled:opacity-30">🗑️</button></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => addBlock('text')} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white">＋ Texte / consigne</button>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white">＋ Photo</button>
            <button type="button" onClick={() => addBlock('video')} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white">＋ Vidéo YouTube</button>
            <select value={activePage.exercise?.type || ''} onChange={(event) => setExerciseType(event.target.value)} className="rounded-xl border px-4 py-2 text-xs font-black"><option value="">＋ Exercice</option><option value="qcm">QCM</option><option value="fill">Texte à trous</option><option value="targeted">Réponse ciblée</option></select>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => uploadImages(event.target.files)} />
          </div>
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); uploadImages(event.dataTransfer.files); }} className="mt-5 min-h-[180px] rounded-2xl border-2 border-dashed border-slate-200 p-4">
            {!activePage.blocks.length && !activePage.exercise && <div className="py-14 text-center font-bold text-slate-400">Ajoute un contenu ou dépose ici une ou plusieurs images.</div>}
            <div className="grid gap-4">{activePage.blocks.map((block, blockIndex) => <div key={block.id} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggedElementId && draggedElementId !== block.id) moveElement(draggedElementId, block.id); }} style={{ order: (activePage.elementOrder || []).indexOf(block.id) >= 0 ? activePage.elementOrder.indexOf(block.id) : blockIndex }} className={`relative rounded-2xl border bg-slate-50 p-4 ${draggedElementId === block.id ? 'opacity-40' : ''}`}>
              <div draggable onDragStart={(event) => { event.stopPropagation(); setDraggedElementId(block.id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDraggedElementId('')} className="mb-2 cursor-grab select-none text-[11px] font-black uppercase tracking-widest text-slate-400 active:cursor-grabbing">⠿ Glisser pour déplacer</div>
              <button type="button" onClick={() => removeBlock(block.id)} className="absolute right-2 top-2 text-red-500">✕</button>
              {block.type === 'text' && <textarea value={block.value} onChange={(event) => updateBlock(block.id, { value: event.target.value })} placeholder="Explication ou consigne…" className="min-h-28 w-full resize-y rounded-xl border bg-white p-3" />}
              {block.type === 'video' && <><input value={block.value} onChange={(event) => updateBlock(block.id, { value: event.target.value })} placeholder="URL YouTube" className="w-full rounded-xl border bg-white p-3" />{youtubeEmbed(block.value) && <iframe className="mt-3 aspect-video w-full rounded-xl" src={youtubeEmbed(block.value)} title="Vidéo" allowFullScreen />}</>}
              {block.type === 'image' && <img src={block.value} alt={block.name || 'Document'} className="mx-auto max-h-[520px] rounded-xl object-contain" />}
            </div>)}</div>
            {activePage.exercise && <div onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggedElementId && draggedElementId !== 'exercise') moveElement(draggedElementId, 'exercise'); }} style={{ order: (activePage.elementOrder || []).indexOf('exercise') >= 0 ? activePage.elementOrder.indexOf('exercise') : activePage.blocks.length }} className={`rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 ${draggedElementId === 'exercise' ? 'opacity-40' : ''}`}>
              <div draggable onDragStart={(event) => { event.stopPropagation(); setDraggedElementId('exercise'); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDraggedElementId('')} className="mb-2 cursor-grab select-none text-[11px] font-black uppercase tracking-widest text-violet-400 active:cursor-grabbing">⠿ Glisser pour déplacer</div>
              <div className="mb-3 font-black text-violet-800">Exercice · {activePage.exercise.type === 'qcm' ? 'QCM' : activePage.exercise.type === 'fill' ? 'Texte à trous' : 'Réponse ciblée'}</div>
              <textarea value={activePage.exercise.question} onChange={(event) => updateExercise({ question: event.target.value })} placeholder={activePage.exercise.type === 'fill' ? 'Texte avec les mots à trouver indiqués entre [crochets]…' : 'Question ou consigne…'} className="min-h-24 w-full rounded-xl border bg-white p-3" />
              {activePage.exercise.type === 'qcm' ? <div className="mt-3 grid gap-2">{activePage.exercise.choices.map((choice, index) => <label key={index} className="flex items-center gap-2"><input type="radio" checked={activePage.exercise.correctIndex === index} onChange={() => updateExercise({ correctIndex: index })} /><input value={choice} onChange={(event) => { const choices = [...activePage.exercise.choices]; choices[index] = event.target.value; updateExercise({ choices }); }} placeholder={`Réponse ${index + 1}`} className="flex-1 rounded-xl border bg-white p-2" /></label>)}</div> : <input value={activePage.exercise.expected} onChange={(event) => updateExercise({ expected: event.target.value })} placeholder="Réponse attendue" className="mt-3 w-full rounded-xl border bg-white p-3" />}
            </div>}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-100 p-4"><span className="text-xs font-bold text-slate-500">{chapter ? `Emplacement : ${chapter.title}` : 'Emplacement : chapitre actuel'}</span><div className="rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white">{activePage.exercise ? 'Corriger et page suivante →' : 'Page suivante →'}</div></div>
          {uploading && <div className="mt-3 text-center text-xs font-black text-blue-600">Envoi des images…</div>}
        </div>}
      </main>
      <StudioDistributionSidebar user={user} allClasses={allClasses} allStudents={allStudents} chapters={chapters} distribution={distribution} setDistribution={setDistribution} viewingClass={viewingClass} setViewingClass={setViewingClass} studentSearch={studentSearch} setStudentSearch={setStudentSearch} targetLevel={globalLevel} targetSection={targetSection} loading={saving} onSave={publish} hideChapterSelector defaultSelectAllClasses saveLabel={`PUBLIER (${existingSelection.size + pages.filter((page) => page.blocks.length || page.exercise).length}) 🚀`} />
    </div>
  </div>;
}
