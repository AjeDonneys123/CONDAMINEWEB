import React, { useEffect, useMemo, useRef, useState } from 'react';
import './DilWorkspace.css';
import './DilCrop.css';
import { startSpeechRecognitionWithFallback } from '../../../utils/speechRecognitionWithFallback';

const tokenise = (text = '') => String(text || '').split(/(\s+|[^\p{L}\p{N}'’-]+)/u).filter(Boolean);
const isWord = (value = '') => /[\p{L}]/u.test(value) && !/^\s+$/u.test(value);
const expressionWords = (value = '') => String(value || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || [];
const normaliseExpressionWord = (value = '') => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const numberedTitle = (value = '') => /^(?:\d{1,2}\s*[.)-]\s+|(?:I|V|X){1,5}\s*[.)]\s+)[A-ZÀ-ÖØ-Ý]/.test(String(value || '').trim());
const extractCentralDocument = (raw = '') => {
  const cleaned = String(raw || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { title: '', body: '' };
  // Ne jamais chercher un titre dans le corps du texte. L'ancienne détection
  // utilisait la taille de police de n'importe quelle ligne OCR et pouvait
  // donc transformer une phrase intérieure en « titre ».
  let cursor = 0;
  const titleParts = [];
  const first = lines[0] || '';
  const startsWithSectionNumber = /^\d{1,2}$/.test(first);
  if (startsWithSectionNumber || numberedTitle(first)) {
    titleParts.push(first);
    cursor = 1;
    if (lines[cursor]) {
      titleParts.push(lines[cursor]);
      cursor += 1;
      // Une ligne qui commence en minuscule est la suite visuelle du titre
      // dans l'OCR, pas une nouvelle phrase du corps.
      while (lines[cursor] && /^[a-zà-öø-ÿ]/u.test(lines[cursor]) && !/[.!?;:]$/.test(titleParts.at(-1))) {
        titleParts.push(lines[cursor]);
        cursor += 1;
      }
    }
  }
  const title = titleParts.join(' ');
  // Le reste reste intégral : aucun contenu n'est retiré au-delà du titre
  // identifié au tout début du document.
  const body = title ? lines.slice(cursor).join('\n') : cleaned;
  return { title, body };
};

export default function DilWorkspace({ user, frenchMode = false }) {
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
  const [correctionPhase, setCorrectionPhase] = useState('identify');
  const [selectedIncorrectWords, setSelectedIncorrectWords] = useState([]);
  const [correctionAnswers, setCorrectionAnswers] = useState({});
  const [manualOpen, setManualOpen] = useState(false);
  const [manualWord, setManualWord] = useState('');
  const [manualLanguage, setManualLanguage] = useState('fr');
  const [manualFrench, setManualFrench] = useState('');
  const [manualSpanish, setManualSpanish] = useState('');
  const [manualWordId, setManualWordId] = useState('');
  const [manualSaved, setManualSaved] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualListening, setManualListening] = useState(false);
  const [manualError, setManualError] = useState('');
  const [newExpression, setNewExpression] = useState('');
  const [newExpressionBusy, setNewExpressionBusy] = useState(false);
  const [newExpressionError, setNewExpressionError] = useState('');
  const fileRef = useRef(null);
  const manualSpeechRef = useRef(null);

  useEffect(() => {
    if (frenchMode) setMode('words');
  }, [frenchMode]);

  const pronounceFrench = (value) => {
    const french = String(value || '').trim();
    if (!french || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(french);
    speech.lang = 'fr-FR';
    speech.rate = 0.88;
    window.speechSynthesis.speak(speech);
  };

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
      // Le cadre violet est exprimé en pourcentage de l'image rendue. Les
      // mêmes pourcentages sont appliqués à ses dimensions naturelles : le
      // JPEG envoyé à l'OCR ne contient ainsi QUE la zone visible du cadre.
      const sourceWidth = Number(image.naturalWidth || image.width || 0);
      const sourceHeight = Number(image.naturalHeight || image.height || 0);
      if (!sourceWidth || !sourceHeight) throw new Error('Dimensions de la photo introuvables.');
      const leftRatio = Math.max(0, Math.min(0.95, Number(crop.left || 0) / 100));
      const rightRatio = Math.max(0, Math.min(0.95, Number(crop.right || 0) / 100));
      const topRatio = Math.max(0, Math.min(0.95, Number(crop.top || 0) / 100));
      const bottomRatio = Math.max(0, Math.min(0.95, Number(crop.bottom || 0) / 100));
      const left = Math.round(sourceWidth * leftRatio);
      const top = Math.round(sourceHeight * topRatio);
      const right = Math.round(sourceWidth * (1 - rightRatio));
      const bottom = Math.round(sourceHeight * (1 - bottomRatio));
      const width = right - left;
      const height = bottom - top;
      if (width < 2 || height < 2) throw new Error('La zone cadrée est trop petite.');

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Création de la zone cadrée impossible.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, left, top, width, height, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
      if (!blob) throw new Error('Création de la photo recadrée impossible.');
      return { blob, width, height };
    } finally { URL.revokeObjectURL(sourceUrl); }
  };
  const readPhoto = async () => {
    if (!photoFile) return;
    setPhotoBusy(true);
    try {
      const cropped = await cropPhoto();
      if (!cropped?.blob) throw new Error('Recadrage impossible.');
      const croppedFile = new File([cropped.blob], `zone-${cropped.width}x${cropped.height}.jpg`, { type: 'image/jpeg' });
      const form = new FormData(); form.append('image', croppedFile);
      const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId || 'preview')}/ocr`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error);
      const detected = extractCentralDocument(data.text || '');
      setDocumentTitle(detected.title); setText(detected.body); setSelected(null);
    } catch (error) { alert(error.message || 'Lecture de la photo impossible.'); }
    finally { setPhotoBusy(false); }
  };
  const translate = async (french, index) => {
    const word = String(french || '').trim();
    if (!word) return;
    const knownWord = words.find((item) => String(item.french || '').toLocaleLowerCase() === word.toLocaleLowerCase());
    setSelected({ french: word, index, spanish: knownWord?.spanish || 'Traduction…', saved: Boolean(knownWord), wordId: knownWord?._id || '' });
    try {
      const response = await fetch(`/api/eleve/dil/translate/fr-es?q=${encodeURIComponent(word)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error);
      const savedWord = words.find((item) => String(item.french || '').toLocaleLowerCase() === word.toLocaleLowerCase());
      setSelected({ ...data, index, saved: Boolean(savedWord), wordId: savedWord?._id || '' });
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
    setSelected((value) => ({ ...value, saved: true, wordId: savedWord._id }));
  };
  const toggleSelectedWord = async () => {
    if (!selected?.french) return;
    // L'aperçu professeur n'a pas d'identifiant élève : il doit néanmoins
    // permettre de tester le clic +/✓ sans écrire dans la base.
    if (preview || !studentId) {
      if (selected.saved) {
        setWords((previous) => previous.filter((item) => String(item._id) !== String(selected.wordId)));
        setSelected((value) => ({ ...value, saved: false, wordId: '', saveError: '' }));
      } else {
        const localWord = { _id: `preview_${Date.now()}`, french: selected.french, spanish: selected.spanish, mastered: false };
        setWords((previous) => [localWord, ...previous.filter((item) => String(item.french || '').toLocaleLowerCase() !== String(localWord.french).toLocaleLowerCase())]);
        setSelected((value) => ({ ...value, saved: true, wordId: localWord._id, saveError: '' }));
      }
      return;
    }
    if (!selected.saved) return saveSelectedWord();
    const stored = selected.wordId || words.find((item) => String(item.french || '').toLocaleLowerCase() === String(selected.french || '').toLocaleLowerCase())?._id;
    if (!stored) return;
    const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary/${encodeURIComponent(stored)}`, { method: 'DELETE' });
    if (!response.ok) return setSelected((value) => ({ ...value, saveError: 'Suppression impossible.' }));
    setWords((previous) => previous.filter((item) => String(item._id) !== String(stored)));
    setSelected((value) => ({ ...value, saved: false, wordId: '', saveError: '' }));
  };
  const selectOrToggleWord = (french, index) => {
    if (selected?.index === index && selected?.spanish && selected.spanish !== 'Traduction…') {
      toggleSelectedWord();
      return;
    }
    translate(french, index);
  };
  const translateManualWord = async (value = manualWord) => {
    const input = String(value || '').trim();
    if (!input) return setManualError(manualLanguage === 'fr' ? 'Écris un mot français.' : 'Écris un mot espagnol.');
    setManualBusy(true); setManualError('');
    const knownWord = words.find((item) => String(manualLanguage === 'fr' ? item.french : item.spanish || '').toLocaleLowerCase() === input.toLocaleLowerCase());
    setManualSaved(Boolean(knownWord)); setManualWordId(knownWord?._id || '');
    try {
      const route = manualLanguage === 'fr' ? 'fr-es' : 'es-fr';
      const response = await fetch(`/api/eleve/dil/translate/${route}?q=${encodeURIComponent(input)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Traduction indisponible.');
      setManualFrench(data.french || (manualLanguage === 'fr' ? input : ''));
      setManualSpanish(data.spanish || (manualLanguage === 'es' ? input : ''));
    } catch (error) { setManualFrench(''); setManualSpanish(''); setManualError(error.message || 'Traduction indisponible.'); }
    finally { setManualBusy(false); }
  };
  const toggleManualWord = async () => {
    const french = String(manualFrench || (manualLanguage === 'fr' ? manualWord : '')).trim();
    const spanish = String(manualSpanish || (manualLanguage === 'es' ? manualWord : '')).trim();
    if (!french || !spanish) return;
    if (preview || !studentId) {
      if (manualSaved) {
        setWords((previous) => previous.filter((item) => String(item._id) !== String(manualWordId)));
        setManualSaved(false); setManualWordId('');
      } else {
        const localWord = { _id: `preview_manual_${Date.now()}`, french, spanish, mastered: false };
        setWords((previous) => [localWord, ...previous.filter((item) => String(item.french || '').toLocaleLowerCase() !== french.toLocaleLowerCase())]);
        setManualSaved(true); setManualWordId(localWord._id);
        pronounceFrench(french);
      }
      return;
    }
    if (!manualSaved) {
      const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ french, spanish }) });
      const saved = await response.json().catch(() => null);
      if (!response.ok || !saved) return setManualError(saved?.error || 'Enregistrement impossible.');
      setWords((previous) => [saved, ...previous.filter((item) => String(item.french || '').toLocaleLowerCase() !== french.toLocaleLowerCase())]);
      setManualSaved(true); setManualWordId(saved._id);
      pronounceFrench(french);
      return;
    }
    if (!manualWordId) return;
    const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary/${encodeURIComponent(manualWordId)}`, { method: 'DELETE' });
    if (!response.ok) return setManualError('Suppression impossible.');
    setWords((previous) => previous.filter((item) => String(item._id) !== String(manualWordId)));
    setManualSaved(false); setManualWordId('');
  };
  const dictateManualWord = () => {
    if (manualListening) {
      manualSpeechRef.current?.stop?.();
      manualSpeechRef.current = null;
      setManualListening(false);
      return;
    }
    setManualError('');
    manualSpeechRef.current = startSpeechRecognitionWithFallback({
      lang: manualLanguage === 'fr' ? 'fr-FR' : 'es-ES',
      fallbackDurationMs: 5000,
      onStart: () => setManualListening(true),
      onFallbackStart: () => setManualError('Reconnaissance Google indisponible : transcription de secours en cours…'),
      onResult: (value, meta) => {
        if (meta?.source === 'native' && meta?.final === false) return;
        setManualWord(value); setManualFrench(''); setManualSpanish(''); setManualSaved(false); setManualWordId(''); setManualError('');
        translateManualWord(value);
      },
      onError: (error) => setManualError(error.message || 'La dictée a échoué.'),
      onEnd: () => { setManualListening(false); manualSpeechRef.current = null; }
    });
  };
  const current = words[trainingIndex % Math.max(1, words.length)];
  useEffect(() => {
    setCorrectionPhase('identify');
    setSelectedIncorrectWords([]);
    setCorrectionAnswers({});
    setFeedback('');
  }, [current?._id]);
  const learnedWords = useMemo(() => words
    .filter((word) => Number(word.correctStreak || 0) >= 4)
    .sort((left, right) => String(left.french || '').localeCompare(String(right.french || ''), 'fr')), [words]);
  const known = learnedWords.length;
  const addedThisHour = useMemo(() => {
    const hourAgo = Date.now() - (60 * 60 * 1000);
    return words.filter((word) => new Date(word.createdAt || 0).getTime() >= hourAgo).length;
  }, [words]);
  const wordsByNeed = useMemo(() => [...words].sort((left, right) => {
    const leftWrong = Number(left.wrongCount || 0);
    const rightWrong = Number(right.wrongCount || 0);
    if (rightWrong !== leftWrong) return rightWrong - leftWrong;
    const leftCorrect = Number(left.correctCount || 0);
    const rightCorrect = Number(right.correctCount || 0);
    if (leftCorrect !== rightCorrect) return leftCorrect - rightCorrect;
    return String(left.french || '').localeCompare(String(right.french || ''), 'fr');
  }), [words]);
  const hasTranscription = Boolean(String(documentTitle || text).trim());
  const checkAnswer = async (event) => {
    event.preventDefault(); if (!current) return;
    if (preview) { setFeedback('Mode aperçu : connecte-toi comme élève DIL pour enregistrer la réponse.'); return; }
    const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wordId: current._id, answer }) });
    const data = await response.json();
    setFeedback(data.correct ? 'Bravo, mot connu !' : `Réessaie : la réponse est « ${current.french} ». `);
    if (data.correct) { setAnswer(''); setTrainingIndex((value) => value + 1); loadWords(); }
  };
  const toggleIncorrectWord = (token) => {
    const key = normaliseExpressionWord(token);
    if (!key || correctionPhase !== 'identify') return;
    setSelectedIncorrectWords((items) => items.some((item) => normaliseExpressionWord(item) === key)
      ? items.filter((item) => normaliseExpressionWord(item) !== key)
      : [...items, token]);
  };
  const checkIncorrectSelection = () => {
    const expected = [...new Set((current?.incorrectWords || []).map(normaliseExpressionWord).filter(Boolean))].sort();
    const selectedWords = [...new Set(selectedIncorrectWords.map(normaliseExpressionWord).filter(Boolean))].sort();
    if (expected.length === selectedWords.length && expected.every((word, index) => word === selectedWords[index])) {
      setCorrectionPhase('complete');
      setFeedback('Bien repéré ! Complète maintenant la phrase correcte.');
    } else {
      setFeedback('Certains mots incorrects ne sont pas encore bien repérés. Réessaie.');
    }
  };
  const checkCorrectionAnswer = async (event) => {
    event.preventDefault();
    if (!current) return;
    const missingIndexes = tokenise(current.french).map((token, index) => ({ token, index }))
      .filter(({ token }) => isWord(token) && (current.focusWords || []).some((word) => normaliseExpressionWord(word) === normaliseExpressionWord(token)));
    const correct = missingIndexes.length > 0 && missingIndexes.every(({ token, index }) => normaliseExpressionWord(correctionAnswers[index]) === normaliseExpressionWord(token));
    if (!correct) return setFeedback('Il reste une erreur dans la phrase correcte.');
    if (preview) return setFeedback('Bravo, la phrase est corrigée !');
    const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wordId: current._id, answer: current.french }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.correct) return setFeedback('La réponse n’a pas pu être enregistrée.');
    setFeedback('Bravo, la phrase est corrigée !');
    window.setTimeout(() => { setTrainingIndex((value) => value + 1); loadWords(); }, 650);
  };
  const renderCorrectionTraining = () => {
    if (!current) return null;
    if (correctionPhase === 'identify') return <div className="dil-correction-exercise"><div className="dil-instruction">CLIQUE SUR LES MOTS INCORRECTS</div><div className="dil-error-sentence">{tokenise(current.incorrectSentence).map((token, index) => isWord(token) ? <button type="button" key={`${token}-${index}`} className={selectedIncorrectWords.some((word) => normaliseExpressionWord(word) === normaliseExpressionWord(token)) ? 'selected' : ''} onClick={() => toggleIncorrectWord(token)}>{token}</button> : <span key={index}>{token}</span>)}</div><button type="button" onClick={checkIncorrectSelection}>VÉRIFIER LES MOTS</button></div>;
    return <form className="dil-correction-exercise" onSubmit={checkCorrectionAnswer}><div className="dil-instruction">COMPLÈTE LA PHRASE CORRECTE</div><div className="dil-correct-sentence">{tokenise(current.french).map((token, index) => isWord(token) && (current.focusWords || []).some((word) => normaliseExpressionWord(word) === normaliseExpressionWord(token)) ? <input key={`${token}-${index}`} value={correctionAnswers[index] || ''} onChange={(event) => setCorrectionAnswers((values) => ({ ...values, [index]: event.target.value }))} aria-label={`Mot manquant ${index + 1}`} /> : <span key={index}>{token}</span>)}</div><button type="submit">VÉRIFIER LA PHRASE</button></form>;
  };
  const toggleExpressionFocus = async (word, token) => {
    if (preview || !studentId || !word?._id) return;
    const key = normaliseExpressionWord(token);
    if (!key) return;
    const previous = Array.isArray(word.focusWords) ? word.focusWords : [];
    const focusWords = previous.some((item) => normaliseExpressionWord(item) === key)
      ? previous.filter((item) => normaliseExpressionWord(item) !== key)
      : [...previous, token];
    const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ french: word.french, spanish: word.spanish, focusWords, source: word.source || 'student-french' })
    });
    if (response.ok) loadWords();
  };
  const addStudentExpression = async (event) => {
    event.preventDefault();
    const french = String(newExpression || '').trim().replace(/\s+/g, ' ');
    if (!french) return setNewExpressionError('Écris un mot ou une expression.');
    setNewExpressionBusy(true);
    setNewExpressionError('');
    try {
      if (preview || !studentId) {
        const localWord = { _id: `preview_expression_${Date.now()}`, french, spanish: french, focusWords: [], mastered: false, createdAt: new Date().toISOString() };
        setWords((previous) => [localWord, ...previous.filter((item) => normaliseExpressionWord(item.french) !== normaliseExpressionWord(french))]);
      } else {
        const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ french, spanish: french, focusWords: [] })
        });
        const saved = await response.json().catch(() => null);
        if (!response.ok || !saved) throw new Error(saved?.error || 'Enregistrement impossible.');
        setWords((previous) => [saved, ...previous.filter((item) => normaliseExpressionWord(item.french) !== normaliseExpressionWord(french))]);
      }
      setNewExpression('');
      pronounceFrench(french);
    } catch (error) {
      setNewExpressionError(error.message || 'Enregistrement impossible.');
    } finally {
      setNewExpressionBusy(false);
    }
  };

  return <section className="dil-workspace">
    <div className="dil-heading"><div><span>{frenchMode ? 'FRANÇAIS · MOTS ET EXPRESSIONS' : 'DIL · ESPAGNOL'}</span><h2>{frenchMode ? 'Lire et mémoriser' : 'Comprendre et apprendre'}</h2><p>{frenchMode ? 'Ton professeur et toi pouvez ajouter des mots et expressions à cette liste.' : 'Les mots consultés sont gardés pour ton entraînement.'}</p></div><div className="dil-heading-stats"><div className="dil-known">{known} mot{known > 1 ? 's' : ''} connu{known > 1 ? 's' : ''}</div><div className="dil-added-hour">{addedThisHour} mot{addedThisHour > 1 ? 's' : ''} ajouté{addedThisHour > 1 ? 's' : ''} cette heure</div></div></div>
    <div className="dil-tabs">{!frenchMode && <button className={mode === 'translation' ? 'active' : ''} onClick={() => setMode('translation')}>📷 TRADUCTION</button>}<button className={mode === 'words' ? 'active' : ''} onClick={() => setMode('words')}>📚 {frenchMode ? 'MES MOTS ET EXPRESSIONS' : 'MES MOTS'}</button><button className={mode === 'training' ? 'active' : ''} onClick={() => setMode('training')}>✍️ ENTRAÎNEMENT</button><button className={mode === 'learned' ? 'active' : ''} onClick={() => setMode('learned')}>🏆 MOTS APPRIS</button></div>
    {mode === 'translation' ? <div className="dil-card">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={selectPhoto} />
      <div className="dil-actions"><button onClick={() => fileRef.current?.click()} disabled={photoBusy}>📷 {hasTranscription ? 'NOUVELLE PHOTO' : 'PRENDRE / CHOISIR UNE PHOTO'}</button><button className="dil-new-word-trigger" onClick={() => setManualOpen((value) => !value)}>➕ NOUVEAU MOT</button>{!hasTranscription && <span>Cadre la zone utile, puis lance la lecture.</span>}</div>
      {manualOpen && <div className="dil-manual-word">
        <div className="dil-manual-heading"><b>Ajouter un mot sans photo</b></div>
        <p>Écris ou dicte un mot en français ou en espagnol : son équivalent pourra être ajouté à ta liste.</p>
        <div className="dil-language-switch" aria-label="Langue du mot à traduire"><button type="button" className={manualLanguage === 'fr' ? 'active' : ''} onClick={() => { setManualLanguage('fr'); setManualWord(''); setManualFrench(''); setManualSpanish(''); setManualSaved(false); setManualWordId(''); setManualError(''); }}>🇫🇷 Français</button><button type="button" className={manualLanguage === 'es' ? 'active' : ''} onClick={() => { setManualLanguage('es'); setManualWord(''); setManualFrench(''); setManualSpanish(''); setManualSaved(false); setManualWordId(''); setManualError(''); }}>🇪🇸 Espagnol</button></div>
        <div className="dil-manual-word-row"><div className="dil-manual-input"><input value={manualWord} onChange={(event) => { setManualWord(event.target.value); setManualFrench(''); setManualSpanish(''); setManualSaved(false); setManualWordId(''); setManualError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); translateManualWord(); } }} placeholder={manualLanguage === 'fr' ? 'Mot français' : 'Mot espagnol'} />{manualWord && <button type="button" className="dil-manual-erase" aria-label="Effacer le mot dicté ou écrit" onClick={() => { setManualWord(''); setManualFrench(''); setManualSpanish(''); setManualWordId(''); setManualSaved(false); setManualError(''); }}>×</button>}</div><button type="button" className={`dil-manual-mic ${manualListening ? 'is-recording' : ''}`} onClick={dictateManualWord} aria-label={manualListening ? 'Enregistrement en cours' : 'Dicter un mot'} title={manualListening ? 'Enregistrement en cours' : 'Dicter un mot'}>{manualListening ? '■' : '🎙️'}</button><button type="button" onClick={() => translateManualWord()} disabled={manualBusy}>{manualBusy ? 'TRADUCTION…' : 'TRADUIRE'}</button></div>
        {manualSpanish && manualFrench && <div className={`dil-manual-translation ${manualSaved ? 'saved' : ''}`}><span>🇪🇸 <b>{manualSpanish}</b> <strong>→</strong> 🇫🇷 <b>{manualFrench}</b></span><div className="dil-manual-translation-actions"><button type="button" className="dil-pronounce" onClick={() => pronounceFrench(manualFrench)} aria-label={`Réécouter ${manualFrench}`}>🔊 Réécouter</button><button type="button" onClick={toggleManualWord}>{manualSaved ? '✓ AJOUTÉ À MA LISTE' : '+ AJOUTER À MA LISTE'}</button></div></div>}
        {manualError && <small className="dil-manual-error">{manualError}</small>}
      </div>}
      {photoUrl && !hasTranscription && <div className="dil-crop"><div className="dil-crop-preview"><div className="dil-crop-image"><img src={photoUrl} alt="Document à recadrer" /><div className="dil-crop-window" style={{ top: `${crop.top}%`, left: `${crop.left}%`, right: `${crop.right}%`, bottom: `${crop.bottom}%` }} /></div></div><div className="dil-crop-controls">{['top', 'bottom', 'left', 'right'].map((side) => <label key={side}>{side === 'top' ? 'Haut' : side === 'bottom' ? 'Bas' : side === 'left' ? 'Gauche' : 'Droite'} <input type="range" min="0" max="45" value={crop[side]} onChange={(event) => setCrop((value) => ({ ...value, [side]: Number(event.target.value) }))} /></label>)}<button onClick={readPhoto} disabled={photoBusy}>{photoBusy ? 'LECTURE…' : 'LIRE LA ZONE CADRÉE'}</button></div></div>}
      <input className="dil-title-input" value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Titre du document (détecté automatiquement)" />
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Le texte du document apparaîtra ici. Clique ensuite sur un mot français pour le traduire." />
      <div className="dil-text" aria-label="Texte à traduire">{documentTitle && <h3>{tokenise(documentTitle).map((part, index) => isWord(part) ? <span className={`dil-word ${selected?.index === `title-${index}` ? 'selected' : ''} ${selected?.index === `title-${index}` && selected?.saved ? 'saved' : ''}`} key={`title-${index}`}><button onClick={() => selectOrToggleWord(part, `title-${index}`)}>{part}</button>{selected?.index === `title-${index}` && <small className="dil-translation-toggle" role="button" tabIndex="0" onClick={toggleSelectedWord}>🇪🇸 {selected.spanish} → 🇫🇷 {selected.french}<button type="button" className="dil-pronounce" aria-label={`Réécouter ${selected.french}`} onClick={(event) => { event.stopPropagation(); pronounceFrench(selected.french); }}>🔊</button><b className="dil-save-word">{selected.saved ? '✓' : '+'}</b>{selected.saveError && <i>{selected.saveError}</i>}</small>}</span> : part)}</h3>}{tokenise(text).map((part, index) => isWord(part) ? <span className={`dil-word ${selected?.index === index ? 'selected' : ''} ${selected?.index === index && selected?.saved ? 'saved' : ''}`} key={`${part}-${index}`}><button onClick={() => selectOrToggleWord(part, index)}>{part}</button>{selected?.index === index && <small className="dil-translation-toggle" role="button" tabIndex="0" onClick={toggleSelectedWord}>🇪🇸 {selected.spanish} → 🇫🇷 {selected.french}<button type="button" className="dil-pronounce" aria-label={`Réécouter ${selected.french}`} onClick={(event) => { event.stopPropagation(); pronounceFrench(selected.french); }}>🔊</button><b className="dil-save-word">{selected.saved ? '✓' : '+'}</b>{selected.saveError && <i>{selected.saveError}</i>}</small>}</span> : <span key={index}>{part}</span>)}</div>
    </div> : mode === 'words' ? <div className="dil-card dil-my-words">
      <h3>📚 Mes mots</h3>
      <p>Du moins connu au plus connu : les mots avec le plus d’erreurs sont proposés en premier.</p>
      {frenchMode && <form className="dil-add-expression" onSubmit={addStudentExpression}>
        <label htmlFor="student-new-expression">Ajouter un mot ou une expression</label>
        <div><input id="student-new-expression" value={newExpression} onChange={(event) => { setNewExpression(event.target.value); setNewExpressionError(''); }} placeholder="Ex. prendre son courage à deux mains" maxLength={120} /><button type="submit" disabled={newExpressionBusy || !newExpression.trim()}>{newExpressionBusy ? 'AJOUT…' : '+ AJOUTER'}</button></div>
        {newExpressionError && <small>{newExpressionError}</small>}
      </form>}
      {!wordsByNeed.length ? <p className="dil-empty">{frenchMode ? 'Ajoute ton premier mot ou une première phrase ci-dessus.' : 'Ajoute des mots dans l’onglet Traduction pour les retrouver ici.'}</p> : <div className="dil-my-words-list">{wordsByNeed.map((word) => <article key={word._id || word.french} className={Number(word.correctStreak || 0) >= 4 ? 'known' : ''}><div className="dil-word-main"><div className="dil-word-pair">{frenchMode ? <>🇫🇷 <b>{word.french}</b></> : <>🇪🇸 <b>{word.spanish}</b><span>→</span> 🇫🇷 <b>{word.french}</b></>}</div>{frenchMode && word.exerciseType !== 'correction' && <><p className="dil-focus-hint">Clique les mots que tu veux réviser en texte à trous.</p><div className="dil-focus-picker">{expressionWords(word.french).map((token, index) => { const selectedFocus = (word.focusWords || []).some((item) => normaliseExpressionWord(item) === normaliseExpressionWord(token)); return <button type="button" className={selectedFocus ? 'selected' : ''} onClick={() => toggleExpressionFocus(word, token)} key={`${token}-${index}`}>{selectedFocus ? '✓ ' : ''}{token}</button>; })}</div></>}{frenchMode && word.exerciseType === 'correction' && <p className="dil-focus-hint">🛠 Phrase à corriger : {word.incorrectSentence}</p>}{frenchMode && Array.isArray(word.focusWords) && word.focusWords.length > 0 && <div className="dil-focus-words">À écrire : {word.focusWords.join(' · ')}</div>}</div><div className="dil-word-results"><span className="correct">✓ {Number(word.correctCount || 0)}</span><span className="wrong">✕ {Number(word.wrongCount || 0)}</span><button type="button" className="dil-pronounce" aria-label={`Réécouter ${word.french}`} onClick={() => pronounceFrench(word.french)}>🔊</button></div></article>)}</div>}
    </div> : mode === 'learned' ? <div className="dil-card dil-my-words">
      <h3>🏆 Mots appris</h3>
      <p>Un mot apparaît ici après 4 bonnes réponses consécutives, sans erreur.</p>
      {!learnedWords.length ? <p className="dil-empty">Continue l’entraînement : il faut 4 bonnes réponses de suite pour apprendre un mot.</p> : <div className="dil-my-words-list">{learnedWords.map((word) => <article key={word._id || word.french} className="known"><div className="dil-word-pair">🇪🇸 <b>{word.spanish}</b><span>→</span> 🇫🇷 <b>{word.french}</b></div><div className="dil-word-results"><span className="correct">✓ {Number(word.correctCount || 0)}</span><button type="button" className="dil-pronounce" aria-label={`Réécouter ${word.french}`} onClick={() => pronounceFrench(word.french)}>🔊</button></div></article>)}</div>}
    </div> : <div className="dil-card dil-training">
      {!current ? <p className="dil-empty">Traduis d’abord des mots dans l’onglet Traduction : ils apparaîtront ici.</p> : current.exerciseType === 'correction' ? <>{renderCorrectionTraining()}{feedback && <p className="dil-feedback">{feedback}</p>}</> : <form onSubmit={checkAnswer}><div className="dil-instruction">TRADUISEZ EN FRANÇAIS</div><div className="dil-spanish">{current.spanish}</div><input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Écris le mot français" /><button type="submit">VÉRIFIER</button>{feedback && <p className="dil-feedback">{feedback}</p>}</form>}
    </div>}
  </section>;
}
