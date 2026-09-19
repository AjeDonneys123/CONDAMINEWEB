import React, { useState, useEffect, useRef } from 'react';

export default function ScanGalleryModal({
    isOpen,
    onClose,
    student = null,
    classId = '',
    className = '',
    onOpenCapture = null
}) {
    const [scans, setScans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterMode, setFilterMode] = useState(student ? 'student' : 'class'); // 'student' or 'class'
    const [selectedScanIds, setSelectedScanIds] = useState([]);
    const [fullscreenScan, setFullscreenScan] = useState(null); // Scan in lightbox
    const [copyingStatus, setCopyingStatus] = useState(''); // Toast status
    const [toastTimer, setToastTimer] = useState(null);

    const showToast = (message) => {
        setCopyingStatus(message);
        if (toastTimer) clearTimeout(toastTimer);
        const t = setTimeout(() => setCopyingStatus(''), 4000);
        setToastTimer(t);
    };

    // Chargement des scans
    const loadScans = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterMode === 'student' && student?._id) {
                params.append('studentId', student._id);
            } else if (classId) {
                params.append('classId', classId);
            }
            const res = await fetch(`/api/classroom/scans?${params.toString()}`);
            const data = await res.json();
            if (res.ok && Array.isArray(data.scans)) {
                setScans(data.scans);
            } else {
                setScans([]);
            }
        } catch (e) {
            console.error("Erreur chargement scans:", e);
            setScans([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setSelectedScanIds([]);
            setFullscreenScan(null);
            void loadScans();
        }
    }, [isOpen, filterMode, student?._id, classId]);

    // Basculer la sélection d'une image
    const toggleSelectScan = (scanId, e) => {
        if (e) e.stopPropagation();
        setSelectedScanIds((prev) =>
            prev.includes(scanId) ? prev.filter((id) => id !== scanId) : [...prev, scanId]
        );
    };

    const handleSelectAll = () => {
        if (selectedScanIds.length === scans.length) {
            setSelectedScanIds([]);
        } else {
            setSelectedScanIds(scans.map((s) => s._id));
        }
    };

    // Suppression d'un scan
    const handleDeleteScan = async (scanId, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm("Supprimer cette capture définitivement ?")) return;
        try {
            const res = await fetch(`/api/classroom/scans/${scanId}`, { method: 'DELETE' });
            if (res.ok) {
                setScans((prev) => prev.filter((s) => s._id !== scanId));
                setSelectedScanIds((prev) => prev.filter((id) => id !== scanId));
                if (fullscreenScan?._id === scanId) setFullscreenScan(null);
                showToast("🗑️ Scan supprimé");
            }
        } catch (_) {}
    };

    // Convertir une URL image en HTMLImageElement
    const loadImageElement = (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Impossible de charger l'image ${url}`));
            img.src = url;
        });
    };

    // COPIER DANS LE PRESSE-PAPIER POUR L'IA
    const handleCopyForAi = async (specificScan = null) => {
        const targetScans = specificScan
            ? [specificScan]
            : (selectedScanIds.length > 0
                ? scans.filter((s) => selectedScanIds.includes(s._id))
                : (scans.length > 0 ? [scans[0]] : []));

        if (targetScans.length === 0) {
            showToast("⚠️ Aucune image sélectionnée à copier.");
            return;
        }

        showToast("⏳ Préparation de l'image pour le presse-papier...");

        try {
            if (targetScans.length === 1) {
                // 1 seule image : conversion propre en PNG et copie
                const img = await loadImageElement(targetScans[0].imageUrl);
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                if (!blob) throw new Error("Échec conversion PNG");

                if (navigator.clipboard?.write && window.ClipboardItem) {
                    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
                    showToast("✅ Image copiée ! Collez (Ctrl+V / Cmd+V) dans ChatGPT, Claude ou Gemini.");
                } else {
                    showToast("⚠️ Navigateur restreint pour le presse-papier image.");
                }
            } else {
                // Plusieurs images sélectionnées : couture verticale haute résolution
                const loadedImages = await Promise.all(targetScans.map((s) => loadImageElement(s.imageUrl)));
                const maxWidth = Math.max(...loadedImages.map((img) => img.naturalWidth || img.width || 1200));
                
                // Calculer la hauteur totale avec marges et séparateurs
                const spacing = 40;
                const headerHeight = 60;
                let totalHeight = 0;
                const scaledHeights = loadedImages.map((img) => {
                    const w = img.naturalWidth || img.width || 1200;
                    const h = img.naturalHeight || img.height || 800;
                    const scale = maxWidth / w;
                    return Math.round(h * scale);
                });
                totalHeight = scaledHeights.reduce((acc, h) => acc + h + spacing + headerHeight, 0);

                const canvas = document.createElement('canvas');
                canvas.width = maxWidth;
                canvas.height = totalHeight;
                const ctx = canvas.getContext('2d');

                // Fond clair
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                let currentY = 0;
                loadedImages.forEach((img, idx) => {
                    const targetScan = targetScans[idx];
                    const h = scaledHeights[idx];

                    // Bandeau numéro de page
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(0, currentY, maxWidth, headerHeight);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
                    ctx.textBaseline = 'middle';
                    const label = `PAGE ${idx + 1} / ${loadedImages.length} — ${targetScan.studentName || student?.firstName || 'Copie'} (${new Date(targetScan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
                    ctx.fillText(label, 24, currentY + headerHeight / 2);

                    currentY += headerHeight;

                    // Dessin de l'image ajustée en largeur
                    ctx.drawImage(img, 0, currentY, maxWidth, h);
                    currentY += h + spacing;
                });

                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                if (!blob) throw new Error("Échec couture multi-images");

                if (navigator.clipboard?.write && window.ClipboardItem) {
                    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
                    showToast(`✅ ${targetScans.length} pages assemblées et copiées ! Collez (Ctrl+V) dans votre IA.`);
                } else {
                    showToast("⚠️ Presse-papier non supporté sur ce navigateur.");
                }
            }
        } catch (err) {
            console.error("Erreur copie presse-papier:", err);
            showToast("❌ Erreur lors de la copie dans le presse-papier.");
        }
    };

    // Navigation dans le plein écran
    const currentFullscreenIndex = fullscreenScan ? scans.findIndex((s) => s._id === fullscreenScan._id) : -1;
    const handleNextFullscreen = () => {
        if (currentFullscreenIndex >= 0 && currentFullscreenIndex < scans.length - 1) {
            setFullscreenScan(scans[currentFullscreenIndex + 1]);
        }
    };
    const handlePrevFullscreen = () => {
        if (currentFullscreenIndex > 0) {
            setFullscreenScan(scans[currentFullscreenIndex - 1]);
        }
    };

    // Gestion touches clavier en plein écran
    useEffect(() => {
        if (!fullscreenScan) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setFullscreenScan(null);
            else if (e.key === 'ArrowRight') handleNextFullscreen();
            else if (e.key === 'ArrowLeft') handlePrevFullscreen();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fullscreenScan, currentFullscreenIndex, scans]);

    if (!isOpen) return null;

    return (
        <div className="conda-scan-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="conda-scan-gallery-card">
                {/* Entête de la galerie */}
                <div className="conda-scan-modal-header">
                    <div className="conda-scan-title-group">
                        <span className="conda-scan-header-icon">🖼️</span>
                        <div>
                            <h3 className="conda-scan-modal-title">
                                {filterMode === 'student' && student
                                    ? `Images : ${student.firstName} ${student.lastName}`
                                    : `Images de la classe ${className || ''}`}
                            </h3>
                            <span className="conda-scan-modal-subtitle">
                                {scans.length} photo{scans.length > 1 ? 's' : ''} disponible{scans.length > 1 ? 's' : ''} • Cliquez pour agrandir en plein écran
                            </span>
                        </div>
                    </div>

                    <div className="conda-scan-header-actions">
                        {student && (
                            <div className="conda-scan-filter-pills">
                                <button
                                    className={`pill-btn ${filterMode === 'student' ? 'active' : ''}`}
                                    onClick={() => setFilterMode('student')}
                                >
                                    Élève
                                </button>
                                <button
                                    className={`pill-btn ${filterMode === 'class' ? 'active' : ''}`}
                                    onClick={() => setFilterMode('class')}
                                >
                                    Toute la classe
                                </button>
                            </div>
                        )}

                        {onOpenCapture && (
                            <button
                                className="conda-scan-tool-btn highlight"
                                onClick={() => { onClose(); onOpenCapture(); }}
                                title="Prendre une nouvelle photo vidéo"
                            >
                                📷 Scanner
                            </button>
                        )}

                        <button className="conda-scan-modal-close" onClick={onClose} title="Fermer">✕</button>
                    </div>
                </div>

                {/* Barre d'outils et bouton Copier pour IA */}
                <div className="conda-scan-gallery-toolbar">
                    <div className="toolbar-left">
                        {scans.length > 0 && (
                            <>
                                <button className="conda-scan-btn-small" onClick={handleSelectAll}>
                                    {selectedScanIds.length === scans.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                                </button>
                                {selectedScanIds.length > 0 && (
                                    <span className="selection-badge">
                                        {selectedScanIds.length} sélectionnée{selectedScanIds.length > 1 ? 's' : ''}
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                    <div className="toolbar-right">
                        <button
                            className="conda-scan-btn-copy-ai"
                            onClick={() => handleCopyForAi()}
                            disabled={scans.length === 0}
                            title="Copier les images sélectionnées (ou la première) dans le presse-papier pour coller dans une IA"
                        >
                            📋 COPIER POUR L'IA {selectedScanIds.length > 1 ? `(${selectedScanIds.length} PAGES)` : ''}
                        </button>
                    </div>
                </div>

                {/* Toast de confirmation de copie */}
                {copyingStatus && (
                    <div className="conda-scan-toast">
                        {copyingStatus}
                    </div>
                )}

                {/* Grille des images */}
                <div className="conda-scan-grid-wrapper custom-scrollbar">
                    {loading ? (
                        <div className="conda-scan-empty-state">
                            <div className="conda-scan-spinner" />
                            <p>Chargement des photos...</p>
                        </div>
                    ) : scans.length === 0 ? (
                        <div className="conda-scan-empty-state">
                            <span className="empty-icon">📷</span>
                            <h4>Aucune image pour le moment</h4>
                            <p>Utilisez le bouton <strong>Scanner</strong> pour prendre en photo le travail de cet élève.</p>
                            {onOpenCapture && (
                                <button
                                    className="conda-scan-action-btn primary"
                                    onClick={() => { onClose(); onOpenCapture(); }}
                                >
                                    Prendre une photo vidéo
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="conda-scan-cards-grid">
                            {scans.map((scan) => {
                                const isSelected = selectedScanIds.includes(scan._id);
                                const dateFormatted = new Date(scan.createdAt).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                                return (
                                    <div
                                        key={scan._id}
                                        className={`conda-scan-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => setFullscreenScan(scan)}
                                    >
                                        {/* Case à cocher de sélection */}
                                        <div
                                            className={`card-select-checkbox ${isSelected ? 'checked' : ''}`}
                                            onClick={(e) => toggleSelectScan(scan._id, e)}
                                            title="Sélectionner pour copier ou supprimer"
                                        >
                                            {isSelected ? '✓' : ''}
                                        </div>

                                        {/* Image */}
                                        <div className="card-image-wrap">
                                            <img src={scan.imageUrl} alt={scan.title || 'Scan'} loading="lazy" />
                                            <div className="card-zoom-hint">🔍 Plein écran</div>
                                        </div>

                                        {/* Pied de carte */}
                                        <div className="card-meta-bar">
                                            <div className="card-info">
                                                {scan.studentName && filterMode === 'class' && (
                                                    <span className="card-student-tag">{scan.studentName}</span>
                                                )}
                                                <span className="card-date-tag">{dateFormatted}</span>
                                            </div>
                                            <div className="card-quick-actions" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    className="card-quick-btn copy"
                                                    onClick={() => handleCopyForAi(scan)}
                                                    title="Copier cette image pour l'IA"
                                                >
                                                    📋
                                                </button>
                                                <button
                                                    className="card-quick-btn delete"
                                                    onClick={(e) => handleDeleteScan(scan._id, e)}
                                                    title="Supprimer"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================== */}
            {/* 🔎 MODAL PLEIN ÉCRAN (LIGHTBOX)                           */}
            {/* ========================================================== */}
            {fullscreenScan && (
                <div
                    className="conda-scan-fullscreen-overlay"
                    onClick={(e) => { if (e.target === e.currentTarget) setFullscreenScan(null); }}
                >
                    <div className="conda-scan-fullscreen-topbar">
                        <div className="fs-title-wrap">
                            <span className="fs-title">
                                {fullscreenScan.studentName || student?.firstName || 'Scan'} • {new Date(fullscreenScan.createdAt).toLocaleString('fr-FR')}
                            </span>
                            <span className="fs-index">
                                ({currentFullscreenIndex + 1} / {scans.length})
                            </span>
                        </div>

                        <div className="fs-actions">
                            <button
                                className="conda-scan-btn-copy-ai fs-copy-btn"
                                onClick={() => handleCopyForAi(fullscreenScan)}
                                title="Copier cette image dans le presse-papier"
                            >
                                📋 COPIER POUR L'IA
                            </button>
                            <a
                                href={fullscreenScan.imageUrl}
                                download={`scan_${Date.now()}.jpg`}
                                className="fs-icon-btn"
                                title="Télécharger l'image"
                            >
                                ⬇️
                            </a>
                            <button
                                className="fs-icon-btn delete"
                                onClick={(e) => handleDeleteScan(fullscreenScan._id, e)}
                                title="Supprimer ce scan"
                            >
                                🗑️
                            </button>
                            <button
                                className="fs-icon-btn close"
                                onClick={() => setFullscreenScan(null)}
                                title="Fermer le plein écran (Échap)"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Image plein écran */}
                    <div className="conda-scan-fullscreen-view">
                        {currentFullscreenIndex > 0 && (
                            <button className="fs-nav-btn prev" onClick={handlePrevFullscreen} title="Précédente (Flèche gauche)">
                                ‹
                            </button>
                        )}
                        <img
                            src={fullscreenScan.imageUrl}
                            alt="Plein écran"
                            className="conda-scan-fullscreen-img"
                        />
                        {currentFullscreenIndex < scans.length - 1 && (
                            <button className="fs-nav-btn next" onClick={handleNextFullscreen} title="Suivante (Flèche droite)">
                                ›
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
