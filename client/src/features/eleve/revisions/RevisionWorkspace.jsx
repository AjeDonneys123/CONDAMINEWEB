import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../fiches/FicheWorkspace.css';
import { startSpeechRecognitionWithFallback } from '../../../utils/speechRecognitionWithFallback';

const normalize = (txt = '') =>
    String(txt || '')
        .toLowerCase()
        .replace(/[’`´]/g, "'")
        .replace(/[‐‑‒–—]/g, '-')
        .replace(/œ/g, 'oe')
        .replace(/æ/g, 'ae')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9'\-\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const extractGoogleSlidesId = (raw = '') => {
    const txt = String(raw || '').trim();
    const match = txt.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
};

const buildSlidesThumbnailProxyUrl = (presentationId = '', objectId = '', slideNumber = '') => {
    const params = new URLSearchParams({ presentationId: String(presentationId || '').trim(), pageObjectId: String(objectId || '').trim() });
    if (String(slideNumber || '').trim()) params.set('slideNumber', String(slideNumber).trim());
    return `/api/learning/slides/thumbnail?${params.toString()}`;
};

const evaluateQuestionAnswer = (questionItem = null, answerText = '') => {
    const txt = normalize(answerText);
    const keys = (Array.isArray(questionItem?.expectedKeywords) ? questionItem.expectedKeywords : [])
        .map((k) => String(k || '').trim())
        .filter(Boolean);
    const matched = keys.filter((key) => txt.includes(normalize(key)));
    const missing = keys.filter((key) => !txt.includes(normalize(key)));
    const required = keys.length > 0 ? Math.min(keys.length, Math.max(1, Math.ceil(keys.length * 0.6))) : 0;
    const expectedAnswer = String(questionItem?.expectedAnswer || '').trim();
    if (keys.length === 0) {
        return { ok: txt.length >= 4, expectedAnswer, missing: [], matched: [], required: 0 };
    }
    return { ok: matched.length >= required, expectedAnswer, missing, matched, required };
};

export default function RevisionWorkspace({ revision, user, onQuit }) {
    const initialQuestions = useMemo(() => {
        const sub = revision?.studentSubmission;
        const rows = Array.isArray(sub?.questions) ? sub.questions : [];
        return rows.length > 0 ? rows : [{ question: '', expectedAnswer: '', expectedKeywords: [] }];
    }, [revision]);
    const [questions, setQuestions] = useState(initialQuestions);
    const [slides, setSlides] = useState([]);
    const [slidesLoading, setSlidesLoading] = useState(false);
    const [slidesError, setSlidesError] = useState('');
    const [activeSlideIdx, setActiveSlideIdx] = useState(0);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [testMode, setTestMode] = useState(false);
    const [testIndex, setTestIndex] = useState(0);
    const [answerText, setAnswerText] = useState('');
    const [feedback, setFeedback] = useState('');
    const [recording, setRecording] = useState(false);
    const [finished, setFinished] = useState(false);
    const recogRef = useRef(null);

    const presentationId = useMemo(() => extractGoogleSlidesId(revision?.presentationUrl || ''), [revision?.presentationUrl]);
    const selectedSlides = useMemo(() => [...new Set((revision?.selectedSlides || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))].sort((a, b) => a - b), [revision?.selectedSlides]);
    const activeSlide = slides[activeSlideIdx] || null;
    const currentTestQuestion = questions[testIndex] || null;

    useEffect(() => {
        const presentationUrl = String(revision?.presentationUrl || '').trim();
        if (!presentationUrl) return;
        const ctrl = new AbortController();
        (async () => {
            setSlidesLoading(true);
            setSlidesError('');
            try {
                const res = await fetch('/api/learning/slides/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        presentationUrl,
                        slideSelection: selectedSlides.join(','),
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
    }, [revision?.presentationUrl, selectedSlides.join(',')]);

    const saveNow = async (markCompleted = false) => {
        try {
            setSaving(true);
            const res = await fetch('/api/eleve/revisions/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    revisionId: String(revision?._id || ''),
                    studentId: String(user?._id || user?.id || ''),
                    questions,
                    markCompleted
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(String(data?.error || 'Erreur sauvegarde'));
            setSaveMessage(markCompleted ? 'Révision terminée.' : 'Révision enregistrée.');
        } catch (e) {
            setSaveMessage(String(e?.message || 'Erreur sauvegarde'));
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMessage(''), 2200);
        }
    };

    const updateQuestion = (idx, patch) => setQuestions((prev) => prev.map((row, rowIdx) => rowIdx === idx ? { ...row, ...patch } : row));
    const addQuestion = () => setQuestions((prev) => [...prev, { question: '', expectedAnswer: '', expectedKeywords: [] }]);
    const removeQuestion = (idx) => setQuestions((prev) => prev.length <= 1 ? prev : prev.filter((_, rowIdx) => rowIdx !== idx));

    const startTest = async () => {
        const usable = questions.filter((q) => String(q.question || '').trim() && (String(q.expectedAnswer || '').trim() || (q.expectedKeywords || []).length > 0));
        if (usable.length === 0) return alert('Crée au moins une vraie question avant de lancer le test.');
        setQuestions(usable);
        await saveNow(false);
        setTestIndex(0);
        setAnswerText('');
        setFeedback('');
        setFinished(false);
        setTestMode(true);
    };

    const stopRecording = () => {
        try { recogRef.current?.stop?.(); } catch (_) {}
        recogRef.current = null;
        setRecording(false);
    };

    const toggleRecording = () => {
        if (recording) {
            stopRecording();
            return;
        }
        const rec = startSpeechRecognitionWithFallback({
            lang: 'fr-FR', continuous: true, interimResults: true, fallbackDurationMs: 10000,
            onResult: (text) => setAnswerText(text),
            onError: () => setRecording(false),
            onEnd: () => setRecording(false)
        });
        recogRef.current = rec;
        setRecording(true);
    };

    const validateCurrentAnswer = async () => {
        if (!currentTestQuestion) return;
        const check = evaluateQuestionAnswer(currentTestQuestion, answerText);
        if (!check.ok) {
            const missingText = check.missing.length > 0 ? ` Il te manque les mots clés suivants : ${check.missing.join(', ')}.` : '';
            setFeedback(`La réponse était : ${check.expectedAnswer || '—'}.${missingText}`);
            setAnswerText('');
            setTestIndex(0);
            return;
        }
        const nextIndex = testIndex + 1;
        if (nextIndex >= questions.length) {
            await saveNow(true);
            setFinished(true);
            setFeedback("Bravo, vous avez terminé votre révision.");
            stopRecording();
            return;
        }
        setFeedback('');
        setAnswerText('');
        setTestIndex(nextIndex);
    };

    return (
        <div className="fiche-workspace">
            <div className="fiche-topbar">
                <button className="fiche-btn fiche-btn-ghost" onClick={onQuit}>✕ Quitter</button>
                <div className="fiche-title-wrap">
                    <div className="fiche-title">{revision?.title || 'Révision'}</div>
                    <div className="fiche-subtitle">{revision?.teacherInstructions || 'Crée tes questions, tes réponses et tes mots-clés puis teste-toi.'}</div>
                </div>
                {!testMode && <button className="fiche-btn" onClick={() => saveNow(false)} disabled={saving}>{saving ? 'Sauvegarde...' : 'Enregistrer'}</button>}
            </div>

            <div className="fiche-shell">
                <aside className="fiche-source-panel">
                    <div className="fiche-panel-head">
                        <div>
                            <div className="fiche-kicker">Source</div>
                            <div className="fiche-panel-title">Slides de révision</div>
                        </div>
                    </div>
                    {slidesLoading && <div className="fiche-empty">Chargement des slides...</div>}
                    {!slidesLoading && slidesError && <div className="fiche-error">{slidesError}</div>}
                    {!slidesLoading && !slidesError && activeSlide && (
                        <div className="fiche-slide-stage">
                            <div className="fiche-slide-preview">
                                <img src={buildSlidesThumbnailProxyUrl(presentationId, activeSlide?.objectId, activeSlide?.slideNumber)} alt={`Slide ${activeSlide?.slideNumber || ''}`} />
                            </div>
                            <div className="fiche-slide-meta">Slide {activeSlide?.slideNumber || ''}</div>
                        </div>
                    )}
                    <div className="fiche-slide-rail">
                        {slides.map((slide, idx) => (
                            <button key={String(slide?.objectId || idx)} type="button" onClick={() => setActiveSlideIdx(idx)} className={`fiche-slide-chip ${idx === activeSlideIdx ? 'active' : ''}`}>
                                <img src={buildSlidesThumbnailProxyUrl(presentationId, slide?.objectId, slide?.slideNumber)} alt={`Slide ${slide?.slideNumber || ''}`} />
                                <span>Slide {slide?.slideNumber || idx + 1}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="fiche-editor-panel">
                    {!testMode && (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-[12px] font-black uppercase text-slate-500">Créer mes questions</div>
                                <div className="flex gap-2">
                                    <button type="button" className="fiche-tool" onClick={addQuestion}>+ Question</button>
                                    <button type="button" className="fiche-btn" onClick={startTest}>Tester mes questions</button>
                                </div>
                            </div>
                            <div className="space-y-3 overflow-auto pr-1">
                                {questions.map((row, idx) => (
                                    <div key={idx} className="rounded-[24px] border border-slate-200 bg-white p-4 space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-black text-slate-700">Question {idx + 1}</div>
                                            <button type="button" className="fiche-btn fiche-btn-ghost" onClick={() => removeQuestion(idx)}>✕</button>
                                        </div>
                                        <input className="expose-subject-input" value={row.question || ''} onChange={(e) => updateQuestion(idx, { question: e.target.value })} placeholder="Question à poser..." />
                                        <input className="expose-subject-input" value={row.expectedAnswer || ''} onChange={(e) => updateQuestion(idx, { expectedAnswer: e.target.value })} placeholder="Réponse attendue..." />
                                        <input className="expose-subject-input" value={Array.isArray(row.expectedKeywords) ? row.expectedKeywords.join(', ') : ''} onChange={(e) => updateQuestion(idx, { expectedKeywords: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="Mots-clés séparés par des virgules..." />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {testMode && !finished && currentTestQuestion && (
                        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                            <div className="text-[12px] font-black uppercase text-slate-400">Question {testIndex + 1} / {questions.length}</div>
                            <div className="text-3xl font-black text-slate-800">{currentTestQuestion.question || 'Question'}</div>
                            <div className="flex gap-3">
                                <button type="button" className="fiche-tool" onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(currentTestQuestion.question || ''))}>🔊 Lire</button>
                                <button type="button" className={`fiche-tool ${recording ? 'active' : ''}`} onClick={toggleRecording}>{recording ? '🎙️ Désactiver micro' : '🎙️ Activer micro'}</button>
                            </div>
                            <textarea className="expose-subject-input" style={{ minHeight: 180, resize: 'vertical' }} value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Réponds ici..." />
                            {feedback && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{feedback}</div>}
                            <div className="flex justify-between gap-3">
                                <button type="button" className="fiche-btn fiche-btn-ghost" onClick={() => { setTestIndex((prev) => Math.max(0, prev - 1)); setFeedback(''); }}>Question précédente</button>
                                <button type="button" className="fiche-btn" onClick={validateCurrentAnswer}>{testIndex >= questions.length - 1 ? 'Valider la révision' : 'Question suivante'}</button>
                            </div>
                        </div>
                    )}

                    {testMode && finished && (
                        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-8 text-center space-y-4">
                            <div className="text-4xl">✅</div>
                            <div className="text-2xl font-black text-emerald-700">Bravo, vous avez terminé votre révision.</div>
                            <div className="text-sm font-bold text-emerald-700">Tes questions sont enregistrées et tu peux quitter ou continuer à les améliorer.</div>
                            <div className="flex justify-center gap-3">
                                <button type="button" className="fiche-btn fiche-btn-ghost" onClick={() => { setTestMode(false); setFinished(false); setFeedback(''); }}>Retour à l'édition</button>
                                <button type="button" className="fiche-btn" onClick={onQuit}>Quitter</button>
                            </div>
                        </div>
                    )}

                    <div className="fiche-editor-meta">
                        <span>{questions.length} question(s)</span>
                        {saveMessage && <span>{saveMessage}</span>}
                    </div>
                </section>
            </div>
        </div>
    );
}
