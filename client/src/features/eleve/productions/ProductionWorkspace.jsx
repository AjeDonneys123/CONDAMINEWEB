import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ProductionWorkspace.css';

const FONT_OPTIONS = [
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Trebuchet MS', label: 'Trebuchet' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Courier New', label: 'Courier' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Palatino Linotype', label: 'Palatino' },
  { value: 'Garamond', label: 'Garamond' },
  { value: 'Arial Black', label: 'Arial Black' }
];

const COLOR_OPTIONS = ['#1f2937', '#0f766e', '#1d4ed8', '#7c3aed', '#be123c', '#c2410c', '#15803d', '#ca8a04', '#0f172a', '#0891b2', '#db2777', '#65a30d'];

const extractGoogleSlidesId = (raw = '') => {
  const txt = String(raw || '').trim();
  const match = txt.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
};

const buildSlidesThumbnailUrl = (presentationId = '', objectId = '', slideNumber = '') => {
  const params = new URLSearchParams({ presentationId: String(presentationId || '').trim(), pageObjectId: String(objectId || '').trim() });
  if (String(slideNumber || '').trim()) params.set('slideNumber', String(slideNumber).trim());
  return `/api/learning/slides/thumbnail?${params.toString()}`;
};

const stripHtml = (html = '') =>
  String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uid = () => `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emptyQuestionnaireRow = () => ({ id: uid(), prompt: '', answer: '', expectedKeywords: [], expectedKeywordsText: '' });
const emptyQuestionnaireLevel = () => ({ id: uid(), title: '', questions: [emptyQuestionnaireRow()] });
const emptyQcmRow = () => ({ id: uid(), prompt: '', options: ['', '', '', ''], correctIndex: 0 });
const emptyQcmLevel = () => ({ id: uid(), title: '', questions: [emptyQcmRow()] });
const countWords = (value = '') => String(value || '').trim().split(/\s+/).filter(Boolean).length;

export default function ProductionWorkspace({ production, user, onQuit }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const slideWindowInteractionRef = useRef(null);
  const initialSubmission = production?.studentSubmission || {};
  const productionType = String(production?.productionType || 'fiche');

  const [slides, setSlides] = useState([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [slidesError, setSlidesError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [fontFamily, setFontFamily] = useState('Georgia');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, list: false });
  const [slideWindowOpen, setSlideWindowOpen] = useState(false);
  const [slideWindowRect, setSlideWindowRect] = useState({ x: 120, y: 90, width: 760, height: 480 });
  const [contentHtml, setContentHtml] = useState(String(initialSubmission?.contentHtml || '<h1>Ma fiche</h1><p></p>'));
  const [answers, setAnswers] = useState(() => {
    const saved = Array.isArray(initialSubmission?.answers) ? initialSubmission.answers : [];
    if (saved.length > 0) {
      return saved.map((row) => ({
        id: uid(),
        prompt: String(row?.prompt || ''),
        answer: String(row?.answer || ''),
        expectedKeywords: Array.isArray(row?.expectedKeywords) ? row.expectedKeywords : [],
        expectedKeywordsText: Array.isArray(row?.expectedKeywords) ? row.expectedKeywords.join(' ') : ''
      }));
    }
    return [emptyQuestionnaireRow()];
  });
  const [questionnaireLevels, setQuestionnaireLevels] = useState(() => {
    const saved = Array.isArray(initialSubmission?.answers) ? initialSubmission.answers : [];
    if (productionType !== 'questionnaire') return [];
    if (saved.length === 0) return [emptyQuestionnaireLevel()];
    const grouped = [];
    saved.forEach((row) => {
      const levelTitle = String(row?.levelTitle || '').trim() || `Niveau/Lecon ${grouped.length + 1}`;
      let level = grouped.find((item) => item.title === levelTitle);
      if (!level) {
        level = { id: uid(), title: levelTitle, questions: [] };
        grouped.push(level);
      }
      level.questions.push({
        id: uid(),
        prompt: String(row?.prompt || ''),
        answer: String(row?.answer || ''),
        expectedKeywords: Array.isArray(row?.expectedKeywords) ? row.expectedKeywords : [],
        expectedKeywordsText: Array.isArray(row?.expectedKeywords) ? row.expectedKeywords.join(' ') : ''
      });
    });
    return grouped.length > 0 ? grouped : [emptyQuestionnaireLevel()];
  });
  const [qcmLevels, setQcmLevels] = useState(() => {
    const saved = Array.isArray(initialSubmission?.answers) ? initialSubmission.answers : [];
    if (productionType !== 'qcm') return [];
    if (saved.length === 0) return [emptyQcmLevel()];
    const grouped = [];
    saved.forEach((row) => {
      const levelTitle = String(row?.levelTitle || '').trim() || `Niveau ${grouped.length + 1}`;
      let level = grouped.find((item) => item.title === levelTitle);
      if (!level) {
        level = { id: uid(), title: levelTitle, questions: [] };
        grouped.push(level);
      }
      level.questions.push({
        id: uid(),
        prompt: String(row?.prompt || ''),
        options: Array.isArray(row?.options) && row.options.length === 4 ? row.options : ['', '', '', ''],
        correctIndex: Number.isFinite(Number(row?.correctIndex)) ? Number(row.correctIndex) : 0
      });
    });
    return grouped.length > 0 ? grouped : [emptyQcmLevel()];
  });

  const presentationId = useMemo(() => extractGoogleSlidesId(production?.presentationUrl || ''), [production?.presentationUrl]);
  const activeSlide = slides[activeSlideIdx] || null;
  const canGoPrevSlide = activeSlideIdx > 0;
  const canGoNextSlide = activeSlideIdx < slides.length - 1;
  const plainTextLength = stripHtml(contentHtml).length;
  const imageCount = (contentHtml.match(/<img\b/gi) || []).length;

  useEffect(() => {
    if (editorRef.current && productionType === 'fiche' && editorRef.current.innerHTML !== contentHtml) {
      editorRef.current.innerHTML = contentHtml;
    }
  }, [contentHtml, productionType]);

  useEffect(() => {
    if (!String(production?.presentationUrl || '').trim()) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        setSlidesLoading(true);
        setSlidesError('');
        const res = await fetch('/api/learning/slides/manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presentationUrl: production.presentationUrl,
            slideSelection: (production.selectedSlides || []).join(','),
            filterCondition: '',
            includeThumbnails: false
          }),
          signal: ctrl.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data?.error || 'Slides indisponibles'));
        setSlides(Array.isArray(data?.slides) ? data.slides : []);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setSlides([]);
        setSlidesError(String(e?.message || 'Slides indisponibles'));
      } finally {
        if (!ctrl.signal.aborted) setSlidesLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [production?.presentationUrl, production?.selectedSlides]);

  useEffect(() => {
    const onMouseMove = (event) => {
      const state = slideWindowInteractionRef.current;
      if (!state) return;
      if (state.mode === 'move') {
        setSlideWindowRect((prev) => ({
          ...prev,
          x: Math.max(16, event.clientX - state.offsetX),
          y: Math.max(16, event.clientY - state.offsetY)
        }));
        return;
      }
      if (state.mode === 'resize') {
        const deltaX = event.clientX - state.startX;
        const deltaY = event.clientY - state.startY;
        setSlideWindowRect((prev) => ({
          x: state.corner.includes('w') ? state.startLeft + deltaX : prev.x,
          y: state.corner.includes('n') ? state.startTop + deltaY : prev.y,
          width: Math.max(360, state.startWidth + (state.corner.includes('w') ? -deltaX : deltaX)),
          height: Math.max(240, state.startHeight + (state.corner.includes('n') ? -deltaY : deltaY))
        }));
      }
    };
    const onMouseUp = () => {
      slideWindowInteractionRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const syncHtmlFromEditor = () => {
    const next = String(editorRef.current?.innerHTML || '').trim();
    setContentHtml(next);
    return next;
  };

  const refreshFormattingState = () => {
    if (!editorRef.current) return;
    setActiveFormats({
      bold: Boolean(document.queryCommandState('bold')),
      italic: Boolean(document.queryCommandState('italic')),
      underline: Boolean(document.queryCommandState('underline')),
      list: Boolean(document.queryCommandState('insertUnorderedList'))
    });
  };

  const exec = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncHtmlFromEditor();
    refreshFormattingState();
  };

  const execBulletList = () => {
    editorRef.current?.focus();
    document.execCommand('insertUnorderedList', false, null);
    document.execCommand('indent', false, null);
    syncHtmlFromEditor();
    refreshFormattingState();
  };

  const insertImageFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (!src) return;
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<img src="${src}" alt="Illustration" style="max-width:320px;width:100%;height:auto;border-radius:18px;display:block;margin:18px auto;" /><p></p>`);
      syncHtmlFromEditor();
    };
    reader.readAsDataURL(file);
  };

  const onPasteEditor = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type && item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    insertImageFile(file);
  };

  const openImageFinder = () => {
    window.open('https://www.google.com/search?tbm=isch&q=', 'production-image-finder', 'popup=yes,width=440,height=520,resizable=yes,scrollbars=yes');
  };

  const questionnaireValidity = useMemo(() => (
    questionnaireLevels.map((level) => ({
      titleOk: Boolean(String(level?.title || '').trim()),
      questions: (level.questions || []).map((row) => ({
        promptOk: Boolean(String(row?.prompt || '').trim()),
        answerOk: Boolean(String(row?.answer || '').trim()),
        keywordsOk: String(row?.expectedKeywordsText || '').trim().length > 0
      }))
    }))
  ), [questionnaireLevels]);

  const qcmValidity = useMemo(() => (
    qcmLevels.map((level) => ({
      titleOk: Boolean(String(level?.title || '').trim()),
      questions: (level.questions || []).map((row) => {
        const options = Array.isArray(row?.options) ? row.options : [];
        const optionWordCounts = options.map((option) => countWords(option));
        return {
          promptOk: Boolean(String(row?.prompt || '').trim()),
          optionsOk: options.length === 4 && options.every((option) => String(option || '').trim()),
          lengthOk: optionWordCounts.every((count) => count > 0 && count <= 4),
          correctOk: Number.isFinite(Number(row?.correctIndex)) && Number(row.correctIndex) >= 0 && Number(row.correctIndex) < 4
        };
      })
    }))
  ), [qcmLevels]);

  const addQuestionnaireLevel = () => setQuestionnaireLevels((prev) => [...prev, emptyQuestionnaireLevel()]);
  const removeQuestionnaireLevel = (id) => setQuestionnaireLevels((prev) => prev.length > 1 ? prev.filter((level) => level.id !== id) : prev);
  const addQuestionnaireRow = (levelId) => setQuestionnaireLevels((prev) => prev.map((level) => level.id === levelId ? { ...level, questions: [...(level.questions || []), emptyQuestionnaireRow()] } : level));
  const removeQuestionnaireRow = (levelId, rowId) => setQuestionnaireLevels((prev) => prev.map((level) => {
    if (level.id !== levelId) return level;
    const nextQuestions = (level.questions || []).length > 1 ? level.questions.filter((row) => row.id !== rowId) : level.questions;
    return { ...level, questions: nextQuestions };
  }));
  const addQcmLevel = () => setQcmLevels((prev) => [...prev, emptyQcmLevel()]);
  const removeQcmLevel = (id) => setQcmLevels((prev) => prev.length > 1 ? prev.filter((level) => level.id !== id) : prev);
  const addQcmQuestion = (levelId) => setQcmLevels((prev) => prev.map((level) => level.id === levelId ? { ...level, questions: [...(level.questions || []), emptyQcmRow()] } : level));
  const removeQcmQuestion = (levelId, questionId) => setQcmLevels((prev) => prev.map((level) => {
    if (level.id !== levelId) return level;
    const nextQuestions = (level.questions || []).length > 1 ? level.questions.filter((question) => question.id !== questionId) : level.questions;
    return { ...level, questions: nextQuestions };
  }));

  const save = async (mode = 'manual') => {
    setSaving(true);
    try {
      const payload = {
        productionId: String(production?._id || ''),
        studentId: String(user?._id || user?.id || '')
      };

      if (productionType === 'fiche') {
        payload.contentHtml = String(editorRef.current?.innerHTML || contentHtml || '');
      } else if (productionType === 'questionnaire') {
        payload.answers = questionnaireLevels.flatMap((level) => (level.questions || []).map((row) => ({
          levelTitle: level.title,
          prompt: row.prompt,
          answer: row.answer,
          expectedKeywords: String(row.expectedKeywordsText || '').split(/\s+/).map((part) => part.trim()).filter(Boolean)
        })));
      } else {
        payload.answers = qcmLevels.flatMap((level) => (level.questions || []).map((row) => ({
          levelTitle: level.title,
          prompt: row.prompt,
          options: row.options,
          correctIndex: Number(row.correctIndex || 0)
        })));
      }

      const res = await fetch('/api/eleve/productions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || 'Sauvegarde impossible'));
      setSaveMessage(mode === 'auto' ? 'Travail sauvegarde automatiquement' : 'Travail sauvegarde');
    } catch (e) {
      setSaveMessage(String(e?.message || 'Sauvegarde impossible'));
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 2200);
    }
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (saving) return;
      save('auto');
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [saving, productionType, contentHtml, questionnaireLevels, qcmLevels]);

  return (
    <div className="prod-workspace">
      <div className="prod-topbar">
        <button className="prod-btn prod-btn-ghost" onClick={onQuit}>Quitter</button>
        <div className="prod-title-wrap">
          <div className="prod-kicker">Production</div>
          <div className="prod-title">{production?.title || 'Production'}</div>
          <div className="prod-subtitle">{production?.teacherInstructions || 'Travaille à partir des slides visibles et construis une production claire.'}</div>
        </div>
        {saveMessage && <div className={`prod-save-message ${/sauvegarde/i.test(saveMessage) && !/impossible|erreur/i.test(saveMessage) ? 'success' : 'error'}`}>{saveMessage}</div>}
        <button className="prod-btn" onClick={() => save('manual')} disabled={saving}>{saving ? 'Sauvegarde...' : 'Enregistrer'}</button>
      </div>

      <div className={`prod-shell ${slideWindowOpen ? 'slide-expanded' : ''}`}>
        <aside className="prod-reader-panel">
          <div className="prod-panel-head">
            <div>
              <div className="prod-panel-kicker">Liseuse</div>
              <div className="prod-panel-title">Slides source</div>
            </div>
            <div className="prod-reader-actions">
              {activeSlide && <button type="button" className="prod-open-link" onClick={() => setSlideWindowOpen(true)}>Changer vue</button>}
            </div>
          </div>

          {slidesLoading && <div className="prod-empty">Chargement des slides...</div>}
          {!slidesLoading && slidesError && <div className="prod-error">{slidesError}</div>}
          {!slidesLoading && !slidesError && activeSlide && (
            <div className="prod-slide-stage">
              <div className="prod-slide-nav-shell">
                <button type="button" className="prod-slide-arrow" onClick={() => canGoPrevSlide && setActiveSlideIdx((prev) => prev - 1)} disabled={!canGoPrevSlide} aria-label="Slide précédente">
                  ‹
                </button>
                <div className="prod-slide-preview">
                  <img src={buildSlidesThumbnailUrl(presentationId, activeSlide?.objectId, activeSlide?.slideNumber)} alt={`Slide ${activeSlide?.slideNumber || ''}`} />
                </div>
                <button type="button" className="prod-slide-arrow" onClick={() => canGoNextSlide && setActiveSlideIdx((prev) => prev + 1)} disabled={!canGoNextSlide} aria-label="Slide suivante">
                  ›
                </button>
              </div>
              <div className="prod-slide-meta">
                Slide {activeSlide?.slideNumber || ''} {slides.length > 1 ? `· ${activeSlideIdx + 1}/${slides.length}` : ''}
              </div>
            </div>
          )}
          {!slidesLoading && !slidesError && slides.length === 0 && <div className="prod-empty">Aucune slide configurée.</div>}
        </aside>

        <section className="prod-content-panel">
          {productionType === 'fiche' && (
            <>
              <div className="prod-editor-head">
                <div>
                  <div className="prod-panel-kicker">Fiche</div>
                  <div className="prod-panel-title">Composer la fiche</div>
                </div>
                <div className="prod-editor-meta">
                  <span>{plainTextLength} caractères</span>
                  <span>{imageCount} image(s)</span>
                  {production?.studentSubmission?.teacherValidated === true && <span>Validé</span>}
                </div>
              </div>
              <div className="prod-toolbar">
                <select value={fontFamily} className="prod-font-select" style={{ fontFamily }} onChange={(e) => { setFontFamily(e.target.value); exec('fontName', e.target.value); }}>
                  {FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={{ fontFamily: option.value }}>{option.label}</option>
                  ))}
                </select>
                <button type="button" className={`prod-tool ${activeFormats.bold ? 'active' : ''}`} onClick={() => exec('bold')}>Gras</button>
                <button type="button" className={`prod-tool ${activeFormats.italic ? 'active' : ''}`} onClick={() => exec('italic')}>Italique</button>
                <button type="button" className={`prod-tool ${activeFormats.underline ? 'active' : ''}`} onClick={() => exec('underline')}>Souligné</button>
                <button type="button" className="prod-tool" onClick={execBulletList}>Liste</button>
                <button type="button" className="prod-tool" onClick={() => imageInputRef.current?.click()}>Image</button>
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { insertImageFile(e.target.files?.[0] || null); e.target.value = ''; }} />
              </div>
              <div className="prod-image-help">
                Tu peux aussi coller directement une image dans la fiche ou en chercher une ici:
                <button type="button" className="prod-inline-link" onClick={openImageFinder}>lien</button>
              </div>
              <div className="prod-color-row">
                {COLOR_OPTIONS.map((color) => (
                  <button key={color} type="button" className={`prod-color-dot ${selectedColor === color ? 'active' : ''}`} style={{ background: color }} onClick={() => { setSelectedColor(color); exec('foreColor', color); }} title={color} />
                ))}
              </div>
              <div className="prod-editor-stage">
                <div ref={editorRef} className="prod-editor" contentEditable suppressContentEditableWarning onInput={syncHtmlFromEditor} onPaste={onPasteEditor} onMouseUp={refreshFormattingState} />
              </div>
            </>
          )}

          {productionType === 'questionnaire' && (
            <div className="prod-stack">
              <div className="prod-block-head">
                <div>
                  <div className="prod-panel-kicker">Questionnaire</div>
                  <div className="prod-panel-title">Questions d'apprentissage</div>
                </div>
                <button type="button" className="prod-btn prod-btn-soft" onClick={addQuestionnaireLevel}>+ Niveau/Leçon</button>
              </div>
              {questionnaireLevels.map((level, levelIndex) => {
                const levelValidity = questionnaireValidity[levelIndex] || { questions: [] };
                return (
                  <div key={level.id} className="prod-level-card">
                    <div className="prod-card-head">
                      <div className="prod-card-title">Niveau/Leçon {levelIndex + 1}</div>
                      <button type="button" className="prod-link-danger" onClick={() => removeQuestionnaireLevel(level.id)}>Supprimer niveau/leçon</button>
                    </div>
                    <input className="prod-input" value={level.title || ''} onChange={(e) => setQuestionnaireLevels((prev) => prev.map((item) => item.id === level.id ? { ...item, title: e.target.value } : item))} placeholder="Titre du Niveau/Leçon" />
                    {!levelValidity.titleOk && <div className="prod-hint">Ajoute un titre de Niveau/Leçon.</div>}
                    <div className="prod-actions-row"><button type="button" className="prod-btn prod-btn-soft" onClick={() => addQuestionnaireRow(level.id)}>+ Question</button></div>
                    {(level.questions || []).map((row, index) => {
                      const validity = levelValidity.questions?.[index] || {};
                      return (
                        <div key={row.id} className="prod-card inner">
                          <div className="prod-card-head">
                            <div className="prod-card-title">Question {index + 1}</div>
                            <button type="button" className="prod-link-danger" onClick={() => removeQuestionnaireRow(level.id, row.id)}>Supprimer</button>
                          </div>
                          <textarea className="prod-input prod-textarea" value={row.prompt || ''} onChange={(e) => setQuestionnaireLevels((prev) => prev.map((item) => item.id === level.id ? { ...item, questions: item.questions.map((question) => question.id === row.id ? { ...question, prompt: e.target.value } : question) } : item))} placeholder="Question" />
                          <textarea className="prod-input prod-textarea large" value={row.answer || ''} onChange={(e) => setQuestionnaireLevels((prev) => prev.map((item) => item.id === level.id ? { ...item, questions: item.questions.map((question) => question.id === row.id ? { ...question, answer: e.target.value } : question) } : item))} placeholder="Réponse attendue" />
                          <div className="prod-field-help">
                            Mots-cles
                            <br />
                            separes
                            <br />
                            par un espace
                          </div>
                          <textarea className="prod-input prod-textarea prod-keywords-input" value={row.expectedKeywordsText || ''} onChange={(e) => setQuestionnaireLevels((prev) => prev.map((item) => item.id === level.id ? { ...item, questions: item.questions.map((question) => question.id === row.id ? { ...question, expectedKeywordsText: e.target.value } : question) } : item))} placeholder="climat oasis desert" />
                          <div className="prod-hint">{!validity.promptOk && 'Ajoute une question. '}{!validity.answerOk && 'Ajoute une réponse. '}{!validity.keywordsOk && 'Ajoute au moins un mot-clé.'}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {productionType === 'qcm' && (
            <div className="prod-stack">
              <div className="prod-block-head">
                <div>
                  <div className="prod-panel-kicker">QCM</div>
                  <div className="prod-panel-title">Construire les Niveau/Leçon</div>
                </div>
                <button type="button" className="prod-btn prod-btn-soft" onClick={addQcmLevel}>+ Niveau/Leçon</button>
              </div>
              {production?.linkedGameTitle && <div className="prod-banner">Jeu associé: {production.linkedGameTitle}</div>}
              {qcmLevels.map((level, levelIndex) => {
                const levelValidity = qcmValidity[levelIndex] || { questions: [] };
                return (
                  <div key={level.id} className="prod-level-card">
                    <div className="prod-card-head">
                      <div className="prod-card-title">Niveau/Leçon {levelIndex + 1}</div>
                      <button type="button" className="prod-link-danger" onClick={() => removeQcmLevel(level.id)}>Supprimer niveau/leçon</button>
                    </div>
                    <input className="prod-input" value={level.title || ''} onChange={(e) => setQcmLevels((prev) => prev.map((item) => item.id === level.id ? { ...item, title: e.target.value } : item))} placeholder="Titre du Niveau/Leçon" />
                    {!levelValidity.titleOk && <div className="prod-hint">Ajoute un titre de Niveau/Leçon.</div>}
                    <div className="prod-actions-row"><button type="button" className="prod-btn prod-btn-soft" onClick={() => addQcmQuestion(level.id)}>+ Question</button></div>
                    {(level.questions || []).map((row, index) => {
                      const validity = levelValidity.questions?.[index] || {};
                      return (
                        <div key={row.id} className="prod-card inner">
                          <div className="prod-card-head">
                            <div className="prod-card-title">Question {index + 1}</div>
                            <button type="button" className="prod-link-danger" onClick={() => removeQcmQuestion(level.id, row.id)}>Supprimer</button>
                          </div>
                          <textarea className="prod-input prod-textarea" value={row.prompt || ''} onChange={(e) => setQcmLevels((prev) => prev.map((item) => item.id === level.id ? { ...item, questions: item.questions.map((question) => question.id === row.id ? { ...question, prompt: e.target.value } : question) } : item))} placeholder="Question du QCM" />
                          <div className="prod-option-grid">
                            {(row.options || []).map((option, optIdx) => (
                              <input key={optIdx} className="prod-input" value={option || ''} onChange={(e) => setQcmLevels((prev) => prev.map((item) => item.id === level.id ? { ...item, questions: item.questions.map((question) => question.id === row.id ? { ...question, options: question.options.map((opt, idx2) => idx2 === optIdx ? e.target.value : opt) } : question) } : item))} placeholder={`Réponse ${optIdx + 1} (4 mots max)`} />
                            ))}
                          </div>
                          <select className="prod-input" value={Number(row.correctIndex || 0)} onChange={(e) => setQcmLevels((prev) => prev.map((item) => item.id === level.id ? { ...item, questions: item.questions.map((question) => question.id === row.id ? { ...question, correctIndex: Number(e.target.value || 0) } : question) } : item))}>
                            <option value={0}>Bonne réponse: 1</option>
                            <option value={1}>Bonne réponse: 2</option>
                            <option value={2}>Bonne réponse: 3</option>
                            <option value={3}>Bonne réponse: 4</option>
                          </select>
                          <div className="prod-hint">{!validity.promptOk && 'Ajoute une question. '}{!validity.optionsOk && 'Il faut 4 réponses. '}{!validity.lengthOk && 'Chaque réponse doit faire 4 mots maximum. '}{!validity.correctOk && 'Choisis la bonne réponse.'}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {slideWindowOpen && activeSlide && (
        <div className="prod-slide-window" style={{ left: slideWindowRect.x, top: slideWindowRect.y, width: slideWindowRect.width, height: slideWindowRect.height }}>
          <div className="prod-slide-window-head" onMouseDown={(event) => {
            const rect = event.currentTarget.parentElement.getBoundingClientRect();
            slideWindowInteractionRef.current = { mode: 'move', offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
          }}>
            <div className="prod-slide-window-title">Slide {activeSlide?.slideNumber || ''}</div>
            <button type="button" className="prod-slide-window-close" onClick={() => setSlideWindowOpen(false)}>✕</button>
          </div>
          <div className="prod-slide-window-body">
            <button type="button" className="prod-floating-arrow prod-floating-arrow-left" onClick={() => canGoPrevSlide && setActiveSlideIdx((prev) => prev - 1)} disabled={!canGoPrevSlide} aria-label="Slide précédente">
              ‹
            </button>
            <img src={buildSlidesThumbnailUrl(presentationId, activeSlide?.objectId, activeSlide?.slideNumber)} alt={`Slide ${activeSlide?.slideNumber || ''}`} draggable="false" />
            <button type="button" className="prod-floating-arrow prod-floating-arrow-right" onClick={() => canGoNextSlide && setActiveSlideIdx((prev) => prev + 1)} disabled={!canGoNextSlide} aria-label="Slide suivante">
              ›
            </button>
          </div>
          {['nw', 'ne', 'sw', 'se'].map((corner) => (
            <div
              key={corner}
              className={`prod-slide-window-resize prod-slide-window-resize-${corner}`}
              onMouseDown={(event) => {
                event.preventDefault();
                slideWindowInteractionRef.current = {
                  mode: 'resize',
                  corner,
                  startX: event.clientX,
                  startY: event.clientY,
                  startLeft: slideWindowRect.x,
                  startTop: slideWindowRect.y,
                  startWidth: slideWindowRect.width,
                  startHeight: slideWindowRect.height
                };
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
