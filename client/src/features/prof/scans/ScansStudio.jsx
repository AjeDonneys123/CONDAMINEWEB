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

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

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

    useEffect(() => {
        if ((view === 'sujets' || view === 'scan') && !loading) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
                .catch(err => console.error("Camera error", err));
        }
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, [view, loading]);

    const handleCapture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            setLocalQueue(prev => [...prev, { blob, url, id: Date.now() }]);
        }, 'image/jpeg', 0.9);
    };

    const handleUploadQueue = async () => {
        if (localQueue.length === 0) return;
        setLoading(true);
        setStatus("Téléchargement vers le Drive...");
        const type = view === 'sujets' ? 'SUBJECT' : 'COPY';

        for (const item of localQueue) {
            const formData = new FormData();
            formData.append('file', item.blob, `scan_${Date.now()}.jpg`);
            formData.append('sessionId', activeSession._id);
            formData.append('type', type);
            await fetch('/api/scans/upload', { method: 'POST', body: formData });
        }

        setLocalQueue([]);
        await loadSessions();
        setLoading(false);
        setView('list');
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
                                <video ref={videoRef} autoPlay playsInline className="cam-video" />
                                <button onClick={handleCapture} className="cam-trigger" />
                                <canvas ref={canvasRef} className="hidden" />
                            </div>
                            <div className="capture-strip custom-scrollbar">
                                {localQueue.map(img => (
                                    <div key={img.id} className="capture-thumb">
                                        <img src={img.url} />
                                        <button onClick={() => setLocalQueue(localQueue.filter(i => i.id !== img.id))} className="thumb-del">✕</button>
                                    </div>
                                ))}
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
