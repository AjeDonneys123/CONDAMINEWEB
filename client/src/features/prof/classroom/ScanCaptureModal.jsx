import React, { useState, useEffect, useRef } from 'react';

export default function ScanCaptureModal({
    isOpen,
    onClose,
    student = null,
    classId = '',
    className = '',
    teacherId = '',
    onOpenGallery = null,
    onScanUploaded = null
}) {
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [capturing, setCapturing] = useState(false);
    const [flashActive, setFlashActive] = useState(false);
    const [sessionCaptures, setSessionCaptures] = useState([]);
    const [availableDevices, setAvailableDevices] = useState([]);
    const [currentDeviceId, setCurrentDeviceId] = useState('');
    const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)

    const sessionIdRef = useRef('');
    const nextPageIndexRef = useRef(1);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const streamRef = useRef(null);

    // Stop all media tracks
    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraReady(false);
    };

    // Enumerer les périphériques vidéo
    const detectCameras = async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter((d) => d.kind === 'videoinput');
            setAvailableDevices(videoInputs);
        } catch (_) {}
    };

    // Démarrage de la caméra
    useEffect(() => {
        if (!isOpen) {
            stopStream();
            return;
        }

        // Nouvelle session de devoir pour ce regroupement d'images
        sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        nextPageIndexRef.current = 1;
        setSessionCaptures([]);

        let isCancelled = false;

        const startCamera = async () => {
            stopStream();
            setCameraError('');
            setCameraReady(false);

            if (!navigator?.mediaDevices?.getUserMedia) {
                setCameraError("Caméra non supportée par votre navigateur.");
                return;
            }

            const host = window?.location?.hostname || '';
            const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
            if (!window.isSecureContext && !isLocalhost) {
                setCameraError("Caméra bloquée : ouvrez l'application en HTTPS ou localhost.");
                return;
            }

            const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
            const preferredFacing = isMobile ? 'environment' : 'user';

            const constraintsList = currentDeviceId
                ? [{ video: { deviceId: { exact: currentDeviceId } } }]
                : [
                    { video: { facingMode: { ideal: facingMode || preferredFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
                    { video: { facingMode: { ideal: preferredFacing } } },
                    { video: true }
                ];

            let activeStream = null;
            let lastErr = null;

            for (const constraints of constraintsList) {
                try {
                    activeStream = await navigator.mediaDevices.getUserMedia(constraints);
                    break;
                } catch (err) {
                    lastErr = err;
                }
            }

            if (isCancelled) {
                if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
                return;
            }

            if (!activeStream) {
                const errorName = String(lastErr?.name || '').trim();
                const errorMessage = String(lastErr?.message || '').trim();
                setCameraError(
                    errorName === 'NotAllowedError'
                        ? "Accès caméra refusé. Veuillez autoriser la caméra dans votre navigateur."
                        : (errorName === 'NotReadableError' || /notreadable|concurrent|start/i.test(errorMessage))
                            ? "Caméra occupée ou verrouillée par une autre application."
                            : errorName === 'NotFoundError'
                                ? "Aucune caméra détectée."
                                : "Impossible de démarrer la caméra."
                );
                return;
            }

            streamRef.current = activeStream;
            if (videoRef.current) {
                videoRef.current.srcObject = activeStream;
            }
            setCameraReady(true);
            void detectCameras();
        };

        void startCamera();

        return () => {
            isCancelled = true;
            stopStream();
        };
    }, [isOpen, currentDeviceId, facingMode]);

    // Bascule caméra avant / arrière
    const toggleFacingMode = () => {
        setCurrentDeviceId('');
        setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    };

    // Prise de photo instantanée
    const handleCapture = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !cameraReady || capturing) return;

        setCapturing(true);
        setFlashActive(true);
        setTimeout(() => setFlashActive(false), 280);

        try {
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
            if (!blob) throw new Error("Échec création image");

            const localPreviewUrl = URL.createObjectURL(blob);
            const tempId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const tempItem = { id: tempId, url: localPreviewUrl, uploading: true };
            setSessionCaptures((prev) => [tempItem, ...prev]);

            // Envoi au serveur
            const formData = new FormData();
            formData.append('file', blob, `capture_${Date.now()}.jpg`);
            formData.append('sessionId', sessionIdRef.current);
            formData.append('pageIndex', String(nextPageIndexRef.current++));
            if (student?._id) {
                formData.append('studentId', student._id);
                formData.append('studentName', `${student.firstName || ''} ${student.lastName || ''}`.trim());
            }
            if (classId) formData.append('classId', classId);
            if (className) formData.append('className', className);
            if (teacherId) formData.append('teacherId', teacherId);

            setCapturing(false);
            void fetch('/api/scans/upload-classroom', {
                method: 'POST',
                body: formData
            }).then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.scan) throw new Error(data?.error || "Échec de l'envoi");
                setSessionCaptures((prev) => prev.map((item) => (item.id === tempId ? { ...item, uploading: false, serverScan: data.scan } : item)));
                if (onScanUploaded) onScanUploaded(data.scan);
            }).catch((err) => {
                console.error("Erreur envoi photo:", err);
                setSessionCaptures((prev) => prev.map((item) => (item.id === tempId ? { ...item, uploading: false, error: true } : item)));
            });
        } catch (err) {
            console.error("Erreur capture photo:", err);
        } finally {
            setCapturing(false);
        }
    };

    // Raccourci barre espace pour capturer
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !capturing && cameraReady) {
                e.preventDefault();
                handleCapture();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, cameraReady, capturing]);

    // Import depuis un fichier
    const handleFileImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCapturing(true);
        try {
            const localPreviewUrl = URL.createObjectURL(file);
            const tempId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const tempItem = { id: tempId, url: localPreviewUrl, uploading: true };
            setSessionCaptures((prev) => [tempItem, ...prev]);

            const formData = new FormData();
            formData.append('file', file, file.name || `import_${Date.now()}.jpg`);
            formData.append('sessionId', sessionIdRef.current);
            formData.append('pageIndex', String(nextPageIndexRef.current++));
            if (student?._id) {
                formData.append('studentId', student._id);
                formData.append('studentName', `${student.firstName || ''} ${student.lastName || ''}`.trim());
            }
            if (classId) formData.append('classId', classId);
            if (className) formData.append('className', className);
            if (teacherId) formData.append('teacherId', teacherId);

            const res = await fetch('/api/scans/upload-classroom', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok && data.scan) {
                setSessionCaptures((prev) => prev.map((item) => (item.id === tempId ? { ...item, uploading: false, serverScan: data.scan } : item)));
                if (onScanUploaded) onScanUploaded(data.scan);
            }
        } catch (err) {
            console.error("Erreur import image:", err);
        } finally {
            setCapturing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="conda-scan-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="conda-scan-capture-card">
                {/* Bouton fermeture permanent et proéminent (toujours visible sur mobile) */}
                <button
                    className="conda-scan-sticky-close-btn"
                    onClick={onClose}
                    title="Fermer la fenêtre (Échap)"
                    aria-label="Fermer"
                >
                    ✕
                </button>

                {/* Entête */}
                <div className="conda-scan-modal-header">
                    <div className="conda-scan-title-group">
                        <span className="conda-scan-header-icon">📷</span>
                        <div>
                            <h3 className="conda-scan-modal-title">
                                {student ? `Scanner : ${student.firstName} ${student.lastName}` : `Scanner : Classe ${className || ''}`}
                            </h3>
                            <span className="conda-scan-modal-subtitle">
                                Cadrez le cahier ou la feuille et déclenchez la capture
                            </span>
                        </div>
                    </div>
                    <div className="conda-scan-header-actions">
                        {availableDevices.length > 1 && (
                            <button
                                className="conda-scan-tool-btn"
                                onClick={toggleFacingMode}
                                title="Changer de caméra (avant / arrière)"
                            >
                                🔄 Caméra
                            </button>
                        )}
                        {onOpenGallery && (
                            <button
                                className="conda-scan-tool-btn highlight"
                                onClick={() => { onClose(); onOpenGallery(); }}
                                title="Voir les images déjà prises"
                            >
                                🖼️ Galerie {sessionCaptures.length > 0 ? `(${sessionCaptures.length})` : ''}
                            </button>
                        )}
                    </div>
                </div>

                {/* Viseur Caméra */}
                <div className="conda-scan-viewfinder-container">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`conda-scan-video ${cameraReady ? 'ready' : ''}`}
                        onLoadedMetadata={() => setCameraReady(true)}
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {/* Effet flash déclencheur */}
                    {flashActive && <div className="conda-scan-flash-overlay" />}

                    {/* Cadre de cadrage document */}
                    {cameraReady && (
                        <div className="conda-scan-frame-guide">
                            <div className="guide-corner top-left" />
                            <div className="guide-corner top-right" />
                            <div className="guide-corner bottom-left" />
                            <div className="guide-corner bottom-right" />
                            <span className="guide-hint">📄 Alignez la copie ici</span>
                        </div>
                    )}

                    {/* Erreur caméra */}
                    {cameraError && (
                        <div className="conda-scan-error-overlay">
                            <div className="conda-scan-error-box">
                                <span className="error-icon">⚠️</span>
                                <p className="error-msg">{cameraError}</p>
                                <div className="error-actions">
                                    <button
                                        className="conda-scan-action-btn secondary"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        📁 Importer une photo depuis l'appareil
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chargement initial */}
                    {!cameraReady && !cameraError && (
                        <div className="conda-scan-loading-overlay">
                            <div className="conda-scan-spinner" />
                            <span>Initialisation de la caméra vidéo...</span>
                        </div>
                    )}
                </div>

                {/* Barre de contrôle inférieure */}
                <div className="conda-scan-bottom-bar">
                    {/* Galerie miniature des captures de la session */}
                    <div className="conda-scan-recent-strip">
                        {sessionCaptures.length === 0 ? (
                            <span className="conda-scan-no-recent">Aucune capture dans cette session</span>
                        ) : (
                            sessionCaptures.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className={`conda-scan-thumb-item ${item.uploading ? 'uploading' : item.error ? 'failed' : 'uploaded'}`}
                                    title={item.uploading ? 'Envoi en cours' : item.error ? 'Échec de l’envoi' : 'Photo envoyée'}
                                >
                                    <img src={item.url} alt={`Capture ${idx + 1}`} />
                                    {item.uploading && <div className="thumb-uploading-badge">⏳</div>}
                                    {item.error && <div className="thumb-error-badge">⚠️</div>}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Bouton central de capture */}
                    <div className="conda-scan-shutter-zone">
                        <button
                            className={`conda-scan-shutter-btn ${capturing ? 'capturing' : ''}`}
                            onClick={handleCapture}
                            disabled={!cameraReady || capturing}
                            title="Prendre la photo (ou appuyez sur Espace)"
                        >
                            <div className="shutter-inner">
                                <span className="shutter-icon">📷</span>
                            </div>
                        </button>
                        <span className="shutter-tip">Espace ou Clic pour capturer</span>
                    </div>

                    {/* Actions d'appoint */}
                    <div className="conda-scan-extra-actions">
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileImport}
                        />
                        <button
                            className="conda-scan-import-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Importer un fichier image"
                        >
                            📁 Fichier
                        </button>
                        {sessionCaptures.length > 0 && onOpenGallery && (
                            <button
                                className="conda-scan-finish-btn"
                                onClick={() => { onClose(); onOpenGallery(); }}
                            >
                                ✅ Voir ({sessionCaptures.length})
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
