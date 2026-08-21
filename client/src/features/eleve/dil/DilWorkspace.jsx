import React, { useEffect, useMemo, useRef, useState } from 'react';
import './DilWorkspace.css';

const tokenise = (text = '') => String(text || '').split(/(\s+|[^\p{L}\p{N}'’-]+)/u).filter(Boolean);
const isWord = (value = '') => /[\p{L}]/u.test(value) && !/^\s+$/u.test(value);

export default function DilWorkspace({ user }) {
  const studentId = String(user?._id || user?.id || '');
  const preview = user?.isVisitorPreview === true;
  const [mode, setMode] = useState('translation');
  const [documentTitle, setDocumentTitle] = useState('');
  const [text, setText] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [crop, setCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
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

  const selectPhoto = (event) => {
    const image = event.target.files?.[0];
    event.target.value = '';
    if (!image) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoFile(image); setPhotoUrl(URL.createObjectURL(image)); setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
  };
  const cropPhoto = async () => {
    if (!photoFile) return null;
    const sourceUrl = URL.createObjectURL(photoFile);
    try {
      const image = await new Promise((resolve, reject) => { const node = new Image(); node.onload = () => resolve(node); node.onerror = reject; node.src = sourceUrl; });
      const left = Math.round(image.width * crop.left / 100), top = Math.round(image.height * crop.top / 100);
      const width = Math.max(1, image.width - left - Math.round(image.width * crop.right / 100));
      const height = Math.max(1, image.height - top - Math.round(image.height * crop.bottom / 100));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(image, left, top, width, height, 0, 0, width, height);
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    } finally { URL.revokeObjectURL(sourceUrl); }
  };
  const readPhoto = async () => {
    if (!photoFile) return;
    setPhotoBusy(true);
    try {
      const image = await cropPhoto();
      if (!image) throw new Error('Recadrage impossible.');
      const form = new FormData(); form.append('image', image, 'document.jpg');
      const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId || 'preview')}/ocr`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error);
      const lines = String(data.text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
      const first = lines[0] || '';
      const looksLikeTitle = first.length <= 110 && !/[.!?;:]$/.test(first);
      setDocumentTitle(looksLikeTitle ? first : '');
      setText((looksLikeTitle ? lines.slice(1) : lines).join('\n')); setSelected(null);
    } catch (error) { alert(error.message || 'Lecture de la photo impossible.'); }
    finally { setPhotoBusy(false); }
  };
  const translate = async (french, index) => {
    const word = String(french || '').trim();
    if (!word) return;
    setSelected({ french: word, index, spanish: 'Traduction…' });
    try {
      const response = await fetch(`/api/eleve/dil/translate/fr-es?q=${encodeURIComponent(word)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error);
      setSelected({ ...data, index });
      if (!preview && studentId) {
        await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        loadWords();
      }
    } catch (error) { setSelected({ french: word, index, spanish: error.message || 'Traduction indisponible' }); }
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
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={selectPhoto} />
      <div className="dil-actions"><button onClick={() => fileRef.current?.click()} disabled={photoBusy}>📷 PRENDRE / CHOISIR UNE PHOTO</button><span>Recadre la zone utile avant la lecture.</span></div>
      {photoUrl && <div className="dil-crop"><img src={photoUrl} alt="Document à recadrer" /><div className="dil-crop-controls">{['top', 'bottom', 'left', 'right'].map((side) => <label key={side}>{side === 'top' ? 'Haut' : side === 'bottom' ? 'Bas' : side === 'left' ? 'Gauche' : 'Droite'} <input type="range" min="0" max="45" value={crop[side]} onChange={(event) => setCrop((value) => ({ ...value, [side]: Number(event.target.value) }))} /></label>)}<button onClick={readPhoto} disabled={photoBusy}>{photoBusy ? 'LECTURE…' : 'LIRE LA ZONE CADRÉE'}</button></div></div>}
      <input className="dil-title-input" value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Titre du document (détecté automatiquement)" />
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Le texte du document apparaîtra ici. Clique ensuite sur un mot français pour le traduire." />
      <div className="dil-text" aria-label="Texte à traduire">{documentTitle && <h3>{tokenise(documentTitle).map((part, index) => isWord(part) ? <span className={`dil-word ${selected?.index === `title-${index}` ? 'selected' : ''}`} key={`title-${index}`}><button onClick={() => translate(part, `title-${index}`)}>{part}</button>{selected?.index === `title-${index}` && <small>{selected.spanish}</small>}</span> : part)}</h3>}{tokenise(text).map((part, index) => isWord(part) ? <span className={`dil-word ${selected?.index === index ? 'selected' : ''}`} key={`${part}-${index}`}><button onClick={() => translate(part, index)}>{part}</button>{selected?.index === index && <small>{selected.spanish}</small>}</span> : <span key={index}>{part}</span>)}</div>
    </div> : <div className="dil-card dil-training">
      {!current ? <p className="dil-empty">Traduis d’abord des mots dans l’onglet Traduction : ils apparaîtront ici.</p> : <form onSubmit={checkAnswer}><div className="dil-instruction">TRADUISEZ EN FRANÇAIS</div><div className="dil-spanish">{current.spanish}</div><input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Écris le mot français" /><button type="submit">VÉRIFIER</button>{feedback && <p className="dil-feedback">{feedback}</p>}</form>}
      {words.length > 0 && <div className="dil-word-list"><b>Mes mots</b>{words.map((word) => <span key={word._id || word.french} className={word.mastered ? 'known' : ''}>{word.spanish} → {word.mastered ? word.french : 'à apprendre'}</span>)}</div>}
    </div>}
  </section>;
}
