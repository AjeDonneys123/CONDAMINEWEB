import React, { useEffect, useMemo, useState } from 'react';

const uid = () => `ctrl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const quoted = (text = '') => [...String(text).matchAll(/["“«]([^"”»]+)["”»]/g)].map(match => match[1].trim()).filter(Boolean);
const typeLabel = { fill: 'Texte à trous', target: 'Questions ciblées', qcm: 'QCM' };
const normalizeInitialItems = (rows = []) => {
  let previousKey = ''; let legacyGroupId = '';
  const normalized = rows.map(item => {
    if (item.groupId) return { ...item, points: Number(item.points) || 1 };
    const key = `${item.lessonTitle || ''}:${item.type || ''}`;
    if (item.type === 'fill' || key !== previousKey) legacyGroupId = uid();
    previousKey = key;
    return { ...item, groupId: legacyGroupId, points: Number(item.points) || 1 };
  });
  const totals = new Map();
  normalized.forEach(item => totals.set(item.groupId, (totals.get(item.groupId) || 0) + (Number(item.points) || 0)));
  return normalized.map(item => ({ ...item, groupPoints: Number(item.groupPoints) || totals.get(item.groupId) || 1 }));
};

export default function ControlStudio({ initialData = {}, chapters = [], globalClass = '', user = {}, onClose }) {
  const [title, setTitle] = useState(initialData.title || 'Contrôle');
  const [moduleId, setModuleId] = useState(initialData.learningModuleId || '');
  const [modules, setModules] = useState([]);
  const [items, setItems] = useState(() => normalizeInitialItems(initialData.items || []));
  const [saving, setSaving] = useState(false);
  const chapterId = String(initialData.chapterId || '');

  useEffect(() => {
    fetch('/api/learning/all').then(response => response.ok ? response.json() : []).then(setModules).catch(() => setModules([]));
  }, []);

  const candidates = useMemo(() => modules.filter(module => String(module.chapterId) === chapterId), [modules, chapterId]);
  useEffect(() => { if (!moduleId && candidates[0]) setModuleId(String(candidates[0]._id)); }, [moduleId, candidates]);
  const selected = candidates.find(module => String(module._id) === String(moduleId));

  const lessons = useMemo(() => {
    if (!selected) return [];
    return (selected.sections || []).map(section => {
      const steps = (selected.steps || []).filter(step => String(step.sectionId) === String(section.id));
      const sheet = steps.find(step => step.type === 'sheet' && !step.informationalOnly && !step.isGeneralSheetMaster);
      const fill = steps.find(step => step.type === 'question' && String(step.autoLinkedSheetId) === String(sheet?.id));
      const targets = steps.filter(step => step.type === 'question' && step !== fill).flatMap(step => step.questionAnswerPairs || []);
      const quizzes = steps.filter(step => step.type === 'quiz').flatMap(step => step.quizQuestions || []);
      return { id: section.id, title: section.name, fill, targets, quizzes };
    }).filter(lesson => lesson.fill || lesson.targets.length || lesson.quizzes.length);
  }, [selected]);

  const addType = (lesson, type) => {
    let additions = [];
    const groupId = uid();
    if (type === 'fill') {
      const prompt = String(lesson.fill?.questionAnswerPairs?.[0]?.question || '');
      if (prompt) additions = [{ id: uid(), groupId, groupPoints: 1, type, lessonTitle: lesson.title, prompt, expectedAnswers: quoted(prompt), points: 1 }];
    } else if (type === 'target') {
      const sources = lesson.targets.length ? lesson.targets : [{ question: '', expectedAnswer: '', expectedKeywords: [] }];
      additions = sources.map(pair => ({
        id: uid(), groupId, groupPoints: 1, type, lessonTitle: lesson.title,
        prompt: pair.question || pair.q || '',
        expectedAnswers: [pair.answer || pair.expectedAnswer].filter(Boolean),
        expectedKeywords: (pair.expectedKeywords || []).filter(Boolean),
        points: 1 / sources.length
      }));
    } else {
      additions = lesson.quizzes.map(question => ({
        id: uid(), groupId, groupPoints: 1, type, lessonTitle: lesson.title,
        prompt: question.question || '', choices: question.choices || [],
        correctIndex: Number(question.correctIndex) || 0, points: 1 / lesson.quizzes.length
      }));
    }
    if (!additions.length) return;
    setItems(current => [...current, ...additions]);
  };

  const updateItem = (index, patch) => setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const blocks = useMemo(() => {
    const result = [];
    items.forEach((item, itemIndex) => {
      const key = String(item.groupId || item.id);
      let block = result.find(candidate => candidate.key === key);
      if (!block) { block = { key, rows: [] }; result.push(block); }
      block.rows.push({ item, itemIndex });
    });
    return result;
  }, [items]);
  const moveBlock = (from, to) => {
    if (!Number.isInteger(from) || from === to) return;
    const next = blocks.map(block => block.rows.map(row => row.item));
    const [moved] = next.splice(from, 1); next.splice(to, 0, moved); setItems(next.flat());
  };
  const updateBlockPoints = (block, rawPoints) => {
    const groupPoints = Math.max(0, Number(rawPoints) || 0);
    const divided = block.rows.length ? groupPoints / block.rows.length : 0;
    const indexes = new Set(block.rows.map(row => row.itemIndex));
    setItems(current => current.map((item, index) => indexes.has(index) ? { ...item, groupPoints, points: divided } : item));
  };
  const addQuestionToBlock = block => {
    const first = block.rows[0]?.item;
    if (!first || !['qcm', 'target'].includes(first.type)) return;
    const groupPoints = Number(first.groupPoints) || block.rows.reduce((sum, row) => sum + (Number(row.item.points) || 0), 0) || 1;
    const added = first.type === 'qcm'
      ? { id: uid(), groupId: first.groupId || block.key, groupPoints, type: 'qcm', lessonTitle: first.lessonTitle, prompt: '', choices: ['', '', '', ''], correctIndex: 0 }
      : { id: uid(), groupId: first.groupId || block.key, groupPoints, type: 'target', lessonTitle: first.lessonTitle, prompt: '', expectedAnswers: [], expectedKeywords: [] };
    const ids = new Set(block.rows.map(row => row.item.id));
    setItems(current => {
      const nextCount = block.rows.length + 1;
      const redistributed = current.map(item => ids.has(item.id) ? { ...item, groupPoints, points: groupPoints / nextCount } : item);
      const lastIndex = Math.max(...block.rows.map(row => row.itemIndex));
      redistributed.splice(lastIndex + 1, 0, { ...added, points: groupPoints / nextCount });
      return redistributed;
    });
  };
  const removeQuestionFromBlock = (block, itemId) => {
    const groupPoints = Number(block.rows[0]?.item.groupPoints) || block.rows.reduce((sum, row) => sum + (Number(row.item.points) || 0), 0) || 1;
    const remainingIds = new Set(block.rows.filter(row => row.item.id !== itemId).map(row => row.item.id));
    const remainingCount = remainingIds.size;
    setItems(current => current
      .filter(item => item.id !== itemId)
      .map(item => remainingIds.has(item.id) ? { ...item, groupPoints, points: groupPoints / remainingCount } : item));
  };
  const deleteBlock = block => { const indexes = new Set(block.rows.map(row => row.itemIndex)); setItems(current => current.filter((_, index) => !indexes.has(index))); };
  const totalPoints = items.reduce((sum, item) => sum + Math.max(0, Number(item.points) || 0), 0);

  const save = async () => {
    if (!items.length) return alert('Ajoutez au moins une question.');
    setSaving(true);
    try {
      const chapter = chapters.find(candidate => String(candidate._id) === chapterId);
      const response = await fetch('/api/controls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...initialData, title, subject: chapter?.section || initialData.subject, chapterId, learningModuleId: moduleId, teacherId: user._id || user.id, targetClassrooms: initialData.targetClassrooms?.length ? initialData.targetClassrooms : [globalClass], items })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur');
      onClose();
    } catch (error) { alert(error.message); } finally { setSaving(false); }
  };

  return <div className="p-6 md:p-10 bg-slate-50 min-h-[700px]">
    <div className="max-w-[1500px] mx-auto flex justify-between items-center mb-6">
      <div><div className="text-xs font-black text-rose-500 uppercase">Nouveau type d’activité</div><h1 className="text-4xl font-black text-slate-900">📝 CONTRÔLE</h1></div>
      <button onClick={onClose} className="w-12 h-12 rounded-full bg-white border text-2xl">×</button>
    </div>
    <div className="max-w-[1500px] mx-auto grid lg:grid-cols-[420px_1fr] gap-6">
      <section className="bg-white rounded-3xl border p-5 space-y-4 self-start lg:sticky lg:top-4">
        <input className="w-full border-2 rounded-2xl p-4 text-xl font-black" value={title} onChange={event => setTitle(event.target.value)} placeholder="Titre du contrôle" />
        <select className="w-full border-2 rounded-2xl p-3 font-bold" value={moduleId} onChange={event => setModuleId(event.target.value)}>
          {candidates.map(module => <option key={module._id} value={module._id}>{module.title} · {module.targetClassrooms?.join(', ')}</option>)}
        </select>
        {lessons.map(lesson => <details key={lesson.id} className="border rounded-2xl p-3">
          <summary className="font-black cursor-pointer">{lesson.title}</summary>
          <div className="mt-3 grid gap-2">
            {lesson.fill && <button className="px-3 py-3 rounded-xl bg-blue-100 text-blue-800 font-black text-left" onClick={() => addType(lesson, 'fill')}>+ Texte à trous</button>}
            <button className="px-3 py-3 rounded-xl bg-amber-100 text-amber-800 font-black text-left" onClick={() => addType(lesson, 'target')}>+ Questions ciblées{lesson.targets.length ? ` (${lesson.targets.length})` : ''}</button>
            {lesson.quizzes.length > 0 && <button className="px-3 py-3 rounded-xl bg-violet-100 text-violet-800 font-black text-left" onClick={() => addType(lesson, 'qcm')}>+ QCM ({lesson.quizzes.length})</button>}
          </div>
        </details>)}
      </section>

      <section className="bg-white rounded-3xl border p-5">
        <div className="flex items-center justify-between mb-4"><h2 className="font-black text-xl">Contenu et ordre · {items.length} question(s)</h2><strong className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2">Barème : {totalPoints.toLocaleString('fr-FR')} pts</strong></div>
        <div className="space-y-4">{blocks.map((block, blockIndex) => { const first = block.rows[0].item; const blockPoints = first.groupPoints ?? block.rows.reduce((sum, row) => sum + (Number(row.item.points) || 0), 0); return <article key={block.key} onDragOver={event => event.preventDefault()} onDrop={event => moveBlock(Number(event.dataTransfer.getData('text/control-block')), blockIndex)} className="border-2 rounded-2xl p-4 bg-slate-50">
          <div className="flex gap-3 items-center mb-3"><span draggable onDragStart={event => { event.dataTransfer.setData('text/control-block', String(blockIndex)); event.dataTransfer.effectAllowed = 'move'; }} className="cursor-grab active:cursor-grabbing select-none text-slate-400 text-xl" title="Déplacer cette partie">⋮⋮</span><div className="flex-1 text-xs uppercase font-black text-violet-600">{blockIndex + 1}. {typeLabel[first.type]} · {first.lessonTitle} {block.rows.length > 1 ? `(${block.rows.length} questions)` : ''}</div>{['qcm', 'target'].includes(first.type) && <button type="button" onClick={() => addQuestionToBlock(block)} className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700">＋ QUESTION</button>}<label className="font-black text-sm">Barème <input type="number" min="0.25" step="0.25" value={blockPoints} onChange={event => updateBlockPoints(block, event.target.value)} className="ml-2 w-20 rounded-lg border p-2 text-center" /> pts</label><button onClick={() => deleteBlock(block)} className="text-red-500 text-xl font-black" title="Supprimer toute la partie">×</button></div>
          <div className={block.rows.length > 1 ? 'max-h-[650px] overflow-y-auto pr-2 space-y-4' : ''}>{block.rows.map(({ item, itemIndex }, questionIndex) => <div key={item.id} className={block.rows.length > 1 ? 'rounded-2xl border bg-white p-4' : ''}>
            <div className="mb-2 flex items-center justify-between"><div className="text-xs font-black text-slate-500">{block.rows.length > 1 ? `QUESTION ${questionIndex + 1}` : 'QUESTION'}</div>{['qcm', 'target'].includes(item.type) && <button type="button" onClick={() => removeQuestionFromBlock(block, item.id)} className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 font-black text-red-500" title="Supprimer cette question">×</button>}</div>
            <textarea value={item.prompt || ''} onChange={event => updateItem(itemIndex, { prompt: event.target.value, ...(item.type === 'fill' ? { expectedAnswers: quoted(event.target.value) } : {}) })} className="w-full min-h-[110px] rounded-xl border bg-white p-3 font-semibold" />
            {item.type === 'fill' && <div className="mt-3 rounded-xl bg-blue-50 p-3"><div className="text-xs font-black text-blue-700 mb-2">Réponses extraites des guillemets · {item.expectedAnswers?.length || 0} trou(s)</div><div className="grid sm:grid-cols-2 gap-2">{(item.expectedAnswers || []).map((answer, answerIndex) => <input key={answerIndex} value={answer} onChange={event => { const expectedAnswers = [...item.expectedAnswers]; expectedAnswers[answerIndex] = event.target.value; updateItem(itemIndex, { expectedAnswers }); }} className="rounded-lg border p-2" />)}</div></div>}
            {item.type === 'target' && <div className="mt-3 grid md:grid-cols-2 gap-3"><label className="text-xs font-black text-amber-700">Réponse modèle<textarea value={(item.expectedAnswers || []).join('\n')} onChange={event => updateItem(itemIndex, { expectedAnswers: event.target.value.split('\n') })} className="mt-1 w-full min-h-[90px] rounded-xl border bg-amber-50 p-3 font-medium" /></label><label className="text-xs font-black text-amber-700">Mots attendus (un par ligne)<textarea value={(item.expectedKeywords || []).join('\n')} onChange={event => updateItem(itemIndex, { expectedKeywords: event.target.value.split('\n') })} className="mt-1 w-full min-h-[90px] rounded-xl border bg-amber-50 p-3 font-medium" /></label></div>}
            {item.type === 'qcm' && <div className="mt-3 grid gap-2">{(item.choices || []).map((choice, choiceIndex) => <label key={choiceIndex} className={`flex gap-2 items-center rounded-xl border p-2 ${Number(item.correctIndex) === choiceIndex ? 'bg-green-50 border-green-400' : 'bg-white'}`}><input type="radio" checked={Number(item.correctIndex) === choiceIndex} onChange={() => updateItem(itemIndex, { correctIndex: choiceIndex })} /><input value={choice} onChange={event => { const choices = [...item.choices]; choices[choiceIndex] = event.target.value; updateItem(itemIndex, { choices }); }} className="flex-1 bg-transparent p-1 font-semibold" /></label>)}</div>}
            <div className="mt-2 text-xs text-slate-500 font-bold">Part de cette question : {(Number(item.points) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} pt(s).</div>
          </div>)}</div>
          <div className="mt-3 text-xs font-black text-violet-700">{blockPoints} point(s) divisés entre {first.type === 'fill' ? `${first.expectedAnswers?.length || 0} trous` : `${block.rows.length} réponse(s)`}.</div>
        </article>; })}</div>
        <button onClick={save} disabled={saving} className="mt-5 w-full p-4 rounded-2xl bg-rose-600 text-white font-black text-lg">{saving ? 'ENREGISTREMENT…' : `PUBLIER LE CONTRÔLE · ${totalPoints.toLocaleString('fr-FR')} PTS`}</button>
      </section>
    </div>
  </div>;
}
