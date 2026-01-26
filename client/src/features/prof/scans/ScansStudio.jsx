import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ user }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [activePanels, setActivePanels] = useState({});
    
    // ETATS MODALE & WORKFLOW
    const [correctionModal, setCorrectionModal] = useState(null); // ID Session pour lancer correction
    const [viewingCorrection, setViewingCorrection] = useState(null); // Objet correction pour affichage résultats
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
            // DISTINCTION CRUCIALE : SUJET ou COPIE
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
        if(!confirm("Supprimer ce dossier de scan ?")) return;
        await fetch(`/api/scans/sessions/${id}`, { method: 'DELETE' });
        loadSessions();
    };

    const handleLinkDrive = async (sessionId) => {
        await fetch(`/api/scans/sessions/${sessionId}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chapterId: selectedFolderId }) });
        alert("✅ Dossier lié !");
        loadSessions();
    };

    // --- IA CORRECTION ---
    const openCorrectionModal = (sessionId) => {
        setCorrectionModal(sessionId);
        setInstructions("Compare la copie au SUJET fourni. Note sur 20. Sois bienveillant mais précis sur les erreurs.");
    };

    const launchCorrection = async () => {
        if(!correctionModal) return;
        setProcessing(true);
        try {
            await fetch(`/api/scans/correct/${correctionModal}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ instructions }) });
            await loadSessions();
            setCorrectionModal(null);
        } catch(e) { alert("Erreur IA"); }
        setProcessing(false);
    };

    // --- VISUALISATION ---
    const handleViewCopy = (session, copyUrl) => {
        // Chercher si une correction existe pour cette URL
        const correction = session.corrections?.find(c => c.originalUrl === copyUrl);
        if (correction) {
            setViewingCorrection(correction); // Ouvre la modale Split View
        } else {
            window.open(copyUrl, '_blank'); // Juste l'image
        }
    };

    return (
        <div className="scan-page">
            
            {/* MODALE RESULTAT SPLIT VIEW */}
            {viewingCorrection && (
                <div className="correction-overlay" onClick={() => setViewingCorrection(null)}>
                    <div className="correction-card !w-[90vw] !max-w-6xl !h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="corr-header">
                            <div>
                                <h2 className="text-xl font-black uppercase text-white">{viewingCorrection.studentName}</h2>
                                <span className="text-xs font-bold text-emerald-400">NOTE : {viewingCorrection.grade}</span>
                            </div>
                            <button onClick={() => setViewingCorrection(null)} className="text-white text-2xl">✕</button>
                        </div>
                        <div className="corr-body flex">
                            {/* GAUCHE : IMAGE */}
                            <div className="flex-1 bg-black flex items-center justify-center p-4">
                                <img src={viewingCorrection.originalUrl} className="max-h-full max-w-full object-contain border-2 border-slate-700 rounded-lg" />
                            </div>
                            {/* DROITE : CORRECTION */}
                            <div className="flex-1 bg-white p-8 overflow-y-auto">
                                <h4 className="text-sm font-black text-slate-400 uppercase mb-2">Appréciation Globale</h4>
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-900 font-medium mb-6">
                                    {viewingCorrection.appreciation}
                                </div>
                                <h4 className="text-sm font-black text-slate-400 uppercase mb-2">Analyse Détaillée</h4>
                                <div className="prose prose-sm text-slate-600 whitespace-pre-wrap">
                                    {viewingCorrection.transcription}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALE LANCEMENT IA */}
            {correctionModal && (
                <div className="scan-overlay animate-in">
                    <div className="scan-modal">
                        <h3>🤖 CONFIGURATION CORRECTION</h3>
                        <p className="text-xs text-slate-400 mb-2">L'IA va utiliser les images "SUJET" comme référence.</p>
                        <textarea className="scan-instr-input" value={instructions} onChange={e => setInstructions(e.target.value)} />
                        <div className="scan-modal-actions">
                            <button onClick={() => setCorrectionModal(null)} className="btn-cancel">ANNULER</button>
                            <button onClick={launchCorrection} className="btn-launch" disabled={processing}>{processing ? 'TRAITEMENT...' : 'LANCER 🚀'}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="create-dc-btn" onClick={handleCreateDC}><span className="create-label">+ NOUVEAU SCAN</span></div>
            
            {sessions.map(s => {
                const active = activePanels[s._id];
                const folderName = chapters.find(c => c._id === s.chapterId)?.title || "AUCUN DOSSIER";
                const correctedCount = s.corrections ? s.corrections.length : 0;

                return (
                    <div key={s._id} className="dc-card">
                        <div className="dc-header">
                            <div>
                                <h3 style={{fontWeight:900}}>{s.title}</h3>
                                <p className="text-xs text-slate-400 font-bold">
                                    {s.subjectUrls?.length || 0} Sujets • {s.copyUrls.length} Copies • {correctedCount} Corrigés
                                </p>
                            </div>
                            <div className="dc-toolbar">
                                <button className="tool-btn btn-sujet" onClick={() => togglePanel(s._id, 'CAMERA_SUBJECT')}>📄 SUJET</button>
                                <button className="tool-btn btn-scanner" onClick={() => togglePanel(s._id, 'CAMERA_COPY')}>📷 COPIES</button>
                                <button className="tool-btn btn-devoirs" onClick={() => togglePanel(s._id, 'SHOW_ALL')}>👀 VOIR TOUT</button>
                                <button className="tool-btn btn-folder" onClick={() => togglePanel(s._id, 'DRIVE_SELECTION', s.chapterId)}>📂 RANGER</button>
                                <button className="tool-btn btn-correct" onClick={() => openCorrectionModal(s._id)}>🤖 CORRIGER</button>
                                <button className="tool-btn btn-delete" onClick={() => handleDeleteSession(s._id)}>✕</button>
                            </div>
                        </div>

                        {/* ZONE DE VISUALISATION */}
                        {active === 'SHOW_ALL' && (
                            <div className="dc-content-area text-white">
                                {/* SECTION SUJETS */}
                                {s.subjectUrls?.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="font-bold mb-2 uppercase text-xs text-indigo-300">ÉNONCÉS / SUJETS DE RÉFÉRENCE</h4>
                                        <div className="snap-queue-strip custom-scrollbar justify-start">
                                            {s.subjectUrls.map((url, i) => (
                                                <img key={i} src={url} className="queue-thumb border-indigo-500 border-2" onClick={() => window.open(url, '_blank')} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* SECTION COPIES */}
                                <div>
                                    <h4 className="font-bold mb-2 uppercase text-xs text-emerald-300">COPIES ÉLÈVES ({s.copyUrls.length})</h4>
                                    <div className="snap-queue-strip custom-scrollbar justify-start flex-wrap">
                                        {s.copyUrls.map((url, i) => {
                                            const isCorrected = s.corrections?.some(c => c.originalUrl === url);
                                            return (
                                                <div key={i} className="relative group cursor-pointer" onClick={() => handleViewCopy(s, url)}>
                                                    <img src={url} className={`queue-thumb ${isCorrected ? 'border-green-500' : 'border-slate-500'} border-2`} />
                                                    {isCorrected && <div className="absolute top-0 right-0 bg-green-500 text-white text-[8px] font-black px-1 rounded-bl">OK</div>}
                                                </div>
                                            );
                                        })}
                                        {s.copyUrls.length === 0 && <span className="text-sm italic opacity-50">Aucune copie scannée.</span>}
                                    </div>
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
                                <h4 className="text-center text-white font-black mb-2 uppercase">
                                    {active === 'CAMERA_SUBJECT' ? "📸 SCANNER L'ÉNONCÉ (SUJET)" : "📸 SCANNER UNE COPIE ÉLÈVE"}
                                </h4>
                                <div className="cam-wrapper">
                                    <video ref={videoRef} autoPlay playsInline className="cam-video" />
                                    <canvas ref={canvasRef} style={{display:'none'}} />
                                    <div className={`cam-trigger ${active === 'CAMERA_SUBJECT' ? 'border-indigo-500' : 'border-emerald-500'}`} onClick={() => takeSnap(s._id, active)}>⚪</div>
                                </div>
                                <div className="snap-queue-strip custom-scrollbar">
                                    {snapQueue.map(sq => <img key={sq.id} src={sq.url} className={`queue-thumb ${sq.status}`} />)}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}