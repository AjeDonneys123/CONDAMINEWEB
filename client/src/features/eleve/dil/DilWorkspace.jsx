import React, { useEffect, useMemo, useRef, useState } from 'react';
import './DilWorkspace.css';

const tokenise = (text = '') => String(text || '').split(/(\s+|[^\p{L}\p{N}'’-]+)/u).filter(Boolean);
const isWord = (value = '') => /[\p{L}]/u.test(value) && !/^\s+$/u.test(value);

export default function DilWorkspace({ user }) {
  const studentId = String(user?._id || user?.id || '');
  const preview = user?.isVisitorPreview === true;
  const [mode, setMode] = useState('translation');
  const [text, setText] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [words, setWords] = useState([]);
  const [trainingIndex, setTrainingIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const fileRef = useRef(null);

  const loadWords = async () => {
    if (!studentId || preview) return setWords([]);
    const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary`);
    if (response.ok) setWords(await response.json());
  };
  useEffect(() => { loadWords(); }, [studentId]);

  const takePhoto = async (event) => {
    const image = event.target.files?.[0];
    event.target.value = '';
    if (!image) return;
    setPhotoBusy(true);
    const form = new FormData(); form.append('image', image);
    try {
      const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId || 'preview')}/ocr`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error);
      setText(data.text || ''); setSelected(null);
    } catch (error) { alert(error.message || 'Lecture de la photo impossible.'); }
    finally { setPhotoBusy(false); }
  };
  const translate = async (french) => {
    const word = String(french || '').trim();
    if (!word) return;
    setSelected({ french: word, spanish: 'Traduction…' });
    try {
      const response = await fetch(`/api/eleve/dil/translate/fr-es?q=${encodeURIComponent(word)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error);
      setSelected(data);
      if (!preview && studentId) {
        await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        loadWords();
      }
    } catch (error) { setSelected({ french: word, spanish: error.message || 'Traduction indisponible' }); }
  };
  const current = words[trainingIndex % Math.max(1, words.length)];
  const known = useMemo(() => words.filter((word) => word.mastered).length, [words]);
  const checkAnswer = async (event) => {
    event.preventDefault(); if (!current) return;
    if (preview) { setFeedback('Mode aperçu : connecte-toi comme élève DIL pour enregistrer la réponse.'); return; }
    const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wordId: current._id, answer }) });
    const data = await response.json();
    setFeedback(data.correct ? 'Bravo, mot connu !' : `Réessaie : la réponse est « ${current.french} ». `);
    if (data.correct) { setAnswer(''); setTrainingIndex((value) => value + 1); loadWords(); }
  };

  return <section className="dil-workspace">
    <div className="dil-heading"><div><span>DIL · ESPAGNOL</span><h2>Comprendre et apprendre</h2><p>Les mots consultés sont gardés pour ton entraînement.</p></div><div className="dil-known">{known} mot{known > 1 ? 's' : ''} connu{known > 1 ? 's' : ''}</div></div>
    <div className="dil-tabs"><button className={mode === 'translation' ? 'active' : ''} onClick={() => setMode('translation')}>📷 TRADUCTION</button><button className={mode === 'training' ? 'active' : ''} onClick={() => setMode('training')}>✍️ ENTRAÎNEMENT</button></div>
    {mode === 'translation' ? <div className="dil-card">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={takePhoto} />
      <div className="dil-actions"><button onClick={() => fileRef.current?.click()} disabled={photoBusy}>{photoBusy ? 'LECTURE DE LA PHOTO…' : '📷 PRENDRE / CHOISIR UNE PHOTO'}</button><span>ou colle / corrige le texte ci-dessous</span></div>
      {selected && <div className="dil-tooltip"><b>{selected.french}</b><span>{selected.spanish}</span></div>}
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Le texte du document apparaîtra ici. Clique ensuite sur un mot français pour le traduire." />
      <div className="dil-text" aria-label="Texte à traduire">{tokenise(text).map((part, index) => isWord(part) ? <button key={`${part}-${index}`} onClick={() => translate(part)}>{part}</button> : <span key={index}>{part}</span>)}</div>
    </div> : <div className="dil-card dil-training">
      {!current ? <p className="dil-empty">Traduis d’abord des mots dans l’onglet Traduction : ils apparaîtront ici.</p> : <form onSubmit={checkAnswer}><div className="dil-instruction">TRADUISEZ EN FRANÇAIS</div><div className="dil-spanish">{current.spanish}</div><input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Écris le mot français" /><button type="submit">VÉRIFIER</button>{feedback && <p className="dil-feedback">{feedback}</p>}</form>}
      {words.length > 0 && <div className="dil-word-list"><b>Mes mots</b>{words.map((word) => <span key={word._id || word.french} className={word.mastered ? 'known' : ''}>{word.spanish} → {word.mastered ? word.french : 'à apprendre'}</span>)}</div>}
    </div>}
  </section>;
}
