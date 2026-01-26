import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ user, globalClass }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [activePanels, setActivePanels] = useState({});
    
    // MODALE CORRECTION
    const [correctionModal, setCorrectionModal] = useState(null); // ID Session ou null
    const [instructions, setInstructions] = useState("");
    const [processing, setProcessing] = useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [snapQueue, setSnapQueue] = useState([]);
    const [selectedFolderId, setSelectedFolderId] = useState("");

    useEffect(() => { loadSessions(); loadChapters(); }, []);

    const loadSessions = async () => { try { const res = await fetch('/api/scans/sessions'); if(res.ok) setSessions(await res.json()); } catch(e) {} };
    const loadChapters = async () => { try { const res = await fetch('/api/structure/chapters'); if(res.ok) setChapters(await res.json()); } catch(e) {} };

    const relevantChapters = chapters.filter(c => String(c.teacherId) === String(user.id || user._id) && !c.isArchived).sort((a,b)=>a.title.localeCompare(b.title));

    const togglePanel = (id, type, currentChap) => {
        if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
        setActivePanels(prev => ({ ...prev, [id]: prev[id] === type ? null : type }));
        if (type.startsWith('CAMERA')) setTimeout(startCamera, 100);
        if (type === 'DRIVE_SELECTION') setSelectedFolderId(currentChap || (relevantChapters[0]?._id || ""));
    };

    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
            setStream(s);
            if (videoRef.current) videoRef.current.srcObject = s;
        } catch (e) { alert("Caméra inaccessible"); }
    };

    const takeSnap = (sessionId, type) => {
        if (!videoRef.current || !canvasRef.current) return;
        const vid = videoRef.current;
        const cvs = canvasRef.current;
        cvs.width = vid.videoWidth;
        cvs.height = vid.videoHeight;
        cvs.getContext('2d').drawImage(vid, 0, 0, cvs.width, cvs.height);
        
        cvs.toBlob(async (blob) => {
            const localUrl = URL.createObjectURL(blob);
            const snapId = Date.now();
            setSnapQueue(prev => [...prev, { id: snapId, url: localUrl, status: 'uploading' }]);
            const formData = new FormData();
            formData.append('file', blob, `snap_${snapId}.jpg`);
            formData.append('sessionId', sessionId);
            formData.append('type', type === 'CAMERA_SUBJECT' ? 'SUBJECT' : 'COPY');
            try {
                await fetch('/api/scans/upload', { method: 'POST', body: formData });
                setSnapQueue(prev => prev.map(s => s.id === snapId ? { ...s, status: 'done' } : s));
                loadSessions(); 
            } catch(e) { /* Error */ }
        }, 'image/jpeg', 0.95);
    };

    const handleCreateDC = async () => {
        const title = prompt("Titre du DC ?") || `Scan ${new Date().toLocaleDateString()}`;
        await fetch('/api/scans/sessions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, teacherId: user.id || user._id }) });
        loadSessions();
    };

    const handleDeleteSession = async (id) => {
        if(!confirm("Supprimer ce paquet de copies ?")) return;
        await fetch(`/api/scans/sessions/${id}`, { method: 'DELETE' });
        loadSessions();
    };

    const handleLinkDrive = async (sessionId) => {
        await fetch(`/api/scans/sessions/${sessionId}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chapterId: selectedFolderId }) });
        alert("✅ Dossier lié !");
        loadSessions();
    };

    // --- LOGIQUE CORRECTION ---
    const openCorrectionModal = (sessionId) => {
        setCorrectionModal(sessionId);
        setInstructions(
            "1. IDENTIFICATION : Trouve le nom de l'élève.\n" +
            "2. TRANSCRIPTION : Recopie le texte de la copie.\n" +
            "3. COMMENTAIRES : Analyse les erreurs et points forts.\n" +
            "4. NOTE : Donne une note sur 20."
        );
    };

    const launchCorrection = async () => {
        if(!correctionModal) return;
        setProcessing(true);
        try {
            await fetch(`/api/scans/correct/${correctionModal}`, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ instructions }) 
            });
            await loadSessions(); // Recharger pour voir les résultats
            setCorrectionModal(null);
        } catch(e) { alert("Erreur IA"); }
        setProcessing(false);
    };

    return (
        <div className="scan-page">
            {/* MODALE CORRECTION */}
            {correctionModal && (
                <div className="scan-overlay animate-in">
                    <div className="scan-modal">
                        <h3>🤖 CONFIGURATION CORRECTION</h3>
                        <textarea 
                            className="scan-instr-input"
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                        />
                        <div className="scan-modal-actions">
                            <button onClick={() => setCorrectionModal(null)} className="btn-cancel">ANNULER</button>
                            <button onClick={launchCorrection} className="btn-launch" disabled={processing}>
                                {processing ? 'TRAITEMENT EN COURS...' : 'LANCER LES CORRECTIONS 🚀'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="create-dc-btn" onClick={handleCreateDC}><span className="create-label">+ NOUVEAU SCAN</span></div>
            
            {sessions.map(s => {
                const active = activePanels[s._id];
                const folderName = chapters.find(c => c._id === s.chapterId)?.title || "AUCUN DOSSIER";
                const hasCorrections = s.corrections && s.corrections.length > 0;

                return (
                    <div key={s._id} className="dc-card">
                        <div className="dc-header">
                            <div>
                                <h3 style={{fontWeight:900}}>{s.title}</h3>
                                <p className="text-xs text-slate-400 font-bold">{s.copyUrls.length} Copies • Dossier : {folderName}</p>
                            </div>
                            <div className="dc-toolbar">
                                <button className="tool-btn btn-scanner" onClick={() => togglePanel(s._id, 'CAMERA_COPY')}>📷 SCANNER</button>
                                <button className="tool-btn btn-devoirs" onClick={() => togglePanel(s._id, 'SHOW_COPIES')}>📚 DEVOIRS</button>
                                <button className="tool-btn btn-folder" onClick={() => togglePanel(s._id, 'DRIVE_SELECTION', s.chapterId)}>📂 RANGER</button>
                                <button className="tool-btn btn-correct" onClick={() => openCorrectionModal(s._id)}>🤖 CORRIGER</button>
                                <button className="tool-btn btn-delete" onClick={() => handleDeleteSession(s._id)}>✕</button>
                            </div>
                        </div>
                        
                        {/* RESULTATS CORRECTIONS (AFFICHAGE DIRECT) */}
                        {hasCorrections && (
                            <div className="corrections-container">
                                {s.corrections.map((corr, idx) => (
                                    <div key={idx} className="correction-card">
                                        <div className="correction-img-box">
                                            <img src={corr.originalUrl} alt="Copie" onClick={() => window.open(corr.originalUrl, '_blank')} />
                                        </div>
                                        <div className="correction-info-box">
                                            <div className="ci-header">
                                                <span className="ci-name">{corr.studentName || "Élève Inconnu"}</span>
                                                <span className="ci-grade">{corr.grade}</span>
                                            </div>
                                            <div className="ci-body custom-scrollbar">
                                                <p className="ci-label">APPRÉCIATION :</p>
                                                <p className="ci-text">{corr.appreciation}</p>
                                                <p className="ci-label mt-2">TRANSCRIPTION :</p>
                                                <p className="ci-text italic">{corr.transcription}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* PANNEAUX OUTILS */}
                        {active === 'SHOW_COPIES' && (
                            <div className="dc-content-area text-white">
                                <h4 className="font-bold mb-4 uppercase">Copies brutes ({s.copyUrls.length})</h4>
                                <div className="snap-queue-strip custom-scrollbar">
                                    {s.copyUrls.map((url, i) => (
                                        <img key={i} src={url} className="queue-thumb" style={{border:'2px solid white'}} onClick={() => window.open(url, '_blank')} />
                                    ))}
                                    {s.copyUrls.length === 0 && <span className="text-sm italic opacity-50">Aucune copie.</span>}
                                </div>
                            </div>
                        )}

                        {active === 'DRIVE_SELECTION' && (
                            <div className="dc-content-area flex flex-col items-center gap-4 text-white">
                                <h3>CHOISIR LE DOSSIER DE RANGEMENT</h3>
                                <select className="p-3 rounded text-black font-bold" value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)}>
                                    <option value="">-- SÉLECTION --</option>
                                    {relevantChapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                                </select>
                                <button className="bg-green-500 text-white px-4 py-2 rounded font-black" onClick={() => handleLinkDrive(s._id)}>VALIDER LE RANGEMENT</button>
                            </div>
                        )}

                        {active && active.startsWith('CAMERA') && (
                            <div className="dc-content-area">
                                <div className="cam-wrapper">
                                    <video ref={videoRef} autoPlay playsInline className="cam-video" />
                                    <canvas ref={canvasRef} style={{display:'none'}} />
                                    <div className="cam-trigger" onClick={() => takeSnap(s._id, active)}>⚪</div>
                                </div>
                                <div className="snap-queue-strip custom-scrollbar">{snapQueue.map(sq => <img key={sq.id} src={sq.url} className={`queue-thumb ${sq.status}`} />)}</div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}