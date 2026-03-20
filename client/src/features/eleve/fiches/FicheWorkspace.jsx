import React, { useEffect, useMemo, useRef, useState } from 'react';
import './FicheWorkspace.css';

const FONT_OPTIONS = [
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Trebuchet MS', label: 'Trebuchet' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Courier New', label: 'Courier' },
    { value: 'Times New Roman', label: 'Times' }
];

const COLOR_OPTIONS = ['#1f2937', '#0f766e', '#1d4ed8', '#7c3aed', '#be123c', '#c2410c', '#15803d', '#ca8a04'];

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
    const initialHtml = String(fiche?.studentSubmission?.contentHtml || '<h1>Ma fiche</h1><p></p>');
    const [contentHtml, setContentHtml] = useState(initialHtml);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [slides, setSlides] = useState([]);
    const [slidesLoading, setSlidesLoading] = useState(false);
    const [slidesError, setSlidesError] = useState('');
    const [activeSlideIdx, setActiveSlideIdx] = useState(0);
    const [fontFamily, setFontFamily] = useState('Georgia');

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

    const exec = (command, value = null) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        syncHtmlFromEditor();
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

    const insertImageFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const src = String(reader.result || '');
            if (!src) return;
            exec('insertImage', src);
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

            <div className="fiche-shell">
                <aside className="fiche-source-panel">
                    <div className="fiche-panel-head">
                        <div>
                            <div className="fiche-kicker">Source</div>
                            <div className="fiche-panel-title">Slides à résumer</div>
                        </div>
                        {fiche?.presentationUrl && (
                            <a href={fiche.presentationUrl} target="_blank" rel="noreferrer" className="fiche-open-link">
                                Ouvrir
                            </a>
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
                        <select value={fontFamily} onChange={(e) => { setFontFamily(e.target.value); exec('fontName', e.target.value); }}>
                            {FONT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <button type="button" className="fiche-tool" onClick={() => exec('bold')}>Gras</button>
                        <button type="button" className="fiche-tool" onClick={() => exec('italic')}>Italique</button>
                        <button type="button" className="fiche-tool" onClick={() => exec('underline')}>Souligné</button>
                        <button type="button" className="fiche-tool" onClick={() => exec('insertUnorderedList')}>Liste</button>
                        <button type="button" className="fiche-tool" onClick={() => exec('formatBlock', '<h1>')}>Titre</button>
                        <button type="button" className="fiche-tool" onClick={() => exec('formatBlock', '<h2>')}>Sous-titre</button>
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
                    <div className="fiche-color-row">
                        {COLOR_OPTIONS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className="fiche-color-dot"
                                style={{ background: color }}
                                onClick={() => exec('foreColor', color)}
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
                    <div
                        ref={editorRef}
                        className="fiche-editor"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={syncHtmlFromEditor}
                        onPaste={onPasteEditor}
                    />
                </section>
            </div>
        </div>
    );
}
