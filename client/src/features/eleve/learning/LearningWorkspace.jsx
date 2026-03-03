import React, { useEffect, useMemo, useRef, useState } from 'react';
import './LearningWorkspace.css';
import { resolveDriveAssetUrl } from '../../../utils/driveUrl';

const normalize = (txt = '') =>
    String(txt || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const normalizeRanges = (ranges = [], textLen = 0) => {
    const clean = (ranges || [])
        .map((r) => ({
            start: Math.max(0, Math.min(textLen, Number(r?.start || 0))),
            end: Math.max(0, Math.min(textLen, Number(r?.end || 0)))
        }))
        .filter((r) => r.end > r.start)
        .sort((a, b) => a.start - b.start);
    const merged = [];
    clean.forEach((r) => {
        const last = merged[merged.length - 1];
        if (!last || r.start > last.end) merged.push({ ...r });
        else last.end = Math.max(last.end, r.end);
    });
    return merged;
};

const normalizeMarkers = (markers = [], textLen = 0) =>
    [...new Set((markers || [])
        .map((m) => Math.max(0, Math.min(textLen, Number(m || 0))))
        .filter((m) => Number.isFinite(m) && m > 0 && m < textLen))]
        .sort((a, b) => a - b);

const buildSegments = (text = '', markers = []) => {
    const source = String(text || '');
    const points = [0, ...normalizeMarkers(markers, source.length), source.length];
    const segments = [];
    for (let i = 0; i < points.length - 1; i += 1) {
        const start = points[i];
        const end = points[i + 1];
        if (end <= start) continue;
        segments.push({ index: i, start, end, text: source.slice(start, end) });
    }
    return segments;
};

const rangesToSnippets = (text = '', ranges = []) =>
    [...new Set((ranges || [])
        .map((r) => String(text || '').slice(r.start, r.end).replace(/\s+/g, ' ').trim())
        .filter(Boolean))];

const snippetKeywords = (snippets = []) =>
    [...new Set((snippets || [])
        .flatMap((s) => normalize(s).split(/[^a-z0-9'-]+/i))
        .map((w) => w.trim())
        .filter((w) => w.length >= 4))]
        .slice(0, 12);

function buildQuestion(step, module) {
    if (step?.customQuestion) return step.customQuestion;
    const chapter = module?.chapterTitle || module?.title || 'ce chapitre';
    const keys = Array.isArray(step?.keywords) ? step.keywords : [];
    const keyHint = keys.length > 0 ? ` (mots-clés: ${keys.slice(0, 3).join(', ')})` : '';
    const difficulty = step?.difficulty || 'easy';
    if (difficulty === 'hard') return `Explique précisément le chapitre "${chapter}" avec un exemple concret${keyHint}.`;
    if (difficulty === 'medium') return `Résume ce que tu as appris dans "${chapter}" en 2 idées principales${keyHint}.`;
    return `Donne une idée importante que tu viens d'apprendre dans "${chapter}"${keyHint}.`;
}

function toEmbedUrl(rawUrl = '') {
    const url = String(rawUrl || '').trim();
    if (!url) return '';
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&#?/]+)/i);
    if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
    const vimeo = url.match(/vimeo\.com\/(\d+)/i);
    if (vimeo?.[1]) return `https://player.vimeo.com/video/${vimeo[1]}`;
    return url;
}

function isProbablyDirectVideo(url = '') {
    const u = String(url || '').toLowerCase();
    if (!u) return false;
    if (u.startsWith('blob:') || u.startsWith('data:')) return true;
    if (/(\.mp4|\.webm|\.ogg|\.m3u8)(\?|#|$)/i.test(u)) return true;
    if (u.includes('/api/proxy/')) return true;
    return false;
}

export default function LearningWorkspace({ module, user, onQuit }) {
    const steps = Array.isArray(module?.steps) ? module.steps : [];
    const initialStep = Math.max(0, Math.min(Number(module?.completion?.currentStep || 0), Math.max(0, steps.length - 1)));
    const [stepIndex, setStepIndex] = useState(initialStep);
    const [validated, setValidated] = useState(() => new Set(Array.from({ length: initialStep }, (_, i) => i)));
    const [sheetReadMs, setSheetReadMs] = useState(0);
    const [sheetScrollRatio, setSheetScrollRatio] = useState(0);
    const [videoEnded, setVideoEnded] = useState(false);
    const [videoUnlocked, setVideoUnlocked] = useState(false);
    const [videoRenderError, setVideoRenderError] = useState(false);
    const [videoManualDone, setVideoManualDone] = useState(false);
    const [answerText, setAnswerText] = useState('');
    const [recording, setRecording] = useState(false);
    const [recordError, setRecordError] = useState('');
    const [saving, setSaving] = useState(false);
    const [gateHint, setGateHint] = useState('');
    const [oralQueue, setOralQueue] = useState([]);
    const [activeOral, setActiveOral] = useState(null);
    const [oralAnswerText, setOralAnswerText] = useState('');
    const [oralError, setOralError] = useState('');

    const sheetRef = useRef(null);
    const videoRef = useRef(null);
    const sheetStartedAt = useRef(Date.now());
    const speechRef = useRef(null);
    const seenOralSeqRef = useRef(new Set());
    const sequenceNodeRefs = useRef({});
    const currentStep = steps[stepIndex];
    const sheetText = String(currentStep?.sheetText || '');
    const sheetPinkRanges = useMemo(() => normalizeRanges(currentStep?.sheetPinkRanges || [], sheetText.length), [currentStep?.sheetPinkRanges, sheetText.length]);
    const sheetZoneMarkers = useMemo(() => {
        if (Array.isArray(currentStep?.sheetZoneMarkers) && currentStep.sheetZoneMarkers.length > 0) {
            return normalizeMarkers(currentStep.sheetZoneMarkers, sheetText.length);
        }
        const legacyRanges = normalizeRanges(currentStep?.sheetZoneRanges || [], sheetText.length);
        return normalizeMarkers(legacyRanges.map((r) => r.end), sheetText.length);
    }, [currentStep?.sheetZoneMarkers, currentStep?.sheetZoneRanges, sheetText.length]);
    const sheetSegments = useMemo(() => {
        const segs = buildSegments(sheetText, sheetZoneMarkers);
        return segs.map((seg) => {
            const overlaps = sheetPinkRanges
                .filter((r) => r.start < seg.end && r.end > seg.start)
                .map((r) => ({ start: Math.max(seg.start, r.start), end: Math.min(seg.end, r.end) }));
            const snippets = rangesToSnippets(sheetText, overlaps);
            return {
                ...seg,
                snippets,
                keywords: snippetKeywords(snippets)
            };
        });
    }, [sheetText, sheetZoneMarkers, sheetPinkRanges]);

    useEffect(() => {
        sheetStartedAt.current = Date.now();
        setSheetReadMs(0);
        setSheetScrollRatio(0);
        setVideoEnded(false);
        setVideoUnlocked(false);
        setVideoRenderError(false);
        setVideoManualDone(false);
        setAnswerText('');
        setGateHint('');
        setOralQueue([]);
        setActiveOral(null);
        setOralAnswerText('');
        setOralError('');
        seenOralSeqRef.current = new Set();
        sequenceNodeRefs.current = {};
        if (speechRef.current) speechRef.current.cancel?.();
    }, [stepIndex]);

    useEffect(() => {
        if (!currentStep || currentStep.type !== 'sheet') return;
        const timer = setInterval(() => {
            setSheetReadMs(Date.now() - sheetStartedAt.current);
            const el = sheetRef.current;
            if (!el) return;
            const max = Math.max(1, el.scrollHeight - el.clientHeight);
            if (max <= 2) {
                setSheetScrollRatio(1);
            } else {
                const ratio = Math.max(0, Math.min(1, el.scrollTop / max));
                setSheetScrollRatio(ratio);
            }
            if (!sheetSegments.length) return;
            const containerRect = el.getBoundingClientRect();
            const newlyPassed = [];
            sheetSegments.forEach((seg) => {
                if (seenOralSeqRef.current.has(seg.index)) return;
                if (!seg.snippets.length) return;
                const node = sequenceNodeRefs.current[seg.index];
                if (!node) return;
                const rect = node.getBoundingClientRect();
                if (rect.bottom < containerRect.top + 2) {
                    seenOralSeqRef.current.add(seg.index);
                    newlyPassed.push(seg);
                }
            });
            if (newlyPassed.length > 0) {
                setOralQueue((prev) => {
                    const existing = new Set((prev || []).map((s) => s.index));
                    const toAdd = newlyPassed.filter((s) => !existing.has(s.index) && (!activeOral || activeOral.index !== s.index));
                    return toAdd.length ? [...prev, ...toAdd] : prev;
                });
            }
        }, 250);
        return () => clearInterval(timer);
    }, [currentStep, sheetSegments, activeOral]);

    const generatedQuestion = useMemo(() => buildQuestion(currentStep, module), [currentStep, module]);

    useEffect(() => {
        if (activeOral || oralQueue.length === 0) return;
        const [first, ...rest] = oralQueue;
        setActiveOral(first || null);
        setOralQueue(rest);
        setOralAnswerText('');
        setOralError('');
    }, [oralQueue, activeOral]);

    useEffect(() => {
        if (!activeOral || !window.speechSynthesis) return;
        const base = activeOral.snippets[0]
            ? `Explique avec tes mots ce passage: ${activeOral.snippets[0]}`
            : `Explique ce que tu viens de lire dans cette séquence.`;
        const utter = new SpeechSynthesisUtterance(base);
        utter.lang = 'fr-FR';
        utter.rate = 0.95;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
        return () => window.speechSynthesis.cancel();
    }, [activeOral]);

    const validateOralAnswer = () => {
        if (!activeOral) return;
        const txt = normalize(oralAnswerText);
        if (txt.length < 12) {
            setOralError("Réponse trop courte.");
            return;
        }
        const keys = activeOral.keywords || [];
        if (keys.length > 0 && !keys.some((k) => txt.includes(normalize(k)))) {
            setOralError("Ajoute un élément clé du passage rose.");
            return;
        }
        setOralError('');
        setOralAnswerText('');
        setActiveOral(null);
    };

    const canValidateCurrent = useMemo(() => {
        if (!currentStep) return false;
        if (currentStep.type === 'sheet') {
            return sheetScrollRatio >= 0.9 && !activeOral && oralQueue.length === 0;
        }
        if (currentStep.type === 'video') return videoUnlocked;
        if (currentStep.type === 'question') {
            const keys = (currentStep.keywords || []).map(k => normalize(k)).filter(Boolean);
            if (keys.length === 0) return normalize(answerText).length >= 10;
            const txt = normalize(answerText);
            const found = new Set(keys.filter(k => txt.includes(k)));
            return found.size >= Number(currentStep.minKeywordMatches || 1);
        }
        return false;
    }, [currentStep, sheetReadMs, sheetScrollRatio, videoUnlocked, answerText]);

    useEffect(() => {
        if (currentStep?.type === 'video' && (videoEnded || videoManualDone)) {
            setVideoUnlocked(true);
            setGateHint('');
        }
    }, [currentStep, videoEnded, videoManualDone]);

    const speakQuestion = () => {
        if (!window.speechSynthesis) return;
        const utter = new SpeechSynthesisUtterance(generatedQuestion);
        utter.lang = 'fr-FR';
        utter.rate = 0.95;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
        speechRef.current = window.speechSynthesis;
    };

    useEffect(() => {
        if (currentStep?.type !== 'question') return;
        // Laisse le DOM se stabiliser puis lance la lecture auto.
        const t = setTimeout(() => {
            speakQuestion();
        }, 250);
        return () => clearTimeout(t);
    }, [currentStep?.type, generatedQuestion]);

    const toggleRecording = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            setRecordError("Reconnaissance vocale non disponible sur ce navigateur.");
            return;
        }
        if (recording) {
            try { speechRef.current?.stop?.(); } catch (_) {}
            setRecording(false);
            return;
        }
        setRecordError('');
        const rec = new SR();
        rec.lang = 'fr-FR';
        rec.interimResults = true;
        rec.continuous = false;
        rec.onresult = (event) => {
            const text = Array.from(event.results).map(r => r[0]?.transcript || '').join(' ').trim();
            setAnswerText(text);
        };
        rec.onerror = () => {
            setRecording(false);
            setRecordError("Micro refusé ou indisponible.");
        };
        rec.onend = () => setRecording(false);
        rec.start();
        speechRef.current = rec;
        setRecording(true);
    };

    const saveProgress = async (payload) => {
        const studentId = String(user._id || user.id);
        await fetch('/api/eleve/learning/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleId: module._id, studentId, ...payload })
        });
    };

    const handleValidate = async () => {
        if (!currentStep) return;
        if (!canValidateCurrent) {
            if (currentStep.type === 'sheet') {
                setGateHint("Lis la fiche et scrolle jusqu'en bas.");
            } else if (currentStep.type === 'video') {
                setGateHint("Termine la vidéo (ou clique le bouton 'J'ai fini de regarder' si c'est un embed).");
            } else {
                setGateHint("Réponse insuffisante: ajoute les mots-clés attendus.");
            }
            return;
        }
        setGateHint('');
        const next = new Set([...validated, stepIndex]);
        setValidated(next);
        const isLast = stepIndex >= steps.length - 1;
        setSaving(true);
        try {
            if (isLast) {
                await saveProgress({ currentStep: steps.length, completed: true });
                alert('Apprentissage validé ✅');
                onQuit();
                return;
            }
            const nextStep = stepIndex + 1;
            await saveProgress({ currentStep: nextStep, completed: false });
            setStepIndex(nextStep);
        } catch (e) {
            console.error("Learning progress save error", e);
            setGateHint("Progression locale validée, mais la sauvegarde serveur a échoué.");
            if (!isLast) setStepIndex(stepIndex + 1);
        } finally {
            setSaving(false);
        }
    };

    if (!currentStep) {
        return (
            <div className="learning-wrap">
                <div className="learning-card">Aucune étape définie pour cet apprentissage.</div>
                <button className="learning-btn" onClick={onQuit}>Retour</button>
            </div>
        );
    }

    const progressPct = steps.length > 0 ? Math.round(((stepIndex + 1) / steps.length) * 100) : 0;
    const videoUrlResolved = currentStep?.type === 'video' ? resolveDriveAssetUrl(currentStep.videoUrl || '') : '';
    const segmentStart = Math.max(0, Number(currentStep?.startSec || currentStep?.videoStartSec || 0));
    const segmentEnd = Math.max(0, Number(currentStep?.endSec || currentStep?.videoEndSec || 0));
    const directVideo = isProbablyDirectVideo(videoUrlResolved);
    const withSegmentParams = (baseUrl) => {
        if (!baseUrl) return '';
        try {
            const u = new URL(baseUrl, window.location.origin);
            if (segmentStart > 0) u.searchParams.set('start', String(Math.floor(segmentStart)));
            if (segmentEnd > 0 && segmentEnd > segmentStart) u.searchParams.set('end', String(Math.floor(segmentEnd)));
            if (u.hostname.includes('youtube.com')) u.searchParams.set('rel', '0');
            return u.toString();
        } catch (_) {
            return baseUrl;
        }
    };
    const embedVideoUrl = withSegmentParams(toEmbedUrl(videoUrlResolved));

    useEffect(() => {
        if (currentStep?.type !== 'video') return;
        const el = videoRef.current;
        if (!el || !directVideo) return;
        const onLoaded = () => {
            if (segmentStart > 0) {
                try { el.currentTime = segmentStart; } catch (_) {}
            }
        };
        el.addEventListener('loadedmetadata', onLoaded);
        return () => el.removeEventListener('loadedmetadata', onLoaded);
    }, [currentStep, segmentStart, directVideo]);

    useEffect(() => {
        if (currentStep?.type !== 'video') return;
        const el = videoRef.current;
        if (!el || !directVideo) return;
        const onTime = () => {
            if (segmentEnd > 0 && el.currentTime >= segmentEnd) {
                try { el.pause(); } catch (_) {}
                setVideoEnded(true);
                setVideoUnlocked(true);
            }
        };
        el.addEventListener('timeupdate', onTime);
        return () => el.removeEventListener('timeupdate', onTime);
    }, [currentStep, segmentEnd, directVideo]);

    const renderSegmentWithPink = (segment) => {
        const source = String(segment?.text || '');
        const base = Number(segment?.start || 0);
        if (!source) return null;
        const localRanges = sheetPinkRanges
            .filter((r) => r.start < segment.end && r.end > segment.start)
            .map((r) => ({ start: Math.max(0, r.start - base), end: Math.min(source.length, r.end - base) }))
            .filter((r) => r.end > r.start);
        if (localRanges.length === 0) return source;
        const cuts = [0, source.length, ...localRanges.flatMap((r) => [r.start, r.end])];
        const points = [...new Set(cuts)].sort((a, b) => a - b);
        const out = [];
        for (let i = 0; i < points.length - 1; i += 1) {
            const start = points[i];
            const end = points[i + 1];
            if (end <= start) continue;
            const chunk = source.slice(start, end);
            const inPink = localRanges.some((r) => start >= r.start && end <= r.end);
            if (!inPink) out.push(<React.Fragment key={`t_${segment.index}_${start}`}>{chunk}</React.Fragment>);
            else out.push(<mark key={`p_${segment.index}_${start}`} className="bg-pink-200 text-pink-900 rounded px-[2px]">{chunk}</mark>);
        }
        return out;
    };

    return (
        <div className="learning-wrap">
            <div className="learning-top">
                <button className="learning-btn ghost" onClick={onQuit}>✕ Quitter</button>
                <div className="learning-title">{module.title}</div>
                <div className="learning-step">Étape {stepIndex + 1}/{steps.length}</div>
            </div>

            <div className="learning-progress">
                <div className="learning-progress-bar" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="learning-card">
                <div className="learning-step-title">
                    {currentStep.type === 'sheet' ? '📄' : currentStep.type === 'video' ? '🎬' : '🎤'} {currentStep.title || 'Étape'}
                </div>

                {currentStep.type === 'sheet' && (
                    <>
                        <div className="learning-hint">Lis la fiche, puis scrolle jusqu'en bas.</div>
                        <div className="learning-sheet" ref={sheetRef}>
                            {sheetText
                                ? (
                                    <div className="learning-sheet-text">
                                        {sheetSegments.map((seg, idx) => (
                                            <React.Fragment key={`seg_${seg.index}`}>
                                                <span
                                                    ref={(node) => {
                                                        if (node) sequenceNodeRefs.current[seg.index] = node;
                                                    }}
                                                    className="learning-segment"
                                                >
                                                    {renderSegmentWithPink(seg)}
                                                </span>
                                                {idx < sheetSegments.length - 1 && <span className="learning-zone-marker" aria-hidden="true" />}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )
                                : currentStep.sheetUrl
                                    ? <iframe src={currentStep.sheetUrl} title="fiche" className="learning-iframe" />
                                : <div className="learning-missing">Aucune fiche configurée.</div>}
                        </div>
                        <div className="learning-meta">
                            <span>Scroll: {Math.round(sheetScrollRatio * 100)}%</span>
                            {activeOral && <span className="text-red-600">Question orale en attente</span>}
                        </div>
                    </>
                )}

                {currentStep.type === 'video' && (
                    <>
                        <div className="learning-hint">Regarde la vidéo en entier pour débloquer l'étape suivante.</div>
                        {(segmentStart > 0 || segmentEnd > 0) && (
                            <div className="learning-meta">
                                <span>Segment: {segmentStart}s {segmentEnd > 0 ? `→ ${segmentEnd}s` : '→ fin'}</span>
                            </div>
                        )}
                        {videoUrlResolved ? (
                            directVideo && !videoRenderError ? (
                            <video
                                key={videoUrlResolved}
                                ref={videoRef}
                                src={videoUrlResolved}
                                controls
                                className="learning-video"
                                onEnded={() => {
                                    setVideoEnded(true);
                                    setVideoUnlocked(true);
                                }}
                                onError={() => setVideoRenderError(true)}
                            />
                            ) : (
                                <div className="learning-video-embed-wrap">
                                    <iframe
                                        title="video-learning"
                                        src={embedVideoUrl}
                                        className="learning-video-frame"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                    <button className="learning-btn ghost mt-3" onClick={() => {
                                        setVideoManualDone(true);
                                        setVideoUnlocked(true);
                                    }}>
                                        ✅ J'ai fini de regarder la vidéo
                                    </button>
                                </div>
                            )
                        ) : (
                            <div className="learning-missing">Aucune vidéo configurée.</div>
                        )}
                        <div className="learning-meta">{videoUnlocked ? '✅ Vidéo terminée' : '⏳ En attente de fin vidéo'}</div>
                    </>
                )}

                {currentStep.type === 'question' && (
                    <>
                        <div className="learning-question">{generatedQuestion}</div>
                        <div className="learning-actions">
                            <button className="learning-btn ghost" onClick={speakQuestion}>🔊 Lire la question</button>
                            <button className={`learning-btn ${recording ? 'danger' : ''}`} onClick={toggleRecording}>
                                {recording ? '⏹ Stop micro' : '🎙️ Répondre au micro'}
                            </button>
                        </div>
                        {recordError && <div className="learning-error">{recordError}</div>}
                        <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            className="learning-answer"
                            placeholder="Transcription / réponse élève..."
                        />
                    </>
                )}
            </div>

            <div className="learning-footer">
                {stepIndex > 0 && (
                    <button
                        className="learning-btn ghost"
                        disabled={saving}
                        onClick={() => {
                            setGateHint('');
                            setStepIndex(prev => Math.max(0, prev - 1));
                        }}
                    >
                        Étape précédente
                    </button>
                )}
                <button className="learning-btn" disabled={saving} onClick={handleValidate}>
                    {saving ? 'Validation...' : (stepIndex >= steps.length - 1 ? 'Valider le module' : 'Valider étape')}
                </button>
            </div>
            {gateHint && <div className="learning-error">{gateHint}</div>}
            {activeOral && (
                <div className="learning-oral-overlay">
                    <div className="learning-oral-card">
                        <div className="learning-question">🎤 Question orale</div>
                        <div className="learning-hint">
                            Explique la séquence sortie de l’écran en t’appuyant sur les passages roses.
                        </div>
                        {activeOral.snippets?.[0] && (
                            <div className="learning-oral-focus">
                                {activeOral.snippets[0]}
                            </div>
                        )}
                        <textarea
                            value={oralAnswerText}
                            onChange={(e) => setOralAnswerText(e.target.value)}
                            className="learning-answer"
                            placeholder="Réponse orale / transcription..."
                        />
                        {oralError && <div className="learning-error">{oralError}</div>}
                        <div className="learning-actions">
                            <button className="learning-btn ghost" onClick={validateOralAnswer}>Valider réponse</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
