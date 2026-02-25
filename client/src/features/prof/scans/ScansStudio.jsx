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

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const queueTimersRef = useRef({});
    const localQueueRef = useRef([]);

    const loadSessions = async () => {
        const res = await fetch('/api/scans/sessions');
        const data = await res.json();
        setSessions(data);
        if (activeSession) {
            const updated = data.find(s => s._id === activeSession._id);
            setActiveSession(updated);
        }
    };

    useEffect(() => { loadSessions(); }, []);
    useEffect(() => { localQueueRef.current = localQueue; }, [localQueue]);
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
            setView('list'); // On revient à la liste pour voir les résultats sur la carte
        } catch (e) { alert("Erreur IA"); }
        setLoading(false);
    };

    const handleDeleteSession = async (id) => {
        if(!confirm("Supprimer cette session ?")) return;
        await fetch(`/api/scans/sessions/${id}`, { method: 'DELETE' });
        loadSessions();
    };

    if (activeSession && view !== 'list') {
        const uploaded = view === 'sujets' ? (activeSession.subjectUrls || []) : (activeSession.copyUrls || []);
        return (
            <div className="scan-workspace animate-in">
                {loading && (
                    <div className="scan-loading-overlay">
                        <div className="scan-spinner"></div>
                        <span className="font-black text-white uppercase tracking-widest">{status}</span>
                    </div>
                )}

                <div className="workspace-header">
                    <button onClick={() => setView('list')} className="ws-back-btn">⬅ RETOUR</button>
                    <div className="ws-title-box">
                        <h2 className="ws-title">{activeSession.title}</h2>
                        <span className="ws-subtitle">{view.toUpperCase()}</span>
                    </div>
                    {localQueue.length > 0 && (
                        <button onClick={handleUploadQueue} className="ws-save-btn">SAUVEGARDER ({localQueue.length})</button>
                    )}
                </div>

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
                            <div className="results-grid">
                                {activeSession.corrections?.map((corr, i) => (
                                    <div key={i} className="res-card" onClick={() => setActiveResult(corr)}>
                                        <div className="res-card-top">
                                            <span className="res-name">{corr.studentName}</span>
                                            <span className={`res-grade grade-${corr.grade[0]}`}>{corr.grade}</span>
                                        </div>
                                        <p className="res-text">{corr.appreciation}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {activeResult && (
                    <div className="v132-correction-overlay animate-in fade-in" onClick={() => setActiveResult(null)}>
                        <div className="v132-modal-window" onClick={e => e.stopPropagation()}>
                            <button className="v132-close-btn" onClick={() => setActiveResult(null)}>✕</button>
                            <div className="v132-image-container custom-scrollbar">
                                <img src={activeResult.originalUrl} className="v132-copy-img" />
                            </div>
                            <div className="v132-text-panel custom-scrollbar">
                                <div className="v132-info-row">
                                    <h3 className="v132-student-name">{activeResult.studentName}</h3>
                                    <div className={`v132-grade-badge grade-${activeResult.grade[0]}`}>{activeResult.grade}</div>
                                </div>
                                <div className="v132-content-box">
                                    <h4 className="v132-label">📝 TRANSCRIPTION & CORRECTIONS</h4>
                                    <div className="v132-main-text" dangerouslySetInnerHTML={{ __html: activeResult.transcription }} />
                                    <h4 className="v132-label mt-8">🤖 APPRÉCIATION GÉNÉRALE</h4>
                                    <div className="v132-appreciation-box">{activeResult.appreciation}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

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
                {sessions.map(s => (
                    <div key={s._id} className="session-card">
                        <div className="session-card-info">
                            <h3 className="s-title">{s.title}</h3>
                            <div className="s-meta">
                                <span className="s-date">{new Date(s.date).toLocaleDateString()}</span>
                                <span className="s-divider">•</span>
                                <span className="s-count">{s.copyUrls?.length || 0} COPIES</span>
                            </div>
                        </div>
                        <div className="session-card-actions">
                            <button onClick={() => { setActiveSession(s); setView('sujets'); }} className="act-btn btn-sujet">Sujets</button>
                            <button onClick={() => { setActiveSession(s); setView('scan'); }} className="act-btn btn-scan">Scan</button>
                            <button onClick={() => { setActiveSession(s); setView('results'); }} className="act-btn btn-results">Résultats</button>
                            <button onClick={() => handleLaunchCorrection(s._id)} className="act-btn btn-ia">Lancer IA</button>
                            <button onClick={() => handleDeleteSession(s._id)} className="act-btn btn-delete">✕</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
