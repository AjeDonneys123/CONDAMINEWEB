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

    const classPoints = liveClassroom?.classPoints ?? 0;

    const loadCourses = async () => {
        if (!globalClassId) return;
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/courses?classId=${encodeURIComponent(globalClassId)}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Chargement impossible');
            setCourses(Array.isArray(data) ? data : []);
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
                    overlays: previousCourse?.overlays || []
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

    return (
        <section className="courses-manager">
            <header className="courses-heading">
                <div>
                    <span className="courses-kicker">{globalClass || 'CLASSE'}</span>
                    <h1>COURS</h1>
                </div>
                <button className="courses-primary-button" type="button" onClick={openNewCourse}>
                    <span aria-hidden="true">＋</span> AJOUTER UN COURS
                </button>
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
                    <div className="courses-grid">
                        {courses.map((course) => (
                            <article className={`course-card ${course.isEnabled === false ? 'is-hidden' : ''}`} key={course._id}>
                                <div className="course-slide-preview">
                                    <iframe title={`Édition de ${course.title}`} src={getEditUrl(course.slidesUrl)} allowFullScreen />
                                </div>
                                <div className="course-card-content">
                                    <div className="course-card-title-row">
                                        <h2>{course.title}</h2>
                                        <span className={course.isEnabled === false ? 'course-state hidden' : 'course-state'}>
                                            {course.isEnabled === false ? 'MASQUÉ' : 'PUBLIÉ'}
                                        </span>
                                    </div>
                                    {course.description && <p>{course.description}</p>}
                                    <div className="course-progress-box">
                                        <div>
                                            <strong>Marqueur élèves</strong>
                                            <span>Slides visibles : 1 → {Math.max(0, Number(course.publishedUntilSlide || 0)) || 'aucune'}</span>
                                        </div>
                                        <div className="course-progress-controls">
                                            <button
                                                type="button"
                                                onClick={() => updatePublishedUntilSlide(course, Number(course.publishedUntilSlide || 0) - 1)}
                                                disabled={progressSavingId === String(course._id)}
                                            >−</button>
                                            <input
                                                type="number"
                                                min="0"
                                                value={Math.max(0, Number(course.publishedUntilSlide || 0))}
                                                onChange={(event) => updatePublishedUntilSlide(course, event.target.value)}
                                                disabled={progressSavingId === String(course._id)}
                                                aria-label="Dernière slide visible par les élèves"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updatePublishedUntilSlide(course, Number(course.publishedUntilSlide || 0) + 1)}
                                                disabled={progressSavingId === String(course._id)}
                                            >＋</button>
                                        </div>
                                    </div>
                                    <div className="course-card-actions">
                                        <button type="button" onClick={() => openPresentation(course)}>PRÉSENTER</button>
                                        <a
                                            className="course-google-edit-link"
                                            href={getEditUrl(course.slidesUrl)}
                                            target="_blank"
                                            rel="noreferrer"
                                        >MODIFIER LES SLIDES</a>
                                        <button type="button" onClick={() => openEditCourse(course)} aria-label={`Modifier ${course.title}`}>MODIFIER</button>
                                        <button type="button" onClick={() => toggleCourse(course)}>
                                            {course.isEnabled === false ? 'PUBLIER' : 'MASQUER'}
                                        </button>
                                        <button className="is-danger" type="button" onClick={() => deleteCourse(course)} aria-label={`Supprimer ${course.title}`}>SUPPRIMER</button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            {playingCourse && (
                <div className="course-player-backdrop" role="dialog" aria-modal="true" aria-label={playingCourse.title}>
                    <div className="course-player-toolbar">
                        <strong>{playingCourse.title}</strong>
                        <div className="course-player-progress">
                            <span>Élèves : slides 1 → {Math.max(0, Number(playingCourse.publishedUntilSlide || 0)) || 'aucune'}</span>
                            <button
                                type="button"
                                onClick={() => updatePublishedUntilSlide(playingCourse, Number(playingCourse.publishedUntilSlide || 0) - 1)}
                                disabled={progressSavingId === String(playingCourse._id)}
                            >−</button>
                            <input
                                type="number"
                                min="0"
                                value={Math.max(0, Number(playingCourse.publishedUntilSlide || 0))}
                                onChange={(event) => updatePublishedUntilSlide(playingCourse, event.target.value)}
                                disabled={progressSavingId === String(playingCourse._id)}
                                aria-label="Dernière slide visible par les élèves"
                            />
                            <button
                                type="button"
                                onClick={() => updatePublishedUntilSlide(playingCourse, Number(playingCourse.publishedUntilSlide || 0) + 1)}
                                disabled={progressSavingId === String(playingCourse._id)}
                            >＋</button>
                        </div>
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
                                📣 Attention : {liveClassroom.activeStudentHighlight}
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
                    <div className="course-player-mode-switch" aria-label="Mode d'affichage">
                        <button
                            type="button"
                            className={playerMode === 'edit' ? 'active' : ''}
                            onClick={() => setPlayerMode('edit')}
                        >ÉDITION</button>
                        <button
                            type="button"
                            className={playerMode === 'presentation' ? 'active' : ''}
                            onClick={() => setPlayerMode('presentation')}
                        >PRÉSENTATION</button>
                    </div>
                </div>
            )}
        </section>
    );
}
