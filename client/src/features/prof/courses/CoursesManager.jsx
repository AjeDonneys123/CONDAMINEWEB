import React, { useEffect, useMemo, useRef, useState } from 'react';
import './CoursesManager.css';

const EMPTY_FORM = {
    title: '',
    description: '',
    slidesUrl: '',
    isEnabled: true
};

const COURSE_DEBT_DISMISS_KEY = 'conda-course-debt-dismissals-v1';
const WEB5E_STUDIO_URL = String(import.meta.env.VITE_WEB5E_URL || '').trim();

const readDebtDismissals = (classId = '') => {
    try {
        const now = Date.now();
        const raw = JSON.parse(window.localStorage.getItem(COURSE_DEBT_DISMISS_KEY) || '{}');
        const next = {};
        Object.entries(raw || {}).forEach(([key, expiresAt]) => {
            if (Number(expiresAt || 0) > now) next[key] = Number(expiresAt);
        });
        window.localStorage.setItem(COURSE_DEBT_DISMISS_KEY, JSON.stringify(next));
        const prefix = `${String(classId || '')}:`;
        return Object.fromEntries(Object.entries(next)
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, expiresAt]) => [key.slice(prefix.length), expiresAt]));
    } catch (_) {
        return {};
    }
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

const normalizeSuggestedChapterTitle = (value = '', fallbackIndex = 1) => {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw) return `H${fallbackIndex} Chapitre ${fallbackIndex}`;
    if (/^[HGE]\s*\d+\b/i.test(raw)) {
        return raw.replace(/^([HGE])\s*(\d+)\s*[:.\-–—]?\s*/i, (_match, subject, number) => `${subject.toUpperCase()}${number} `).trim();
    }
    const match = raw.match(/^(histoire|g[ée]ographie|g[ée]o|emc|enseignement\s+moral(?:\s+et\s+civique)?)\s*[-–—:]?\s*(?:chapitre|chap\.?|ch\.?)?\s*(\d+)\s*[:.\-–—]?\s*(.*)$/i);
    if (!match) return raw.slice(0, 140);
    const normalizedSubject = match[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const prefix = normalizedSubject.startsWith('histoire') ? 'H' : normalizedSubject.startsWith('g') ? 'G' : 'E';
    const name = String(match[3] || '').trim();
    return `${prefix}${match[2]}${name ? ` ${name}` : ''}`.slice(0, 140);
};

function CourseSlideThumbnail({ slide }) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    return <span className="course-split-thumb-frame">
        {!loaded && <span className="course-split-slide-fallback">SLIDE {slide.slideNumber}</span>}
        {!failed && <img
            className={loaded ? 'loaded' : ''}
            src={slide.thumbnailProxyUrl || slide.thumbnailPublicUrl}
            alt={`Slide ${slide.slideNumber}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
        />}
    </span>;
}

const mergeCourseForCurrentView = (currentCourse, serverCourse) => {
    const currentSectionId = String(currentCourse?.courseSectionId || '');
    const serverSectionId = String(serverCourse?.courseSectionId || '');
    const hasLogicalSection = currentSectionId.startsWith('level:') || currentSectionId.startsWith('class:');
    const serverHasLogicalSection = serverSectionId.startsWith('level:') || serverSectionId.startsWith('class:');
    return hasLogicalSection && !serverHasLogicalSection
        ? { ...serverCourse, courseSectionId: currentSectionId }
        : serverCourse;
};

export default function CoursesManager({ globalClass, globalClassId = '', globalLevel = '', user = {} }) {
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
    const [sourceEditor, setSourceEditor] = useState(null);
    const [splitEditor, setSplitEditor] = useState(null);
    const [splittingCourse, setSplittingCourse] = useState(false);
    const [debtStudents, setDebtStudents] = useState([]);
    const [dismissedDebtIds, setDismissedDebtIds] = useState({});
    const [animationEditor, setAnimationEditor] = useState(null);
    const [savingAnimation, setSavingAnimation] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [projectedControl, setProjectedControl] = useState(null);
    const animationFrameRef = useRef(null);

    const previewUrl = useMemo(() => getEmbedUrl(form.slidesUrl), [form.slidesUrl]);
    const editPreviewUrl = useMemo(() => getEditUrl(form.slidesUrl), [form.slidesUrl]);
    const activeCourses = useMemo(() => courses
        .filter((course) => course.isEnabled !== false && !course.isSourcePresentation)
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr', { numeric: true, sensitivity: 'base' })), [courses]);
    const visibleDebtStudents = useMemo(() => {
        const now = Date.now();
        return debtStudents.filter((student) => Number(dismissedDebtIds[String(student.id)] || 0) <= now);
    }, [debtStudents, dismissedDebtIds]);

    useEffect(() => {
        setDismissedDebtIds(readDebtDismissals(globalClassId));
    }, [globalClassId]);

    const dismissDebtForCurrentHour = (studentId) => {
        const id = String(studentId || '');
        if (!id || !globalClassId) return;
        const nextHour = new Date();
        nextHour.setMinutes(60, 0, 0);
        const expiresAt = nextHour.getTime();
        setDismissedDebtIds((current) => ({ ...current, [id]: expiresAt }));
        try {
            const raw = JSON.parse(window.localStorage.getItem(COURSE_DEBT_DISMISS_KEY) || '{}');
            window.localStorage.setItem(COURSE_DEBT_DISMISS_KEY, JSON.stringify({
                ...(raw && typeof raw === 'object' ? raw : {}),
                [`${globalClassId}:${id}`]: expiresAt
            }));
        } catch (_) {}
    };

    useEffect(() => {
        if (!playingCourse || !globalClassId) {
            setLiveClassroom(null);
            setDebtStudents([]);
            return undefined;
        }

        const fetchLiveStatus = async () => {
            try {
                const teacherId = user.id || user._id || '';
                const [res, studentsRes] = await Promise.all([
                    fetch(`/api/classroom/${globalClassId}`),
                    fetch(`/api/classroom/debts/${globalClassId}?teacherId=${encodeURIComponent(teacherId)}`)
                ]);
                if (res.ok) setLiveClassroom(await res.json());
                if (studentsRes.ok) {
                    const rows = await studentsRes.json();
                    setDebtStudents(Array.isArray(rows) ? rows : []);
                }
            } catch (e) {
                console.error("Live polling error:", e);
            }
        };

        fetchLiveStatus(); // immediate call
        const interval = setInterval(fetchLiveStatus, 2000);
        return () => clearInterval(interval);
    }, [playingCourse, globalClassId, user.id, user._id]);

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
                    targetScope: previousCourse?.targetScope || 'LEVEL',
                    targetLevel: previousCourse?.targetLevel || globalLevel,
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
                    targetScope: course.targetScope || 'LEVEL',
                    targetLevel: course.targetLevel || globalLevel,
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
                    targetScope: course.targetScope || 'LEVEL',
                    targetLevel: course.targetLevel || globalLevel,
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

    const changeCourseSource = (course) => {
        setSourceEditor({
            course,
            slidesUrl: String(course.slidesUrl || ''),
            targetScope: course.targetScope === 'CLASS' ? 'CLASS' : 'LEVEL'
        });
        setError('');
    };

    const saveCourseSource = async () => {
        const course = sourceEditor?.course;
        if (!course) return;
        const normalizedUrl = String(sourceEditor.slidesUrl || '').trim();
        if (!getEmbedUrl(normalizedUrl)) {
            setError('Le lien Google Slides est invalide.');
            return;
        }
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
                    targetScope: sourceEditor.targetScope,
                    targetLevel: globalLevel,
                    publishedUntilSlide: course.publishedUntilSlide || 0,
                    overlays: course.overlays || [],
                    courseSectionId: course.courseSectionId || '',
                    order: course.order || 0
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Modification de la source impossible');
            setCourses((current) => current.map((item) => String(item._id) === String(data._id) ? data : item));
            setSourceEditor(null);
        } catch (updateError) {
            setError(updateError.message);
            await loadCourses();
        }
    };

    const openCourseSplitter = async (course) => {
        if (!course?.slidesUrl) return;
        setSourceEditor(null);
        setSplitEditor({
            course,
            sourceSlidesUrl: course.slidesUrl,
            chapters: [],
            draftTitle: '',
            draftStart: 1,
            draftEnd: 1,
            editingChapterIndex: null,
            slides: [],
            loadingSlides: true,
            selectionStart: null,
            error: ''
        });
        try {
            const response = await fetch('/api/learning/slides/manifest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ presentationUrl: course.slidesUrl, outlineOnly: true })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Chargement des slides impossible');
            const existingChildren = courses
                .filter((item) => String(item.sourceCourseId || '') === String(course._id))
                .map((item) => {
                    const slides = Array.isArray(data.slides) ? data.slides : [];
                    const resolveAnchor = (anchor) => {
                        const objectIndex = slides.findIndex((slide) => String(slide.objectId || '') === String(anchor?.objectId || ''));
                        if (objectIndex >= 0) return objectIndex + 1;
                        const excerpt = String(anchor?.textExcerpt || '').trim().toLocaleLowerCase('fr');
                        const textIndex = excerpt ? slides.findIndex((slide) => String(slide.text || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr').startsWith(excerpt)) : -1;
                        return textIndex >= 0 ? textIndex + 1 : Number(anchor?.originalSlideNumber || 0);
                    };
                    return {
                        title: item.title,
                        startSlide: resolveAnchor(item.sourceStartAnchor),
                        endSlide: resolveAnchor(item.sourceEndAnchor)
                    };
                })
                .filter((item) => item.startSlide > 0 && item.endSlide >= item.startSlide)
                .sort((a, b) => a.startSlide - b.startSlide);
            const detectedStarts = (data.slides || []).filter((slide) => /(?:^|\s)(?:chapitre|ch\s*\d+|h\s*\d+|g\s*\d+|e\s*\d+)\b/i.test(String(slide.text || '')));
            const suggestedChapters = detectedStarts.map((slide, index) => {
                const next = detectedStarts[index + 1];
                const rawTitle = String(slide.text || '').replace(/\s+/g, ' ').trim();
                return {
                    title: normalizeSuggestedChapterTitle(rawTitle, index + 1),
                    startSlide: Number(slide.slideNumber),
                    endSlide: next ? Number(next.slideNumber) - 1 : (data.slides || []).length
                };
            });
            const initialChapters = existingChildren.length ? existingChildren : suggestedChapters;
            setSplitEditor((current) => current ? {
                ...current,
                sourceSlidesUrl: data.sourcePresentationUrl || course.slidesUrl,
                slides: data.slides || [],
                loadingSlides: false,
                chapters: initialChapters,
                draftStart: initialChapters.length ? Math.min((data.slides || []).length, initialChapters.at(-1).endSlide + 1) : 1,
                draftEnd: initialChapters.length ? Math.min((data.slides || []).length, initialChapters.at(-1).endSlide + 1) : 1
            } : current);
        } catch (loadError) {
            setSplitEditor((current) => current ? { ...current, loadingSlides: false, error: loadError.message } : current);
        }
    };

    const selectSplitSlide = (slideNumber) => {
        setSplitEditor((current) => {
            if (!current) return current;
            if (!current.selectionStart) return { ...current, selectionStart: slideNumber, draftStart: slideNumber, draftEnd: slideNumber };
            const start = Math.min(current.selectionStart, slideNumber);
            const end = Math.max(current.selectionStart, slideNumber);
            return { ...current, selectionStart: null, draftStart: start, draftEnd: end };
        });
    };

    const addSplitChapter = () => {
        setSplitEditor((current) => {
            if (!current) return current;
            const startSlide = Math.max(1, Math.floor(Number(current.draftStart || 0)));
            const endSlide = Math.max(1, Math.floor(Number(current.draftEnd || 0)));
            if (!startSlide || !endSlide || endSlide < startSlide) return { ...current, error: 'La plage de slides est invalide.' };
            const editingIndex = Number.isInteger(current.editingChapterIndex) ? current.editingChapterIndex : null;
            const overlaps = current.chapters.some((chapter, index) => index !== editingIndex && startSlide <= chapter.endSlide && endSlide >= chapter.startSlide);
            if (overlaps) return { ...current, error: 'Cette plage recouvre déjà un autre chapitre.' };
            const title = String(current.draftTitle || `Chapitre ${current.chapters.length + 1}`).trim();
            const nextChapter = { title, startSlide, endSlide };
            const chapters = editingIndex === null
                ? [...current.chapters, nextChapter]
                : current.chapters.map((chapter, index) => index === editingIndex ? nextChapter : chapter);
            return {
                ...current,
                chapters: chapters.sort((a, b) => a.startSlide - b.startSlide),
                draftTitle: '',
                draftStart: endSlide + 1,
                draftEnd: endSlide + 1,
                editingChapterIndex: null,
                error: ''
            };
        });
    };

    const editSplitChapter = (chapter, index) => {
        setSplitEditor((current) => current ? {
            ...current,
            draftTitle: chapter.title,
            draftStart: chapter.startSlide,
            draftEnd: chapter.endSlide,
            editingChapterIndex: index,
            error: ''
        } : current);
    };

    const clearSplitChapterEditing = () => {
        setSplitEditor((current) => {
            if (!current || !Number.isInteger(current.editingChapterIndex)) return current;
            const nextSlide = Math.max(0, ...current.chapters.map((chapter) => Number(chapter.endSlide || 0))) + 1;
            return {
                ...current,
                draftTitle: '',
                draftStart: nextSlide,
                draftEnd: nextSlide,
                editingChapterIndex: null,
                error: ''
            };
        });
    };

    const createSplitCourses = async () => {
        if (!splitEditor?.course || splitEditor.chapters.length < 1) {
            setSplitEditor((current) => current ? { ...current, error: 'Ajoute au moins un chapitre.' } : current);
            return;
        }
        if (!window.confirm(`Créer ou mettre à jour ${splitEditor.chapters.length} présentations depuis « ${splitEditor.course.title} » ? La source restera intacte.`)) return;
        setSplittingCourse(true);
        setSplitEditor((current) => current ? { ...current, error: '' } : current);
        try {
            const response = await fetch(`/api/courses/${splitEditor.course._id}/split`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chapters: splitEditor.chapters, presentationUrl: splitEditor.sourceSlidesUrl || splitEditor.course.slidesUrl })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Découpage impossible');
            setSplitEditor(null);
            await loadCourses();
        } catch (splitError) {
            setSplitEditor((current) => current ? { ...current, error: splitError.message } : current);
        } finally {
            setSplittingCourse(false);
        }
    };

    const toggleCourseEnabled = async (course) => {
        const courseId = String(course?._id || '');
        if (!courseId) return;
        const isEnabled = course.isEnabled === false;
        setError('');
        try {
            const response = await fetch(`/api/courses/${courseId}/enabled`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Modification de visibilité impossible');
            setCourses((current) => current.map((item) => String(item._id) === courseId ? mergeCourseForCurrentView(item, data) : item));
        } catch (updateError) {
            setError(updateError.message);
        }
    };

    const openMascotAnimationStudio = () => {
        setAddMenuOpen(false);
        if (!playingCourse) return;
        const suggested = Math.max(1, Number(playingCourse.publishedUntilSlide || 1));
        const raw = window.prompt('Sur quelle slide ajouter ou modifier la mascotte ?', String(suggested));
        if (raw === null) return;
        const slideNumber = Math.max(1, Math.floor(Number(raw || 1)));
        const existing = (playingCourse.presentationAnimations || []).find((row) => Number(row?.slideNumber) === slideNumber)?.animationBlock || null;
        const isLocal = ['localhost', '127.0.0.1'].includes(String(window.location.hostname || '').toLowerCase());
        const studioUrl = WEB5E_STUDIO_URL || (isLocal ? 'http://localhost:5174' : '/projet-5e');
        setAnimationEditor({ course: playingCourse, slideNumber, animationBlock: existing, studioUrl: `${studioUrl.replace(/\/$/, '')}/?embeddedAnimation=1` });
    };

    const openControlOnCourse = async () => {
        setAddMenuOpen(false);
        try {
            const response = await fetch('/api/controls/all');
            const rows = response.ok ? await response.json() : [];
            const key = String(globalClass || '').replace(/\s/g, '').toUpperCase();
            const available = (rows || []).filter(row => row.active !== false && (row.targetClassrooms || []).some(value => String(value || '').replace(/\s/g, '').toUpperCase() === key));
            if (!available.length) return alert('Aucun contrôle actif pour cette classe. Créez-le dans Activités.');
            const choice = available.length === 1 ? available[0] : available.find((_, i) => String(i + 1) === prompt(available.map((row, i) => `${i + 1}. ${row.title}`).join('\n'), '1'));
            if (choice) setProjectedControl(choice);
        } catch (_) { alert('Chargement des contrôles impossible.'); }
    };

    useEffect(() => {
        if (!animationEditor) return undefined;
        const receiveAnimation = (event) => {
            if (event.source !== animationFrameRef.current?.contentWindow) return;
            if (event.data?.type === 'conda-mascot-animation-ready' && animationEditor.animationBlock) {
                animationFrameRef.current.contentWindow.postMessage({ type: 'conda-mascot-animation-load', animationBlock: animationEditor.animationBlock }, '*');
            }
            if (event.data?.type === 'conda-mascot-animation-change') {
                setAnimationEditor((current) => current ? { ...current, animationBlock: event.data.animationBlock } : current);
            }
        };
        window.addEventListener('message', receiveAnimation);
        return () => window.removeEventListener('message', receiveAnimation);
    }, [animationEditor?.course?._id, animationEditor?.slideNumber]);

    const saveMascotAnimation = async () => {
        if (!animationEditor?.course?._id || !animationEditor.animationBlock) return;
        setSavingAnimation(true);
        try {
            const response = await fetch(`/api/courses/${animationEditor.course._id}/animation`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slideNumber: animationEditor.slideNumber, animationBlock: animationEditor.animationBlock })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Enregistrement de l’animation impossible');
            setCourses((current) => current.map((course) => String(course._id) === String(data._id) ? mergeCourseForCurrentView(course, data) : course));
            setPlayingCourse((current) => String(current?._id) === String(data._id) ? { ...current, presentationAnimations: data.presentationAnimations || [] } : current);
            setAnimationEditor(null);
        } catch (animationError) {
            setError(animationError.message);
        } finally {
            setSavingAnimation(false);
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
            setCourses((current) => current.map((item) => String(item._id) === courseId ? mergeCourseForCurrentView(item, data) : item));
            setPlayingCourse((current) => String(current?._id || '') === courseId ? mergeCourseForCurrentView(current, data) : current);
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

    const openModification = async (course) => {
        setError('');
        try {
            const response = await fetch(`/api/courses/${course._id}/editor-access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherEmail: user?.email || user?.mail || '' })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Accès en modification impossible');
            setPlayerMode('edit');
            setPlayingCourse({ ...course, slidesUrl: data.editUrl || course.slidesUrl, editorNonce: Date.now() });
        } catch (accessError) {
            setError(accessError.message);
            alert(`Impossible d’ouvrir cette présentation en modification : ${accessError.message}`);
        }
    };

    const createCourseSection = async () => {
        const name = window.prompt('Nom de la nouvelle section :', 'Nouvelle section');
        if (!String(name || '').trim()) return;
        try {
            const response = await fetch('/api/courses/sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: String(name).trim(), targetClassroomId: globalClassId }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Création impossible');
            setCourseSections((current) => current.some((section) => String(section._id) === String(data._id))
                ? current
                : [...current, data]);
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

    const reorderCourse = async (draggedId, targetCourse, placeAfter = false) => {
        const id = String(draggedId || '');
        const targetId = String(targetCourse?._id || '');
        if (!id || !targetId || id === targetId) return setDraggedCourseId('');
        const destinationSectionId = String(targetCourse.courseSectionId || '');
        const destination = courses
            .filter((course) => String(course.courseSectionId || '') === destinationSectionId && String(course._id) !== id)
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
        const targetIndex = destination.findIndex((course) => String(course._id) === targetId);
        if (targetIndex < 0) return setDraggedCourseId('');
        const draggedCourse = courses.find((course) => String(course._id) === id);
        if (!draggedCourse) return setDraggedCourseId('');
        destination.splice(targetIndex + (placeAfter ? 1 : 0), 0, { ...draggedCourse, courseSectionId: destinationSectionId });
        const placements = destination.map((course, order) => ({ id: String(course._id), courseSectionId: destinationSectionId, order }));
        const previous = courses;
        setCourses((current) => current.map((course) => {
            const placement = placements.find((item) => item.id === String(course._id));
            return placement ? { ...course, courseSectionId: placement.courseSectionId, order: placement.order } : course;
        }));
        setDraggedCourseId('');
        try {
            const response = await fetch('/api/courses/placements/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ placements })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Réorganisation impossible');
        } catch (moveError) {
            setCourses(previous);
            setError(moveError.message);
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
            {sourceEditor && (
                <div className="course-source-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="course-source-modal-title">
                    <form className="course-source-modal" onSubmit={(event) => { event.preventDefault(); saveCourseSource(); }}>
                        <div className="course-source-modal-heading">
                            <div>
                                <span>✏️ SOURCE GOOGLE SLIDES</span>
                                <h2 id="course-source-modal-title">Modifier la présentation</h2>
                            </div>
                            <button type="button" onClick={() => setSourceEditor(null)} aria-label="Fermer">×</button>
                        </div>
                        <label>
                            <span>URL DE LA PRÉSENTATION</span>
                            <input
                                autoFocus
                                value={sourceEditor.slidesUrl}
                                onChange={(event) => setSourceEditor((current) => ({ ...current, slidesUrl: event.target.value }))}
                                placeholder="https://docs.google.com/presentation/d/..."
                            />
                        </label>
                        <fieldset className="course-source-scope">
                            <legend>VISIBLE POUR</legend>
                            <label className={sourceEditor.targetScope === 'CLASS' ? 'selected' : ''}>
                                <input type="radio" name="course-target-scope" value="CLASS" checked={sourceEditor.targetScope === 'CLASS'} onChange={() => setSourceEditor((current) => ({ ...current, targetScope: 'CLASS' }))} />
                                <strong>Cette classe</strong><small>{globalClass || 'Classe actuelle'}</small>
                            </label>
                            <label className={sourceEditor.targetScope === 'LEVEL' ? 'selected' : ''}>
                                <input type="radio" name="course-target-scope" value="LEVEL" checked={sourceEditor.targetScope === 'LEVEL'} onChange={() => setSourceEditor((current) => ({ ...current, targetScope: 'LEVEL' }))} />
                                <strong>Tout le niveau</strong><small>{globalLevel || 'Niveau actuel'}</small>
                            </label>
                        </fieldset>
                        <div className="course-source-modal-actions">
                            <button type="button" className="course-split-open-button" onClick={() => openCourseSplitter(sourceEditor.course)}>✂ DÉCOUPER</button>
                            <button type="button" className="courses-secondary-button" onClick={() => setSourceEditor(null)}>ANNULER</button>
                            <button type="submit" className="courses-save-button">ENREGISTRER</button>
                        </div>
                    </form>
                </div>
            )}
            {splitEditor && (
                <div className="course-source-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="course-split-modal-title">
                    <div className="course-split-modal" onDoubleClick={(event) => {
                        if (event.target.closest('input, button, .course-split-chapters > div')) return;
                        clearSplitChapterEditing();
                    }}>
                        <div className="course-source-modal-heading">
                            <div>
                                <span>✂ DÉCOUPAGE GOOGLE SLIDES</span>
                                <h2 id="course-split-modal-title">Créer une présentation par chapitre</h2>
                            </div>
                            <button type="button" onClick={() => !splittingCourse && setSplitEditor(null)} aria-label="Fermer">×</button>
                        </div>
                        <p className="course-split-help">Clique sur la première puis la dernière miniature d’un chapitre. La présentation mère restera intacte dans Sources.</p>
                        {splitEditor.error && <div className="course-split-error" role="alert"><span>{splitEditor.error}</span></div>}
                        <div className="course-split-workspace">
                            <div className="course-split-picker" aria-label="Miniatures de la présentation source">
                                {splitEditor.loadingSlides && <div className="course-split-placeholder">CHARGEMENT DES MINIATURES…</div>}
                                {!splitEditor.loadingSlides && splitEditor.slides.map((slide) => {
                                    const number = Number(slide.slideNumber);
                                    const selected = number >= Number(splitEditor.draftStart) && number <= Number(splitEditor.draftEnd);
                                    const assigned = splitEditor.chapters.some((chapter, index) => index !== splitEditor.editingChapterIndex && number >= chapter.startSlide && number <= chapter.endSlide);
                                    return <button type="button" key={slide.objectId || number} className={`${selected ? 'selected' : ''} ${assigned ? 'assigned' : ''}`} onClick={() => !assigned && selectSplitSlide(number)}>
                                        <CourseSlideThumbnail slide={slide} />
                                        <strong>SLIDE {number}</strong>
                                    </button>;
                                })}
                            </div>
                            <aside className="course-split-sidebar">
                                <label>
                                    <span>TITRE DU CHAPITRE</span>
                                    <input type="text" value={splitEditor.draftTitle} onChange={(event) => setSplitEditor((current) => ({ ...current, draftTitle: event.target.value }))} placeholder="Ex. La Méditerranée antique" />
                                </label>
                                <div className="course-split-range-fields">
                                    <label><span>DE LA SLIDE</span><input type="number" min="1" value={splitEditor.draftStart} onChange={(event) => setSplitEditor((current) => ({ ...current, draftStart: event.target.value }))} /></label>
                                    <label><span>À LA SLIDE</span><input type="number" min="1" value={splitEditor.draftEnd} onChange={(event) => setSplitEditor((current) => ({ ...current, draftEnd: event.target.value }))} /></label>
                                </div>
                                <div className="course-split-selection">{splitEditor.selectionStart ? `Début choisi : slide ${splitEditor.selectionStart}. Clique la dernière slide.` : 'Clique deux miniatures pour choisir la plage.'}</div>
                                <button type="button" className="course-split-add-button" onClick={addSplitChapter}>{Number.isInteger(splitEditor.editingChapterIndex) ? '✓ ENREGISTRER LES MODIFICATIONS' : '＋ AJOUTER CE CHAPITRE'}</button>
                                {Number.isInteger(splitEditor.editingChapterIndex) && <button type="button" className="course-split-cancel-edit" onClick={clearSplitChapterEditing}>ANNULER LA MODIFICATION</button>}
                                <div className="course-split-chapters">
                                    <div className="course-split-chapters-heading">CHAPITRES AJOUTÉS <strong>{splitEditor.chapters.length}</strong></div>
                                    {splitEditor.chapters.map((chapter, index) => (
                                        <div key={`${chapter.startSlide}-${chapter.endSlide}`} className={splitEditor.editingChapterIndex === index ? 'selected' : ''} role="button" tabIndex="0" onClick={() => editSplitChapter(chapter, index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') editSplitChapter(chapter, index); }}>
                                            <span><strong>{index + 1}. {chapter.title}</strong><small>Slides {chapter.startSlide}–{chapter.endSlide}</small></span>
                                            <button type="button" onClick={(event) => { event.stopPropagation(); setSplitEditor((current) => ({ ...current, chapters: current.chapters.filter((_item, itemIndex) => itemIndex !== index), editingChapterIndex: current.editingChapterIndex === index ? null : (Number.isInteger(current.editingChapterIndex) && current.editingChapterIndex > index ? current.editingChapterIndex - 1 : current.editingChapterIndex) })); }} aria-label={`Retirer ${chapter.title}`}>×</button>
                                        </div>
                                    ))}
                                </div>
                            </aside>
                        </div>
                        <div className="course-split-actions">
                            <button type="button" className="courses-secondary-button" onClick={() => setSplitEditor(null)} disabled={splittingCourse}>ANNULER</button>
                            <button type="button" className={`courses-save-button ${splittingCourse ? 'is-working' : ''}`} onClick={createSplitCourses} disabled={splittingCourse || splitEditor.chapters.length < 1}>{splittingCourse ? 'CRÉATION GOOGLE SLIDES EN COURS…' : splitEditor.chapters.length ? `CRÉER ${splitEditor.chapters.length} PRÉSENTATION${splitEditor.chapters.length > 1 ? 'S' : ''}` : 'AJOUTE UN CHAPITRE CI-DESSUS'}</button>
                        </div>
                    </div>
                </div>
            )}
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
                    <>
                    {activeCourses.length > 0 && (
                        <section className="active-course-shelf" aria-label="Présentations actives">
                            <div className="active-course-shelf-heading">
                                <span>●</span>
                                <strong>PRÉSENTATIONS ACTIVES</strong>
                                <small>{activeCourses.length}</small>
                            </div>
                            <div className="active-course-shelf-list">
                                {activeCourses.map((course) => (
                                    <div className="active-course-shelf-item" key={course._id}>
                                        <button type="button" className="active-course-present" onClick={() => openPresentation(course)}>
                                            <span>{course.title}</span>
                                            <strong>PRÉSENTER</strong>
                                        </button>
                                        <button type="button" className="active-course-disable" onClick={() => toggleCourseEnabled(course)} title="Inactiver cette présentation" aria-label={`Inactiver ${course.title}`}>×</button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                    <div className="course-sections-stack">
                        {[{ _id: '', name: 'SANS SECTION' }, ...[...courseSections].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', { numeric: true, sensitivity: 'base' })), { _id: 'sources', name: 'SOURCES' }].map((section) => {
                            const sectionId = String(section._id || '');
                            const rows = courses
                                .filter((course) => String(course.courseSectionId || '') === sectionId)
                                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
                            const normalizedSectionName = String(section.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
                            const sectionStateKey = sectionId || 'unsectioned';
                            const isOpen = openCourseSections[sectionStateKey] === true;
                            if (normalizedSectionName === 'HISTOIRE' && rows.length === 0) return null;
                            if (!sectionId && rows.length === 0 && courseSections.length > 0) return null;
                            if (sectionId === 'sources' && rows.length === 0) return null;
                            return <section
                                key={sectionId || 'unsectioned'}
                                className={`course-drop-section ${draggedCourseId ? 'is-dragging' : ''}`}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => { event.preventDefault(); moveCourseToSection(draggedCourseId, sectionId); }}
                            >
                                <button type="button" className={`course-section-heading ${sectionId === 'sources' && rows.some((row) => Number(row.uncoveredSlideCount || 0) > 0) ? 'has-uncovered-slides' : ''}`} onClick={() => setOpenCourseSections((current) => ({ ...current, [sectionStateKey]: !isOpen }))} aria-expanded={isOpen}>
                                    <span className="course-section-folder">{isOpen ? '📂' : '📁'}</span><strong>{section.name}</strong><small>{rows.length} présentation{rows.length > 1 ? 's' : ''}</small><span className="course-section-chevron">{isOpen ? '⌃' : '⌄'}</span>
                                </button>
                                {isOpen && <div className="courses-grid courses-grid-compact">{rows.map((course) => (
                            <article
                                className={`course-compact-row ${course.isSourcePresentation && Number(course.uncoveredSlideCount || 0) > 0 ? 'source-has-gaps' : ''}`}
                                key={course._id}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    const draggedId = event.dataTransfer.getData('text/plain') || draggedCourseId;
                                    const bounds = event.currentTarget.getBoundingClientRect();
                                    reorderCourse(draggedId, course, event.clientY > bounds.top + bounds.height / 2);
                                }}
                            >
                                <span className="course-drag-handle" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(course._id)); setDraggedCourseId(String(course._id)); }} onDragEnd={() => setDraggedCourseId('')} title="Glisser pour réordonner ou changer de section">⋮⋮</span>
                                <div className="course-compact-copy">
                                    <input
                                        className="course-inline-title"
                                        defaultValue={course.title}
                                        key={`${course._id}-${course.title}`}
                                        aria-label="Nom de la présentation"
                                        onBlur={(event) => updateCourseTitle(course, event.target.value)}
                                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                                    />
                                    {!course.isSourcePresentation && <textarea
                                        className="course-inline-description"
                                        defaultValue={course.description || ''}
                                        key={`${course._id}-${course.description || 'empty'}`}
                                        aria-label="Informations complémentaires"
                                        placeholder="Notes facultatives…"
                                        title="Notes facultatives — ce champ peut rester vide"
                                        rows="2"
                                        onBlur={(event) => updateCourseDescription(course, event.target.value)}
                                    />}
                                    {course.isSourcePresentation && Number(course.uncoveredSlideCount || 0) > 0 && <small className="course-source-warning">{course.uncoveredSlideCount} slide{course.uncoveredSlideCount > 1 ? 's' : ''} hors chapitre</small>}
                                </div>
                                <div className="course-compact-actions">
                                    {!course.isSourcePresentation && <button type="button" className="course-present-button" onClick={() => openPresentation(course)}>PRÉSENTER</button>}
                                    {!course.isSourcePresentation && <button type="button" onClick={() => openModification(course)}>MODIFIER</button>}
                                    {!course.isSourcePresentation && <button type="button" className={`course-enabled-button ${course.isEnabled !== false ? 'active' : ''}`} onClick={() => toggleCourseEnabled(course)} title={course.isEnabled !== false ? 'Masquer cette présentation aux élèves' : 'Rendre cette présentation visible aux élèves'}>{course.isEnabled !== false ? 'ACTIF' : 'INACTIF'}</button>}
                                    {course.isSourcePresentation && <button type="button" className="course-present-button" onClick={() => openCourseSplitter(course)}>↻ METTRE À JOUR</button>}
                                    <button type="button" className="course-source-pencil" onClick={() => changeCourseSource(course)} title="Modifier la source Google Slides" aria-label="Modifier la source Google Slides">✏️</button>
                                    <button className="course-delete-x" type="button" onClick={() => deleteCourse(course)} aria-label={`Supprimer ${course.title}`}>×</button>
                                </div>
                            </article>
                                ))}{rows.length === 0 && <div className="course-section-empty">Glisse une présentation ici</div>}</div>}
                            </section>;
                        })}
                    </div>
                    </>
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
                                : `${getEditUrl(playingCourse.slidesUrl)}?usp=sharing&editor=${playingCourse.editorNonce || Date.now()}`}
                            allowFullScreen
                        />
                        {projectedControl && <div className="course-control-projection">
                            <button type="button" className="course-control-close" onClick={() => setProjectedControl(null)}>×</button>
                            <div className="course-control-qr">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(`https://condaweb.vercel.app/?control=${projectedControl._id}`)}`} alt="QR code du contrôle"/>
                                <strong>SCANNE POUR COMMENCER</strong>
                                <a href={`/?control=${projectedControl._id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black underline text-violet-700 hover:text-violet-900 mt-1">
                                    ↗ Ouvrir le contrôle
                                </a>
                            </div>
                            <div className="course-control-paper"><h1>{projectedControl.title}</h1>{(projectedControl.items || []).map((item, index) => <article key={item.id}><small>{index + 1} · {item.lessonTitle}</small><div>{String(item.prompt || '').replace(/["“«][^"”»]+["”»]/g, '__________')}</div>{item.type === 'qcm' && <ol type="A">{item.choices.map(choice => <li key={choice}>{choice}</li>)}</ol>}</article>)}</div>
                        </div>}
                        
                        {/* COMPTEUR DE POINTS DE LA CLASSE EN HAUT A DROITE */}
                        <div className="live-class-points">
                            🏆 Score Classe : {classPoints} pts
                        </div>

                        {visibleDebtStudents.length > 0 && (
                            <div className="course-debt-panel">
                                <div className="course-debt-title">À régler</div>
                                {visibleDebtStudents.map((student) => (
                                    <div key={student.id} className={`course-debt-name ${student.status || 'incomplete'}`}>
                                        <span>{student.status === 'punishment' ? 'Punition · ' : student.status === 'warning' ? 'Avertissement · ' : 'Travail incomplet · '}{student.name}</span>
                                        <button type="button" onClick={() => dismissDebtForCurrentHour(student.id)} title="Masquer jusqu’à la prochaine heure" aria-label={`Masquer ${student.name} jusqu’à la prochaine heure`}>×</button>
                                    </div>
                                ))}
                            </div>
                        )}

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
                            onClick={() => playerMode === 'presentation' ? openModification(playingCourse) : setPlayerMode('presentation')}
                        >{playerMode === 'presentation' ? '✏️ PASSER EN MODE MODIFIER' : '▶ PASSER EN MODE LECTURE'}</button>
                        <div className="course-add-wrap"><button type="button" className="course-animation-button" onClick={() => setAddMenuOpen(value => !value)}>＋ AJOUTER</button>{addMenuOpen && <div className="course-add-menu"><button onClick={openMascotAnimationStudio}>🎭 Animation</button><button onClick={openControlOnCourse}>📝 Contrôle + QR code</button></div>}</div>
                    </div>
                </div>
            )}
            {animationEditor && (
                <div className="course-animation-editor-backdrop" role="dialog" aria-modal="true" aria-label="Créateur de mascotte animée">
                    <div className="course-animation-editor-window">
                        <div className="course-animation-editor-heading">
                            <div><strong>ANIMATION — SLIDE {animationEditor.slideNumber}</strong><span>{animationEditor.course.title}</span></div>
                            <button type="button" onClick={() => !savingAnimation && setAnimationEditor(null)} aria-label="Fermer">×</button>
                        </div>
                        <iframe ref={animationFrameRef} src={animationEditor.studioUrl} title="Éditeur de mascotte animée" allow="microphone; clipboard-read; clipboard-write" />
                        <div className="course-animation-editor-actions">
                            <button type="button" className="courses-secondary-button" onClick={() => setAnimationEditor(null)} disabled={savingAnimation}>ANNULER</button>
                            <button type="button" className="courses-save-button" onClick={saveMascotAnimation} disabled={savingAnimation || !animationEditor.animationBlock}>{savingAnimation ? 'ENREGISTREMENT…' : 'ENREGISTRER L’ANIMATION'}</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
