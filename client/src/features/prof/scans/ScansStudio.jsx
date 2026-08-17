// @signatures: ScansStudio, handleCapture, handleUploadQueue, handleLaunchCorrection, handleOpenResult
import React, { useState, useEffect, useRef } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ user, globalClass, globalClassId, classes = [], launchIntent = null }) {
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [view, setView] = useState('list'); 
    const [localQueue, setLocalQueue] = useState([]);
    const [activeResult, setActiveResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [cameraError, setCameraError] = useState("");
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraRequestNonce, setCameraRequestNonce] = useState(0);
    const [collapsedSessions, setCollapsedSessions] = useState({});
    const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
    const [iaDraftBySession, setIaDraftBySession] = useState({});
    const [transcriptView, setTranscriptView] = useState('literal_final');
    const [reCorrectingUrl, setReCorrectingUrl] = useState('');
    const [manualImportBySession, setManualImportBySession] = useState({});
    const [manualPromptBySession, setManualPromptBySession] = useState({});
    const [manualImporting, setManualImporting] = useState(false);
    const [manualPreparing, setManualPreparing] = useState(false);
    const [manualCopyingClipboard, setManualCopyingClipboard] = useState(false);
    const [selectedAssetUrls, setSelectedAssetUrls] = useState([]);
    const [manualZipDownloading, setManualZipDownloading] = useState(false);
    const [gradingSession, setGradingSession] = useState(null);
    const [gradingStudents, setGradingStudents] = useState([]);
    const [selectedGradingStudentId, setSelectedGradingStudentId] = useState('');
    const [gradingLoading, setGradingLoading] = useState(false);
    const [savingGradeKey, setSavingGradeKey] = useState('');
    const [isDesktopMode, setIsDesktopMode] = useState(() => {
        if (typeof window === 'undefined') return true;
        const ua = navigator?.userAgent || '';
        const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
        return !isMobileUa && window.innerWidth >= 900;
    });

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const queueTimersRef = useRef({});
    const localQueueRef = useRef([]);
    const handledLaunchIntentRef = useRef('');
    const teacherId = user?.id || user?._id || '';
    const normalizedGlobalClassId = String(globalClassId || '').trim();
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
        const params = new URLSearchParams();
        if (teacherId) params.set('teacherId', teacherId);
        if (normalizedGlobalClassId && !isDesktopMode) params.set('classId', normalizedGlobalClassId);
        if (isDesktopMode) params.set('includeUnassigned', '1');
        const res = await fetch(`/api/scans/sessions?${params.toString()}`);
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

    useEffect(() => { loadSessions(); }, [teacherId, normalizedGlobalClassId, isDesktopMode]);
    useEffect(() => { localQueueRef.current = localQueue; }, [localQueue]);
    useEffect(() => {
        const syncViewport = () => {
            const ua = navigator?.userAgent || '';
            const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
            setIsDesktopMode(!isMobileUa && window.innerWidth >= 900);
        };
        syncViewport();
        window.addEventListener('resize', syncViewport);
        return () => window.removeEventListener('resize', syncViewport);
    }, []);
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
        const tryOpenCameraStream = async () => {
            const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
            const attempts = isMobile
                ? [
                    { video: { facingMode: { ideal: 'environment' } } },
                    { video: { facingMode: { ideal: 'user' } } },
                    { video: true }
                ]
                : [
                    { video: { facingMode: { ideal: 'user' } } },
                    { video: true },
                    { video: { facingMode: { ideal: 'environment' } } }
                ];

            let lastErr = null;
            for (const constraints of attempts) {
                try {
                    return await navigator.mediaDevices.getUserMedia(constraints);
                } catch (err) {
                    lastErr = err;
                }
            }

            if (navigator.mediaDevices?.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
                const videoInputs = Array.isArray(devices)
                    ? devices.filter((device) => device.kind === 'videoinput' && String(device.deviceId || '').trim())
                    : [];
                for (const device of videoInputs) {
                    try {
                        return await navigator.mediaDevices.getUserMedia({
                            video: { deviceId: { exact: device.deviceId } }
                        });
                    } catch (err) {
                        lastErr = err;
                    }
                }
            }

            throw lastErr || new Error('camera_unavailable');
        };

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
            try {
                const stream = await tryOpenCameraStream();
                if (videoRef.current) videoRef.current.srcObject = stream;
                return;
            } catch (lastErr) {
                const errorName = String(lastErr?.name || '').trim();
                const errorMessage = String(lastErr?.message || '').trim();
                setCameraError(
                    errorName === 'NotAllowedError'
                        ? "Accès caméra refusé. Autorise la caméra dans le navigateur."
                        : (errorName === 'NotReadableError' || /notreadable|trackstart|concurrent|start/i.test(errorMessage))
                            ? "Caméra occupée ou bloquée par le système."
                            : (errorName === 'NotFoundError')
                                ? "Aucune caméra disponible."
                                : "Caméra détectée mais indisponible."
                );
            }
        };
        startCamera();
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            setCameraReady(false);
        };
    }, [view, loading, cameraRequestNonce]);

    useEffect(() => {
        const key = String(launchIntent?.requestedAt || '');
        if (!launchIntent?.autoCreate || !teacherId || !normalizedGlobalClassId || !globalClass || !key) return;
        if (handledLaunchIntentRef.current === key) return;
        handledLaunchIntentRef.current = key;
        const openIntentSession = async () => {
            try {
                const res = await fetch('/api/scans/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: String(launchIntent?.title || `Sprites ${globalClass}`).trim(),
                        teacherId,
                        classId: normalizedGlobalClassId,
                        className: globalClass || ''
                    })
                });
                const data = await res.json().catch(() => ({}));
                await loadSessions();
                if (res.ok && data?._id) {
                    setActiveSession(data);
                    setView('scan');
                    setWorkspaceCollapsed(false);
                }
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    ['scanAuto', 'scanTitle'].forEach((name) => url.searchParams.delete(name));
                    window.history.replaceState({}, '', url.toString());
                }
            } catch (_) {}
        };
        void openIntentSession();
    }, [launchIntent?.autoCreate, launchIntent?.requestedAt, launchIntent?.title, teacherId, normalizedGlobalClassId, globalClass]);

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
        setSelectedAssetUrls(prev => prev.filter(x => x !== url));
        await loadSessions();
    };
    const toggleAssetSelection = (url) => {
        setSelectedAssetUrls(prev => prev.includes(url) ? prev.filter(x => x !== url) : [...prev, url]);
    };
    const clearAssetSelection = () => setSelectedAssetUrls([]);

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
    const buildManualPrompt = (session) => {
        const subjectLines = (session.subjectUrls || []).map((url, idx) => `- Sujet ${idx + 1}: ${url}`).join('\n') || '- Aucun sujet';
        const copyLines = (session.copyUrls || []).map((url, idx) => `- Copie ${idx + 1}: ${url}`).join('\n') || '- Aucune copie';
        return [
            `Tu corriges un lot de copies manuscrites pour la session "${session.title || 'Sans titre'}".`,
            '',
            'Important:',
            '- L utilisateur va joindre manuellement toutes les images des sujets puis toutes les images des copies.',
            '- Chaque copie est indexee dans l ordre ci-dessous. Garde exactement ce copyIndex dans la reponse.',
            '- Releve le nom de l eleve si visible. Sinon mets "Inconnu".',
            '- Interdiction absolue de resumer a la place de transcrire.',
            '- Pour chaque copie, lis vraiment l ecriture et fournis une transcription textuelle exploitable.',
            '- Donne une appreciation concise et exploitable par le professeur.',
            '- Utilise seulement les notes A+, A, B, C. Ajoute score20 seulement si tu es certain d etre en notation sur 20.',
            '- `literalTranscription` = transcription fidele, ligne par ligne, au plus proche de l original. Ne jamais mettre un resume generique.',
            '- `transcription` = meme contenu mais rendu lisible avec orthographe corrigee. Ne jamais mettre un resume generique.',
            '- Si un mot est illisible, garde `[illisible]` a sa place, mais continue la transcription.',
            '- `questionFeedback` = tableau de remarques par question si identifiable.',
            '- `spellingMistakes` = tableau optionnel [{ "wrong": "...", "correct": "..." }].',
            '',
            'Consignes du professeur:',
            String(iaDraftBySession[session._id] || session.aiInstructions || '').trim() || 'Aucune',
            '',
            'Ordre des sujets:',
            subjectLines,
            '',
            'Ordre des copies:',
            copyLines,
            '',
            'Reponds uniquement avec ce JSON:',
            '```json',
            '{',
            '  "corrections": [',
            '    {',
            '      "copyIndex": 1,',
            '      "studentName": "Prenom Nom",',
            '      "grade": "A|A+|B|C",',
            '      "score20": 15,',
            '      "appreciation": "Commentaire global",',
            '      "literalTranscription": "Texte fidele complet de la copie, pas un resume",',
            '      "transcription": "Texte complet corrige, pas un resume",',
            '      "questionFeedback": ["Q1 ...", "Q2 ..."],',
            '      "spellingMistakes": [{"wrong": "mot faux", "correct": "mot juste"}]',
            '    }',
            '  ]',
            '}',
            '```'
        ].join('\n');
    };
    const handleLaunchManualMode = async (session) => {
        const prompt = buildManualPrompt(session);
        setManualPromptBySession(prev => ({ ...prev, [session._id]: prompt }));
        setActiveSession(session);
        setView('manual');
        setWorkspaceCollapsed(false);
        setManualPreparing(true);
        try {
            await navigator.clipboard.writeText(prompt);
            setStatus("Prompt du mode B copié.");
        } catch (_) {
            setStatus("Copie automatique du prompt refusée.");
        }
        try {
            window.open('https://chatgpt.com/', 'conda-scan-b', 'popup=yes,width=980,height=820,left=80,top=60');
        } catch (_) {}
        try {
            await handleDownloadManualAssets(session);
        } catch (_) {}
        setManualPreparing(false);
    };
    const handleCopyManualPrompt = async (session) => {
        const prompt = manualPromptBySession[session._id] || buildManualPrompt(session);
        setManualPromptBySession(prev => ({ ...prev, [session._id]: prompt }));
        try {
            await navigator.clipboard.writeText(prompt);
            setStatus("Prompt du mode B copié.");
        } catch (_) {
            alert("Impossible de copier le prompt automatiquement.");
        }
    };
    const handleImportManualResults = async (sessionId) => {
        const rawText = String(manualImportBySession[sessionId] || '').trim();
        if (!rawText) {
            alert("Colle d'abord la réponse JSON de ChatGPT.");
            return;
        }
        setManualImporting(true);
        try {
            const res = await fetch(`/api/scans/manual-import/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Import manuel impossible");
            setManualImportBySession(prev => ({ ...prev, [sessionId]: '' }));
            await loadSessions();
            setView('results');
        } catch (e) {
            alert(String(e?.message || "Import manuel impossible"));
        } finally {
            setManualImporting(false);
        }
    };
    const sanitizeFilePart = (value) => String(value || 'scan')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'scan';
    const downloadBlob = (blob, filename) => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    };
    const inferExtFromBlob = (blob, fallback = 'jpg') => {
        const type = String(blob?.type || '').toLowerCase();
        if (type.includes('png')) return 'png';
        if (type.includes('webp')) return 'webp';
        if (type.includes('pdf')) return 'pdf';
        return fallback;
    };
    const handleDownloadManualAssets = async (session) => {
        if (!session?._id) return;
        setManualZipDownloading(true);
        try {
            const res = await fetch(`/api/scans/session-zip/${session._id}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || "Téléchargement du zip impossible");
            }
            const blob = await res.blob();
            const base = sanitizeFilePart(session?.title || 'session');
            downloadBlob(blob, `${base}_session.zip`);
            setStatus("Zip de la session téléchargé.");
        } catch (e) {
            alert(String(e?.message || "Téléchargement du zip impossible"));
        } finally {
            setManualZipDownloading(false);
        }
    };
    const handleCopyManualAssetsToClipboard = async (session) => {
        if (!navigator?.clipboard?.write || typeof ClipboardItem === 'undefined') {
            alert("Copie d'images non supportée sur ce navigateur.");
            return;
        }
        setManualCopyingClipboard(true);
        try {
            const rows = [
                ...(Array.isArray(session?.subjectUrls) ? session.subjectUrls : []).map((url, idx) => ({ url, label: `sujet ${idx + 1}` })),
                ...(Array.isArray(session?.copyUrls) ? session.copyUrls : []).map((url, idx) => ({ url, label: `copie ${idx + 1}` }))
            ];
            if (rows.length === 0) {
                alert("Aucune image à copier.");
                return;
            }

            const items = [];
            for (const row of rows) {
                try {
                    const res = await fetch(row.url);
                    const blob = await res.blob();
                    const type = String(blob?.type || '').toLowerCase();
                    if (!type.startsWith('image/')) continue;
                    items.push(new ClipboardItem({ [blob.type || 'image/png']: blob }));
                } catch (_) {}
            }

            if (items.length === 0) {
                alert("Aucune image exploitable n'a pu être copiée.");
                return;
            }

            await navigator.clipboard.write(items);
            setStatus(`${items.length} image(s) copiée(s) dans le presse-papiers. Teste ensuite Cmd/Ctrl+V dans ChatGPT.`);
        } catch (e) {
            alert("Le navigateur a refusé la copie multiple d'images. Le téléchargement reste la solution fiable.");
        } finally {
            setManualCopyingClipboard(false);
        }
    };

    const handleDeleteSession = async (id) => {
        if(!confirm("Supprimer cette session ?")) return;
        await fetch(`/api/scans/sessions/${id}`, { method: 'DELETE' });
        loadSessions();
    };
    const handleAssignSessionClass = async (sessionId, classId) => {
        const selected = classes.find((c) => String(c._id) === String(classId));
        await fetch(`/api/scans/sessions/${sessionId}/classroom`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classId: selected?._id || null,
                className: selected?.name || ''
            })
        });
        await loadSessions();
    };

    const openManualGrading = async (session) => {
        setGradingSession(session);
        setSelectedGradingStudentId('');
        setGradingLoading(true);
        try {
            const res = await fetch('/api/admin/students');
            if (!res.ok) throw new Error('Impossible de charger les élèves.');
            const rows = await res.json();
            const classId = String(session?.classId || normalizedGlobalClassId || '');
            const filtered = (Array.isArray(rows) ? rows : []).filter((student) => {
                if (!classId) return true;
                if (String(student?.classId || '') === classId) return true;
                return (student?.assignedGroups || []).some((id) => String(id?._id || id) === classId);
            });
            filtered.sort((a, b) => String(a?.firstName || '').localeCompare(String(b?.firstName || ''), 'fr', { sensitivity: 'base' }) ||
                String(a?.lastName || '').localeCompare(String(b?.lastName || ''), 'fr', { sensitivity: 'base' }));
            setGradingStudents(filtered);
        } catch (e) {
            setStatus(e.message || 'Impossible de charger les élèves.');
            setGradingStudents([]);
        } finally {
            setGradingLoading(false);
        }
    };

    const saveManualGrade = async (studentId, value) => {
        if (!gradingSession?._id) return;
        const key = `${studentId}-${value}`;
        const previousSession = gradingSession;
        const now = new Date().toISOString();
        const optimisticGrades = [...(gradingSession.manualGrades || [])];
        const existingIndex = optimisticGrades.findIndex((row) => String(row.studentId?._id || row.studentId) === String(studentId));
        if (existingIndex >= 0) optimisticGrades[existingIndex] = { ...optimisticGrades[existingIndex], value, gradedAt: now };
        else optimisticGrades.push({ studentId, value, gradedAt: now });
        const optimisticSession = { ...gradingSession, manualGrades: optimisticGrades };
        setGradingSession(optimisticSession);
        setSessions((current) => current.map((row) => row._id === optimisticSession._id ? optimisticSession : row));
        setSavingGradeKey(key);
        try {
            const res = await fetch(`/api/scans/sessions/${gradingSession._id}/manual-grade`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, value })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "La note n'a pas été enregistrée.");
            setGradingSession(data.session);
            setSessions((current) => current.map((row) => row._id === data.session._id ? data.session : row));
            setStatus(`Note ${value}/5 enregistrée.`);
        } catch (e) {
            setGradingSession(previousSession);
            setSessions((current) => current.map((row) => row._id === previousSession._id ? previousSession : row));
            setStatus(e.message || "La note n'a pas été enregistrée.");
        } finally {
            setSavingGradeKey('');
        }
    };

    const createSession = async (isManualOnly = false) => {
        const title = String(prompt(isManualOnly ? "Titre du devoir manuel :" : "Titre de l'évaluation :") || '').trim();
        if (!title) return;
        try {
            const res = await fetch('/api/scans/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    teacherId,
                    classId: globalClassId || null,
                    className: globalClass || '',
                    isManualOnly
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?._id) throw new Error(data?.error || "Création de session impossible");
            await loadSessions();
            if (isManualOnly) {
                setActiveSession(null);
                setView('list');
                await openManualGrading(data);
            } else {
                setActiveSession(data);
                setView('scan');
                setWorkspaceCollapsed(false);
            }
        } catch (e) {
            alert(e.message || "Création de session impossible");
        }
    };
    const toggleSessionCollapse = (sessionId) => {
        setCollapsedSessions(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
    };
    const renderWorkspace = (session) => {
        const uploaded = view === 'sujets' ? (session.subjectUrls || []) : (session.copyUrls || []);
        return (
            <div className={`scan-workspace-inline animate-in view-${view}`}>
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
                        {isDesktopMode && (
                            <button
                                onClick={() => handleLaunchManualMode(session)}
                                className="act-btn btn-manual"
                                title="Mode B desktop"
                            >
                                B
                            </button>
                        )}
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
                                {!cameraReady && (
                                    <button
                                        type="button"
                                        className="act-btn btn-scan"
                                        onClick={() => {
                                            setCameraError("");
                                            setCameraRequestNonce((prev) => prev + 1);
                                        }}
                                    >
                                        Activer caméra
                                    </button>
                                )}
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
                                    {uploaded.length > 0 && (
                                        <div className="asset-selection-toolbar">
                                            <div className="asset-selection-text">
                                                {selectedAssetUrls.length > 0
                                                    ? `${selectedAssetUrls.length} image(s) sélectionnée(s). Essaie maintenant Ctrl/Cmd+C.`
                                                    : "Clique sur les images pour en sélectionner plusieurs."}
                                            </div>
                                            {selectedAssetUrls.length > 0 && (
                                                <button type="button" className="asset-selection-clear" onClick={clearAssetSelection}>Effacer</button>
                                            )}
                                        </div>
                                    )}
                                    {uploaded.map((url, idx) => (
                                        <div
                                            key={`${url}-${idx}`}
                                            className={`capture-thumb uploaded selectable ${selectedAssetUrls.includes(url) ? 'selected' : ''}`}
                                            onClick={() => toggleAssetSelection(url)}
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    toggleAssetSelection(url);
                                                }
                                            }}
                                        >
                                            <img src={url} draggable={false} />
                                            <button onClick={() => handleDeleteUploaded(url, view === 'sujets' ? 'SUBJECT' : 'COPY')} className="thumb-del">✕</button>
                                            {selectedAssetUrls.includes(url) && <div className="capture-selected-badge">Sélectionnée</div>}
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

                        {view === 'manual' && isDesktopMode && (
                            <div className="manual-b-panel">
                                <div className="manual-b-top">
                                    <div>
                                        <div className="manual-b-kicker">Mode B desktop</div>
                                        <h3 className="manual-b-title">Fallback sans API</h3>
                                        <p className="manual-b-text">
                                            Le prompt est copié puis ChatGPT s'ouvre dans une petite fenêtre. Le professeur y colle le prompt,
                                            récupère automatiquement tous les sujets et copies téléchargés sur l'ordinateur, puis recolle ici la réponse JSON.
                                        </p>
                                    </div>
                                    <div className="manual-b-actions">
                                        <button className="manual-b-btn primary" onClick={() => handleCopyManualPrompt(session)}>Copier le prompt</button>
                                        <button className="manual-b-btn" onClick={() => handleCopyManualAssetsToClipboard(session)} disabled={manualCopyingClipboard}>
                                            {manualCopyingClipboard ? 'Copie...' : 'Copier les images'}
                                        </button>
                                        <button className="manual-b-btn" onClick={() => handleDownloadManualAssets(session)} disabled={manualZipDownloading}>
                                            {manualZipDownloading ? 'Zip...' : 'Télécharger le zip'}
                                        </button>
                                        <button className="manual-b-btn" onClick={() => window.open('https://chatgpt.com/', 'conda-scan-b', 'popup=yes,width=980,height=820,left=80,top=60')}>Ouvrir ChatGPT</button>
                                    </div>
                                </div>
                                {manualPreparing && <div className="manual-b-hint">Préparation du mode B en cours: prompt copié, fenêtre ouverte, images téléchargées.</div>}
                                <textarea
                                    className="manual-b-prompt"
                                    value={manualPromptBySession[session._id] || buildManualPrompt(session)}
                                    onChange={(e) => setManualPromptBySession(prev => ({ ...prev, [session._id]: e.target.value }))}
                                />
                                <textarea
                                    className="manual-b-import"
                                    value={manualImportBySession[session._id] || ''}
                                    onChange={(e) => setManualImportBySession(prev => ({ ...prev, [session._id]: e.target.value }))}
                                    placeholder='Colle ici la réponse JSON de ChatGPT, par exemple {"corrections":[...]}'
                                />
                                <div className="manual-b-actions">
                                    <button className="manual-b-btn success" onClick={() => handleImportManualResults(session._id)} disabled={manualImporting}>
                                        {manualImporting ? 'Import...' : 'Importer les corrections'}
                                    </button>
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

    const visibleSessions = sessions.filter((session) => {
        if (isDesktopMode) return true;
        const sessionClassId = String(session?.classId || '').trim();
        if (sessionClassId) return sessionClassId === normalizedGlobalClassId;
        return isDesktopMode;
    });

    return (
        <div className="scan-page animate-in fade-in">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">Correction Vision 📸</h2>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Scanner et corriger via le Drive Pro</p>
                    {globalClass && <p className="scan-class-context">Classe active: {globalClass}</p>}
                </div>
                <div className="scan-create-actions">
                    <button onClick={() => createSession(false)} className="scan-create-btn primary">
                        + NOUVELLE SESSION
                    </button>
                    <button onClick={() => createSession(true)} className="scan-create-btn manual">
                        ✋ MANUEL
                    </button>
                </div>
            </div>

            <div className="sessions-list">
                {visibleSessions.map(s => {
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
                                        {!s.isManualOnly && <button onClick={() => { setActiveSession(s); setView('sujets'); }} className="act-btn btn-sujet">Sujets</button>}
                                        {!s.isManualOnly && <button onClick={() => { setActiveSession(s); setView('scan'); }} className="act-btn btn-scan">Scan</button>}
                                        {!s.isManualOnly && <button onClick={() => { setActiveSession(s); setView('results'); }} className="act-btn btn-results">Résultats</button>}
                                        <button onClick={() => openManualGrading(s)} className="act-btn btn-quick-grade">Manuel</button>
                                        {!s.isManualOnly && <button
                                            onClick={() => {
                                                setActiveSession(s);
                                                setView('ia');
                                                setWorkspaceCollapsed(false);
                                            }}
                                            className="act-btn btn-ia"
                                        >
                                            IA
                                        </button>}
                                        {isDesktopMode && !s.isManualOnly && (
                                            <button
                                                onClick={() => handleLaunchManualMode(s)}
                                                className="act-btn btn-manual"
                                                title="Mode B desktop"
                                            >
                                                B
                                            </button>
                                        )}
                                        <button onClick={() => handleDeleteSession(s._id)} className="act-btn btn-delete">✕</button>
                                    </div>
                                </div>
                                {!isCollapsed && (
                                    <div className="session-card-info">
                                        <div className="s-meta">
                                            <span className="s-date">{new Date(s.date).toLocaleDateString()}</span>
                                            <span className="s-divider">•</span>
                                            <span className={`s-class-tag ${s.classId ? 'assigned' : 'unassigned'}`}>{s.className || 'Classe non définie'}</span>
                                            <span className="s-divider">•</span>
                                            <span className="s-count">{s.copyUrls?.length || 0} COPIES</span>
                                        </div>
                                        {isDesktopMode && (
                                            <div className="session-class-assign">
                                                <label htmlFor={`scan-class-${s._id}`} className="session-class-label">Classe</label>
                                                <select
                                                    id={`scan-class-${s._id}`}
                                                    className="session-class-select"
                                                    value={String(s.classId || '')}
                                                    onChange={(e) => handleAssignSessionClass(s._id, e.target.value)}
                                                >
                                                    <option value="">Non attribuée</option>
                                                    {classes.map((cls) => (
                                                        <option key={cls._id} value={cls._id}>{cls.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                        {isActiveWorkspace && renderWorkspace(s)}
                    </div>
                )})}
                {visibleSessions.length === 0 && (
                    <div className="scan-empty-state">
                        {globalClass ? `Aucun scan pour ${globalClass}.` : 'Aucun scan.'}
                    </div>
                )}
            </div>
            {gradingSession && (
                <div className="scan-grading-overlay" onClick={() => setGradingSession(null)}>
                    <section className="scan-grading-modal" onClick={(event) => event.stopPropagation()}>
                        <header className="scan-grading-header">
                            <div>
                                <div className="scan-grading-kicker">Notation manuelle · {gradingSession.className || globalClass || 'Classe'}</div>
                                <h2>{gradingSession.title || 'Devoir'}</h2>
                                <time>Date du devoir : {new Date(gradingSession.date).toLocaleDateString('fr-FR')}</time>
                            </div>
                            <button type="button" onClick={() => setGradingSession(null)} aria-label="Fermer">✕</button>
                        </header>
                        <div className="scan-grading-help">Touchez un élève, puis attribuez immédiatement une note de 1 à 5.</div>
                        <div className="scan-grading-grid">
                            {gradingLoading && <div className="scan-grading-empty">Chargement de la classe…</div>}
                            {!gradingLoading && gradingStudents.map((student) => {
                                const studentId = String(student._id);
                                const grade = (gradingSession.manualGrades || []).find((row) => String(row.studentId?._id || row.studentId) === studentId);
                                const selected = selectedGradingStudentId === studentId;
                                return (
                                    <article key={studentId} className={`scan-student-grade ${selected ? 'is-selected' : ''} ${grade ? 'is-graded' : ''}`}>
                                        <button className="scan-student-select" type="button" onClick={() => setSelectedGradingStudentId(selected ? '' : studentId)}>
                                            <span>{student.firstName} {student.lastName}</span>
                                            <strong>{grade ? `${grade.value}/5` : '—'}</strong>
                                        </button>
                                        {selected && (
                                            <div className="scan-grade-buttons" aria-label={`Noter ${student.firstName}`}>
                                                {[1, 2, 3, 4, 5].map((value) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        className={Number(grade?.value) === value ? 'is-current' : ''}
                                                        disabled={!!savingGradeKey}
                                                        onClick={() => saveManualGrade(studentId, value)}
                                                    >
                                                        {savingGradeKey === `${studentId}-${value}` ? '…' : value}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <small>{new Date(gradingSession.date).toLocaleDateString('fr-FR')}</small>
                                    </article>
                                );
                            })}
                            {!gradingLoading && gradingStudents.length === 0 && <div className="scan-grading-empty">Aucun élève trouvé dans cette classe.</div>}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
