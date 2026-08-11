import React, { useEffect, useMemo, useRef, useState } from 'react';
import './EleveChatWorkspace.css';

const EMPTY_ANSWERS = { error1: '', error2: '', agreements: '', difference: '' };
const stripHtml = (html = '') => String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function RichNotes({ initialHtml, onChange, onBlocked }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialHtml) editorRef.current.innerHTML = initialHtml || '';
  }, []); // only hydrate the uncontrolled editor once so typing never loses its caret

  const format = (command, value) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onChange(editorRef.current?.innerHTML || '');
  };

  return (
    <div className="research-rich-wrap">
      <div className="research-rich-tools" aria-label="Mise en forme des notes">
        <button type="button" onClick={() => format('bold')}><b>B</b></button>
        <button type="button" onClick={() => format('insertUnorderedList')}>• Liste</button>
        {['#172033', '#dc2626', '#2563eb', '#0b9c6c', '#7c3aed', '#ea580c'].map((color) => (
          <button className="research-color" style={{ background: color }} type="button" aria-label={`Couleur ${color}`} key={color} onClick={() => format('foreColor', color)} />
        ))}
        <button type="button" onClick={() => format('removeFormat')}>Effacer format</button>
      </div>
      <div
        ref={editorRef}
        className="research-rich-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onPaste={onBlocked}
        onDrop={onBlocked}
        data-placeholder="Note ici les faits, dates, arguments et différences avec tes propres mots…"
      />
    </div>
  );
}

const paragraphs = (text = '') => String(text).split(/\n+/).map((line) => line.trim()).filter(Boolean);

function HighlightedParagraph({ text, excerpts = [] }) {
  const ranges = excerpts.map((excerpt) => {
    const start = String(text).toLocaleLowerCase('fr').indexOf(String(excerpt).toLocaleLowerCase('fr'));
    return start >= 0 ? { start, end: start + String(excerpt).length } : null;
  }).filter(Boolean).sort((a, b) => a.start - b.start);
  if (!ranges.length) return <p>{text}</p>;
  const nodes = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start < cursor) return;
    if (range.start > cursor) nodes.push(text.slice(cursor, range.start));
    nodes.push(<mark className="research-missing-angle" key={`${range.start}-${index}`}>{text.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <p>{nodes}</p>;
}

export default function EleveChatWorkspace({ user, onQuit }) {
  const studentId = String(user?._id || user?.id || '').trim();
  const level = String(user?.currentClass || user?.className || user?.level || '').trim();
  const storageKey = `condaweb-research-workshop-v4-${studentId || 'student'}`;
  const [phase, setPhase] = useState('topic');
  const [topic, setTopic] = useState('');
  const [base, setBase] = useState(null);
  const [questions, setQuestions] = useState('');
  const [feedback, setFeedback] = useState('');
  const [documents, setDocuments] = useState(null);
  const [activeSource, setActiveSource] = useState(1);
  const [answers, setAnswers] = useState(EMPTY_ANSWERS);
  const [review, setReview] = useState(null);
  const [notesHtml, setNotesHtml] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [visibleSourceText, setVisibleSourceText] = useState('');
  const [uncoveredThreadIds, setUncoveredThreadIds] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (!saved || typeof saved !== 'object') return;
      setPhase(saved.phase || 'topic');
      setTopic(saved.topic || '');
      setBase(saved.base || null);
      setQuestions(saved.questions || '');
      setFeedback(saved.feedback || '');
      setDocuments(saved.documents || null);
      setAnswers(saved.answers || EMPTY_ANSWERS);
      setReview(saved.review || null);
      setNotesHtml(saved.notesHtml || '');
      setUncoveredThreadIds(Array.isArray(saved.uncoveredThreadIds) ? saved.uncoveredThreadIds : []);
    } catch (_) {}
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ phase, topic, base, questions, feedback, documents, answers, review, notesHtml, uncoveredThreadIds }));
    } catch (_) {}
  }, [storageKey, phase, topic, base, questions, feedback, documents, answers, review, notesHtml, uncoveredThreadIds]);

  const source = useMemo(() => documents?.[`article${activeSource}`] || null, [documents, activeSource]);
  const progress = phase === 'topic' ? 1 : phase === 'questions' ? 2 : phase === 'documents' ? 3 : 4;
  const missingExcerpts = useMemo(() => (Array.isArray(base?.openThreads) ? base.openThreads : [])
    .map((thread, index) => typeof thread === 'string' ? { id: `T${index + 1}`, excerpt: thread } : thread)
    .filter((thread) => uncoveredThreadIds.includes(String(thread?.id)))
    .map((thread) => String(thread?.excerpt || ''))
    .filter(Boolean), [base, uncoveredThreadIds]);

  useEffect(() => {
    const completeText = String(source?.content || '');
    setVisibleSourceText('');
    if (!completeText) return undefined;
    let cursor = 0;
    let frame = 0;
    const reveal = () => {
      cursor = Math.min(completeText.length, cursor + 22);
      setVisibleSourceText(completeText.slice(0, cursor));
      if (cursor < completeText.length) frame = window.requestAnimationFrame(reveal);
    };
    frame = window.requestAnimationFrame(reveal);
    return () => window.cancelAnimationFrame(frame);
  }, [source?.content]);

  const callResearch = async (requestedPhase, payload = {}) => {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/eleve/chat/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, phase: requestedPhase, level, ...payload })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Erreur HTTP ${response.status}`);
      return data;
    } catch (requestError) {
      setError(requestError.message || 'L’atelier de recherche est momentanément indisponible.');
      return null;
    } finally {
      setPending(false);
    }
  };

  const submitTopic = async () => {
    if (!topic.trim()) return;
    const data = await callResearch('topic', { topic: topic.trim() });
    if (!data) return;
    setBase(data.base);
    setUncoveredThreadIds([]);
    setFeedback('Lis cette première base. Elle laisse volontairement plusieurs points à éclaircir : à toi de les transformer en questions de recherche.');
    setPhase('questions');
  };

  const submitQuestions = async () => {
    if (!questions.trim()) return;
    const data = await callResearch('questions', { topic, base, questions });
    if (!data) return;
    setUncoveredThreadIds(Array.isArray(data.uncoveredThreadIds) ? data.uncoveredThreadIds.map(String) : []);
    setFeedback(data.feedback || 'Reformule tes questions.');
    if (data.ready && data.documents) {
      setQuestions((data.acceptedQuestions || []).join('\n') || questions);
      setDocuments(data.documents);
      setPhase('documents');
    }
  };

  const submitReview = async () => {
    const data = await callResearch('review', { topic, questions, documents, answers: { ...answers, questions } });
    if (!data) return;
    setReview(data);
    if (data.complete) setPhase('complete');
  };

  const blockImportedText = (event) => {
    event.preventDefault();
    setNotice('Le copier-coller est bloqué dans les notes : reformule les informations avec tes propres mots.');
    window.setTimeout(() => setNotice(''), 3500);
  };

  const prepareCanva = async () => {
    await callResearch('complete', { topic, questions, notes: stripHtml(notesHtml), review });
    window.open('https://www.canva.com/', '_blank', 'noopener,noreferrer');
  };

  const restart = () => {
    if (!window.confirm('Commencer une nouvelle recherche et effacer ce brouillon sur cet appareil ?')) return;
    window.localStorage.removeItem(storageKey);
    setPhase('topic'); setTopic(''); setBase(null); setQuestions(''); setFeedback('');
    setDocuments(null); setActiveSource(1); setAnswers(EMPTY_ANSWERS); setReview(null); setNotesHtml(''); setError(''); setUncoveredThreadIds([]);
  };

  return (
    <div className="research-overlay">
      <header className="research-header">
        <div><div className="research-kicker">Entraînement à la recherche · {level || 'collège'}</div><h1>🔎 Atelier Recherche</h1></div>
        <div className="research-progress" aria-label={`Étape ${progress} sur 4`}>
          {['Sujet', 'Questions', 'Sources', 'Bilan'].map((label, index) => <span className={progress >= index + 1 ? 'done' : ''} key={label}>{index + 1}. {label}</span>)}
        </div>
        <div className="research-header-actions"><button type="button" className="research-restart" onClick={restart}>Nouveau sujet</button><button className="research-close" type="button" onClick={onQuit} aria-label="Quitter">×</button></div>
      </header>

      <main className={`research-workspace phase-${phase}`}>
        <section className="research-coach">
          {phase === 'topic' ? (
            <div className="research-welcome">
              <div className="research-avatar">C</div>
              <div className="research-bubble"><strong>Bienvenue ! Quel est ton sujet ?</strong><p>Ma mission est de t’entraîner à chercher, questionner et confronter des documents. Je ne ferai pas l’exposé à ta place.</p></div>
              <textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex. Cléopâtre, les volcans, l’intelligence artificielle…" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitTopic(); } }} />
              <button type="button" onClick={submitTopic} disabled={!topic.trim() || pending}>{pending ? 'Préparation…' : 'Découvrir le sujet'}</button>
            </div>
          ) : (
            <>
              <div className="research-coach-head"><span className="research-avatar">C</span><div><strong>Cyclopédia</strong><small>Document pédagogique d’entraînement adapté à ton niveau</small></div></div>
              <article className="research-base">
                <h2>{base?.title || topic}</h2>
                {paragraphs(base?.article).map((p, i) => <HighlightedParagraph text={p} excerpts={missingExcerpts} key={i} />)}
                {missingExcerpts.length > 0 && <div className="research-missing-hint">Les passages rouges montrent des aspects importants qui ne sont pas encore couverts par tes questions. Ajoute une question qui les explore.</div>}
              </article>
              <div className="research-question-box">
                <h3>Ta problématique et tes questions</h3>
                <p>Pose une ou plusieurs questions assez larges pour nécessiter une vraie recherche. Évite les questions auxquelles une seule ligne suffit.</p>
                <textarea value={questions} onChange={(event) => setQuestions(event.target.value)} placeholder="Pourquoi… ? Comment… ? Dans quelle mesure… ?" />
                {feedback && <div className="research-feedback">💬 {feedback}</div>}
                <button type="button" onClick={submitQuestions} disabled={!questions.trim() || pending}>{pending ? 'Analyse…' : documents ? 'Régénérer les sources' : 'Faire vérifier mes questions'}</button>
              </div>
            </>
          )}
          {error && <div className="research-error">{error}</div>}
        </section>

        <section className="research-dossier">
          {!documents ? (
            <div className="research-dossier-empty"><span>📚</span><h2>Ton dossier documentaire apparaîtra ici</h2><p>Il sera créé quand tes questions seront assez ouvertes et intéressantes.</p></div>
          ) : (
            <>
              <div className="research-source-tabs">
                <button type="button" className={activeSource === 1 ? 'active' : ''} onClick={() => setActiveSource(1)}>Source 1</button>
                <button type="button" className={activeSource === 2 ? 'active' : ''} onClick={() => setActiveSource(2)}>Source 2</button>
                <span>{documents.sharedTension}</span>
              </div>
              <div className="research-source-and-notes">
                <article
                  className="research-article research-article-shielded"
                  onCopy={(event) => event.preventDefault()}
                  onCut={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className="research-generated-label">Document pédagogique généré · une coquille factuelle s’y cache</div>
                  <h2>{source?.title}</h2><h3>{source?.angle}</h3>
                  {paragraphs(visibleSourceText).map((p, i) => <p key={i}>{p}</p>)}
                  {visibleSourceText.length < String(source?.content || '').length && <span className="research-writing-caret" aria-hidden="true" />}
                  <footer>{source?.sourceNote}</footer>
                  <div className="research-reading-shield" aria-hidden="true" />
                </article>
                <div className="research-notes-panel">
                  <div className="research-notes-title"><div><h3>📝 Mes notes</h3><span>{stripHtml(notesHtml).length} caractères · collage bloqué</span></div></div>
                  <RichNotes initialHtml={notesHtml} onChange={setNotesHtml} onBlocked={blockImportedText} />
                  {notice && <div className="research-notice">{notice}</div>}
                </div>
              </div>
            </>
          )}
        </section>

        {documents && (
          <section className="research-comparison">
            <div className="research-comparison-head"><div><h2>Confronte les deux sources</h2><p>Les deux angles peuvent être défendables. Repère aussi l’unique coquille cachée dans chaque texte.</p></div>{review && <div className={`research-score ${review.complete ? 'ok' : ''}`}>{review.score ?? 0}/4</div>}</div>
            <div className="research-comparison-grid">
              <label>Coquille de la source 1<textarea value={answers.error1} onChange={(e) => setAnswers({ ...answers, error1: e.target.value })} /></label>
              <label>Coquille de la source 2<textarea value={answers.error2} onChange={(e) => setAnswers({ ...answers, error2: e.target.value })} /></label>
              <label>Ce que les deux sources confirment<textarea value={answers.agreements} onChange={(e) => setAnswers({ ...answers, agreements: e.target.value })} /></label>
              <label>Leur différence de point de vue<textarea value={answers.difference} onChange={(e) => setAnswers({ ...answers, difference: e.target.value })} /></label>
            </div>
            {review && <div className={`research-review ${review.complete ? 'ok' : ''}`}><strong>{review.complete ? 'Mission réussie' : 'À approfondir'}</strong><span>{review.feedback}</span>{review.missing?.length > 0 && <small>À revoir : {review.missing.join(' · ')}</small>}</div>}
            <div className="research-actions">
              <button type="button" onClick={submitReview} disabled={pending}>{pending ? 'Vérification…' : 'Valider ma confrontation'}</button>
              <button className="research-canva" type="button" onClick={prepareCanva}>Préparer Canva ↗</button>
              <span><b>Écran partagé :</b> Mac <kbd>⌘</kbd> + <kbd>⌥</kbd> + <kbd>N</kbd> · Windows/Linux <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>N</kbd></span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
