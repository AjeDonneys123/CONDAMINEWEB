import React, { useEffect, useMemo, useRef, useState } from 'react';
import './FicheWorkspace.css';

const FONT_OPTIONS = [
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Trebuchet MS', label: 'Trebuchet' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Courier New', label: 'Courier' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Palatino Linotype', label: 'Palatino' },
    { value: 'Garamond', label: 'Garamond' },
    { value: 'Arial Black', label: 'Arial Black' }
];

const COLOR_OPTIONS = ['#1f2937', '#0f766e', '#1d4ed8', '#7c3aed', '#be123c', '#c2410c', '#15803d', '#ca8a04', '#0f172a', '#0891b2', '#db2777', '#65a30d'];

const extractGoogleSlidesId = (raw = '') => {
    const txt = String(raw || '').trim();
    const match = txt.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
};

const buildSlidesThumbnailProxyUrl = (presentationId = '', objectId = '', slideNumber = '') => {
    const params = new URLSearchParams({ presentationId: String(presentationId || '').trim(), pageObjectId: String(objectId || '').trim() });
    if (String(slideNumber || '').trim()) params.set('slideNumber', String(slideNumber).trim());
    return `/api/learning/slides/thumbnail?${params.toString()}`;
};

const stripHtml = (html = '') =>
    String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export default function FicheWorkspace({ fiche, user, onQuit }) {
    const editorRef = useRef(null);
    const imageInputRef = useRef(null);
    const interactionRef = useRef(null);
    const slideWindowInteractionRef = useRef(null);
    const initialHtml = String(fiche?.studentSubmission?.contentHtml || '<h1>Ma fiche</h1><p></p>');
    const [contentHtml, setContentHtml] = useState(initialHtml);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [slides, setSlides] = useState([]);
    const [slidesLoading, setSlidesLoading] = useState(false);
    const [slidesError, setSlidesError] = useState('');
    const [activeSlideIdx, setActiveSlideIdx] = useState(0);
    const [fontFamily, setFontFamily] = useState('Georgia');
    const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
    const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, list: false });
    const [activeTool, setActiveTool] = useState('');
    const [slideWindowOpen, setSlideWindowOpen] = useState(false);
    const [slideWindowRect, setSlideWindowRect] = useState({ x: 140, y: 90, width: 640, height: 420 });

    const presentationId = useMemo(() => extractGoogleSlidesId(fiche?.presentationUrl || ''), [fiche?.presentationUrl]);
    const selectedSlides = useMemo(
        () => [...new Set((fiche?.selectedSlides || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))].sort((a, b) => a - b),
        [fiche?.selectedSlides]
    );

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== contentHtml) {
            editorRef.current.innerHTML = contentHtml;
        }
    }, [contentHtml]);

    useEffect(() => {
        const presentationUrl = String(fiche?.presentationUrl || '').trim();
        if (!presentationUrl) return;
        const ctrl = new AbortController();
        (async () => {
            setSlidesLoading(true);
            setSlidesError('');
            try {
                const res = await fetch('/api/learning/slides/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        presentationUrl,
                        slideSelection: selectedSlides.join(','),
                        filterCondition: '',
                        includeThumbnails: false
                    }),
                    signal: ctrl.signal
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(String(data?.error || 'Slides indisponibles'));
                setSlides(Array.isArray(data?.slides) ? data.slides : []);
            } catch (e) {
                if (ctrl.signal.aborted) return;
                setSlides([]);
                setSlidesError(String(e?.message || 'Slides indisponibles'));
            } finally {
                if (!ctrl.signal.aborted) setSlidesLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [fiche?.presentationUrl, selectedSlides.join(',')]);

    const activeSlide = slides[activeSlideIdx] || null;
    const plainTextLength = stripHtml(contentHtml).length;
    const imageCount = (contentHtml.match(/<img\b/gi) || []).length;

    const syncHtmlFromEditor = () => {
        const next = String(editorRef.current?.innerHTML || '').trim();
        setContentHtml(next);
        return next;
    };

    const refreshFormattingState = () => {
        if (!editorRef.current) return;
        setActiveFormats({
            bold: Boolean(document.queryCommandState('bold')),
            italic: Boolean(document.queryCommandState('italic')),
            underline: Boolean(document.queryCommandState('underline')),
            list: Boolean(document.queryCommandState('insertUnorderedList'))
        });
    };

    const exec = (command, value = null) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        syncHtmlFromEditor();
        refreshFormattingState();
    };

    const execBulletList = () => {
        editorRef.current?.focus();
        document.execCommand('insertUnorderedList', false, null);
        document.execCommand('indent', false, null);
        syncHtmlFromEditor();
        refreshFormattingState();
    };

    const saveNow = async (manual = false) => {
        try {
            setSaving(true);
            const html = syncHtmlFromEditor();
            const res = await fetch('/api/eleve/fiches/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ficheId: String(fiche?._id || ''),
                    studentId: String(user?._id || user?.id || ''),
                    contentHtml: html
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(String(data?.error || 'Erreur sauvegarde'));
            setSaveMessage(manual ? 'Fiche enregistrée.' : 'Sauvegarde auto.');
        } catch (e) {
            setSaveMessage(String(e?.message || 'Erreur sauvegarde'));
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMessage(''), 2200);
        }
    };

    useEffect(() => {
        const t = setTimeout(() => {
            if (stripHtml(contentHtml)) saveNow(false);
        }, 1200);
        return () => clearTimeout(t);
    }, [contentHtml]);

    useEffect(() => {
        const onSelectionChange = () => {
            const editor = editorRef.current;
            const selection = window.getSelection();
            if (!editor || !selection?.anchorNode) return;
            if (editor.contains(selection.anchorNode)) {
                refreshFormattingState();
            }
        };
        document.addEventListener('selectionchange', onSelectionChange);
        return () => document.removeEventListener('selectionchange', onSelectionChange);
    }, []);

    useEffect(() => {
        const onMouseMove = (event) => {
            const state = slideWindowInteractionRef.current;
            if (!state) return;
            if (state.mode === 'move') {
                setSlideWindowRect((prev) => ({
                    ...prev,
                    x: Math.max(16, event.clientX - state.offsetX),
                    y: Math.max(16, event.clientY - state.offsetY)
                }));
                return;
            }
            if (state.mode === 'resize') {
                setSlideWindowRect((prev) => ({
                    ...prev,
                    width: Math.max(320, state.startWidth + (event.clientX - state.startX)),
                    height: Math.max(220, state.startHeight + (event.clientY - state.startY))
                }));
            }
        };
        const onMouseUp = () => {
            slideWindowInteractionRef.current = null;
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const getPoint = (event) => {
            const rect = editor.getBoundingClientRect();
            return {
                x: event.clientX - rect.left + editor.scrollLeft,
                y: event.clientY - rect.top + editor.scrollTop
            };
        };

        const onMouseDown = (event) => {
            const target = event.target.closest('.fiche-floating-media, .fiche-shape');
            if (target) {
                if (activeTool === 'erase') {
                    event.preventDefault();
                    const confirmed = window.confirm("Supprimer cet élément ?");
                    if (confirmed) {
                        target.remove();
                        syncHtmlFromEditor();
                    }
                    return;
                }
                event.preventDefault();
                const rect = target.getBoundingClientRect();
                interactionRef.current = {
                    type: 'drag',
                    target,
                    offsetX: event.clientX - rect.left,
                    offsetY: event.clientY - rect.top
                };
                return;
            }

            if (!activeTool) return;

            const point = getPoint(event);
            if (activeTool === 'line') {
                event.preventDefault();
                const node = document.createElement('div');
                node.className = 'fiche-shape fiche-line-shape';
                node.setAttribute('contenteditable', 'false');
                node.style.left = `${point.x}px`;
                node.style.top = `${point.y}px`;
                node.innerHTML = `
                    <svg viewBox="0 0 10 10" preserveAspectRatio="none">
                        <line x1="0" y1="0" x2="10" y2="10" stroke="${selectedColor}" stroke-width="2.4" stroke-linecap="round"></line>
                    </svg>
                `;
                editor.appendChild(node);
                interactionRef.current = {
                    type: 'line',
                    target: node,
                    startX: point.x,
                    startY: point.y
                };
                return;
            }

            if (activeTool === 'draw') {
                event.preventDefault();
                const node = document.createElement('div');
                node.className = 'fiche-shape fiche-drawing-shape';
                node.setAttribute('contenteditable', 'false');
                node.style.left = `${point.x}px`;
                node.style.top = `${point.y}px`;
                node.style.width = '2px';
                node.style.height = '2px';
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 2 2');
                svg.setAttribute('preserveAspectRatio', 'none');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'M 1 1');
                path.setAttribute('stroke', selectedColor);
                path.setAttribute('stroke-width', '2.2');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(path);
                node.appendChild(svg);
                editor.appendChild(node);
                interactionRef.current = {
                    type: 'draw',
                    target: node,
                    path,
                    points: [{ x: 1, y: 1 }],
                    minX: point.x,
                    minY: point.y,
                    maxX: point.x,
                    maxY: point.y
                };
            }
        };

        const onMouseMove = (event) => {
            const interaction = interactionRef.current;
            if (!interaction) return;
            const point = getPoint(event);
            if (interaction.type === 'drag') {
                event.preventDefault();
                interaction.target.style.left = `${Math.max(0, point.x - interaction.offsetX)}px`;
                interaction.target.style.top = `${Math.max(0, point.y - interaction.offsetY)}px`;
                return;
            }
            if (interaction.type === 'line') {
                event.preventDefault();
                const left = Math.min(interaction.startX, point.x);
                const top = Math.min(interaction.startY, point.y);
                const width = Math.max(8, Math.abs(point.x - interaction.startX));
                const height = Math.max(8, Math.abs(point.y - interaction.startY));
                const x1 = point.x >= interaction.startX ? 0 : 10;
                const y1 = point.y >= interaction.startY ? 0 : 10;
                const x2 = point.x >= interaction.startX ? 10 : 0;
                const y2 = point.y >= interaction.startY ? 10 : 0;
                interaction.target.style.left = `${left}px`;
                interaction.target.style.top = `${top}px`;
                interaction.target.style.width = `${width}px`;
                interaction.target.style.height = `${height}px`;
                interaction.target.querySelector('line')?.setAttribute('x1', String(x1));
                interaction.target.querySelector('line')?.setAttribute('y1', String(y1));
                interaction.target.querySelector('line')?.setAttribute('x2', String(x2));
                interaction.target.querySelector('line')?.setAttribute('y2', String(y2));
                return;
            }
            if (interaction.type === 'draw') {
                event.preventDefault();
                interaction.minX = Math.min(interaction.minX, point.x);
                interaction.minY = Math.min(interaction.minY, point.y);
                interaction.maxX = Math.max(interaction.maxX, point.x);
                interaction.maxY = Math.max(interaction.maxY, point.y);
                const localX = point.x - interaction.minX + 1;
                const localY = point.y - interaction.minY + 1;
                interaction.points.push({ x: localX, y: localY });
                interaction.target.style.left = `${interaction.minX}px`;
                interaction.target.style.top = `${interaction.minY}px`;
                interaction.target.style.width = `${Math.max(2, interaction.maxX - interaction.minX + 2)}px`;
                interaction.target.style.height = `${Math.max(2, interaction.maxY - interaction.minY + 2)}px`;
                const svg = interaction.target.querySelector('svg');
                svg?.setAttribute('viewBox', `0 0 ${Math.max(2, interaction.maxX - interaction.minX + 2)} ${Math.max(2, interaction.maxY - interaction.minY + 2)}`);
                interaction.path.setAttribute('d', `M ${interaction.points.map((p) => `${p.x} ${p.y}`).join(' L ')}`);
            }
        };

        const finishInteraction = (event) => {
            const interaction = interactionRef.current;
            if (!interaction) return;
            interactionRef.current = null;
            if (event?.target?.closest('.fiche-floating-media')) {
                setTimeout(() => syncHtmlFromEditor(), 0);
            } else {
                syncHtmlFromEditor();
            }
        };

        editor.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', finishInteraction);
        return () => {
            editor.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', finishInteraction);
        };
    }, [activeTool, selectedColor]);

    const insertImageFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const src = String(reader.result || '');
            if (!src) return;
            editorRef.current?.focus();
            document.execCommand(
                'insertHTML',
                false,
                `<div class="fiche-floating-media" contenteditable="false" style="left:48px;top:96px;width:220px;height:auto;">
                    <img src="${src}" alt="Illustration" draggable="false" />
                </div><p></p>`
            );
            syncHtmlFromEditor();
        };
        reader.readAsDataURL(file);
    };

    const onPasteEditor = (e) => {
        const items = Array.from(e.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type && item.type.startsWith('image/'));
        if (!imageItem) return;
        e.preventDefault();
        const file = imageItem.getAsFile();
        insertImageFile(file);
    };

    const openImageFinder = () => {
        window.open(
            'https://www.google.com/search?tbm=isch&q=',
            'fiche-image-finder',
            'popup=yes,width=440,height=520,resizable=yes,scrollbars=yes'
        );
    };

    return (
        <div className="fiche-workspace">
            <div className="fiche-topbar">
                <button className="fiche-btn fiche-btn-ghost" onClick={onQuit}>✕ Quitter</button>
                <div className="fiche-title-wrap">
                    <div className="fiche-title">{fiche?.title || 'Fiche'}</div>
                    <div className="fiche-subtitle">{fiche?.teacherInstructions || 'Crée une fiche claire et agréable à relire.'}</div>
                </div>
                <button className="fiche-btn" onClick={() => saveNow(true)} disabled={saving}>{saving ? 'Sauvegarde...' : 'Enregistrer'}</button>
            </div>

            <div className={`fiche-shell ${slideWindowOpen ? 'slide-expanded' : ''}`}>
                <aside className="fiche-source-panel">
                    <div className="fiche-panel-head">
                        <div>
                            <div className="fiche-kicker">Source</div>
                            <div className="fiche-panel-title">Slides à résumer</div>
                        </div>
                        {activeSlide && (
                            <button type="button" className="fiche-open-link" onClick={() => setSlideWindowOpen(true)}>
                                Agrandir
                            </button>
                        )}
                    </div>

                    {slidesLoading && <div className="fiche-empty">Chargement des slides...</div>}
                    {!slidesLoading && slidesError && <div className="fiche-error">{slidesError}</div>}
                    {!slidesLoading && !slidesError && activeSlide && (
                        <div className="fiche-slide-stage">
                            <div className="fiche-slide-preview">
                                <img
                                    src={buildSlidesThumbnailProxyUrl(presentationId, activeSlide?.objectId, activeSlide?.slideNumber)}
                                    alt={`Slide ${activeSlide?.slideNumber || ''}`}
                                />
                            </div>
                            <div className="fiche-slide-meta">Slide {activeSlide?.slideNumber || ''}</div>
                        </div>
                    )}
                    {!slidesLoading && !slidesError && slides.length === 0 && <div className="fiche-empty">Aucune slide configurée.</div>}

                    <div className="fiche-slide-rail">
                        {slides.map((slide, idx) => (
                            <button
                                key={String(slide?.objectId || idx)}
                                type="button"
                                onClick={() => setActiveSlideIdx(idx)}
                                className={`fiche-slide-chip ${idx === activeSlideIdx ? 'active' : ''}`}
                            >
                                <img
                                    src={buildSlidesThumbnailProxyUrl(presentationId, slide?.objectId, slide?.slideNumber)}
                                    alt={`Slide ${slide?.slideNumber || ''}`}
                                />
                                <span>Slide {slide?.slideNumber || idx + 1}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="fiche-editor-panel">
                    <div className="fiche-toolbar">
                        <select
                            value={fontFamily}
                            className="fiche-font-select"
                            style={{ fontFamily }}
                            onChange={(e) => { setFontFamily(e.target.value); exec('fontName', e.target.value); }}
                        >
                            {FONT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value} style={{ fontFamily: option.value }}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <button type="button" className={`fiche-tool ${activeFormats.bold ? 'active' : ''}`} onClick={() => exec('bold')}>Gras</button>
                        <button type="button" className={`fiche-tool ${activeFormats.italic ? 'active' : ''}`} onClick={() => exec('italic')}>Italique</button>
                        <button type="button" className={`fiche-tool ${activeFormats.underline ? 'active' : ''}`} onClick={() => exec('underline')}>Souligné</button>
                        <button type="button" className="fiche-tool fiche-tool-list" onClick={execBulletList} title="Créer une puce">
                            <span className="fiche-tool-list-dot">•</span>
                            <span>Liste</span>
                        </button>
                        <button type="button" className={`fiche-tool ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => setActiveTool((prev) => prev === 'draw' ? '' : 'draw')}>Dessiner</button>
                        <button type="button" className={`fiche-tool ${activeTool === 'line' ? 'active' : ''}`} onClick={() => setActiveTool((prev) => prev === 'line' ? '' : 'line')}>Trait</button>
                        <button type="button" className={`fiche-tool ${activeTool === 'erase' ? 'active' : ''}`} onClick={() => setActiveTool((prev) => prev === 'erase' ? '' : 'erase')}>Gomme</button>
                        <button type="button" className="fiche-tool" onClick={() => imageInputRef.current?.click()}>Image</button>
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                insertImageFile(e.target.files?.[0] || null);
                                e.target.value = '';
                            }}
                        />
                    </div>
                    <div className="fiche-image-help">
                        Tu peux aussi copier une image d’internet et la coller dans ta fiche :
                        <button type="button" className="fiche-inline-link" onClick={openImageFinder}>
                            lien
                        </button>
                    </div>
                    <div className="fiche-color-row">
                        {COLOR_OPTIONS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={`fiche-color-dot ${selectedColor === color ? 'active' : ''}`}
                                style={{ background: color }}
                                onClick={() => {
                                    setSelectedColor(color);
                                    exec('foreColor', color);
                                }}
                                title={color}
                            />
                        ))}
                    </div>
                    <div className="fiche-editor-meta">
                        <span>{plainTextLength} caractères</span>
                        <span>{imageCount} image(s)</span>
                        {saveMessage && <span>{saveMessage}</span>}
                        {fiche?.studentSubmission?.teacherValidated === true && <span>✅ Devoir validé</span>}
                    </div>
                    <div className={`fiche-editor-stage ${activeTool ? `tool-${activeTool}` : ''}`}>
                        <div
                            ref={editorRef}
                            className="fiche-editor"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={syncHtmlFromEditor}
                            onPaste={onPasteEditor}
                            onMouseUp={() => refreshFormattingState()}
                        />
                    </div>
                </section>
            </div>
            {slideWindowOpen && activeSlide && (
                <div
                    className="fiche-slide-window"
                    style={{
                        left: slideWindowRect.x,
                        top: slideWindowRect.y,
                        width: slideWindowRect.width,
                        height: slideWindowRect.height
                    }}
                >
                    <div
                        className="fiche-slide-window-head"
                        onMouseDown={(event) => {
                            const rect = event.currentTarget.parentElement.getBoundingClientRect();
                            slideWindowInteractionRef.current = {
                                mode: 'move',
                                offsetX: event.clientX - rect.left,
                                offsetY: event.clientY - rect.top
                            };
                        }}
                    >
                        <div className="fiche-slide-window-title">Slide {activeSlide?.slideNumber || ''}</div>
                        <button type="button" className="fiche-slide-window-close" onClick={() => setSlideWindowOpen(false)}>✕</button>
                    </div>
                    <div className="fiche-slide-window-body">
                        <img
                            src={buildSlidesThumbnailProxyUrl(presentationId, activeSlide?.objectId, activeSlide?.slideNumber)}
                            alt={`Slide ${activeSlide?.slideNumber || ''}`}
                            draggable="false"
                        />
                    </div>
                    <div
                        className="fiche-slide-window-resize"
                        onMouseDown={(event) => {
                            event.preventDefault();
                            slideWindowInteractionRef.current = {
                                mode: 'resize',
                                startX: event.clientX,
                                startY: event.clientY,
                                startWidth: slideWindowRect.width,
                                startHeight: slideWindowRect.height
                            };
                        }}
                    />
                </div>
            )}
        </div>
    );
}
