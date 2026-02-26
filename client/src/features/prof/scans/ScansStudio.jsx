// @signatures: ScansStudio, handleCapture, handleUploadQueue, handleLaunchCorrection, handleOpenResult
import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ user, globalClass }) {
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [view, setView] = useState('list'); 
    const [localQueue, setLocalQueue] = useState([]);
    const [activeResult, setActiveResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [cameraError, setCameraError] = useState("");
    const [cameraReady, setCameraReady] = useState(false);
    const [collapsedSessions, setCollapsedSessions] = useState({});
    const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
    const [iaDraftBySession, setIaDraftBySession] = useState({});
    const [transcriptView, setTranscriptView] = useState('literal_final');
    const [reCorrectingUrl, setReCorrectingUrl] = useState('');

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const queueTimersRef = useRef({});
    const localQueueRef = useRef([]);
    const gradeClass = (corr = {}) => {
        const g = String(corr.grade || '').toUpperCase();
        if (g === 'A+') return 'grade-aplus';
        if (g === 'A') return 'grade-a';
        if (g === 'B') return 'grade-b';
        return 'grade-c';
    };
    const gradeLabel = (corr = {}) => {
        if (corr.isLycee) {
            const n = Number(corr.score20);
            return Number.isFinite(n) ? `${n}/20` : `--/20`;
        }
        return String(corr.grade || 'B').toUpperCase();
    };
    const confidenceLabel = (corr = {}) => {
        const n = Number(corr.ocrConfidence);
        if (!Number.isFinite(n)) return 'Confiance: inconnue';
        if (n >= 0.8) return `Confiance: haute (${Math.round(n * 100)}%)`;
        if (n >= 0.55) return `Confiance: moyenne (${Math.round(n * 100)}%)`;
        return `Confiance: faible (${Math.round(n * 100)}%)`;
    };
    const getTranscriptTabs = (corr = {}) => {
        const variants = (corr && typeof corr.transcriptionVariants === 'object' && corr.transcriptionVariants)
            ? corr.transcriptionVariants
            : {};
        const firstNonEmpty = (...vals) => vals.find(v => String(v || '').trim()) || '';
        const feedbackText = Array.isArray(corr.questionFeedback) && corr.questionFeedback.length
            ? corr.questionFeedback.map((fb, idx) => `Q${idx + 1}. ${fb}`).join('\n')
            : String(corr.appreciation || '');

        return [
            {
                key: 'literal_final',
                label: 'Transcription fidèle',
                text: firstNonEmpty(
                    variants.literal_final?.text,
                    variants.literal_ocr?.text,
                    variants.meaning_final?.text,
                    corr.literalTranscription,
                    corr.transcription
                )
            },
            {
                key: 'orthography_corrected',
                label: 'Orthographe corrigée',
                text: firstNonEmpty(
                    variants.orthography_corrected?.text,
                    corr.transcription,
                    variants.corrected_legacy?.text
                )
            },
            {
                key: 'content_feedback',
                label: 'Feedback fond',
                text: firstNonEmpty(
                    variants.content_feedback?.text,
                    feedbackText
                )
            }
        ];
    };

    const loadSessions = async () => {
        const res = await fetch('/api/scans/sessions');
        const data = await res.json();
        setSessions(data);
        setIaDraftBySession(prev => {
            const next = { ...prev };
            data.forEach(s => {
                if (typeof next[s._id] !== 'string') {
                    next[s._id] = String(s.aiInstructions || '');
                }
            });
            return next;
        });
        if (activeSession) {
            const updated = data.find(s => s._id === activeSession._id);
            setActiveSession(updated);
        }
    };

    useEffect(() => { loadSessions(); }, []);
    useEffect(() => { localQueueRef.current = localQueue; }, [localQueue]);
    useEffect(() => {
        if (!activeResult) return;
        const tabs = getTranscriptTabs(activeResult);
        const first = tabs[0]?.key || 'literal_final';
        setTranscriptView(first);
    }, [activeResult?._id, activeResult?.originalUrl]);
    useEffect(() => () => {
        Object.values(queueTimersRef.current).forEach(tid => clearTimeout(tid));
    }, []);

    useEffect(() => {
        const startCamera = async () => {
            if (!(view === 'sujets' || view === 'scan') || loading) return;
            setCameraError("");
            setCameraReady(false);
            if (!navigator?.mediaDevices?.getUserMedia) {
                setCameraError("Caméra non supportée sur ce navigateur.");
                return;
            }
            const host = window?.location?.hostname || '';
            const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
            if (!window.isSecureContext && !isLocalhost) {
                setCameraError("Caméra bloquée: ouvre ce site en HTTPS (ou localhost).");
                return;
            }
            let devices = [];
            try {
                devices = await navigator.mediaDevices.enumerateDevices();
            } catch (_) {}
            const hasVideoInput = devices.some(d => d.kind === 'videoinput');
            if (!hasVideoInput) {
                setCameraError("Aucune caméra détectée sur cet appareil.");
                return;
            }
            const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
            const attempts = isMobile
                ? [
                    { video: { facingMode: { ideal: 'environment' } } },
                    { video: { facingMode: 'user' } },
                    { video: true }
                ]
                : [
                    { video: { facingMode: 'user' } },
                    { video: true },
                    { video: { facingMode: { ideal: 'environment' } } }
                ];
            let lastErr = null;
            for (const constraints of attempts) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    if (videoRef.current) videoRef.current.srcObject = stream;
                    return;
                } catch (err) {
                    lastErr = err;
                }
            }
            setCameraError(lastErr?.name === 'NotAllowedError'
                ? "Accès caméra refusé. Autorise la caméra dans le navigateur."
                : "Caméra introuvable ou indisponible.");
        };
        startCamera();
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            setCameraReady(false);
        };
    }, [view, loading]);

    const handleCapture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        if (!cameraReady || !video.videoWidth || !video.videoHeight) {
            setCameraError("Caméra pas encore prête. Réessaie dans 1 seconde.");
            return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => {
            if (!blob) {
                setCameraError("Échec capture photo. Vérifie l'accès caméra.");
                return;
            }
            const url = URL.createObjectURL(blob);
            const id = Date.now() + Math.floor(Math.random() * 1000);
            const item = { blob, url, id, status: view === 'scan' ? 'pending' : 'draft' };
            setLocalQueue(prev => [...prev, item]);
            if (view === 'scan' && activeSession?._id) {
                const timer = setTimeout(() => {
                    handleUploadSingle(id, activeSession._id, 'COPY');
                }, 2200);
                queueTimersRef.current[id] = timer;
            }
        }, 'image/jpeg', 0.9);
    };

    const handleUploadSingle = async (id, sessionId, type) => {
        const item = localQueueRef.current.find(x => x.id === id);
        if (!item) return;
        setLocalQueue(prev => prev.map(x => x.id === id ? { ...x, status: 'uploading' } : x));
        const formData = new FormData();
        formData.append('file', item.blob, `scan_${Date.now()}.jpg`);
        formData.append('sessionId', sessionId);
        formData.append('type', type);
        try {
            await fetch('/api/scans/upload', { method: 'POST', body: formData });
            URL.revokeObjectURL(item.url);
            setLocalQueue(prev => prev.filter(x => x.id !== id));
            await loadSessions();
        } catch (e) {
            setLocalQueue(prev => prev.map(x => x.id === id ? { ...x, status: 'error' } : x));
        } finally {
            if (queueTimersRef.current[id]) {
                clearTimeout(queueTimersRef.current[id]);
                delete queueTimersRef.current[id];
            }
        }
    };

    const handleUploadQueue = async () => {
        if (localQueue.length === 0) return;
        setLoading(true);
        setStatus("Téléchargement vers le Drive...");
        const type = view === 'sujets' ? 'SUBJECT' : 'COPY';

        for (const item of localQueue) {
            if (item.status === 'uploading') continue;
            const formData = new FormData();
            formData.append('file', item.blob, `scan_${Date.now()}.jpg`);
            formData.append('sessionId', activeSession._id);
            formData.append('type', type);
            await fetch('/api/scans/upload', { method: 'POST', body: formData });
            URL.revokeObjectURL(item.url);
        }

        setLocalQueue([]);
        await loadSessions();
        setLoading(false);
        setView('list');
    };

    const handleRemoveQueued = (id) => {
        const item = localQueue.find(x => x.id === id);
        if (queueTimersRef.current[id]) {
            clearTimeout(queueTimersRef.current[id]);
            delete queueTimersRef.current[id];
        }
        if (item?.url) URL.revokeObjectURL(item.url);
        setLocalQueue(prev => prev.filter(i => i.id !== id));
    };

    const handleDeleteUploaded = async (url, type) => {
        await fetch('/api/scans/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: activeSession._id, url, type })
        });
        await loadSessions();
    };

    const handleLaunchCorrection = async (sessionId) => {
        setLoading(true);
        setStatus("L'IA analyse les copies...");
        try {
            await fetch(`/api/scans/correct/${sessionId}`, { method: 'POST' });
            await loadSessions();
            setView('results');
        } catch (e) { alert("Erreur IA"); }
        setLoading(false);
    };
    const handleReCorrectOne = async (sessionId, copyUrl) => {
        if (!sessionId || !copyUrl) return;
        setReCorrectingUrl(copyUrl);
        try {
            await fetch(`/api/scans/correct-one/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ copyUrl })
            });
            await loadSessions();
        } catch (e) {
            alert("Erreur relance IA sur cette copie");
        } finally {
            setReCorrectingUrl('');
        }
    };
    const handleSaveAIInstructions = async (sessionId) => {
        setLoading(true);
        setStatus("Sauvegarde des consignes IA...");
        try {
            const aiInstructions = String(iaDraftBySession[sessionId] || '').trim();
            await fetch(`/api/scans/sessions/${sessionId}/instructions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiInstructions })
            });
            await loadSessions();
        } catch (e) {
            alert("Erreur sauvegarde consignes IA");
        }
        setLoading(false);
    };

    const handleDeleteSession = async (id) => {
        if(!confirm("Supprimer cette session ?")) return;
        await fetch(`/api/scans/sessions/${id}`, { method: 'DELETE' });
        loadSessions();
    };
    const toggleSessionCollapse = (sessionId) => {
        setCollapsedSessions(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
    };
    const renderWorkspace = (session) => {
        const uploaded = view === 'sujets' ? (session.subjectUrls || []) : (session.copyUrls || []);
        return (
            <div className="scan-workspace-inline animate-in">
                {loading && (
                    <div className="scan-loading-overlay">
                        <div className="scan-spinner"></div>
                        <span className="font-black text-white uppercase tracking-widest">{status}</span>
                    </div>
                )}

                <div className="workspace-header">
                    <button
                        type="button"
                        className="ws-title-box ws-title-toggle"
                        onClick={() => setWorkspaceCollapsed(prev => !prev)}
                        title={workspaceCollapsed ? "Ouvrir le panneau" : "Fermer le panneau"}
                    >
                        <h2 className="ws-title">{session.title}</h2>
                        <span className="ws-subtitle">{view.toUpperCase()}</span>
                    </button>
                    <div className="workspace-actions">
                        <button onClick={() => { setActiveSession(session); setView('sujets'); setWorkspaceCollapsed(false); }} className="act-btn btn-sujet">Sujets</button>
                        <button onClick={() => { setActiveSession(session); setView('scan'); setWorkspaceCollapsed(false); }} className="act-btn btn-scan">Scan</button>
                        <button onClick={() => { setActiveSession(session); setView('results'); setWorkspaceCollapsed(false); }} className="act-btn btn-results">Résultats</button>
                        <button
                            onClick={() => {
                                setActiveSession(session);
                                setView('ia');
                                setWorkspaceCollapsed(false);
                            }}
                            className="act-btn btn-ia"
                        >
                            IA
                        </button>
                        <button onClick={() => { setView('list'); setActiveSession(null); setWorkspaceCollapsed(false); }} className="act-btn btn-delete">✕</button>
                    </div>
                    {localQueue.length > 0 && (
                        <button onClick={handleUploadQueue} className="ws-save-btn">SAUVEGARDER ({localQueue.length})</button>
                    )}
                </div>

                {!workspaceCollapsed && (
                    <div className="workspace-content">
                        {(view === 'sujets' || view === 'scan') && (
                            <div className="camera-view">
                                <div className="cam-wrapper">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        className="cam-video"
                                        onLoadedMetadata={() => {
                                            setCameraReady(true);
                                            setCameraError("");
                                        }}
                                    />
                                    <button onClick={handleCapture} className="cam-trigger" />
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>
                                {cameraError && <div className="camera-error">{cameraError}</div>}
                                <div className="capture-strip custom-scrollbar">
                                    {localQueue.length === 0 && view === 'scan' && (
                                        <div className="capture-empty">Les captures apparaissent ici avant envoi.</div>
                                    )}
                                    {localQueue.map(img => (
                                        <div key={img.id} className="capture-thumb">
                                            <img src={img.url} />
                                            <button onClick={() => handleRemoveQueued(img.id)} className="thumb-del">✕</button>
                                        </div>
                                    ))}
                                </div>
                                <div className="uploaded-strip custom-scrollbar">
                                    {uploaded.map((url, idx) => (
                                        <div key={`${url}-${idx}`} className="capture-thumb uploaded">
                                            <img src={url} />
                                            <button onClick={() => handleDeleteUploaded(url, view === 'sujets' ? 'SUBJECT' : 'COPY')} className="thumb-del">✕</button>
                                        </div>
                                    ))}
                                    {uploaded.length === 0 && (
                                        <div className="capture-empty">
                                            {view === 'sujets' ? 'Aucun sujet enregistré.' : 'Aucune copie enregistrée.'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {view === 'results' && (
                            <div className="results-view">
                                <div className="results-head">
                                    <h3 className="results-title">Copies corrigées ({session.corrections?.length || 0})</h3>
                                    <p className="results-sub">Clique sur une copie pour ouvrir la vue détaillée.</p>
                                </div>
                                <div className="results-grid">
                                    {session.corrections?.map((corr, i) => (
                                        <div key={i} className="res-card" onClick={() => setActiveResult(corr)}>
                                            <div className="res-card-top">
                                                <span className="res-name">{corr.studentName}{corr.studentClass ? ` • ${corr.studentClass}` : ''}</span>
                                                <span className={`res-grade ${gradeClass(corr)}`}>{gradeLabel(corr)}</span>
                                            </div>
                                            <div className="res-card-actions">
                                                <button
                                                    type="button"
                                                    className="res-retry-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleReCorrectOne(session._id, corr.originalUrl);
                                                    }}
                                                    disabled={reCorrectingUrl === corr.originalUrl}
                                                    title="Relancer l'IA pour cette copie uniquement"
                                                >
                                                    {reCorrectingUrl === corr.originalUrl ? 'IA…' : 'IA ↻'}
                                                </button>
                                            </div>
                                            <p className="res-text">{corr.appreciation}</p>
                                        </div>
                                    ))}
                                    {(!session.corrections || session.corrections.length === 0) && (
                                        <div className="results-empty">Aucune copie corrigée. Lance l'IA pour générer les résultats.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {view === 'ia' && (
                            <div className="ia-menu-panel">
                                <button
                                    onClick={() => handleLaunchCorrection(session._id)}
                                    className="ia-run-btn"
                                >
                                    Lancer l'IA
                                </button>
                                <textarea
                                    className="ia-instructions-input"
                                    value={iaDraftBySession[session._id] || ''}
                                    onChange={(e) => setIaDraftBySession(prev => ({ ...prev, [session._id]: e.target.value }))}
                                    placeholder="Consignes de correction pour cette session (style, niveau d'exigence, feedback attendu par question...)"
                                />
                                <div className="ia-menu-actions">
                                    <button className="ia-save-btn" onClick={() => handleSaveAIInstructions(session._id)}>Sauvegarder consignes</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeResult && !workspaceCollapsed && (
                    <div className="v132-correction-overlay animate-in fade-in" onClick={() => setActiveResult(null)}>
                        <div className="v132-modal-window" onClick={e => e.stopPropagation()}>
                            <button className="v132-close-btn" onClick={() => setActiveResult(null)}>✕</button>
                            <div className="v132-image-container custom-scrollbar">
                                <img src={activeResult.originalUrl} className="v132-copy-img" />
                            </div>
                            <div className="v132-text-panel custom-scrollbar">
                                <div className="v132-info-row">
                                    <h3 className="v132-student-name">{activeResult.studentName}{activeResult.studentClass ? ` • ${activeResult.studentClass}` : ''}</h3>
                                    <div className="v132-info-actions">
                                        <div className={`v132-grade-badge ${gradeClass(activeResult)}`}>{gradeLabel(activeResult)}</div>
                                        <button className="v132-close-btn-inline" onClick={() => setActiveResult(null)}>✕</button>
                                    </div>
                                </div>
                                <div className="v132-content-box">
                                    <h4 className="v132-label">🤖 APPRÉCIATION GÉNÉRALE</h4>
                                    <div className="v132-appreciation-box">{activeResult.appreciation || "Pas d'appréciation."}</div>
                                    <div className="v132-quality-row">
                                        <span className="v132-quality-chip">{confidenceLabel(activeResult)}</span>
                                        {Array.isArray(activeResult.qualityFlags) && activeResult.qualityFlags.length > 0 && (
                                            <span className="v132-quality-flags">{activeResult.qualityFlags.join(' • ')}</span>
                                        )}
                                    </div>
                                    {transcriptView === 'orthography_corrected' && (
                                        <>
                                            <h4 className="v132-label mt-8">✍️ CORRECTIONS D'ORTHOGRAPHE</h4>
                                            {Array.isArray(activeResult.spellingMistakes) && activeResult.spellingMistakes.length > 0 ? (
                                                <ul className="v132-spelling-list">
                                                    {activeResult.spellingMistakes.map((m, idx) => (
                                                        <li key={`${m.wrong}-${m.correct}-${idx}`} className="v132-spelling-item">
                                                            <span className="wrong">{m.wrong || '...'}</span>
                                                            <span className="arrow">→</span>
                                                            <span className="correct">{m.correct || '...'}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="v132-empty-spelling">Aucune faute d'orthographe détectée.</div>
                                            )}
                                        </>
                                    )}
                                    {transcriptView === 'content_feedback' && Array.isArray(activeResult.questionFeedback) && activeResult.questionFeedback.length > 0 && (
                                        <>
                                            <h4 className="v132-label">📌 FEEDBACK PAR QUESTION</h4>
                                            <ul className="v132-feedback-list">
                                                {activeResult.questionFeedback.map((fb, idx) => (
                                                    <li key={`${idx}-${fb}`} className="v132-feedback-item">{fb}</li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                    <h4 className="v132-label">📝 TRANSCRIPTIONS</h4>
                                    {(() => {
                                        const tabs = getTranscriptTabs(activeResult);
                                        const current = tabs.find(t => t.key === transcriptView) || tabs[0];
                                        const isHtmlLegacy = current?.key === 'orthography_corrected' && String(current?.text || '').includes('<span');
                                        const safeText = String(current?.text || '').trim() || "[vide]";
                                        return (
                                            <>
                                                <div className="v132-transcript-tabs">
                                                    {tabs.map(tab => (
                                                        <button
                                                            key={tab.key}
                                                            type="button"
                                                            className={`v132-transcript-tab ${transcriptView === tab.key ? 'active' : ''}`}
                                                            onClick={() => setTranscriptView(tab.key)}
                                                        >
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                {isHtmlLegacy ? (
                                                    <div className="v132-main-text" dangerouslySetInnerHTML={{ __html: safeText }} />
                                                ) : (
                                                    <div className="v132-main-text">{safeText}</div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="scan-page animate-in fade-in">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">Correction Vision 📸</h2>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Scanner et corriger via le Drive Pro</p>
                </div>
                <button onClick={async () => {
                    const title = prompt("Titre de l'évaluation :");
                    if (!title) return;
                    await fetch('/api/scans/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, teacherId: user.id || user._id }) });
                    loadSessions();
                }} className="bg-indigo-600 text-white px-8 py-5 rounded-[25px] font-black text-sm shadow-xl hover:scale-105 transition-transform">
                    + NOUVELLE SESSION
                </button>
            </div>

            <div className="sessions-list">
                {sessions.map(s => {
                    const isCollapsed = !!collapsedSessions[s._id];
                    const isActiveWorkspace = activeSession?._id === s._id && view !== 'list';
                    return (
                    <div key={s._id} className="session-card">
                        {!isActiveWorkspace && (
                            <>
                                <div className="session-card-top">
                                    <div className="session-card-title-row">
                                        <h3 className="s-title">{s.title}</h3>
                                        <button
                                            onClick={() => toggleSessionCollapse(s._id)}
                                            className="session-collapse-btn"
                                            title={isCollapsed ? "Ouvrir" : "Fermer"}
                                        >
                                            {isCollapsed ? "+" : "−"}
                                        </button>
                                    </div>
                                    <div className="session-card-actions">
                                        <button onClick={() => { setActiveSession(s); setView('sujets'); }} className="act-btn btn-sujet">Sujets</button>
                                        <button onClick={() => { setActiveSession(s); setView('scan'); }} className="act-btn btn-scan">Scan</button>
                                        <button onClick={() => { setActiveSession(s); setView('results'); }} className="act-btn btn-results">Résultats</button>
                                        <button
                                            onClick={() => {
                                                setActiveSession(s);
                                                setView('ia');
                                                setWorkspaceCollapsed(false);
                                            }}
                                            className="act-btn btn-ia"
                                        >
                                            IA
                                        </button>
                                        <button onClick={() => handleDeleteSession(s._id)} className="act-btn btn-delete">✕</button>
                                    </div>
                                </div>
                                {!isCollapsed && (
                                    <div className="session-card-info">
                                        <div className="s-meta">
                                            <span className="s-date">{new Date(s.date).toLocaleDateString()}</span>
                                            <span className="s-divider">•</span>
                                            <span className="s-count">{s.copyUrls?.length || 0} COPIES</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {isActiveWorkspace && renderWorkspace(s)}
                    </div>
                )})}
            </div>
        </div>
    );
}
