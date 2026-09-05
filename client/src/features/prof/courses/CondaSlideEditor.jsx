import React, { useState, useRef, useEffect, useCallback } from 'react';
import CondaSlideCanvas from './CondaSlideCanvas';
import './CondaSlideViewer.css';

const FONTS = [
    'Roboto', 'Inter', 'Montserrat', 'Playfair Display',
    'Oswald', 'Merriweather', 'Lora', 'Open Sans', 'Lato'
];

const QUICK_COLORS = ['#1e293b', '#ffffff', '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed'];

const toHexColor = (col) => {
    if (!col) return '#1e293b';
    if (typeof col === 'string' && col.startsWith('#') && (col.length === 7 || col.length === 4)) {
        if (col.length === 4) return `#${col[1]}${col[1]}${col[2]}${col[2]}${col[3]}${col[3]}`;
        return col;
    }
    const match = String(col).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
        const r = Number(match[1]).toString(16).padStart(2, '0');
        const g = Number(match[2]).toString(16).padStart(2, '0');
        const b = Number(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
    return '#1e293b';
};

export default function CondaSlideEditor({
    courseId,
    slides = [],
    activeSlideIndex = 0,
    onSlidesChange,
    onSaveStatusChange
}) {
    const [currentSlides, setCurrentSlides] = useState(slides);
    const [selectedId, setSelectedId] = useState(null);
    const [editingTextId, setEditingTextId] = useState(null);
    const [syncState, setSyncState] = useState('synced'); // 'synced' | 'saving' | 'error'
    const pendingChangesRef = useRef([]);
    const saveTimerRef = useRef(null);

    // Keep internal state aligned if outer slides change initially
    useEffect(() => {
        if (slides && slides.length > 0 && (!currentSlides || currentSlides.length === 0 || pendingChangesRef.current.length === 0)) {
            setCurrentSlides(slides);
        }
    }, [slides]);

    const activeSlide = currentSlides[activeSlideIndex] || currentSlides[0] || { elements: [] };
    const selectedElement = activeSlide?.elements?.find((el) => el.id === selectedId);

    // Trigger debounced save to CondaWeb & Google Slides
    const queueSave = useCallback((updatedSlides, newChange) => {
        setCurrentSlides(updatedSlides);
        onSlidesChange?.(updatedSlides);
        if (newChange) {
            pendingChangesRef.current.push(newChange);
        }
        setSyncState('saving');
        onSaveStatusChange?.('saving');

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            const changesToSync = [...pendingChangesRef.current];
            pendingChangesRef.current = [];
            try {
                const response = await fetch(`/api/courses/${courseId}/slides/save-native`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nativeSlides: updatedSlides,
                        changes: changesToSync
                    })
                });
                const data = await response.json();
                if (data.ok) {
                    setSyncState('synced');
                    onSaveStatusChange?.('synced');
                } else {
                    setSyncState('error');
                    onSaveStatusChange?.('error');
                }
            } catch (err) {
                console.error("Save error:", err);
                setSyncState('error');
                onSaveStatusChange?.('error');
            }
        }, 800);
    }, [courseId, onSlidesChange, onSaveStatusChange]);

    // Update single element property
    const updateElement = useCallback((elementId, updater, changeAction = 'update_text') => {
        let updatedEl = null;
        const newSlides = currentSlides.map((slide, sIdx) => {
            if (sIdx !== activeSlideIndex) return slide;
            const newElements = (slide.elements || []).map((el) => {
                if (el.id !== elementId) return el;
                updatedEl = typeof updater === 'function' ? updater(el) : { ...el, ...updater };
                return updatedEl;
            });
            return { ...slide, elements: newElements };
        });

        if (updatedEl) {
            queueSave(newSlides, {
                action: changeAction,
                element: updatedEl,
                slideObjectId: activeSlide.objectId
            });
        }
    }, [currentSlides, activeSlideIndex, activeSlide.objectId, queueSave]);

    // Handle Drag to move or resize
    const handleStartDrag = useCallback((e, elementId, mode) => {
        const startX = e.clientX;
        const startY = e.clientY;
        const el = activeSlide.elements.find((item) => item.id === elementId);
        if (!el) return;

        const initialX = Number(el.x || 0);
        const initialY = Number(el.y || 0);
        const initialW = Number(el.width || 10);
        const initialH = Number(el.height || 10);

        const stageEl = document.querySelector('.conda-slide-stage');
        const stageRect = stageEl ? stageEl.getBoundingClientRect() : { width: 960, height: 540 };

        const onMouseMove = (moveEvent) => {
            const deltaXPct = ((moveEvent.clientX - startX) / stageRect.width) * 100;
            const deltaYPct = ((moveEvent.clientY - startY) / stageRect.height) * 100;

            let nextX = initialX;
            let nextY = initialY;
            let nextW = initialW;
            let nextH = initialH;

            if (mode === 'move') {
                nextX = Math.max(0, Math.min(100 - initialW, initialX + deltaXPct));
                nextY = Math.max(0, Math.min(100 - initialH, initialY + deltaYPct));
            } else if (mode === 'br') {
                nextW = Math.max(2, Math.min(100 - initialX, initialW + deltaXPct));
                nextH = Math.max(2, Math.min(100 - initialY, initialH + deltaYPct));
            } else if (mode === 'r') {
                nextW = Math.max(2, Math.min(100 - initialX, initialW + deltaXPct));
            } else if (mode === 'b') {
                nextH = Math.max(2, Math.min(100 - initialY, initialH + deltaYPct));
            } else if (mode === 'tl') {
                const maxXDelta = initialW - 2;
                const maxYDelta = initialH - 2;
                const clampX = Math.min(maxXDelta, Math.max(-initialX, deltaXPct));
                const clampY = Math.min(maxYDelta, Math.max(-initialY, deltaYPct));
                nextX = initialX + clampX;
                nextY = initialY + clampY;
                nextW = initialW - clampX;
                nextH = initialH - clampY;
            }

            updateElement(elementId, {
                x: Math.round(nextX * 100) / 100,
                y: Math.round(nextY * 100) / 100,
                width: Math.round(nextW * 100) / 100,
                height: Math.round(nextH * 100) / 100
            }, 'update_transform');
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [activeSlide.elements, updateElement]);

    // Insert new Text element
    const handleAddText = () => {
        const newEl = {
            id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'text',
            content: 'Nouveau titre ou texte',
            x: 20,
            y: 35,
            width: 60,
            height: 12,
            style: {
                fontFamily: 'Roboto',
                fontSize: 24,
                color: '#1e293b',
                bold: true,
                italic: false,
                underline: false,
                align: 'center',
                backgroundColor: 'transparent'
            },
            zIndex: (activeSlide.elements?.length || 0) + 1
        };

        const newSlides = currentSlides.map((slide, sIdx) => {
            if (sIdx !== activeSlideIndex) return slide;
            return { ...slide, elements: [...(slide.elements || []), newEl] };
        });

        setSelectedId(newEl.id);
        queueSave(newSlides, {
            action: 'create_text',
            element: newEl,
            slideObjectId: activeSlide.objectId
        });
    };

    // Insert new Image element
    const handleAddImage = () => {
        const url = window.prompt("Colle l'URL directe de l'image (ou lien Google Drive public) :");
        if (!url || !url.trim()) return;
        const newEl = {
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'image',
            src: url.trim(),
            x: 25,
            y: 25,
            width: 50,
            height: 45,
            zIndex: (activeSlide.elements?.length || 0) + 1
        };

        const newSlides = currentSlides.map((slide, sIdx) => {
            if (sIdx !== activeSlideIndex) return slide;
            return { ...slide, elements: [...(slide.elements || []), newEl] };
        });

        setSelectedId(newEl.id);
        queueSave(newSlides, {
            action: 'create_image',
            element: newEl,
            slideObjectId: activeSlide.objectId
        });
    };

    // Insert YouTube Video
    const handleAddYoutube = () => {
        const url = window.prompt("Lien de la vidéo YouTube :");
        if (!url || !url.trim()) return;
        let videoId = '';
        try {
            const u = new URL(url.trim());
            if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1);
            else videoId = u.searchParams.get('v') || '';
        } catch (_) { }

        const newEl = {
            id: `yt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'video_youtube',
            url: url.trim(),
            videoId,
            x: 20,
            y: 20,
            width: 60,
            height: 55,
            zIndex: (activeSlide.elements?.length || 0) + 1
        };

        const newSlides = currentSlides.map((slide, sIdx) => {
            if (sIdx !== activeSlideIndex) return slide;
            return { ...slide, elements: [...(slide.elements || []), newEl] };
        });

        setSelectedId(newEl.id);
        queueSave(newSlides, {
            action: 'create_video',
            element: newEl,
            slideObjectId: activeSlide.objectId
        });
    };

    // Delete selected element
    const handleDeleteElement = () => {
        if (!selectedId) return;
        const target = selectedElement;
        const newSlides = currentSlides.map((slide, sIdx) => {
            if (sIdx !== activeSlideIndex) return slide;
            return { ...slide, elements: (slide.elements || []).filter((el) => el.id !== selectedId) };
        });
        setSelectedId(null);
        if (target) {
            queueSave(newSlides, {
                action: 'delete',
                element: target,
                slideObjectId: activeSlide.objectId
            });
        }
    };

    // Force Google Slides sync
    const handleForceSync = async () => {
        setSyncState('saving');
        try {
            const res = await fetch(`/api/courses/${courseId}/slides/sync-to-google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changes: pendingChangesRef.current })
            });
            const data = await res.json();
            if (data.ok) setSyncState('synced');
            else setSyncState('error');
        } catch (_) {
            setSyncState('error');
        }
    };

    return (
        <div className="conda-slide-wrapper">
            {/* Barre d'outils supérieure */}
            <div className="conda-editor-top-bar">
                <div className="conda-editor-add-actions">
                    <button type="button" className="conda-add-btn" onClick={handleAddText}>
                        <span>📝</span> ＋ Texte
                    </button>
                    <button type="button" className="conda-add-btn" onClick={handleAddImage}>
                        <span>🖼️</span> ＋ Image
                    </button>
                    <button type="button" className="conda-add-btn" onClick={handleAddYoutube}>
                        <span>🎬</span> ＋ Vidéo YouTube
                    </button>
                </div>

                {selectedElement && selectedElement.type === 'text' ? (
                    <div className="conda-editor-text-tools" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <select
                            value={selectedElement.style?.fontFamily || 'Roboto'}
                            onChange={(e) => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, fontFamily: e.target.value } }))}
                            title="Police d'écriture"
                        >
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>

                        <button
                            type="button"
                            className="conda-toolbar-btn"
                            onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, fontSize: Math.max(8, (Number(el.style?.fontSize) || 18) - 2) } }))}
                            title="Diminuer la taille"
                        >
                            -
                        </button>
                        <input
                            type="number"
                            className="conda-toolbar-size-input"
                            value={selectedElement.style?.fontSize || 18}
                            onChange={(e) => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, fontSize: Number(e.target.value) || 18 } }))}
                            title="Taille de police (pt)"
                        />
                        <button
                            type="button"
                            className="conda-toolbar-btn"
                            onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, fontSize: (Number(el.style?.fontSize) || 18) + 2 } }))}
                            title="Augmenter la taille"
                        >
                            +
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <input
                                type="color"
                                className="conda-toolbar-color-picker"
                                value={toHexColor(selectedElement.style?.color)}
                                onChange={(e) => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, color: e.target.value } }))}
                                title="Palette de couleurs personnalisée"
                            />
                            {QUICK_COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, color: c } }))}
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: '50%',
                                        backgroundColor: c,
                                        border: toHexColor(selectedElement.style?.color).toLowerCase() === c.toLowerCase() ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.3)',
                                        cursor: 'pointer',
                                        padding: 0,
                                        flexShrink: 0
                                    }}
                                    title={`Couleur ${c}`}
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            className={`conda-toolbar-btn ${selectedElement.style?.bold ? 'active' : ''}`}
                            onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, bold: !el.style?.bold } }))}
                            title="Gras"
                        >
                            <b>B</b>
                        </button>

                        <button
                            type="button"
                            className={`conda-toolbar-btn ${selectedElement.style?.italic ? 'active' : ''}`}
                            onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, italic: !el.style?.italic } }))}
                            title="Italique"
                        >
                            <i>I</i>
                        </button>

                        <button
                            type="button"
                            className={`conda-toolbar-btn ${selectedElement.style?.underline ? 'active' : ''}`}
                            onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, underline: !el.style?.underline } }))}
                            title="Souligné"
                        >
                            <u>U</u>
                        </button>

                        <button
                            type="button"
                            className={`conda-toolbar-btn ${selectedElement.style?.align === 'left' ? 'active' : ''}`}
                            onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, align: 'left' } }))}
                            title="Aligner à gauche"
                        >
                            ⇤
                        </button>
                        <button
                            type="button"
                            className={`conda-toolbar-btn ${selectedElement.style?.align === 'center' ? 'active' : ''}`}
                            onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, align: 'center' } }))}
                            title="Centrer"
                        >
                            ⇥⇤
                        </button>
                        <button
                            type="button"
                            className={`conda-toolbar-btn ${selectedElement.style?.align === 'right' ? 'active' : ''}`}
                            onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, align: 'right' } }))}
                            title="Aligner à droite"
                        >
                            ⇥
                        </button>

                        <button
                            type="button"
                            className="conda-toolbar-btn danger"
                            onClick={handleDeleteElement}
                            title="Supprimer cet élément"
                        >
                            🗑️
                        </button>
                    </div>
                ) : (
                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                        💡 Cliquez sur un texte pour modifier sa police, sa taille et sa couleur
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`conda-sync-status-badge ${syncState}`}>
                        {syncState === 'synced' && '☁️ Synchronisé avec Google Slides (✓)'}
                        {syncState === 'saving' && '⏳ Enregistrement et sync...'}
                        {syncState === 'error' && '⚠️ Échec sync Google Slides'}
                    </span>
                    <button
                        type="button"
                        className="conda-editor-force-sync-btn"
                        onClick={handleForceSync}
                        title="Forcer la répercussion immédiate dans Google Slides"
                    >
                        🔄 Forcer Synchro
                    </button>
                </div>
            </div>

            {/* Canvas avec gestion de la sélection et des poignées */}
            <div className="conda-slide-viewport" style={{ position: 'relative' }}>
                <CondaSlideCanvas
                    slide={activeSlide}
                    isEditMode={true}
                    selectedElementId={selectedId}
                    onSelectElement={(id) => {
                        setSelectedId(id);
                        if (id !== selectedId) setEditingTextId(null);
                    }}
                    onStartDrag={handleStartDrag}
                    onTextChange={(id, newText) => updateElement(id, (el) => ({ ...el, content: newText }), 'update_text')}
                >
                    {/* Floating formatting toolbar above selected element */}
                    {selectedElement && selectedElement.type === 'text' && (
                        <div
                            className="conda-floating-toolbar"
                            style={{
                                left: `${selectedElement.x}%`,
                                top: `${selectedElement.y}%`
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <select
                                value={selectedElement.style?.fontFamily || 'Roboto'}
                                onChange={(e) => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, fontFamily: e.target.value } }))}
                            >
                                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>

                            <button
                                type="button"
                                className="conda-toolbar-btn"
                                onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, fontSize: Math.max(8, (Number(el.style?.fontSize) || 18) - 2) } }))}
                            >
                                -
                            </button>
                            <input
                                type="number"
                                className="conda-toolbar-size-input"
                                value={selectedElement.style?.fontSize || 18}
                                onChange={(e) => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, fontSize: Number(e.target.value) || 18 } }))}
                            />
                            <button
                                type="button"
                                className="conda-toolbar-btn"
                                onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, fontSize: (Number(el.style?.fontSize) || 18) + 2 } }))}
                            >
                                +
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <input
                                    type="color"
                                    className="conda-toolbar-color-picker"
                                    value={toHexColor(selectedElement.style?.color)}
                                    onChange={(e) => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, color: e.target.value } }))}
                                    title="Palette de couleurs personnalisée"
                                />
                                {QUICK_COLORS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, color: c } }))}
                                        style={{
                                            width: 16,
                                            height: 16,
                                            borderRadius: '50%',
                                            backgroundColor: c,
                                            border: toHexColor(selectedElement.style?.color).toLowerCase() === c.toLowerCase() ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.3)',
                                            cursor: 'pointer',
                                            padding: 0,
                                            flexShrink: 0
                                        }}
                                        title={`Couleur ${c}`}
                                    />
                                ))}
                            </div>

                            <button
                                type="button"
                                className={`conda-toolbar-btn ${selectedElement.style?.bold ? 'active' : ''}`}
                                onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, bold: !el.style?.bold } }))}
                                title="Gras"
                            >
                                <b>B</b>
                            </button>

                            <button
                                type="button"
                                className={`conda-toolbar-btn ${selectedElement.style?.italic ? 'active' : ''}`}
                                onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, italic: !el.style?.italic } }))}
                                title="Italique"
                            >
                                <i>I</i>
                            </button>

                            <button
                                type="button"
                                className={`conda-toolbar-btn ${selectedElement.style?.underline ? 'active' : ''}`}
                                onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, underline: !el.style?.underline } }))}
                                title="Souligné"
                            >
                                <u>U</u>
                            </button>

                            <button
                                type="button"
                                className={`conda-toolbar-btn ${selectedElement.style?.align === 'left' ? 'active' : ''}`}
                                onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, align: 'left' } }))}
                            >
                                ⇤
                            </button>
                            <button
                                type="button"
                                className={`conda-toolbar-btn ${selectedElement.style?.align === 'center' ? 'active' : ''}`}
                                onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, align: 'center' } }))}
                            >
                                ⇥⇤
                            </button>
                            <button
                                type="button"
                                className={`conda-toolbar-btn ${selectedElement.style?.align === 'right' ? 'active' : ''}`}
                                onClick={() => updateElement(selectedElement.id, (el) => ({ ...el, style: { ...el.style, align: 'right' } }))}
                            >
                                ⇥
                            </button>

                            <button
                                type="button"
                                className="conda-toolbar-btn danger"
                                onClick={handleDeleteElement}
                                title="Supprimer cet élément"
                            >
                                🗑️
                            </button>
                        </div>
                    )}
                </CondaSlideCanvas>
            </div>
        </div>
    );
}
