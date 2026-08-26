import React, { useEffect, useMemo, useState } from 'react';
import './CoursesManager.css';

const EMPTY_FORM = {
    title: '',
    description: '',
    slidesUrl: '',
    isEnabled: true
};

const extractPresentationId = (value = '') => {
    const text = String(value || '').trim();
    const pathMatch = text.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/i);
    if (pathMatch?.[1]) return pathMatch[1];
    return text.match(/[?&]id=([a-zA-Z0-9_-]+)/i)?.[1] || '';
};

const getEmbedUrl = (value = '') => {
    const id = extractPresentationId(value);
    return id
        ? `https://docs.google.com/presentation/d/${encodeURIComponent(id)}/embed?start=false&loop=false&delayms=3000`
        : '';
};

const getEditUrl = (value = '') => {
    const id = extractPresentationId(value);
    return id
        ? `https://docs.google.com/presentation/d/${encodeURIComponent(id)}/edit`
        : '';
};

export default function CoursesManager({ globalClass, globalClassId = '', user = {} }) {
    const [courses, setCourses] = useState([]);
    const [courseSections, setCourseSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [playingCourse, setPlayingCourse] = useState(null);
    const [playerMode, setPlayerMode] = useState('presentation');
    const [liveClassroom, setLiveClassroom] = useState(null);
    const [progressSavingId, setProgressSavingId] = useState('');
    const [draggedCourseId, setDraggedCourseId] = useState('');
    const [openCourseSections, setOpenCourseSections] = useState({});

    const previewUrl = useMemo(() => getEmbedUrl(form.slidesUrl), [form.slidesUrl]);
    const editPreviewUrl = useMemo(() => getEditUrl(form.slidesUrl), [form.slidesUrl]);

    useEffect(() => {
        if (!playingCourse || !globalClassId) {
            setLiveClassroom(null);
            return undefined;
        }

        const fetchLiveStatus = async () => {
            try {
                const res = await fetch(`/api/classroom/${globalClassId}`);
                if (res.ok) {
                    const data = await res.json();
                    setLiveClassroom(data);
                }
            } catch (e) {
                console.error("Live polling error:", e);
            }
        };

        fetchLiveStatus(); // immediate call
        const interval = setInterval(fetchLiveStatus, 2000);
        return () => clearInterval(interval);
    }, [playingCourse, globalClassId]);

    const isHighlightActive = useMemo(() => {
        if (!liveClassroom?.activeStudentHighlight || !liveClassroom?.activeStudentHighlightTime) return false;
        const highlightTime = new Date(liveClassroom.activeStudentHighlightTime).getTime();
        return (Date.now() - highlightTime) < 6000;
    }, [liveClassroom]);

    const isBonusActive = useMemo(() => {
        if (!liveClassroom?.activeStudentBonusAlert || !liveClassroom?.activeStudentBonusAlertTime) return false;
        const bonusTime = new Date(liveClassroom.activeStudentBonusAlertTime).getTime();
        return (Date.now() - bonusTime) < 6000;
    }, [liveClassroom]);

    const activeHourWarnings = useMemo(() => {
        const now = Date.now();
        return Array.isArray(liveClassroom?.activeHourWarnings)
            ? liveClassroom.activeHourWarnings
                .filter((row) => Number(row?.expiresAt || 0) > now && String(row?.name || '').trim())
                .slice(0, 8)
            : [];
    }, [liveClassroom]);

    const classPoints = liveClassroom?.classPoints ?? 0;

    const loadCourses = async () => {
        if (!globalClassId) return;
        setLoading(true);
        setError('');
        try {
            const [response, sectionsResponse] = await Promise.all([
                fetch(`/api/courses?classId=${encodeURIComponent(globalClassId)}`),
                fetch(`/api/courses/sections/list?classId=${encodeURIComponent(globalClassId)}`)
            ]);
            const [data, sectionsData] = await Promise.all([response.json(), sectionsResponse.json()]);
            if (!response.ok) throw new Error(data?.error || 'Chargement impossible');
            if (!sectionsResponse.ok) throw new Error(sectionsData?.error || 'Chargement des sections impossible');
            setCourses(Array.isArray(data) ? data : []);
            setCourseSections(Array.isArray(sectionsData) ? sectionsData : []);
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setEditorOpen(false);
        setEditingId('');
        setForm(EMPTY_FORM);
        loadCourses();
    }, [globalClassId]);

    useEffect(() => {
        if (!playingCourse) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setPlayingCourse(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [playingCourse]);

    const openNewCourse = () => {
        setEditingId('');
        setForm(EMPTY_FORM);
        setError('');
        setEditorOpen(true);
    };

    const openEditCourse = (course) => {
        setEditingId(String(course._id || ''));
        setForm({
            title: String(course.title || ''),
            description: String(course.description || ''),
            slidesUrl: String(course.slidesUrl || ''),
            isEnabled: course.isEnabled !== false
        });
        setError('');
        setEditorOpen(true);
    };

    const closeEditor = () => {
        setEditorOpen(false);
        setEditingId('');
        setForm(EMPTY_FORM);
        setError('');
    };

    const saveCourse = async (event) => {
        event.preventDefault();
        if (!form.title.trim()) return setError('Ajoute un titre au cours.');
        if (!previewUrl) return setError('Le lien Google Slides est invalide.');

        setSaving(true);
        setError('');
        try {
            const previousCourse = courses.find((course) => String(course._id) === editingId);
            const response = await fetch(editingId ? `/api/courses/${editingId}` : '/api/courses', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    teacherId: user.id || user._id || null,
                    targetClassroomId: globalClassId,
                    targetClassroomName: globalClass,
                    publishedUntilSlide: previousCourse?.publishedUntilSlide || 0,
                    overlays: previousCourse?.overlays || [],
                    courseSectionId: previousCourse?.courseSectionId || '',
                    order: previousCourse?.order || 0
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Enregistrement impossible');
            await loadCourses();
            closeEditor();
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleCourse = async (course) => {
        const nextEnabled = course.isEnabled === false;
        try {
            const response = await fetch(`/api/courses/${course._id}/enabled`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: nextEnabled })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Modification impossible');
            setCourses((current) => current.map((item) => String(item._id) === String(data._id) ? data : item));
        } catch (toggleError) {
            setError(toggleError.message);
        }
    };

    const deleteCourse = async (course) => {
        if (!window.confirm(`Supprimer le cours « ${course.title} » ?`)) return;
        try {
            const response = await fetch(`/api/courses/${course._id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Suppression impossible');
            setCourses((current) => current.filter((item) => String(item._id) !== String(course._id)));
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    const updateCourseTitle = async (course, rawTitle) => {
        const title = String(rawTitle || '').trim();
        if (!title || title === String(course.title || '').trim()) return;
        setError('');
        try {
            const response = await fetch(`/api/courses/${course._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description: course.description || '',
                    slidesUrl: course.slidesUrl || '',
                    isEnabled: course.isEnabled !== false,
                    teacherId: course.teacherId || user.id || user._id || null,
                    targetClassroomId: course.targetClassroomId || globalClassId,
                    targetClassroomName: course.targetClassroomName || globalClass,
                    publishedUntilSlide: course.publishedUntilSlide || 0,
                    overlays: course.overlays || [],
                    courseSectionId: course.courseSectionId || '',
                    order: course.order || 0
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Modification du nom impossible');
            setCourses((current) => current.map((item) => String(item._id) === String(data._id) ? data : item));
        } catch (updateError) {
            setError(updateError.message);
            await loadCourses();
        }
    };

    const updateCourseDescription = async (course, rawDescription) => {
        const description = String(rawDescription || '').trim();
        if (description === String(course.description || '').trim()) return;
        setError('');
        try {
            const response = await fetch(`/api/courses/${course._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: course.title || 'Cours',
                    description,
                    slidesUrl: course.slidesUrl || '',
                    isEnabled: course.isEnabled !== false,
                    teacherId: course.teacherId || user.id || user._id || null,
                    targetClassroomId: course.targetClassroomId || globalClassId,
                    targetClassroomName: course.targetClassroomName || globalClass,
                    publishedUntilSlide: course.publishedUntilSlide || 0,
                    overlays: course.overlays || [],
                    courseSectionId: course.courseSectionId || '',
                    order: course.order || 0
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Modification des informations impossible');
            setCourses((current) => current.map((item) => String(item._id) === String(data._id) ? data : item));
        } catch (updateError) {
            setError(updateError.message);
            await loadCourses();
        }
    };

    const changeCourseSource = async (course) => {
        const slidesUrl = window.prompt('Nouvelle URL de la présentation Google Slides :', String(course.slidesUrl || ''));
        if (slidesUrl === null) return;
        const normalizedUrl = String(slidesUrl || '').trim();
        if (!getEmbedUrl(normalizedUrl)) {
            setError('Le lien Google Slides est invalide.');
            return;
        }
        if (normalizedUrl === String(course.slidesUrl || '').trim()) return;
        setError('');
        try {
            const response = await fetch(`/api/courses/${course._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: course.title || 'Cours',
                    description: course.description || '',
                    slidesUrl: normalizedUrl,
                    isEnabled: course.isEnabled !== false,
                    teacherId: course.teacherId || user.id || user._id || null,
                    targetClassroomId: course.targetClassroomId || globalClassId,
                    targetClassroomName: course.targetClassroomName || globalClass,
                    publishedUntilSlide: course.publishedUntilSlide || 0,
                    overlays: course.overlays || [],
                    courseSectionId: course.courseSectionId || '',
                    order: course.order || 0
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Modification de la source impossible');
            setCourses((current) => current.map((item) => String(item._id) === String(data._id) ? data : item));
        } catch (updateError) {
            setError(updateError.message);
            await loadCourses();
        }
    };

    const updatePublishedUntilSlide = async (course, nextValue) => {
        const nextSlide = Math.max(0, Math.floor(Number(nextValue || 0)));
        const courseId = String(course?._id || '');
        if (!courseId) return;
        setProgressSavingId(courseId);
        setError('');
        try {
            const response = await fetch(`/api/courses/${courseId}/progress`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publishedUntilSlide: nextSlide })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Mise à jour du marqueur impossible');
            setCourses((current) => current.map((item) => String(item._id) === courseId ? data : item));
            setPlayingCourse((current) => String(current?._id || '') === courseId ? data : current);
        } catch (progressError) {
            setError(progressError.message);
        } finally {
            setProgressSavingId('');
        }
    };

    const openPresentation = (course) => {
        setPlayerMode('presentation');
        setPlayingCourse(course);
        if (Math.max(0, Number(course?.publishedUntilSlide || 0)) === 0) {
            updatePublishedUntilSlide(course, 1);
        }
    };

    const openModification = (course) => {
        setPlayerMode('edit');
        setPlayingCourse(course);
    };

    const createCourseSection = async () => {
        const name = window.prompt('Nom de la nouvelle section :', 'Nouvelle section');
        if (!String(name || '').trim()) return;
        try {
            const response = await fetch('/api/courses/sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: String(name).trim(), targetClassroomId: globalClassId }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Création impossible');
            setCourseSections((current) => [...current, data]);
            setOpenCourseSections((current) => ({ ...current, [String(data._id)]: true }));
        } catch (sectionError) {
            setError(sectionError.message);
        }
    };

    const moveCourseToSection = async (courseId, courseSectionId) => {
        const id = String(courseId || '');
        if (!id) return;
        const sectionCourses = courses.filter((course) => String(course.courseSectionId || '') === String(courseSectionId || ''));
        try {
            const response = await fetch(`/api/courses/${id}/placement`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseSectionId: courseSectionId || '', order: sectionCourses.length }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Déplacement impossible');
            setCourses((current) => current.map((course) => String(course._id) === id ? data : course));
            setOpenCourseSections((current) => ({ ...current, [String(courseSectionId || 'unsectioned')]: true }));
        } catch (moveError) {
            setError(moveError.message);
        } finally {
            setDraggedCourseId('');
        }
    };

    const askPublishedSlideFromMarker = () => {
        if (!playingCourse) return;
        const currentValue = Math.max(0, Number(playingCourse.publishedUntilSlide || 0));
        const raw = window.prompt('Dernière slide visible côté élève ?', String(currentValue || 1));
        if (raw === null) return;
        updatePublishedUntilSlide(playingCourse, raw);
    };

    return (
        <section className="courses-manager">
            <header className="courses-heading">
                <div>
                    <span className="courses-kicker">{globalClass || 'CLASSE'}</span>
                    <h1>COURS</h1>
                </div>
                <div className="courses-heading-actions">
                    <button className="courses-secondary-button" type="button" onClick={createCourseSection}>＋ SECTION</button>
                    <button className="courses-primary-button" type="button" onClick={openNewCourse}>
                        <span aria-hidden="true">＋</span> AJOUTER UN COURS
                    </button>
                </div>
            </header>

            {error && <div className="courses-error" role="alert">{error}</div>}

            {editorOpen && (
                <form className="course-editor" onSubmit={saveCourse}>
                    <div className="course-editor-fields">
                        <div className="course-editor-titlebar">
                            <h2>{editingId ? 'MODIFIER LE COURS' : 'NOUVEAU COURS'}</h2>
                            <button className="courses-icon-button" type="button" onClick={closeEditor} aria-label="Fermer">×</button>
                        </div>
                        <label>
                            <span>TITRE</span>
                            <input
                                value={form.title}
                                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                                placeholder="La Révolution française"
                                autoFocus
                            />
                        </label>
                        <label>
                            <span>LIEN GOOGLE SLIDES</span>
                            <input
                                value={form.slidesUrl}
                                onChange={(event) => setForm((current) => ({ ...current, slidesUrl: event.target.value }))}
                                placeholder="https://docs.google.com/presentation/d/..."
                            />
                        </label>
                        <label>
                            <span>DESCRIPTION</span>
                            <textarea
                                value={form.description}
                                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                placeholder="Chapitre, objectifs ou consignes"
                                rows="4"
                            />
                        </label>
                        <label className="course-switch-row">
                            <input
                                type="checkbox"
                                checked={form.isEnabled}
                                onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))}
                            />
                            <span>VISIBLE POUR LA CLASSE</span>
                        </label>
                        <div className="course-editor-actions">
                            <button className="courses-secondary-button" type="button" onClick={closeEditor}>ANNULER</button>
                            <button className="courses-save-button" type="submit" disabled={saving}>
                                {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER'}
                            </button>
                        </div>
                    </div>
                    <div className={`course-preview ${previewUrl ? 'is-ready' : ''}`}>
                        {previewUrl ? (
                            <iframe title="Édition Google Slides" src={editPreviewUrl} allowFullScreen />
                        ) : (
                            <div className="course-preview-empty" aria-hidden="true">
                                <span>▣</span>
                                <strong>APERÇU</strong>
                            </div>
                        )}
                    </div>
                </form>
            )}

            <div className="courses-library">
                {loading ? (
                    <div className="courses-empty">CHARGEMENT...</div>
                ) : courses.length === 0 ? (
                    <div className="courses-empty">
                        <strong>AUCUN COURS</strong>
                    </div>
                ) : (
                    <div className="course-sections-stack">
                        {[{ _id: '', name: 'SANS SECTION' }, ...[...courseSections].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', { numeric: true, sensitivity: 'base' }))].map((section) => {
                            const sectionId = String(section._id || '');
                            const rows = courses
                                .filter((course) => String(course.courseSectionId || '') === sectionId)
                                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
                            const sectionStateKey = sectionId || 'unsectioned';
                            const isOpen = openCourseSections[sectionStateKey] === true;
                            if (!sectionId && rows.length === 0 && courseSections.length > 0) return null;
                            return <section
                                key={sectionId || 'unsectioned'}
                                className={`course-drop-section ${draggedCourseId ? 'is-dragging' : ''}`}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => { event.preventDefault(); moveCourseToSection(draggedCourseId, sectionId); }}
                            >
                                <button type="button" className="course-section-heading" onClick={() => setOpenCourseSections((current) => ({ ...current, [sectionStateKey]: !isOpen }))} aria-expanded={isOpen}>
                                    <span className="course-section-folder">{isOpen ? '📂' : '📁'}</span><strong>{section.name}</strong><small>{rows.length} présentation{rows.length > 1 ? 's' : ''}</small><span className="course-section-chevron">{isOpen ? '⌃' : '⌄'}</span>
                                </button>
                                {isOpen && <div className="courses-grid courses-grid-compact">{rows.map((course) => (
                            <article className="course-compact-row" key={course._id}>
                                <span className="course-drag-handle" draggable onDragStart={() => setDraggedCourseId(String(course._id))} onDragEnd={() => setDraggedCourseId('')} title="Glisser dans une section">⋮⋮</span>
                                <div className="course-compact-copy">
                                    <input
                                        className="course-inline-title"
                                        defaultValue={course.title}
                                        key={`${course._id}-${course.title}`}
                                        aria-label="Nom de la présentation"
                                        onBlur={(event) => updateCourseTitle(course, event.target.value)}
                                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                                    />
                                    <textarea
                                        className="course-inline-description"
                                        defaultValue={course.description || ''}
                                        key={`${course._id}-${course.description || 'empty'}`}
                                        aria-label="Informations complémentaires"
                                        placeholder="Ajoute ici quelques informations sur ce cours…"
                                        rows="2"
                                        onBlur={(event) => updateCourseDescription(course, event.target.value)}
                                    />
                                </div>
                                <div className="course-compact-actions">
                                    <button type="button" className="course-present-button" onClick={() => openPresentation(course)}>PRÉSENTER</button>
                                    <button type="button" onClick={() => changeCourseSource(course)}>SOURCE</button>
                                    <button type="button" onClick={() => openModification(course)}>MODIFIER</button>
                                    <button className="course-delete-x" type="button" onClick={() => deleteCourse(course)} aria-label={`Supprimer ${course.title}`}>×</button>
                                </div>
                            </article>
                                ))}{rows.length === 0 && <div className="course-section-empty">Glisse une présentation ici</div>}</div>}
                            </section>;
                        })}
                    </div>
                )}
            </div>

            {playingCourse && (
                <div className="course-player-backdrop" role="dialog" aria-modal="true" aria-label={playingCourse.title}>
                    <div className="course-player-toolbar">
                        <strong>{playingCourse.title}</strong>
                        <button type="button" onClick={() => setPlayingCourse(null)} aria-label="Fermer">×</button>
                    </div>
                    <div className="course-player-stage">
                        <iframe
                            title={playingCourse.title}
                            src={playerMode === 'presentation'
                                ? getEmbedUrl(playingCourse.slidesUrl)
                                : getEditUrl(playingCourse.slidesUrl)}
                            allowFullScreen
                        />
                        
                        {/* COMPTEUR DE POINTS DE LA CLASSE EN HAUT A DROITE */}
                        <div className="live-class-points">
                            🏆 Score Classe : {classPoints} pts
                        </div>

                        {/* NOM DE L'ELEVE EN ROUGE DANS UN COIN (BAS GAUCHE) */}
                        {isHighlightActive && (
                            <div className="live-student-highlight">
                                {liveClassroom.activeStudentHighlight}
                            </div>
                        )}

                        {activeHourWarnings.length > 0 && (
                            <div className="live-hour-warning-panel">
                                <div className="live-hour-warning-title">Avertis cette heure</div>
                                {activeHourWarnings.map((row) => (
                                    <div key={row.studentId || row.name} className="live-hour-warning-name">
                                        {row.name}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* MESSAGE DE FELICITATIONS BONUS EN PLEIN MILIEU */}
                        {isBonusActive && (
                            <div className="live-bonus-alert">
                                <div className="live-bonus-star">⭐</div>
                                <div>{liveClassroom.activeStudentBonusAlert}</div>
                            </div>
                        )}

                        {(playingCourse.overlays || []).length > 0 && <div className="course-overlay-layer" aria-hidden="true">
                            {(playingCourse.overlays || []).map((overlay, index) => (
                                overlay.type === 'video' ? (
                                    <video
                                        key={`${overlay.sourceUrl}-${index}`}
                                        src={overlay.sourceUrl}
                                        autoPlay
                                        muted
                                        playsInline
                                        style={{ left: `${overlay.x}%`, top: `${overlay.y}%`, width: `${overlay.width}%` }}
                                    />
                                ) : (
                                    <img
                                        key={`${overlay.sourceUrl}-${index}`}
                                        src={overlay.sourceUrl}
                                        alt=""
                                        style={{ left: `${overlay.x}%`, top: `${overlay.y}%`, width: `${overlay.width}%` }}
                                    />
                                )
                            ))}
                        </div>}
                    </div>
                    <div className="course-player-mode-switch" aria-label="Changer de mode">
                        <button
                            type="button"
                            className="active"
                            onClick={() => setPlayerMode((current) => current === 'presentation' ? 'edit' : 'presentation')}
                        >{playerMode === 'presentation' ? '✏️ PASSER EN MODE MODIFIER' : '▶ PASSER EN MODE LECTURE'}</button>
                    </div>
                </div>
            )}
        </section>
    );
}
