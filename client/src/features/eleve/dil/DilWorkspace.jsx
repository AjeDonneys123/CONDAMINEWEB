import React, { useEffect, useMemo, useRef, useState } from 'react';
import './DilWorkspace.css';
import './DilCrop.css';

const tokenise = (text = '') => String(text || '').split(/(\s+|[^\p{L}\p{N}'’-]+)/u).filter(Boolean);
const isWord = (value = '') => /[\p{L}]/u.test(value) && !/^\s+$/u.test(value);
const numberedTitle = (value = '') => /^(?:\d{1,2}\s*[.)-]\s+|(?:I|V|X){1,5}\s*[.)]\s+)[A-ZÀ-ÖØ-Ý]/.test(String(value || '').trim());
const extractCentralDocument = (raw = '', ocrLines = []) => {
  const cleaned = String(raw || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { title: '', body: '' };
  const first = lines[0] || '';
  const firstLine = first.split('\n')[0].trim();
  const heights = (Array.isArray(ocrLines) ? ocrLines : []).map((line) => Number(line?.height || 0)).filter(Boolean).sort((a, b) => a - b);
  const median = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
  const largeTitle = (Array.isArray(ocrLines) ? ocrLines : []).slice(0, 12).find((line) => {
    const value = String(line?.text || '').trim();
    return value.length <= 140 && Number(line?.height || 0) >= median * 1.25;
  })?.text || '';
  const title = largeTitle || (numberedTitle(firstLine) || (firstLine.length <= 110 && !/[.!?;:]$/.test(firstLine)) ? firstLine : '');
  // Aucune coupe automatique : la détection sert uniquement à séparer le
  // titre du corps. L'élève garde toujours l'intégralité de sa photo OCR.
  const body = title && first === title ? lines.slice(1).join('\n') : cleaned;
  return { title, body };
};

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
    setDocumentTitle(''); setText(''); setSelected(null);
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
      const detected = extractCentralDocument(data.text || '', data.lines || []);
      setDocumentTitle(detected.title); setText(detected.body); setSelected(null);
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
    } catch (error) { setSelected({ french: word, index, spanish: error.message || 'Traduction indisponible' }); }
  };
  const saveSelectedWord = async () => {
    if (!selected?.french || !selected?.spanish || preview || !studentId) return;
    const savedResponse = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selected)
    });
    const savedWord = await savedResponse.json().catch(() => null);
    if (!savedResponse.ok || !savedWord) return setSelected((value) => ({ ...value, saveError: savedWord?.error || 'Enregistrement impossible.' }));
    setWords((previous) => [savedWord, ...previous.filter((item) => String(item.french || '').toLocaleLowerCase() !== String(savedWord.french || '').toLocaleLowerCase())]);
    setSelected((value) => ({ ...value, saved: true }));
  };
  const current = words[trainingIndex % Math.max(1, words.length)];
  const known = useMemo(() => words.filter((word) => word.mastered).length, [words]);
  const hasTranscription = Boolean(String(documentTitle || text).trim());
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
      <div className="dil-actions"><button onClick={() => fileRef.current?.click()} disabled={photoBusy}>📷 {hasTranscription ? 'NOUVELLE PHOTO' : 'PRENDRE / CHOISIR UNE PHOTO'}</button>{!hasTranscription && <span>Cadre la zone utile, puis lance la lecture.</span>}</div>
      {photoUrl && !hasTranscription && <div className="dil-crop"><div className="dil-crop-preview"><img src={photoUrl} alt="Document à recadrer" /><div className="dil-crop-window" style={{ top: `${crop.top}%`, left: `${crop.left}%`, right: `${crop.right}%`, bottom: `${crop.bottom}%` }} /></div><div className="dil-crop-controls">{['top', 'bottom', 'left', 'right'].map((side) => <label key={side}>{side === 'top' ? 'Haut' : side === 'bottom' ? 'Bas' : side === 'left' ? 'Gauche' : 'Droite'} <input type="range" min="0" max="45" value={crop[side]} onChange={(event) => setCrop((value) => ({ ...value, [side]: Number(event.target.value) }))} /></label>)}<button onClick={readPhoto} disabled={photoBusy}>{photoBusy ? 'LECTURE…' : 'LIRE LA ZONE CADRÉE'}</button></div></div>}
      <input className="dil-title-input" value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Titre du document (détecté automatiquement)" />
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Le texte du document apparaîtra ici. Clique ensuite sur un mot français pour le traduire." />
      <div className="dil-text" aria-label="Texte à traduire">{documentTitle && <h3>{tokenise(documentTitle).map((part, index) => isWord(part) ? <span className={`dil-word ${selected?.index === `title-${index}` ? 'selected' : ''}`} key={`title-${index}`}><button onClick={() => translate(part, `title-${index}`)}>{part}</button>{selected?.index === `title-${index}` && <small>{selected.spanish}<button className="dil-save-word" onClick={saveSelectedWord} disabled={preview || selected.saved} title="Ajouter à mes mots">{selected.saved ? '✓' : '+'}</button>{selected.saveError && <i>{selected.saveError}</i>}</small>}</span> : part)}</h3>}{tokenise(text).map((part, index) => isWord(part) ? <span className={`dil-word ${selected?.index === index ? 'selected' : ''}`} key={`${part}-${index}`}><button onClick={() => translate(part, index)}>{part}</button>{selected?.index === index && <small>{selected.spanish}<button className="dil-save-word" onClick={saveSelectedWord} disabled={preview || selected.saved} title="Ajouter à mes mots">{selected.saved ? '✓' : '+'}</button>{selected.saveError && <i>{selected.saveError}</i>}</small>}</span> : <span key={index}>{part}</span>)}</div>
    </div> : <div className="dil-card dil-training">
      {!current ? <p className="dil-empty">Traduis d’abord des mots dans l’onglet Traduction : ils apparaîtront ici.</p> : <form onSubmit={checkAnswer}><div className="dil-instruction">TRADUISEZ EN FRANÇAIS</div><div className="dil-spanish">{current.spanish}</div><input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Écris le mot français" /><button type="submit">VÉRIFIER</button>{feedback && <p className="dil-feedback">{feedback}</p>}</form>}
      {words.length > 0 && <div className="dil-word-list"><b>Mes mots</b>{words.map((word) => <span key={word._id || word.french} className={word.mastered ? 'known' : ''}>{word.spanish} → {word.mastered ? word.french : 'à apprendre'}</span>)}</div>}
    </div>}
  </section>;
}
