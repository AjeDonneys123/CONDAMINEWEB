import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ user }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    
    // UI STATES
    const [activePanels, setActivePanels] = useState({});
    const [collapsedSessions, setCollapsedSessions] = useState({});
    
    // FILE D'ATTENTE LOCALE
    const [snapQueue, setSnapQueue] = useState([]); 
    
    // DRIVE STATE
    const [selectedFolderId, setSelectedFolderId] = useState("");

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);

    // INSTRUCTIONS IA PAR DÉFAUT
    const [instructions, setInstructions] = useState("Corrige l'orthographe et la syntaxe. Sois précis.");

    useEffect(() => { 
        loadSessions(); 
        loadChapters();
    }, []);

    const loadSessions = async () => {
        try {
            const res = await fetch('/api/scans/sessions');
            if(res.ok) setSessions(await res.json());
        } catch(e) { console.error(e); }
    };

    const loadChapters = async () => {
        try {
            const res = await fetch('/api/structure/chapters');
            if(res.ok) setChapters(await res.json());
        } catch(e) { console.error(e); }
    };

    // --- 1. CRÉATION ---
    const handleCreateDC = async () => {
        const title = prompt("Titre du DC (ex: 24/01 MATHS) ?") || `DC ${new Date().toLocaleDateString().slice(0,5)}`;
        try {
            await fetch('/api/scans/sessions', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ title: title.toUpperCase(), teacherId: user._id })
            });
            loadSessions();
        } catch(e) { alert("Erreur création"); }
    };

    // --- 2. GESTION DES PANNEAUX ---
    const toggleCollapse = (sessionId) => {
        setCollapsedSessions(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
    };

    const togglePanel = async (sessionId, panelType, currentChapterId) => {
        if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
        setSnapQueue([]); 

        setActivePanels(prev => {
            if (prev[sessionId] === panelType) { const copy = { ...prev }; delete copy[sessionId]; return copy; }
            return { ...prev, [sessionId]: panelType };
        });

        if (panelType === 'DRIVE_SELECTION') {
            if (currentChapterId) setSelectedFolderId(currentChapterId);
            else if (chapters.length > 0) setSelectedFolderId(chapters[0]._id);
        }

        if (panelType === 'CAMERA_SUBJECT' || panelType === 'CAMERA_COPY') {
            setTimeout(() => startCamera(), 100);
        }
    };

    const handleLinkDrive = async (sessionId) => {
        if (!selectedFolderId) return;
        try {
            await fetch(`/api/scans/sessions/${sessionId}`, {
                method: 'PATCH', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ chapterId: selectedFolderId })
            });
            alert("✅ Dossier lié avec succès !"); togglePanel(sessionId, null); loadSessions();
        } catch(e) { alert("Erreur sauvegarde lien"); }
    };

    // --- 3. CAMÉRA VIDÉO ---
    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } });
            setStream(s);
            if (videoRef.current) videoRef.current.srcObject = s;
        } catch (e) { alert("Impossible d'accéder à la caméra."); }
    };

    const takeSnap = (sessionId, type) => {
        if (!videoRef.current || !canvasRef.current) return;
        const vid = videoRef.current;
        const cvs = canvasRef.current;
        cvs.width = vid.videoWidth;
        cvs.height = vid.videoHeight;
        cvs.getContext('2d').drawImage(vid, 0, 0);
        
        cvs.toBlob(async (blob) => {
            const localUrl = URL.createObjectURL(blob);
            const snapId = Date.now();
            setSnapQueue(prev => [...prev, { id: snapId, url: localUrl, status: 'uploading' }]);

            const formData = new FormData();
            formData.append('file', blob, `snap_${snapId}.jpg`);
            formData.append('sessionId', sessionId);
            formData.append('type', type === 'CAMERA_SUBJECT' ? 'SUBJECT' : 'COPY');
            
            vid.style.opacity = 0.5; setTimeout(() => vid.style.opacity = 1, 100);

            try {
                await fetch('/api/scans/upload', { method: 'POST', body: formData });
                setSnapQueue(prev => prev.map(s => s.id === snapId ? { ...s, status: 'done' } : s));
                loadSessions(); 
            } catch(e) { 
                setSnapQueue(prev => prev.map(s => s.id === snapId ? { ...s, status: 'error' } : s));
            }
        }, 'image/jpeg', 0.85);
    };

    // --- 4. CORRECTION IA (MISE À JOUR) ---
    const launchCorrection = async (sessionId) => {
        if(!confirm("Lancer l'IA EXPERTE sur toutes les copies ?\n(Identification élève + Correction Rouge + Note)")) return;
        alert("Correction lancée en tâche de fond. Le serveur analyse les copies...");
        
        try {
            await fetch(`/api/scans/correct/${sessionId}`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ instructions })
            });
            loadSessions();
        } catch(e) { alert("Erreur lors de la correction IA."); }
    };

    const deleteSession = async (id) => {
        if(!confirm("Supprimer ce DC et toutes les copies ?")) return;
        await fetch(`/api/scans/sessions/${id}`, { method: 'DELETE' });
        loadSessions();
    };

    // Helper pour la couleur de la note
    const getGradeColorClass = (grade) => {
        if (!grade) return 'bg-gray-400';
        if (grade.includes('A+')) return 'grade-A-plus';
        if (grade.includes('A')) return 'grade-A';
        if (grade.includes('B')) return 'grade-B';
        return 'grade-C'; // Rouge par défaut (C, D, E, Insuffisant)
    };

    return (
        <div className="scan-page">
            <div className="create-dc-btn" onClick={handleCreateDC}>
                <div className="create-icon">+</div>
                <span className="create-label">NOUVEAU DC (DEVOIR CLASSE)</span>
            </div>

            {(sessions || []).map(s => {
                const activePanel = activePanels[s._id];
                const isCollapsed = collapsedSessions[s._id];
                const subjectImages = s.subjectUrls || [];
                const copyImages = s.copyUrls || [];
                const linkedChapter = chapters.find(c => c._id === s.chapterId);
                const folderName = linkedChapter ? linkedChapter.title : "AUCUN DOSSIER";

                return (
                    <div key={s._id} className="dc-card">
                        <div className="dc-header">
                            <div className="dc-title-group">
                                <div className={`dc-icon ${isCollapsed ? 'collapsed' : ''}`} onClick={() => toggleCollapse(s._id)}>{isCollapsed ? '📁' : '📂'}</div>
                                <div>
                                    <input className="dc-input" defaultValue={s.title} onBlur={(e) => { /* Update */ }} />
                                    <div className="dc-date">{new Date(s.date).toLocaleDateString()} • {copyImages.length} Copies • Dossier : <strong>{folderName}</strong></div>
                                </div>
                            </div>
                            <button className="tool-btn btn-delete" onClick={() => deleteSession(s._id)}>✕</button>
                        </div>

                        {!isCollapsed && (
                            <>
                                <div className="dc-toolbar">
                                    <button className="tool-btn btn-sujet" onClick={() => togglePanel(s._id, 'CAMERA_SUBJECT')}>📸 SUJET ({subjectImages.length})</button>
                                    <button className="tool-btn btn-scanner" onClick={() => togglePanel(s._id, 'CAMERA_COPY')}>⚡ SCANNER COPIES</button>
                                    <button className="tool-btn btn-devoirs" onClick={() => togglePanel(s._id, 'GALLERY')}>👀 DEVOIRS RENDUS ({copyImages.length})</button>
                                    <button className="tool-btn btn-correct" onClick={() => togglePanel(s._id, 'CORRECTION')}>🤖 CORRECTION IA</button>
                                    <button className="tool-btn btn-folder" onClick={() => togglePanel(s._id, 'DRIVE_SELECTION', s.chapterId)}>📂 DRIVE</button>
                                </div>

                                {activePanel && (
                                    <div className="dc-content-area">
                                        
                                        {/* (CODES CAMERA ET GALERIE IDENTIQUES QU'AVANT, JE FOCUS SUR LA CORRECTION) */}
                                        {(activePanel === 'CAMERA_SUBJECT' || activePanel === 'CAMERA_COPY') && (
                                            <div className="flex flex-col items-center">
                                                <div className="cam-wrapper">
                                                    <div className={`absolute top-2 left-2 px-2 rounded text-xs font-bold animate-pulse text-white ${activePanel === 'CAMERA_SUBJECT' ? 'bg-blue-600' : 'bg-green-600'}`}>{activePanel === 'CAMERA_SUBJECT' ? 'MODE SUJET' : 'MODE COPIES'}</div>
                                                    <video ref={videoRef} autoPlay playsInline className="cam-video" />
                                                    <canvas ref={canvasRef} style={{display:'none'}} />
                                                    <div className="cam-trigger" onClick={() => takeSnap(s._id, activePanel)}>⚪</div>
                                                </div>
                                                <div className="w-full mt-6">
                                                    <span className="persistent-label">{activePanel === 'CAMERA_SUBJECT' ? `PAGES SUJET (${subjectImages.length})` : 'FILE D\'ATTENTE'}</span>
                                                    {activePanel === 'CAMERA_SUBJECT' ? (
                                                        <div className="persistent-strip custom-scrollbar">{subjectImages.map((u, i) => <img key={i} src={u} className="persistent-thumb" />)}</div>
                                                    ) : (
                                                        <div className="snap-queue-strip custom-scrollbar">{snapQueue.map(scan => <img key={scan.id} src={scan.url} className={`queue-thumb ${scan.status}`} />)}</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* CORRECTION AMÉLIORÉE */}
                                        {activePanel === 'CORRECTION' && (
                                            <div className="correction-box">
                                                <h3 className="font-black text-slate-700 uppercase">Instructions pour l'IA</h3>
                                                <textarea className="ai-instr-input" value={instructions} onChange={e => setInstructions(e.target.value)} />
                                                <button className="btn-launch-ia" onClick={() => launchCorrection(s._id)}>LANCER CORRECTION ({copyImages.length} COPIES)</button>
                                                
                                                <div className="results-grid">
                                                    {(s.corrections || []).map((c, idx) => (
                                                        <div key={idx} className="result-card">
                                                            <div className="result-header">
                                                                <div className="result-student">
                                                                    <span className="student-icon">🎓</span>
                                                                    {c.studentName || "ÉLÈVE INCONNU"}
                                                                </div>
                                                                <div className={`grade-badge ${getGradeColorClass(c.grade)}`}>
                                                                    NOTE : {c.grade}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="result-img-box"><img src={c.originalUrl} className="result-img" /></div>
                                                            
                                                            <div className="result-body">
                                                                <div className="appreciation-box">
                                                                    <strong>APPRÉCIATION :</strong> {c.appreciation || "Aucune appréciation."}
                                                                </div>
                                                                
                                                                <div className="transcription-box" dangerouslySetInnerHTML={{__html: c.transcription}}></div>
                                                                
                                                                {c.mistakes?.length > 0 && (
                                                                    <div className="mistakes-list">
                                                                        {c.mistakes.map((m, i) => <span key={i} className="mistake-tag">{m}</span>)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* DRIVE ET GALERIE (Code standard caché pour gain de place dans la réponse, inchangé) */}
                                        {activePanel === 'DRIVE_SELECTION' && (
                                            <div className="drive-box animate-in">
                                                <h3 className="font-black text-slate-700 uppercase text-center">📁 LIER À UN DOSSIER</h3>
                                                <select className="drive-select" value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)}>
                                                    <option value="">-- SÉLECTIONNER UN DOSSIER --</option>
                                                    {chapters.map(c => <option key={c._id} value={c._id}>{c.title} ({c.classroom || '?'})</option>)}
                                                </select>
                                                <button className="btn-save-drive" onClick={() => handleLinkDrive(s._id)}>SAUVEGARDER LE LIEN</button>
                                            </div>
                                        )}
                                        {activePanel === 'GALLERY' && (
                                            <div className="gallery-grid">
                                                {copyImages.map((u, i) => <div key={i} className="gallery-item"><img src={u} className="gallery-img" /><div className="gallery-tag">COPIE {i+1}</div></div>)}
                                            </div>
                                        )}

                                    </div>
                                )}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}