// @signatures: ScansStudio, SecureImage, handleCreateDC, handleDeleteFile, handleDeleteSession, handleLinkDrive, launchCorrection, loadChapters, loadSessions, openCorrectionModal, startCamera, takeSnap, togglePanel
import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

const SecureImage = ({ src, className, style, onClick }) => {
    const [error, setError] = useState(false);
    if (error) return <div className={`bg-slate-100 flex items-center justify-center border-2 border-red-200 text-red-400 p-4 text-center ${className}`} style={style}>⚠️ Perdu</div>;
    return <img src={src} className={className} style={style} onClick={onClick} onError={() => setError(true)} alt="Scan" />;
};

export default function ScansStudio({ user }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [activePanels, setActivePanels] = useState({});
    
    // correctionModal stocke l'ID de la session en cours de config
    const [correctionModal, setCorrectionModal] = useState(null); 
    const [viewingCorrection, setViewingCorrection] = useState(null); 
    const [instructions, setInstructions] = useState("");
    const [processing, setProcessing] = useState(false); 
    const [zoomImage, setZoomImage] = useState(null);

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
        if (type && type.startsWith('CAMERA')) setTimeout(startCamera, 100);
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
        cvs.width = vid.videoWidth; cvs.height = vid.videoHeight;
        cvs.getContext('2d').drawImage(vid, 0, 0, cvs.width, cvs.height);
        cvs.toBlob(async (blob) => {
            const localUrl = URL.createObjectURL(blob);
            const snapId = Date.now();
            setSnapQueue(prev => [...prev, { id: snapId, url: localUrl, status: 'uploading' }]);
            const formData = new FormData();
            formData.append('file', blob, `scan_${snapId}.jpg`);
            formData.append('sessionId', sessionId);
            formData.append('type', type === 'CAMERA_SUBJECT' ? 'SUBJECT' : 'COPY');
            try {
                const res = await fetch('/api/scans/upload', { method: 'POST', body: formData });
                if (res.ok) { setSnapQueue(prev => prev.map(s => s.id === snapId ? { ...s, status: 'done' } : s)); loadSessions(); }
            } catch(e) { setSnapQueue(prev => prev.filter(s => s.id !== snapId)); }
        }, 'image/jpeg', 0.95);
    };

    const handleDeleteFile = async (sessionId, url, type) => {
        if(!confirm(`Supprimer définitivement ?`)) return;
        try {
            const res = await fetch('/api/scans/delete-file', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sessionId, url, type }) });
            if(res.ok) loadSessions();
        } catch(e) {}
    };

    const openCorrectionModal = (sessionId) => {
        setCorrectionModal(sessionId);
        setInstructions("Compare la copie au SUJET fourni. Identifie l'élève. Mets une appréciation globale et une lettre (A+, A, B ou C).");
    };

    const launchCorrection = async () => {
        if(!correctionModal) return;
        const sid = correctionModal;
        setCorrectionModal(null); // On ferme la modale immédiatement
        setProcessing(true);      // On affiche le sablier
        
        try {
            const res = await fetch(`/api/scans/correct/${sid}`, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ instructions }) 
            });
            if (res.ok) {
                await loadSessions(); // Recharge les données une fois fini
            }
        } catch(e) { console.error(e); }
        setProcessing(false); // On enlève le sablier
    };

    const handleCreateDC = async () => {
        const title = prompt("Titre du DC ?") || `Scan ${new Date().toLocaleDateString()}`;
        await fetch('/api/scans/sessions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, teacherId: user.id || user._id }) });
        loadSessions();
    };

    const handleDeleteSession = async (id) => {
        if(!confirm("Supprimer toute la session ?")) return;
        await fetch(`/api/scans/sessions/${id}`, { method: 'DELETE' });
        loadSessions();
    };

    const handleLinkDrive = async (sessionId) => {
        await fetch(`/api/scans/sessions/${sessionId}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chapterId: selectedFolderId }) });
        alert("✅ Dossier lié !"); loadSessions();
    };

    return (
        <div className="scan-page">
            {processing && (
                <div className="background-processing-indicator">
                    <span className="sand-timer">⏳</span>
                    <span>IA : CORRECTION EN COURS...</span>
                </div>
            )}

            {zoomImage && (
                <div className="fixed inset-0 z-[100000] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} className="max-w-full max-h-full object-contain" alt="Zoom" />
                </div>
            )}

            {viewingCorrection && (
                <div className="fixed inset-0 z-[90000] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-0 md:p-4" onClick={() => setViewingCorrection(null)}>
                    <div className="bg-white md:rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full h-full md:max-w-[1000px] md:h-[95vh]" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-lg font-black uppercase">{viewingCorrection.studentName}</h2>
                                <span className="text-xs font-black px-3 py-1 rounded-full bg-green-500 text-white mt-1 inline-block">NOTE : {viewingCorrection.grade}</span>
                            </div>
                            <button onClick={() => setViewingCorrection(null)} className="text-white text-2xl font-bold">✕</button>
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <div className="bg-slate-200 relative overflow-y-auto" style={{ height: '60%' }}>
                                <SecureImage src={viewingCorrection.originalUrl} className="w-full h-auto block" onClick={() => setZoomImage(viewingCorrection.originalUrl)} />
                            </div>
                            <div className="bg-white flex flex-col p-6 overflow-y-auto" style={{ height: '40%' }}>
                                <div className="mb-4 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-xl">
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-1">Synthèse IA</h4>
                                    <p className="text-sm font-bold text-slate-700">{viewingCorrection.appreciation}</p>
                                </div>
                                <div className="prose prose-sm text-slate-800 font-mono text-xs whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: viewingCorrection.transcription }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALE DE CONFIGURATION IA (Apparaît quand on clique sur CORRIGER) */}
            {correctionModal && (
                <div className="scan-overlay">
                    <div className="scan-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="font-black">🤖 CONFIGURATION IA</h3>
                        <p className="text-[11px] text-slate-400 font-bold uppercase">Instructions pour la correction :</p>
                        <textarea 
                            className="scan-instr-input" 
                            value={instructions} 
                            onChange={e => setInstructions(e.target.value)} 
                        />
                        <div className="scan-modal-actions">
                            <button onClick={() => setCorrectionModal(null)} className="btn-cancel">ANNULER</button>
                            <button onClick={launchCorrection} className="btn-launch">LANCER LA CORRECTION 🚀</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="create-dc-btn" onClick={handleCreateDC}><span>+ NOUVEAU SCAN (DC)</span></div>
            
            {sessions.map(s => {
                const active = activePanels[s._id];
                const correctedCount = s.corrections ? s.corrections.length : 0;
                return (
                    <div key={s._id} className="dc-card">
                        <div className="dc-header">
                            <div><h3 style={{fontWeight:950, fontSize: '1.1rem'}}>{s.title}</h3><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{s.subjectUrls?.length || 0} Sujets • {s.copyUrls.length} Copies • {correctedCount} Corrigés</p></div>
                            <div className="dc-toolbar">
                                <button className="tool-btn btn-sujet" onClick={() => togglePanel(s._id, 'CAMERA_SUBJECT')}>📄 SUJET</button>
                                <button className="tool-btn btn-scanner" onClick={() => togglePanel(s._id, 'CAMERA_COPY')}>📷 COPIES</button>
                                <button className="tool-btn btn-devoirs" onClick={() => togglePanel(s._id, 'SHOW_ALL')}>👀 VOIR TOUT</button>
                                <button className="tool-btn btn-folder" onClick={() => togglePanel(s._id, 'DRIVE_SELECTION', s.chapterId)}>📂 RANGER</button>
                                <button className="tool-btn btn-correct" onClick={() => openCorrectionModal(s._id)}>🤖 CORRIGER</button>
                                <button className="tool-btn btn-delete" onClick={() => handleDeleteSession(s._id)}>✕</button>
                            </div>
                        </div>
                        {active === 'SHOW_ALL' && (
                            <div className="dc-content-area">
                                {s.subjectUrls?.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="font-black mb-3 uppercase text-[10px] text-indigo-300 tracking-widest">SUJETS ({s.subjectUrls.length})</h4>
                                        <div className="snap-queue-strip">
                                            {s.subjectUrls.map((url, i) => (
                                                <div key={i} className="queue-thumb-container">
                                                    <SecureImage src={url} className="queue-thumb border-indigo-500 border-2" onClick={() => window.open(url, '_blank')} />
                                                    <div className="thumb-delete-trigger" onClick={(e) => { e.stopPropagation(); handleDeleteFile(s._id, url, 'SUBJECT'); }}>✕</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-black mb-3 uppercase text-[10px] text-emerald-300 tracking-widest">COPIES ({s.copyUrls.length})</h4>
                                    <div className="snap-queue-strip flex-wrap">
                                        {s.copyUrls.map((url, i) => { 
                                            const correction = s.corrections?.find(c => c.originalUrl === url); 
                                            return (
                                                <div key={i} className="queue-thumb-container">
                                                    <div onClick={() => { if(correction) setViewingCorrection(correction); else window.open(url, '_blank'); }}>
                                                        <SecureImage src={url} className={`queue-thumb ${correction ? 'border-green-500' : 'border-slate-500'} border-2`} />
                                                        {correction && <div className="absolute top-0 right-0 bg-green-500 text-white text-[8px] font-black px-1 rounded-bl">{correction.grade || "OK"}</div>}
                                                    </div>
                                                    <div className="thumb-delete-trigger" onClick={(e) => { e.stopPropagation(); handleDeleteFile(s._id, url, 'COPY'); }}>✕</div>
                                                </div>
                                            ); 
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                        {active === 'DRIVE_SELECTION' && (<div className="dc-content-area flex flex-col items-center gap-4 text-white"><h3>RANGER DANS LE DRIVE</h3><select className="p-3 rounded text-black font-bold" value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)}><option value="">-- CHOISIR DOSSIER --</option>{relevantChapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}</select><button className="bg-green-500 text-white px-6 py-2 rounded-xl font-black" onClick={() => handleLinkDrive(s._id)}>VALIDER</button></div>)}
                        {active && active.startsWith('CAMERA') && (<div className="dc-content-area"><h4 className="text-center text-white font-black mb-4 uppercase tracking-widest">{active === 'CAMERA_SUBJECT' ? "📸 SCANNER LE SUJET" : "📸 SCANNER LES COPIES"}</h4><div className="cam-wrapper"><video ref={videoRef} autoPlay playsInline className="cam-video" /><canvas ref={canvasRef} style={{display:'none'}} /><div className={`cam-trigger ${active === 'CAMERA_SUBJECT' ? 'border-indigo-500' : 'border-emerald-500'}`} onClick={() => takeSnap(s._id, active)}>⚪</div></div><div className="snap-queue-strip">{(active === 'CAMERA_SUBJECT' ? s.subjectUrls : s.copyUrls).map((url, i) => (<div key={i} className="queue-thumb-container"><SecureImage src={url} className="queue-thumb border-white/20 border-2" /><div className="thumb-delete-trigger" onClick={() => handleDeleteFile(s._id, url, active === 'CAMERA_SUBJECT' ? 'SUBJECT' : 'COPY')}>✕</div></div>))}</div></div>)}
                    </div>
                );
            })}
        </div>
    );
}
