import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

const SecureImage = ({ src, className, onClick }) => {
    const [error, setError] = useState(false);
    if (error) {
        return (
            <div className={`${className} bg-slate-100 flex flex-col items-center justify-center border-2 border-red-200 text-red-400 p-2 text-center`} title="Fichier perdu">
                <span className="text-xl">⚠️</span>
                <span className="text-[8px] font-black uppercase">Perdu</span>
            </div>
        );
    }
    return <img src={src} className={className} onClick={onClick} onError={() => setError(true)} alt="Scan" />;
};

export default function ScansStudio({ user }) {
    const [sessions, setSessions] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [activePanels, setActivePanels] = useState({});
    
    const [correctionModal, setCorrectionModal] = useState(null); 
    const [viewingCorrection, setViewingCorrection] = useState(null); 
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
            formData.append('file', blob, `scan_${snapId}.jpg`);
            formData.append('sessionId', sessionId);
            formData.append('type', type === 'CAMERA_SUBJECT' ? 'SUBJECT' : 'COPY');
            
            try {
                const res = await fetch('/api/scans/upload', { method: 'POST', body: formData });
                if (!res.ok) throw new Error("Erreur Upload");
                setSnapQueue(prev => prev.map(s => s.id === snapId ? { ...s, status: 'done' } : s));
                loadSessions(); 
            } catch(e) { 
                alert("Échec upload Drive.");
                setSnapQueue(prev => prev.filter(s => s.id !== snapId));
            }
        }, 'image/jpeg', 0.95);
    };

    const handleCreateDC = async () => {
        const title = prompt("Titre du DC ?") || `Scan ${new Date().toLocaleDateString()}`;
        await fetch('/api/scans/sessions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, teacherId: user.id || user._id }) });
        loadSessions();
    };

    const handleDeleteSession = async (id) => {
        if(!confirm("Supprimer ?")) return;
        await fetch(`/api/scans/sessions/${id}`, { method: 'DELETE' });
        loadSessions();
    };

    const handleLinkDrive = async (sessionId) => {
        await fetch(`/api/scans/sessions/${sessionId}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chapterId: selectedFolderId }) });
        alert("✅ Dossier lié !");
        loadSessions();
    };

    const openCorrectionModal = (sessionId) => {
        setCorrectionModal(sessionId);
        setInstructions("Compare la copie au SUJET fourni. Note selon le barème (A+, A, B, C).");
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
            await loadSessions();
            setCorrectionModal(null);
        } catch(e) { alert("Erreur IA"); }
        setProcessing(false);
    };

    return (
        <div className="scan-page">
            {viewingCorrection && (
                <div className="correction-overlay" onClick={() => setViewingCorrection(null)}>
                    <div className="correction-card !w-[90vw] !max-w-6xl !h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="corr-header">
                            <div>
                                <h2 className="text-xl font-black uppercase text-white">{viewingCorrection.studentName}</h2>
                                <span className={`text-sm font-black px-3 py-1 rounded-full ${
                                    (viewingCorrection.grade || "").includes("A") ? "bg-green-500 text-white" :
                                    (viewingCorrection.grade || "").includes("B") ? "bg-yellow-500 text-white" :
                                    "bg-red-500 text-white"
                                }`}>
                                    NOTE : {viewingCorrection.grade}
                                </span>
                            </div>
                            <button onClick={() => setViewingCorrection(null)} className="text-white text-2xl">✕</button>
                        </div>
                        <div className="corr-body flex">
                            <div className="flex-1 bg-black flex items-center justify-center p-4">
                                <SecureImage src={viewingCorrection.originalUrl} className="max-h-full max-w-full object-contain border-2 border-slate-700 rounded-lg" />
                            </div>
                            <div className="flex-1 bg-white p-8 overflow-y-auto">
                                <h4 className="text-sm font-black text-slate-400 uppercase mb-2">Appréciation Globale</h4>
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-900 font-medium mb-6">
                                    {viewingCorrection.appreciation}
                                </div>
                                <h4 className="text-sm font-black text-slate-400 uppercase mb-2">Analyse Détaillée (Rouge = IA / Noir = Élève)</h4>
                                {/* MODIFICATION CRITIQUE : Support du HTML pour les couleurs */}
                                <div 
                                    className="prose prose-sm text-slate-800 whitespace-pre-wrap font-mono text-xs p-4 bg-slate-50 border rounded-xl"
                                    dangerouslySetInnerHTML={{ __html: viewingCorrection.transcription }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {correctionModal && (
                <div className="scan-overlay animate-in">
                    <div className="scan-modal">
                        <h3>🤖 CORRECTION (Barème A+/A/B/C)</h3>
                        <p className="text-xs text-slate-400 mb-2">L'IA va transcrire le texte en noir et commenter en rouge.</p>
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
                const correctedCount = s.corrections ? s.corrections.length : 0;

                return (
                    <div key={s._id} className="dc-card">
                        <div className="dc-header">
                            <div>
                                <h3 style={{fontWeight:900}}>{s.title}</h3>
                                <p className="text-xs text-slate-400 font-bold">{s.subjectUrls?.length || 0} Sujets • {s.copyUrls.length} Copies • {correctedCount} Corrigés</p>
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

                        {active === 'SHOW_ALL' && (
                            <div className="dc-content-area text-white">
                                {s.subjectUrls?.length > 0 && (
                                    <div className="mb-6"><h4 className="font-bold mb-2 uppercase text-xs text-indigo-300">SUJETS</h4><div className="snap-queue-strip custom-scrollbar justify-start">{s.subjectUrls.map((url, i) => (<SecureImage key={i} src={url} className="queue-thumb border-indigo-500 border-2" onClick={() => window.open(url, '_blank')} />))}</div></div>
                                )}
                                <div><h4 className="font-bold mb-2 uppercase text-xs text-emerald-300">COPIES ({s.copyUrls.length})</h4><div className="snap-queue-strip custom-scrollbar justify-start flex-wrap">{s.copyUrls.map((url, i) => { const correction = s.corrections?.find(c => c.originalUrl === url); return (<div key={i} className="relative group cursor-pointer" onClick={() => { if(correction) setViewingCorrection(correction); else window.open(url, '_blank'); }}><SecureImage src={url} className={`queue-thumb ${correction ? 'border-green-500' : 'border-slate-500'} border-2`} />{correction && <div className="absolute top-0 right-0 bg-green-500 text-white text-[8px] font-black px-1 rounded-bl">{correction.grade || "OK"}</div>}</div>); })}</div></div>
                            </div>
                        )}

                        {active === 'DRIVE_SELECTION' && (
                            <div className="dc-content-area flex flex-col items-center gap-4 text-white">
                                <h3>CHOISIR LE DOSSIER</h3>
                                <select className="p-3 rounded text-black font-bold" value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)}><option value="">-- SÉLECTION --</option>{relevantChapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}</select>
                                <button className="bg-green-500 text-white px-4 py-2 rounded font-black" onClick={() => handleLinkDrive(s._id)}>VALIDER</button>
                            </div>
                        )}

                        {active && active.startsWith('CAMERA') && (
                            <div className="dc-content-area">
                                <h4 className="text-center text-white font-black mb-2 uppercase">{active === 'CAMERA_SUBJECT' ? "SUJET" : "COPIE ÉLÈVE"}</h4>
                                <div className="cam-wrapper"><video ref={videoRef} autoPlay playsInline className="cam-video" /><canvas ref={canvasRef} style={{display:'none'}} /><div className={`cam-trigger ${active === 'CAMERA_SUBJECT' ? 'border-indigo-500' : 'border-emerald-500'}`} onClick={() => takeSnap(s._id, active)}>⚪</div></div>
                                <div className="snap-queue-strip custom-scrollbar">{snapQueue.map(sq => <img key={sq.id} src={sq.url} className={`queue-thumb ${sq.status}`} />)}</div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}