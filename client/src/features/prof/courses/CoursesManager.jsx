import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './CoursesManager.css';
import SharedVideoSequenceEditor from '../learning/SharedVideoSequenceEditor';

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

const getPresentUrl = (value = '') => {
    const id = extractPresentationId(value);
    return id
        ? `https://docs.google.com/presentation/d/${encodeURIComponent(id)}/present?start=false&loop=false&delayms=3000&rm=minimal`
        : '';
};

const getEditUrl = (value = '') => {
    const id = extractPresentationId(value);
    return id
        ? `https://docs.google.com/presentation/d/${encodeURIComponent(id)}/edit`
        : '';
};

const getYoutubeVideoId = (value = '') => {
    const text = String(value || '').trim();
    try {
        const url = new URL(text);
        if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
        if (url.hostname.includes('youtube.com')) return url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || '';
    } catch (_) { }
    return '';
};

const getYoutubeEmbedUrl = (value = '') => {
    const id = getYoutubeVideoId(value);
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1` : '';
};

function YoutubeSequencePlayer({ video, playVersion, isVisible = true, autoplayOnMount = false, onEnded, onBufferProgress }) {
    const [hasStarted, setHasStarted] = useState(false);
    const hostRef = useRef(null);
    const playerRef = useRef(null);
    const readyRef = useRef(false);
    const bufferTimerRef = useRef(null);
    const currentVideoIdRef = useRef('');
    const isVisibleRef = useRef(isVisible);
    isVisibleRef.current = isVisible;
    const mountedPlayVersionRef = useRef(autoplayOnMount ? Number(playVersion || 0) - 1 : Number(playVersion || 0));
    const requestedPlayVersionRef = useRef(Number(playVersion || 0));
    const endTimerRef = useRef(null);
    const finishedRef = useRef(false);
    const playAuthorizedRef = useRef(false);
    const monitorEndRef = useRef(() => {});

    useEffect(() => {
        let cancelled = false;
        const stopEndTimer = () => {
            if (endTimerRef.current) window.clearInterval(endTimerRef.current);
            endTimerRef.current = null;
        };
        const stopBufferTimer = () => {
            if (bufferTimerRef.current) window.clearInterval(bufferTimerRef.current);
            bufferTimerRef.current = null;
        };
        const finishAtLastFrame = (player) => {
            if (finishedRef.current || !playAuthorizedRef.current || !isVisibleRef.current) return;
            finishedRef.current = true;
            playAuthorizedRef.current = false;
            stopEndTimer();
            try { player?.pauseVideo?.(); } catch (_) { }
            onEnded?.();
        };
        const monitorEnd = (player) => {
            stopEndTimer();
            endTimerRef.current = window.setInterval(() => {
                try {
                    const configuredEnd = Math.max(0, Number(video?.endSec || 0));
                    const naturalEnd = Math.max(0, Number(player?.getDuration?.() || 0));
                    const boundary = configuredEnd > 0 ? configuredEnd : naturalEnd;
                    if (boundary > 0 && Number(player?.getCurrentTime?.() || 0) >= boundary - 0.12) finishAtLastFrame(player);
                } catch (_) { }
            }, 60);
        };
        monitorEndRef.current = monitorEnd;
        const startBufferMonitoring = (player) => {
            stopBufferTimer();
            bufferTimerRef.current = window.setInterval(() => {
                try {
                    if (player && typeof player.getVideoLoadedFraction === 'function') {
                        const fraction = player.getVideoLoadedFraction();
                        onBufferProgress?.(fraction);
                    }
                } catch (_) { }
            }, 500);
        };

        const targetVideoId = getYoutubeVideoId(video?.url);
        const startSec = Math.floor(Number(video?.startSec || 0));
        setHasStarted(false);

        // If player already exists, load new video without rebuilding iframe
        if (playerRef.current && readyRef.current && typeof playerRef.current.loadVideoById === 'function') {
            if (currentVideoIdRef.current !== targetVideoId) {
                currentVideoIdRef.current = targetVideoId;
                finishedRef.current = false;
                try {
                    playerRef.current.mute();
                    playerRef.current.loadVideoById({ videoId: targetVideoId, startSeconds: startSec });
                } catch (_) {}
            } else {
                try { playerRef.current.seekTo(startSec, true); } catch (_) {}
            }
            return;
        }

        const create = () => {
            if (cancelled || !hostRef.current || !window.YT?.Player) return;
            try { playerRef.current?.destroy?.(); } catch (_) { }
            currentVideoIdRef.current = targetVideoId;
            playerRef.current = new window.YT.Player(hostRef.current, {
                videoId: targetVideoId,
                playerVars: {
                    autoplay: 0,
                    mute: 1,
                    rel: 0,
                    playsinline: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    start: startSec
                },
                events: {
                    onReady: (event) => {
                        readyRef.current = true;
                        startBufferMonitoring(event.target);
                        // YouTube ne garantit pas un téléchargement intégral en pause. La
                        // disponibilité du lecteur API est donc l'état réellement utile :
                        // il peut recevoir immédiatement la commande Play.
                        onBufferProgress?.(1);
                        if (isVisibleRef.current && requestedPlayVersionRef.current > mountedPlayVersionRef.current) {
                            finishedRef.current = false;
                            playAuthorizedRef.current = true;
                            monitorEnd(event.target);
                            setHasStarted(true);
                            event.target.unMute();
                            event.target.playVideo();
                            mountedPlayVersionRef.current = requestedPlayVersionRef.current;
                        }
                    },
                    onStateChange: (event) => {
                        if (event.data === window.YT.PlayerState.ENDED && playAuthorizedRef.current && isVisibleRef.current) finishAtLastFrame(event.target);
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            if (!isVisibleRef.current) {
                                try {
                                    event.target.pauseVideo();
                                    event.target.seekTo(startSec, true);
                                } catch (_) {}
                            }
                            try { onBufferProgress?.(event.target.getVideoLoadedFraction?.() || 0.25); } catch (_) { }
                        }
                        if (event.data === window.YT.PlayerState.BUFFERING) {
                            try { onBufferProgress?.(event.target.getVideoLoadedFraction?.() || 0.1); } catch (_) { }
                        }
                    }
                }
            });
        };

        if (window.YT?.Player) create();
        else {
            const previous = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { previous?.(); create(); };
            if (!document.querySelector('script[data-conda-youtube-api]')) {
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                script.dataset.condaYoutubeApi = '1';
                document.head.appendChild(script);
            }
        }

        return () => {
            cancelled = true;
            stopEndTimer();
            stopBufferTimer();
        };
    }, [video?.url, video?.startSec]);

    useEffect(() => {
        if (!readyRef.current || !playerRef.current) return;
        if (!isVisible) {
            try {
                playerRef.current.mute();
                playerRef.current.pauseVideo();
            } catch (_) { }
            playAuthorizedRef.current = false;
            if (endTimerRef.current) window.clearInterval(endTimerRef.current);
            endTimerRef.current = null;
        } else {
            try {
                playerRef.current.unMute();
            } catch (_) { }
        }
    }, [isVisible]);

    useEffect(() => {
        const nextVersion = Number(playVersion || 0);
        if (nextVersion <= mountedPlayVersionRef.current) return;
        requestedPlayVersionRef.current = nextVersion;
        finishedRef.current = false;
        if (readyRef.current && isVisible) {
            try {
                playAuthorizedRef.current = true;
                monitorEndRef.current(playerRef.current);
                setHasStarted(true);
                playerRef.current.unMute();
                playerRef.current.playVideo();
                mountedPlayVersionRef.current = nextVersion;
            } catch (_) { }
        }
    }, [playVersion, isVisible]);

    const thumbnailUrl = getYoutubeVideoId(video?.url)
        ? `https://i.ytimg.com/vi/${encodeURIComponent(getYoutubeVideoId(video.url))}/maxresdefault.jpg`
        : '';
    return <div className={`course-youtube-player ${hasStarted ? 'has-started' : ''}`}>
        {thumbnailUrl && <img className="course-youtube-clean-poster" src={thumbnailUrl} alt="" draggable="false" />}
        <div className="course-youtube-player-host" ref={hostRef} />
    </div>;
}

const normalizeVideoScenes = (course = {}) => {
    const savedScenes = Array.isArray(course.presentationVideoScenes) ? course.presentationVideoScenes : [];
    if (savedScenes.length) return savedScenes.map((scene, sceneIndex) => ({
        id: String(scene?.id || `scene_${sceneIndex}`), name: String(scene?.name || `Scène ${sceneIndex + 1}`),
        sequences: Array.isArray(scene?.sequences) ? scene.sequences.map((item) => ({ ...item })) : []
    }));
    const legacy = Array.isArray(course.presentationVideoSequences) ? course.presentationVideoSequences : [];
    return [{ id: `scene_${Date.now()}`, name: 'Scène 1', sequences: legacy.map((item) => ({ ...item })) }];
};

const normalizeVideoSlides = (course = {}) => {
    const saved = Array.isArray(course.presentationVideoSlides) ? course.presentationVideoSlides : [];
    if (saved.length) return saved.map((slide, index) => ({ slideNumber: Math.max(1, Number(slide?.slideNumber || index + 1)), scenes: normalizeVideoScenes({ presentationVideoScenes: slide?.scenes }) }));
    return [{ slideNumber: 1, scenes: normalizeVideoScenes(course) }];
};

const groupSceneSequences = (scene = {}) => {
    return (Array.isArray(scene?.sequences) ? scene.sequences : []).map((video) => [video]);
};

const getScenesForSlide = (slides = [], slideNumber = 1) => {
    const rows = Array.isArray(slides) ? slides : [];
    const exact = rows.find((slide) => Number(slide?.slideNumber) === Number(slideNumber));
    const exactHasSequences = Array.isArray(exact?.scenes)
        && exact.scenes.some((scene) => Array.isArray(scene?.sequences) && scene.sequences.length > 0);
    if (exactHasSequences) return exact.scenes;
    // Compatibilité avec l'ancien séquenceur qui enregistrait toujours sous
    // SLIDE 1, même lorsqu'il était ouvert depuis une autre diapo.
    const configured = rows.filter((slide) => Array.isArray(slide?.scenes)
        && slide.scenes.some((scene) => Array.isArray(scene?.sequences) && scene.sequences.length > 0));
    if (configured.length === 1 && Number(configured[0]?.slideNumber) === 1) return configured[0].scenes;
    return Array.isArray(exact?.scenes) ? exact.scenes : [];
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
    const [liveClock, setLiveClock] = useState(() => Date.now());
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
    const [videoSequencer, setVideoSequencer] = useState(null);
    const [uploadingSequenceVideos, setUploadingSequenceVideos] = useState(false);
    const [draggedSequence, setDraggedSequence] = useState(null);
    const [youtubeDrafts, setYoutubeDrafts] = useState({});
    const [sequenceCutEditor, setSequenceCutEditor] = useState(null);
    const [sequenceCutPlayhead, setSequenceCutPlayhead] = useState(0);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [projectedControl, setProjectedControl] = useState(null);
    const [presentationRemote, setPresentationRemote] = useState(null);
    const [slideManifest, setSlideManifest] = useState([]);
    const [playingVideoIndex, setPlayingVideoIndex] = useState(0);
    const [heldProjectedVideo, setHeldProjectedVideo] = useState(null);
    const [projectedClassPlan, setProjectedClassPlan] = useState(null);
    const animationFrameRef = useRef(null);
    const sequenceVideoRef = useRef(null);
    const sequenceCutVideoRef = useRef(null);
    const coursePlayerRef = useRef(null);
    const completedProjectedVideoRef = useRef('');
    const consumedYoutubePlayVersionRef = useRef(0);
    const isPhone = useMemo(() => /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent || '') || window.innerWidth < 769, []);

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
        } catch (_) { }
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
        const interval = setInterval(fetchLiveStatus, 750);
        return () => clearInterval(interval);
    }, [playingCourse, globalClassId, user.id, user._id]);

    useEffect(() => {
        if (!playingCourse) return undefined;
        const interval = window.setInterval(() => setLiveClock(Date.now()), 200);
        return () => window.clearInterval(interval);
    }, [playingCourse]);

    const isHighlightActive = useMemo(() => {
        if (!liveClassroom?.activeStudentHighlight || !liveClassroom?.activeStudentHighlightTime) return false;
        const highlightTime = new Date(liveClassroom.activeStudentHighlightTime).getTime();
        return (Date.now() - highlightTime) < 6000;
    }, [liveClassroom]);

    const activeScoreAlerts = useMemo(() => (Array.isArray(liveClassroom?.activeScoreAlerts)
        ? liveClassroom.activeScoreAlerts
        : [])
        .filter((row) => {
            const createdAt = new Date(row?.createdAt || 0).getTime();
            return Number.isFinite(createdAt) && liveClock - createdAt >= 0 && liveClock - createdAt < 3000;
        })
        .slice(-6), [liveClassroom?.activeScoreAlerts, liveClock]);

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

    useEffect(() => {
        if (!globalClassId) return undefined;
        const poll = async () => {
            try {
                const response = await fetch(`/api/courses/presentation-remote/active?classId=${encodeURIComponent(globalClassId)}`, { cache: 'no-store' });
                const data = await response.json();
                setPresentationRemote(data?.active ? data : null);
            } catch (_) { }
        };
        poll();
        const interval = window.setInterval(poll, 650);
        return () => window.clearInterval(interval);
    }, [globalClassId]);

    useEffect(() => {
        const projectedClassId = String(presentationRemote?.remote?.classId || globalClassId || '');
        if (isPhone || !projectedClassId || presentationRemote?.remote?.classPlanVisible !== true) {
            setProjectedClassPlan(null);
            return undefined;
        }
        let cancelled = false;
        const loadProjectedClassPlan = async () => {
            try {
                const teacherId = String(user?._id || user?.id || '');
                const [classResponse, planResponse] = await Promise.all([
                    fetch(`/api/classroom/${encodeURIComponent(projectedClassId)}`, { cache: 'no-store' }),
                    fetch(`/api/classroom/plan/${encodeURIComponent(projectedClassId)}${teacherId ? `?teacherId=${encodeURIComponent(teacherId)}` : ''}`, { cache: 'no-store' })
                ]);
                if (!classResponse.ok || !planResponse.ok) throw new Error('Plan indisponible');
                const classInfo = await classResponse.json();
                const students = await planResponse.json();
                if (cancelled) return;
                const list = Array.isArray(students) ? students : [];
                const cols = Math.max(2, Number(classInfo?.layout?.cols || 6));
                const rows = Math.max(2, Number(classInfo?.layout?.rows || 5), Math.ceil(list.length / cols));
                const validSeats = list.filter((student) => Number.isInteger(student?.seatX) && Number.isInteger(student?.seatY)
                    && student.seatX >= 0 && student.seatX < cols && student.seatY >= 0 && student.seatY < rows);
                const uniqueSeats = new Set(validSeats.map((student) => `${student.seatX}-${student.seatY}`));
                const hasMeaningfulPlan = uniqueSeats.size > 1 || list.length <= 1;
                const occupied = new Set();
                const placedIds = new Set();
                const seats = [];
                if (hasMeaningfulPlan) {
                    validSeats.forEach((student) => {
                        const x = student.seatX;
                        const y = student.seatY;
                        const key = `${x}-${y}`;
                        if (occupied.has(key)) return;
                        occupied.add(key);
                        placedIds.add(String(student?._id || ''));
                        seats.push({ student, x, y });
                    });
                }
                let cursor = 0;
                list.filter((student) => !placedIds.has(String(student?._id || '')))
                    .sort((a, b) => {
                        const first = String(a?.firstName || '').localeCompare(String(b?.firstName || ''), 'fr', { sensitivity: 'base' });
                        return first || String(a?.lastName || '').localeCompare(String(b?.lastName || ''), 'fr', { sensitivity: 'base' });
                    })
                    .forEach((student) => {
                        while (cursor < cols * rows && occupied.has(`${cursor % cols}-${Math.floor(cursor / cols)}`)) cursor += 1;
                        if (cursor >= cols * rows) return;
                        const x = cursor % cols;
                        const y = Math.floor(cursor / cols);
                        occupied.add(`${x}-${y}`);
                        seats.push({ student, x, y });
                        cursor += 1;
                    });
                setProjectedClassPlan({ name: classInfo?.name || globalClass || 'Classe', cols, rows, seats });
            } catch (_) {
                if (!cancelled) setProjectedClassPlan({ error: true });
            }
        };
        void loadProjectedClassPlan();
        const planPollInterval = window.setInterval(loadProjectedClassPlan, 1500);
        return () => {
            cancelled = true;
            window.clearInterval(planPollInterval);
        };
    }, [isPhone, globalClassId, globalClass, user?._id, user?.id, presentationRemote?.remote?.classId, presentationRemote?.remote?.classPlanVisible]);

    useEffect(() => {
        if (isPhone || !playingCourse?._id) return undefined;
        fetch(`/api/courses/${playingCourse._id}/presentation-remote/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId: globalClassId, playerMode })
        }).then((response) => response.json()).then((data) => {
            if (!data?.remote) return;
            setPresentationRemote({
                active: true,
                courseId: String(playingCourse._id),
                title: playingCourse.title,
                videoSlides: data.videoSlides || playingCourse.presentationVideoSlides || [],
                scenes: data.scenes || playingCourse.presentationVideoScenes || [],
                sequences: data.sequences || playingCourse.presentationVideoSequences || [],
                remote: data.remote
            });
        }).catch(() => { });
        fetch('/api/learning/slides/manifest', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presentationUrl: playingCourse.slidesUrl, includeThumbnails: false })
        }).then((response) => response.json()).then((data) => setSlideManifest(Array.isArray(data?.slides) ? data.slides : [])).catch(() => setSlideManifest([]));
        return undefined;
    }, [isPhone, playingCourse?._id, playingCourse?.slidesUrl, globalClassId]);

    const sendPresentationCommand = async (action, options = {}, remoteData = presentationRemote) => {
        const courseId = String(remoteData?.courseId || playingCourse?._id || '');
        if (!courseId) return;
        if (['play', 'slide_previous', 'slide_next', 'sequence_previous', 'sequence_next', 'sequence_select', 'scene_previous', 'scene_next', 'scene_select', 'sync'].includes(action)) {
            setHeldProjectedVideo(null);
        }
        const slideIndex = Math.max(0, Number(remoteData?.remote?.slideIndex || 0));
        const localVideoSlides = playingCourse?._id ? normalizeVideoSlides(playingCourse) : [];
        const videoSlides = localVideoSlides.length ? localVideoSlides : (remoteData?.videoSlides?.length ? remoteData.videoSlides : []);
        const scenes = getScenesForSlide(videoSlides, slideIndex + 1);
        const sceneIndex = Math.min(scenes.length - 1, Math.max(0, Number(remoteData?.remote?.sceneIndex || 0)));
        const sequenceTotal = Math.max(1, Number(options.sequenceTotal || groupSceneSequences(scenes[sceneIndex]).length));
        const response = await fetch(`/api/courses/${courseId}/presentation-remote/command`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...options, slideTotal: Math.max(1, slideManifest.length || 100), sceneTotal: Math.max(1, Number(options.sceneTotal || scenes.length)), sequenceTotal })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) setPresentationRemote((current) => ({ ...(current || remoteData || {}), active: true, courseId, videoSlides, remote: data.remote }));
    };

    const forceSyncRemote = async () => {
        try {
            const classId = globalClassId || presentationRemote?.remote?.classId || '';
            if (classId) {
                const res = await fetch(`/api/courses/presentation-remote/active?classId=${encodeURIComponent(classId)}`, { cache: 'no-store' });
                const data = await res.json();
                if (data?.active) {
                    setPresentationRemote(data);
                    const courseId = data.courseId || playingCourse?._id || '';
                    if (courseId) {
                        const syncResponse = await fetch(`/api/courses/${courseId}/presentation-remote/sync`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                playerMode,
                                slideIndex: projectedSlideIndex,
                                sceneIndex: projectedSceneIndex,
                                sequenceIndex: projectedSequenceIndex
                            })
                        });
                        const syncData = await syncResponse.json().catch(() => ({}));
                        if (syncResponse.ok && syncData?.remote) {
                            setPresentationRemote((current) => ({ ...(current || data), active: true, courseId, remote: syncData.remote }));
                        }
                    }
                }
            }
        } catch (_) { }
    };

    const selectProjectedSlide = async (nextIndex) => {
        const total = Math.max(1, slideManifest.length || 1);
        const slideIndex = Math.min(total - 1, Math.max(0, Math.floor(Number(nextIndex) || 0)));
        await sendPresentationCommand('sync', {
            slideIndex,
            sceneIndex: 0,
            sequenceIndex: 0,
            playerMode
        });
    };

    const renderProjectedClassPlan = () => {
        if (!presentationRemote?.remote?.classPlanVisible) return null;
        return (
            <div className="course-projected-class-plan">
                <button
                    type="button"
                    className="course-projected-plan-close"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setPresentationRemote((current) => current ? {
                            ...current,
                            remote: { ...(current.remote || {}), classPlanVisible: false }
                        } : current);
                        void sendPresentationCommand('class_plan_hide');
                    }}
                    aria-label="Fermer le plan de classe"
                    title="Fermer le plan de classe"
                >×</button>
                {projectedClassPlan?.error ? (
                    <strong className="course-projected-plan-message">PLAN DE CLASSE INDISPONIBLE</strong>
                ) : projectedClassPlan ? (
                    <>
                        <div className="course-projected-plan-header">
                            <div className="course-projected-board-indicator">
                                <span>⬛ TABLEAU & BUREAU DU PROFESSEUR (DEVANT) ⬛</span>
                            </div>
                            <div className="course-projected-plan-title">
                                <strong>{projectedClassPlan.name}</strong>
                                <span className="course-projected-badge">PLAN VU PAR LES ÉLÈVES (MIROIR)</span>
                            </div>
                        </div>

                        <div className="course-projected-plan-orientation-labels">
                            <span>← GAUCHE DES ÉLÈVES</span>
                            <span>DROITE DES ÉLÈVES →</span>
                        </div>

                        <div
                            className="course-projected-plan-grid"
                            style={{
                                gridTemplateColumns: `repeat(${projectedClassPlan.cols}, minmax(0, 1fr))`,
                                gridTemplateRows: `repeat(${projectedClassPlan.rows}, minmax(0, 1fr))`
                            }}
                        >
                            {projectedClassPlan.seats.map(({ student, x, y }) => (
                                <div
                                    className="course-projected-seat"
                                    key={student?._id || `${x}-${y}`}
                                    style={{
                                        gridColumn: projectedClassPlan.cols - x,
                                        gridRow: projectedClassPlan.rows - y
                                    }}
                                >
                                    <strong className="course-projected-seat-name">{String(student?.firstName || student?.name || 'Élève')}</strong>
                                    <small className="course-projected-seat-last">{String(student?.lastName || '').slice(0, 1)}{student?.lastName ? '.' : ''}</small>
                                </div>
                            ))}
                        </div>

                        <div className="course-projected-back-indicator">
                            <span>FOND DE LA CLASSE (DERRIÈRE)</span>
                        </div>
                    </>
                ) : (
                    <strong className="course-projected-plan-message">CHARGEMENT DU PLAN…</strong>
                )}
            </div>
        );
    };

    const closePresentation = () => {
        if (playingCourse?._id && !isPhone) fetch(`/api/courses/${playingCourse._id}/presentation-remote/stop`, { method: 'POST' }).catch(() => { });
        setPlayingCourse(null);
        setPresentationRemote(null);
    };

    const rawVideoSlides = (Array.isArray(playingCourse?.presentationVideoSlides) && playingCourse.presentationVideoSlides.length > 0)
        ? playingCourse.presentationVideoSlides
        : (Array.isArray(presentationRemote?.videoSlides) && presentationRemote.videoSlides.length > 0)
            ? presentationRemote.videoSlides
            : [];
    const projectedVideoSlides = rawVideoSlides.length > 0
        ? normalizeVideoSlides({ presentationVideoSlides: rawVideoSlides })
        : normalizeVideoSlides(playingCourse || {});
    const projectedScenes = getScenesForSlide(projectedVideoSlides, Math.max(0, Number(presentationRemote?.remote?.slideIndex || 0)) + 1);
    const projectedSceneIndex = projectedScenes.length > 0
        ? Math.min(projectedScenes.length - 1, Math.max(0, Number(presentationRemote?.remote?.sceneIndex || 0)))
        : 0;
    const projectedGroups = projectedScenes.length > 0 ? groupSceneSequences(projectedScenes[projectedSceneIndex]) : [];
    const projectedSequenceIndex = projectedGroups.length > 0
        ? Math.max(0, Math.min(projectedGroups.length - 1, Math.max(0, Number(presentationRemote?.remote?.sequenceIndex || 0))))
        : 0;
    const projectedSlideIndex = Math.max(0, Number(presentationRemote?.remote?.slideIndex || 0));
    const projectedVideo = projectedGroups[projectedSequenceIndex]?.[playingVideoIndex] || projectedGroups[projectedSequenceIndex]?.[0];
    const currentPlayVersion = Number(presentationRemote?.remote?.playVersion || 0);
    const visibleProjectedVideo = heldProjectedVideo?.playVersion === currentPlayVersion ? heldProjectedVideo.video : projectedVideo;
    const visibleVideoIsYoutube = visibleProjectedVideo?.sourceType === 'youtube' || getYoutubeVideoId(visibleProjectedVideo?.url);
    const visiblePlaybackKey = `${visibleProjectedVideo?.id || visibleProjectedVideo?.url || ''}:${currentPlayVersion}`;
    const youtubeAutoplayOnMount = Boolean(visibleVideoIsYoutube && currentPlayVersion > consumedYoutubePlayVersionRef.current);

    const lastReportedBufferRef = useRef({});
    useEffect(() => {
        lastReportedBufferRef.current = {};
    }, [playingCourse?._id]);
    const handleItemBufferProgress = useCallback((slideIdx, sceneIdx, seqIdx, fraction) => {
        if (isPhone || !playingCourse?._id) return;
        const pct = Math.min(100, Math.max(0, Math.round((Number(fraction) || 0) * 100)));
        const key = `${slideIdx}_${sceneIdx}_${seqIdx}`;
        const prevPct = lastReportedBufferRef.current[key] ?? -1;
        if (pct > prevPct || prevPct === -1) {
            lastReportedBufferRef.current[key] = pct;
            fetch(`/api/courses/${playingCourse._id}/presentation-remote/buffer-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slideIndex: slideIdx, sceneIndex: sceneIdx, sequenceIndex: seqIdx, bufferPct: pct, isReady: pct >= 65 })
            }).catch(() => {});
        }
    }, [isPhone, playingCourse?._id]);

    const handleNativeItemProgress = useCallback((slideIdx, sceneIdx, seqIdx, event) => {
        const video = event.currentTarget;
        if (!video || !video.duration) return;
        try {
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const fraction = Math.min(1, Math.max(0, bufferedEnd / video.duration));
                handleItemBufferProgress(slideIdx, sceneIdx, seqIdx, fraction);
            }
        } catch (_) { }
    }, [handleItemBufferProgress]);

    const preloadItems = useMemo(() => {
        if (isPhone || !playingCourse?._id || !Array.isArray(projectedScenes) || projectedScenes.length === 0) return [];
        const items = [];
        // 1. All sequences of the current scene (e.g. Scene 1 upon opening the slide)
        const curScene = projectedScenes[projectedSceneIndex];
        if (curScene) {
            const curGroups = groupSceneSequences(curScene);
            curGroups.forEach((group, seqIdx) => {
                const vid = group[0];
                if (vid && (vid.url || vid.id)) {
                    items.push({
                        sceneIndex: projectedSceneIndex,
                        sequenceIndex: seqIdx,
                        slideIndex: projectedSlideIndex,
                        video: vid,
                        isCurrent: seqIdx === projectedSequenceIndex
                    });
                }
            });

        }
        return items;
    }, [isPhone, playingCourse?._id, projectedScenes, projectedSceneIndex, projectedSequenceIndex, projectedSlideIndex]);
    const projectedSlideObjectId = String(slideManifest[projectedSlideIndex]?.objectId || playingCourse?.editSlideObjectId || '').trim();
    const projectedSlidesUrl = projectedSlideObjectId
        ? `${getEmbedUrl(playingCourse?.slidesUrl)}&slide=id.${encodeURIComponent(projectedSlideObjectId)}`
        : getEmbedUrl(playingCourse?.slidesUrl);
    const editSlidesUrl = projectedSlideObjectId
        ? `${getEditUrl(playingCourse?.slidesUrl)}?usp=sharing&editor=${playingCourse?.editorNonce || 0}#slide=id.${encodeURIComponent(projectedSlideObjectId)}`
        : `${getEditUrl(playingCourse?.slidesUrl)}?usp=sharing&editor=${playingCourse?.editorNonce || 0}`;
    const finishProjectedVideo = () => {
        const completionKey = `${projectedSceneIndex}:${projectedSequenceIndex}:${playingVideoIndex}:${projectedVideo?.id || projectedVideo?.url || ''}:${presentationRemote?.remote?.playVersion || 0}`;
        if (completedProjectedVideoRef.current === completionKey) return;
        completedProjectedVideoRef.current = completionKey;
        setHeldProjectedVideo({ video: projectedVideo, playVersion: currentPlayVersion });
        const group = projectedGroups[projectedSequenceIndex] || [];
        if (playingVideoIndex < group.length - 1) setPlayingVideoIndex((index) => index + 1);
        else void sendPresentationCommand('sequence_finished', {
            closeAfterSequence: projectedVideo?.closeAfterSequence === true,
            sequenceTotal: projectedGroups.length,
            sceneTotal: projectedScenes.length
        });
    };

    useEffect(() => {
        completedProjectedVideoRef.current = '';
    }, [projectedSceneIndex, projectedSequenceIndex, playingVideoIndex, projectedVideo?.id, presentationRemote?.remote?.playVersion]);

    useEffect(() => {
        if (youtubeAutoplayOnMount) consumedYoutubePlayVersionRef.current = currentPlayVersion;
    }, [youtubeAutoplayOnMount, currentPlayVersion]);

    useEffect(() => {
        if (isPhone || !playingCourse?._id || playerMode !== 'presentation' || videoSequencer || sequenceCutEditor) return undefined;
        coursePlayerRef.current?.focus();
        const handlePresentationShortcut = (event) => {
            const tag = String(event.target?.tagName || '').toLowerCase();
            if (['input', 'textarea', 'select', 'button'].includes(tag) || event.target?.isContentEditable || event.repeat) return;
            const action = event.key === 'Enter' ? 'animation_toggle'
                : event.code === 'Space' ? 'play'
                    : event.key === 'ArrowLeft' ? 'sequence_previous'
                        : event.key === 'ArrowRight' ? 'sequence_next'
                            : event.key === 'ArrowUp' ? 'scene_previous'
                                : event.key === 'ArrowDown' ? 'scene_next' : '';
            if (!action) return;
            event.preventDefault();
            void sendPresentationCommand(action);
        };
        window.addEventListener('keydown', handlePresentationShortcut, true);
        return () => window.removeEventListener('keydown', handlePresentationShortcut, true);
    }, [isPhone, playingCourse?._id, playerMode, presentationRemote, slideManifest.length, videoSequencer, sequenceCutEditor]);

    useEffect(() => { setPlayingVideoIndex(0); }, [projectedSceneIndex, projectedSequenceIndex]);
    useEffect(() => {
        if (!presentationRemote?.remote?.playVersion || presentationRemote.remote.animationVisible === false) return;
        setPlayingVideoIndex(0);
        window.setTimeout(() => sequenceVideoRef.current?.play().catch(() => { }), 0);
    }, [presentationRemote?.remote?.playVersion]);
    useEffect(() => {
        if (playingVideoIndex > 0) sequenceVideoRef.current?.play().catch(() => { });
    }, [playingVideoIndex]);

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

    const openVideoSequencer = () => {
        setAddMenuOpen(false);
        if (!playingCourse) return;
        setVideoSequencer({
            course: playingCourse,
            activeSlideNumber: projectedSlideIndex + 1,
            slides: normalizeVideoSlides(playingCourse)
        });
    };

    const uploadSequenceVideos = async (fileList, sceneIndex) => {
        const files = Array.from(fileList || []).filter((file) => String(file.type || '').startsWith('video/'));
        if (!files.length) return;
        setUploadingSequenceVideos(true);
        try {
            const uploaded = [];
            for (const file of files) {
                const body = new FormData();
                body.append('file', file);
                const response = await fetch('/api/web5e/presentation-video-upload', { method: 'POST', body });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.url) throw new Error(data.error || `Import impossible : ${file.name}`);
                uploaded.push({ id: `video_${Date.now()}_${uploaded.length}`, name: file.name.replace(/\.mp4$/i, ''), url: data.url, driveFileId: data.driveFileId || '', mergeWithNext: false, closeAfterSequence: false, startSec: 0, endSec: 0 });
            }
            setVideoSequencer((current) => current ? { ...current, slides: current.slides.map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: slide.scenes.map((scene, index) => index === sceneIndex ? { ...scene, sequences: [...scene.sequences, ...uploaded] } : scene) } : slide) } : current);
        } catch (uploadError) {
            setError(uploadError.message);
        } finally {
            setUploadingSequenceVideos(false);
        }
    };

    const addYoutubeSequence = (sceneIndex) => {
        const url = String(youtubeDrafts[sceneIndex] || '').trim();
        const videoId = getYoutubeVideoId(url);
        if (!videoId) { setError('Lien YouTube invalide.'); return; }
        setVideoSequencer((current) => current ? { ...current, slides: (current.slides || []).map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: (slide.scenes || []).map((scene, index) => index === sceneIndex ? { ...scene, sequences: [...(scene.sequences || []), { id: `youtube_${Date.now()}`, name: `YouTube ${videoId}`, url, sourceType: 'youtube', mergeWithNext: false, closeAfterSequence: false, startSec: 0, endSec: 0 }] } : scene) } : slide) } : current);
        setYoutubeDrafts((current) => ({ ...current, [sceneIndex]: '' }));
    };

    const saveVideoSequences = async () => {
        if (!videoSequencer?.course?._id) return;
        setSavingAnimation(true);
        try {
            const response = await fetch(`/api/courses/${videoSequencer.course._id}/video-sequences`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slides: videoSequencer.slides })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Enregistrement impossible');
            setCourses((current) => current.map((course) => String(course._id) === String(data._id) ? mergeCourseForCurrentView(course, data) : course));
            setPlayingCourse((current) => String(current?._id) === String(data._id) ? { ...current, presentationVideoSlides: data.presentationVideoSlides || [] } : current);
            setVideoSequencer(null);
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setSavingAnimation(false);
        }
    };

    const moveSequenceVideo = (targetSceneIndex, targetVideoIndex) => {
        if (!draggedSequence) return;
        setVideoSequencer((current) => {
            if (!current) return current;
            const slides = (current.slides || []).map((slide) => ({ ...slide, scenes: (slide.scenes || []).map((scene) => ({ ...scene, sequences: [...(scene.sequences || [])] })) }));
            const activeSlide = slides.find((slide) => Number(slide.slideNumber) === Number(current.activeSlideNumber));
            const sourceScene = activeSlide?.scenes?.[draggedSequence.sceneIndex];
            const targetScene = activeSlide?.scenes?.[targetSceneIndex];
            if (!sourceScene || !targetScene) return current;
            const [moved] = sourceScene.sequences.splice(draggedSequence.videoIndex, 1);
            if (!moved) return current;
            let insertionIndex = targetVideoIndex;
            if (draggedSequence.sceneIndex === targetSceneIndex && draggedSequence.videoIndex < targetVideoIndex) insertionIndex -= 1;
            targetScene.sequences.splice(Math.max(0, Math.min(insertionIndex, targetScene.sequences.length)), 0, moved);
            return { ...current, slides };
        });
        setDraggedSequence(null);
    };

    const moveSequenceVideoByNumber = (sceneIndex, videoIndex, rawNumber) => {
        const scene = videoSequencerScenes[sceneIndex];
        const total = Array.isArray(scene?.sequences) ? scene.sequences.length : 0;
        if (!total) return;
        const requestedIndex = Math.max(0, Math.min(total - 1, Math.floor(Number(rawNumber || 1)) - 1));
        if (requestedIndex === videoIndex) return;
        setVideoSequencer((current) => {
            if (!current) return current;
            const slides = (current.slides || []).map((slide) => ({ ...slide, scenes: (slide.scenes || []).map((item) => ({ ...item, sequences: [...(item.sequences || [])] })) }));
            const activeSlide = slides.find((slide) => Number(slide.slideNumber) === Number(current.activeSlideNumber));
            const sequences = activeSlide?.scenes?.[sceneIndex]?.sequences;
            if (!sequences?.[videoIndex]) return current;
            const [moved] = sequences.splice(videoIndex, 1);
            sequences.splice(requestedIndex, 0, moved);
            return { ...current, slides };
        });
    };

    const patchSequenceVideo = (sceneIndex, videoIndex, patch) => {
        setVideoSequencer((current) => current ? { ...current, slides: (current.slides || []).map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: (slide.scenes || []).map((scene, sIndex) => sIndex === sceneIndex ? { ...scene, sequences: (scene.sequences || []).map((video, vIndex) => vIndex === videoIndex ? { ...video, ...patch } : video) } : scene) } : slide) } : current);
    };

    const openSequenceCutEditor = (sceneIndex, videoIndex, video) => {
        setSequenceCutPlayhead(Math.max(0, Number(video?.startSec || 0)));
        setSequenceCutEditor({ sceneIndex, videoIndex, video: { ...video } });
    };

    const saveSequenceCut = (nextVideo = sequenceCutEditor?.video) => {
        if (!sequenceCutEditor) return;
        const startSec = Math.max(0, Number(nextVideo?.startSec || 0));
        const rawEnd = Math.max(0, Number(nextVideo?.endSec || 0));
        patchSequenceVideo(sequenceCutEditor.sceneIndex, sequenceCutEditor.videoIndex, { ...nextVideo, startSec, endSec: rawEnd > startSec ? rawEnd : 0 });
        setSequenceCutEditor(null);
    };

    const duplicateSequenceCut = (nextVideo = sequenceCutEditor?.video) => {
        if (!sequenceCutEditor) return;
        setVideoSequencer((current) => current ? { ...current, slides: (current.slides || []).map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: (slide.scenes || []).map((scene, sIndex) => sIndex === sequenceCutEditor.sceneIndex ? { ...scene, sequences: (scene.sequences || []).flatMap((video, vIndex) => vIndex === sequenceCutEditor.videoIndex ? [video, { ...nextVideo, id: `segment_${Date.now()}`, name: `${nextVideo?.name || 'Vidéo'} — nouvelle séquence`, mergeWithNext: false }] : [video]) } : scene) } : slide) } : current);
        setSequenceCutEditor(null);
    };

    const splitSequenceCut = (cutAt) => {
        if (!sequenceCutEditor) return;
        const start = Math.max(0, Number(sequenceCutEditor.video.startSec || 0));
        const oldEnd = Math.max(0, Number(sequenceCutEditor.video.endSec || 0));
        const boundary = Math.max(start + .1, Number(cutAt || 0));
        setVideoSequencer((current) => current ? { ...current, slides: (current.slides || []).map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: (slide.scenes || []).map((scene, sIndex) => sIndex === sequenceCutEditor.sceneIndex ? { ...scene, sequences: (scene.sequences || []).flatMap((video, vIndex) => vIndex === sequenceCutEditor.videoIndex ? [{ ...video, endSec: boundary }, { ...video, id: `segment_${Date.now()}`, name: `${video.name || 'Vidéo'} — suite`, startSec: boundary, endSec: oldEnd, mergeWithNext: false }] : [video]) } : scene) } : slide) } : current);
        setSequenceCutEditor(null);
    };

    const saveAllSequenceCuts = (nextSegments) => {
        if (!sequenceCutEditor || !Array.isArray(nextSegments) || !nextSegments.length) return;
        const sourceUrl = String(sequenceCutEditor.video?.url || '');
        setVideoSequencer((current) => current ? {
            ...current, slides: (current.slides || []).map((slide) => slide.slideNumber === current.activeSlideNumber ? {
                ...slide, scenes: (slide.scenes || []).map((scene, sceneIndex) => {
                    if (sceneIndex !== sequenceCutEditor.sceneIndex) return scene;
                    let inserted = false;
                    const sequences = (scene.sequences || []).flatMap((item) => {
                        if (String(item.url || '') !== sourceUrl) return [item];
                        if (inserted) return [];
                        inserted = true;
                        return nextSegments.map((segment) => ({ ...segment, url: sourceUrl, sourceType: sequenceCutEditor.video.sourceType, driveFileId: sequenceCutEditor.video.driveFileId || segment.driveFileId || '' }));
                    });
                    return { ...scene, sequences: inserted ? sequences : [...sequences, ...nextSegments] };
                })
            } : slide)
        } : current);
        setSequenceCutEditor(null);
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
        if (Math.max(0, Number(course?.publishedUntilSlide || 0)) === 0) {
            updatePublishedUntilSlide(course, 1);
        }
        setPlayerMode('presentation');
        setPlayingCourse(course);
    };

    const openModification = async (course) => {
        setError('');
        const editSlideObjectId = projectedSlideObjectId;
        try {
            const response = await fetch(`/api/courses/${course._id}/editor-access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherEmail: user?.email || user?.mail || '' })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Accès en modification impossible');
            setPlayerMode('edit');
            setPlayingCourse((current) => ({
                ...(current || course),
                slidesUrl: data.editUrl || course.slidesUrl,
                editorNonce: Date.now(),
                editSlideObjectId
            }));
            void sendPresentationCommand('mode_change', {
                playerMode: 'edit',
                slideIndex: projectedSlideIndex,
                sceneIndex: projectedSceneIndex,
                sequenceIndex: projectedSequenceIndex
            });
        } catch (accessError) {
            setError(accessError.message);
            alert(`Impossible d’ouvrir cette présentation en modification : ${accessError.message}`);
        }
    };

    const togglePlayerMode = async () => {
        if (playerMode === 'presentation') {
            await openModification(playingCourse);
        } else {
            setPlayerMode('presentation');
            void sendPresentationCommand('mode_change', {
                playerMode: 'presentation',
                slideIndex: projectedSlideIndex,
                sceneIndex: projectedSceneIndex,
                sequenceIndex: projectedSequenceIndex
            });
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
    const videoSequencerSlide = videoSequencer?.slides?.find((slide) => Number(slide.slideNumber) === Number(videoSequencer.activeSlideNumber));
    const videoSequencerScenes = videoSequencerSlide?.scenes || [];

    if (isPhone) {
        const phoneSlideIndex = Math.max(0, Number(presentationRemote?.remote?.slideIndex || 0));
        const phoneVideoSlides = normalizeVideoSlides({
            presentationVideoSlides: presentationRemote?.videoSlides || [],
            presentationVideoScenes: presentationRemote?.scenes || [],
            presentationVideoSequences: presentationRemote?.sequences || []
        });
        const phoneScenes = getScenesForSlide(phoneVideoSlides, phoneSlideIndex + 1);
        const phoneSceneIndex = Math.max(0, Math.min(phoneScenes.length - 1, Math.max(0, Number(presentationRemote?.remote?.sceneIndex || 0))));
        const phoneGroups = groupSceneSequences(phoneScenes[phoneSceneIndex]);
        const phoneSequenceIndex = Math.min(Math.max(0, phoneGroups.length - 1), Math.max(0, Number(presentationRemote?.remote?.sequenceIndex || 0)));
        return <section className="course-phone-remote">
            {!presentationRemote ? (
                <div className="course-phone-remote-empty">
                    <span>🎬</span>
                    <strong>AUCUNE PRÉSENTATION DE SLIDES ACTIVE</strong>
                    <p>Ouvre un cours sur l’ordinateur du tableau pour piloter les slides en direct.</p>
                </div>
            ) : <>
                <div className="course-phone-remote-head">
                    <div className="course-phone-top-bar">
                        <small>COURS AU TABLEAU · SLIDE {phoneSlideIndex + 1}</small>
                        <button
                            type="button"
                            className="course-phone-sync-btn"
                            onClick={forceSyncRemote}
                            title="Forcer la resynchronisation avec le tableau"
                        >
                            🔄 Synchro
                        </button>
                    </div>
                    <strong>{presentationRemote.title}</strong>
                    {presentationRemote?.remote?.playerMode === 'edit' && (
                        <div className="course-phone-edit-warning">
                            <span>✏️</span>
                            <div>
                                <strong>TABLEAU EN MODE MODIFIER</strong>
                                <small>Édition en cours sur le tableau (Slide {phoneSlideIndex + 1})</small>
                            </div>
                        </div>
                    )}
                    <label>SCÈNES</label>
                    <div className="course-phone-scenes">
                        {phoneScenes.map((scene, index) => <button key={scene.id || index} className={index === phoneSceneIndex ? 'selected' : ''} onClick={() => void sendPresentationCommand('scene_select', { sceneIndex: index })}>{index + 1}</button>)}
                    </div>
                    <label>SÉQUENCES DE LA SCÈNE {phoneSceneIndex + 1}</label>
                    <div className="course-phone-sequences">
                        {phoneGroups.map((group, index) => {
                            const isSelected = index === phoneSequenceIndex;
                            const bufferMap = presentationRemote?.remote?.sequenceBuffers || {};
                            const specificKey = `${phoneSlideIndex}_${phoneSceneIndex}_${index}`;
                            const pct = Math.min(100, Math.max(0, Number(
                                bufferMap[specificKey] ??
                                0
                            )));
                            const isReady = pct >= 65 || (isSelected && presentationRemote?.remote?.isReady === true);
                            const radius = 19;
                            const circ = 2 * Math.PI * radius; // ~119.38
                            const strokeOffset = circ - (circ * pct) / 100;
                            return (
                                <button
                                    key={group[0]?.id || index}
                                    type="button"
                                    className={`course-phone-seq-camembert ${isSelected ? 'selected' : ''} ${isReady ? 'ready' : ''}`}
                                    onClick={() => void sendPresentationCommand('sequence_select', { sequenceIndex: index })}
                                    title={`Séquence ${index + 1} : ${pct}% chargé en mémoire vive ${isReady ? '(Prête)' : ''}`}
                                >
                                    <svg className="seq-camembert-svg" viewBox="0 0 46 46">
                                        <circle cx="23" cy="23" r={radius} className="seq-camembert-track" />
                                        <circle
                                            cx="23"
                                            cy="23"
                                            r={radius}
                                            className={`seq-camembert-progress ${isReady ? 'ready' : ''}`}
                                            style={{
                                                strokeDasharray: circ,
                                                strokeDashoffset: isReady ? 0 : strokeOffset
                                            }}
                                        />
                                    </svg>
                                    <div className="seq-camembert-center">
                                        <span className="seq-camembert-num">{index + 1}</span>
                                        {isReady ? (
                                            <span className="seq-camembert-badge ready">✓</span>
                                        ) : (
                                            <span className="seq-camembert-badge">{pct}%</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div>
                        <span>SCÈNE <b>{phoneSceneIndex + 1}</b></span>
                        <span>SÉQUENCE <b>{phoneSequenceIndex + 1}</b></span>
                    </div>
                </div>
                <div className="course-phone-controls">
                    <button
                        type="button"
                        className="course-phone-resync-action"
                        onClick={forceSyncRemote}
                    >
                        <span>🔄</span>
                        <div className="btn-content">
                            <strong>SYNCHRONISER AVEC LE TABLEAU</strong>
                            <small>Aligner instantanément le téléphone sur la slide et la scène du tableau</small>
                        </div>
                    </button>
                    <button onClick={() => void sendPresentationCommand('slide_previous')}><span>◀</span>Slide précédente</button>
                    <button onClick={() => void sendPresentationCommand('slide_next')}><span>▶</span>Slide suivante</button>
                    <button className={presentationRemote.remote?.animationVisible ? 'active' : ''} onClick={() => void sendPresentationCommand('animation_toggle')}><span>🎞</span>{presentationRemote.remote?.animationVisible ? 'Désactiver animation' : 'Activer animation'}</button>
                    {(() => {
                        const currentBufferKey = `${phoneSlideIndex}_${phoneSceneIndex}_${phoneSequenceIndex}`;
                        const currentBufferPct = Math.min(100, Math.max(0, Number(presentationRemote?.remote?.sequenceBuffers?.[currentBufferKey] ?? 0)));
                        const isCurrentReady = presentationRemote?.remote?.isReady === true || currentBufferPct >= 65;
                        return (
                            <button
                                type="button"
                                className={`play ${isCurrentReady ? 'ready' : 'buffering'}`}
                                onClick={() => void sendPresentationCommand('play')}
                                title={isCurrentReady ? 'Séquence prête en mémoire vive · Lancer' : `Mémoire tampon à ${currentBufferPct}% · Toucher pour forcer`}
                            >
                                <span>{isCurrentReady ? '▶' : '⏳'}</span>
                                {isCurrentReady ? 'Play (Prêt)' : `Chargement (${currentBufferPct}%)`}
                            </button>
                        );
                    })()}
                    <button onClick={() => void sendPresentationCommand('sequence_previous')}><span>⏮</span>Séquence précédente</button>
                    <button onClick={() => void sendPresentationCommand('sequence_next')}><span>⏭</span>Séquence suivante</button>
                </div>
            </>}
        </section>;
    }

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
                <div className="course-player-backdrop" role="dialog" aria-modal="true" aria-label={playingCourse.title} tabIndex={-1} ref={coursePlayerRef}>
                    <div className="course-player-stage">
                        {!presentationRemote?.remote?.classPlanVisible && (
                            <button type="button" className="course-player-close" onClick={closePresentation} aria-label="Fermer la présentation">×</button>
                        )}
                        <iframe
                            title={playingCourse.title}
                            src={playerMode === 'presentation' ? projectedSlidesUrl : editSlidesUrl}
                            allowFullScreen
                        />
                        {projectedGroups.length > 0 && <div className="course-scene-sequence-counter"><b>{projectedSceneIndex + 1}</b><span>{projectedSequenceIndex + 1}</span></div>}
                        {renderProjectedClassPlan()}
                        {preloadItems.length > 0 ? (
                            preloadItems.map((item) => {
                                const heldVideoKey = String(heldProjectedVideo?.video?.id || heldProjectedVideo?.video?.url || '');
                                const itemVideoKey = String(item.video?.id || item.video?.url || '');
                                const hasHeldFrame = Boolean(heldVideoKey && heldProjectedVideo?.playVersion === currentPlayVersion);
                                const isHeldItem = hasHeldFrame && heldVideoKey === itemVideoKey;
                                const isCurrentActive = presentationRemote?.remote?.animationVisible
                                    && (hasHeldFrame ? isHeldItem : item.isCurrent);
                                const isYoutube = item.video?.sourceType === 'youtube' || getYoutubeVideoId(item.video?.url);
                                const itemKey = `${item.slideIndex}_${item.sceneIndex}_${item.sequenceIndex}_${item.video?.id || item.video?.url || ''}`;
                                return (
                                    <div
                                        key={itemKey}
                                        className={`course-sequence-video-layer ${isCurrentActive ? 'active' : 'prewarming'}`}
                                    >
                                        {isYoutube ? (
                                            <YoutubeSequencePlayer
                                                video={item.video}
                                                playVersion={item.isCurrent ? presentationRemote?.remote?.playVersion : 0}
                                                isVisible={isCurrentActive}
                                                autoplayOnMount={item.isCurrent ? youtubeAutoplayOnMount : false}
                                                onEnded={item.isCurrent ? finishProjectedVideo : undefined}
                                                onBufferProgress={(fraction) => handleItemBufferProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, fraction)}
                                            />
                                        ) : (
                                            <video
                                                ref={item.isCurrent ? sequenceVideoRef : undefined}
                                                src={item.video.url}
                                                playsInline
                                                preload="auto"
                                                muted={!isCurrentActive}
                                                onLoadedMetadata={(event) => {
                                                    event.currentTarget.currentTime = Math.max(0, Number(item.video.startSec || 0));
                                                }}
                                                onLoadedData={() => handleItemBufferProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, .25)}
                                                onCanPlay={() => handleItemBufferProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, .65)}
                                                onCanPlayThrough={() => handleItemBufferProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, 1)}
                                                onProgress={(event) => handleNativeItemProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, event)}
                                                onTimeUpdate={(event) => {
                                                    handleNativeItemProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, event);
                                                    if (item.isCurrent) {
                                                        const end = Math.max(0, Number(item.video.endSec || 0));
                                                        if (end > 0 && event.currentTarget.currentTime >= end) {
                                                            event.currentTarget.pause();
                                                            finishProjectedVideo();
                                                        }
                                                    }
                                                }}
                                                onEnded={item.isCurrent ? finishProjectedVideo : undefined}
                                            />
                                        )}
                                    </div>
                                );
                            })
                        ) : visibleProjectedVideo ? (
                            <div className={`course-sequence-video-layer ${presentationRemote?.remote?.animationVisible ? 'active' : 'prewarming'}`}>
                                {visibleVideoIsYoutube ? (
                                    <YoutubeSequencePlayer
                                        video={visibleProjectedVideo}
                                        playVersion={presentationRemote?.remote?.playVersion}
                                        isVisible={presentationRemote?.remote?.animationVisible === true}
                                        autoplayOnMount={youtubeAutoplayOnMount}
                                        onEnded={finishProjectedVideo}
                                        onBufferProgress={(fraction) => handleItemBufferProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, fraction)}
                                    />
                                ) : (
                                    <video
                                        ref={sequenceVideoRef}
                                        src={visibleProjectedVideo.url}
                                        playsInline
                                        preload="auto"
                                        onLoadedMetadata={(event) => {
                                            event.currentTarget.currentTime = Math.max(0, Number(visibleProjectedVideo.startSec || 0));
                                        }}
                                        onLoadedData={() => handleItemBufferProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, .25)}
                                        onCanPlay={() => handleItemBufferProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, .65)}
                                        onCanPlayThrough={() => handleItemBufferProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, 1)}
                                        onProgress={(event) => handleNativeItemProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, event)}
                                        onTimeUpdate={(event) => {
                                            handleNativeItemProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, event);
                                            const end = Math.max(0, Number(visibleProjectedVideo.endSec || 0));
                                            if (end > 0 && event.currentTarget.currentTime >= end) {
                                                event.currentTarget.pause();
                                                finishProjectedVideo();
                                            }
                                        }}
                                        onEnded={finishProjectedVideo}
                                    />
                                )}
                            </div>
                        ) : null}
                        {projectedControl && <div className="course-control-projection">
                            <button type="button" className="course-control-close" onClick={() => setProjectedControl(null)}>×</button>
                            <div className="course-control-qr">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(`https://condaweb.vercel.app/?control=${projectedControl._id}`)}`} alt="QR code du contrôle" />
                                <strong>SCANNE POUR COMMENCER</strong>
                                <a href={`/?control=${projectedControl._id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black underline text-violet-700 hover:text-violet-900 mt-1">
                                    ↗ Ouvrir le contrôle
                                </a>
                            </div>
                            <div className="course-control-paper"><h1>{projectedControl.title}</h1>{(projectedControl.items || []).map((item, index) => <article key={item.id}><small>{index + 1} · {item.lessonTitle}</small><div>{String(item.prompt || '').replace(/["“«][^"”»]+["”»]/g, '__________')}</div>{item.type === 'qcm' && <ol type="A">{item.choices.map(choice => <li key={choice}>{choice}</li>)}</ol>}</article>)}</div>
                        </div>}

                        {/* COMPTEUR DE POINTS DE LA CLASSE EN HAUT A DROITE */}
                        <div className="live-class-points" title="Score de la classe" aria-label={`Score de la classe : ${classPoints} points`}>
                            <span aria-hidden="true">🏆</span><strong>{classPoints}</strong>
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

                        {activeScoreAlerts.length > 0 && (
                            <div className="live-score-alert-stack" aria-live="polite">
                                {activeScoreAlerts.map((alert, index) => (
                                    <div className="live-score-alert" key={alert?.id || `${alert?.createdAt}-${index}`}>
                                        {alert?.message}
                                    </div>
                                ))}
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

                        <div className="course-player-mode-switch" aria-label="Commandes de la présentation">
                            <div className="course-player-slide-selector" aria-label="Diapo active mémorisée par CondaWeb">
                                <button type="button" onClick={() => void selectProjectedSlide(projectedSlideIndex - 1)} disabled={projectedSlideIndex <= 0} aria-label="Diapo précédente">‹</button>
                                <label>
                                    <span>DIAPO</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max={Math.max(1, slideManifest.length || 1)}
                                        value={projectedSlideIndex + 1}
                                        onChange={(event) => void selectProjectedSlide(Number(event.target.value) - 1)}
                                        onKeyDown={(event) => event.stopPropagation()}
                                        aria-label="Numéro de la diapo active"
                                    />
                                </label>
                                <button type="button" onClick={() => void selectProjectedSlide(projectedSlideIndex + 1)} disabled={projectedSlideIndex >= Math.max(0, slideManifest.length - 1)} aria-label="Diapo suivante">›</button>
                            </div>
                            <button
                                type="button"
                                className={`course-edit-mode-button ${playerMode === 'edit' ? 'active' : ''}`}
                                onClick={() => void togglePlayerMode()}
                            >
                                {playerMode === 'presentation' ? '✎ PASSER EN MODE MODIFIER' : '▶ PASSER EN MODE LECTURE'}
                            </button>
                            <button type="button" className="course-sync-board-button" onClick={() => void forceSyncRemote()} title="Envoyer la diapo CondaWeb active au téléphone">
                                ↻ SYNCHRONISER LE TÉLÉPHONE
                            </button>
                            <div className="course-add-wrap">
                                <button type="button" className="course-animation-button" onClick={() => setAddMenuOpen((current) => !current)}>
                                    ＋ AJOUTER
                                </button>
                                {addMenuOpen && (
                                    <div className="course-add-menu">
                                        <button type="button" onClick={openVideoSequencer}>🎬 AJOUTER UNE ANIMATION</button>
                                        <button type="button" onClick={openControlOnCourse}>📝 AFFICHER UN CONTRÔLE</button>
                                    </div>
                                )}
                            </div>
                        </div>
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
            {videoSequencer && (
                <div className="course-animation-editor-backdrop" role="dialog" aria-modal="true" aria-label="Séquenceur vidéo">
                    <div className="course-video-sequencer-window">
                        <div className="course-animation-editor-heading">
                            <div><strong>SÉQUENCEUR VIDÉO</strong><span>{videoSequencer.course.title}</span></div>
                            <button type="button" onClick={() => !savingAnimation && setVideoSequencer(null)} aria-label="Fermer">×</button>
                        </div>
                        <div className="course-video-sequencer-body">
                            <div className="course-video-editor-help"><strong>✂ ÉDITEUR DE SÉQUENCES</strong><span>Après avoir ajouté une vidéo, clique sur le bouton violet situé sous son aperçu pour choisir précisément son début et sa fin.</span></div>
                            <div className="course-video-slide-tabs">{Array.from({ length: Math.max(1, slideManifest.length || Number(videoSequencer.course.publishedUntilSlide || 1)) }, (_, index) => index + 1).map((number) => <button type="button" className={number === videoSequencer.activeSlideNumber ? 'selected' : ''} key={number} onClick={() => setVideoSequencer((current) => ({ ...current, activeSlideNumber: number, slides: current.slides.some((slide) => Number(slide.slideNumber) === number) ? current.slides : [...current.slides, { slideNumber: number, scenes: [{ id: `scene_${Date.now()}`, name: 'Scène 1', sequences: [] }] }] }))}>SLIDE {number}</button>)}</div>
                            <button type="button" className="course-video-add-scene" onClick={() => setVideoSequencer((current) => ({ ...current, slides: current.slides.map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: [...slide.scenes, { id: `scene_${Date.now()}`, name: `Scène ${slide.scenes.length + 1}`, sequences: [] }] } : slide) }))}>＋ AJOUTER UNE SCÈNE</button>
                            {videoSequencerScenes.map((scene, sceneIndex) => <section className="course-video-scene" key={scene.id}>
                                <div className="course-video-scene-head"><span>{sceneIndex + 1}</span><input value={scene.name} onChange={(event) => setVideoSequencer((current) => ({ ...current, slides: current.slides.map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: slide.scenes.map((item, index) => index === sceneIndex ? { ...item, name: event.target.value } : item) } : slide) }))} /><label className="course-video-upload-button">{uploadingSequenceVideos ? 'IMPORT…' : '＋ MP4'}<input type="file" accept="video/mp4,video/*" multiple hidden disabled={uploadingSequenceVideos} onChange={(event) => void uploadSequenceVideos(event.target.files, sceneIndex)} /></label>{videoSequencerScenes.length > 1 ? <button type="button" className="course-video-delete" onClick={() => setVideoSequencer((current) => ({ ...current, slides: current.slides.map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: slide.scenes.filter((_, index) => index !== sceneIndex) } : slide) }))}>×</button> : null}</div>
                                <div className="course-video-youtube-add"><input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Coller un lien YouTube" value={youtubeDrafts[sceneIndex] || ''} onChange={(event) => setYoutubeDrafts((current) => ({ ...current, [sceneIndex]: event.target.value }))} onPaste={(event) => event.stopPropagation()} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); addYoutubeSequence(sceneIndex); } }} /><button type="button" onClick={() => addYoutubeSequence(sceneIndex)}>＋ AJOUTER LE LIEN</button></div>
                                {scene.sequences.length === 0 ? <div className={`course-video-empty ${draggedSequence ? 'drop-ready' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={() => moveSequenceVideo(sceneIndex, 0)}>Importe les vidéos de cette scène.</div> : null}
                                <div className="course-video-sequence-list">{scene.sequences.map((sequence, index) => <div className={`course-video-sequence-row ${draggedSequence?.sceneIndex === sceneIndex && draggedSequence?.videoIndex === index ? 'dragging' : ''}`} key={sequence.id || index} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={() => moveSequenceVideo(sceneIndex, index)}>
                                    <span className="course-video-drag-handle" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(sequence.id || index)); setDraggedSequence({ sceneIndex, videoIndex: index }); }} onDragEnd={() => setDraggedSequence(null)} title="Glisser pour déplacer">⋮⋮</span><input className="course-video-sequence-number" type="number" min="1" max={scene.sequences.length} defaultValue={index + 1} key={`${sequence.id || index}_${index}`} aria-label={`Position de la vidéo ${index + 1}`} onBlur={(event) => moveSequenceVideoByNumber(sceneIndex, index, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><div className="course-video-media-cell">{sequence.sourceType === 'youtube' || getYoutubeVideoId(sequence.url) ? <iframe src={getYoutubeEmbedUrl(sequence.url)} title={sequence.name || 'Vidéo YouTube'} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <video src={sequence.url} preload="metadata" controls />}<button type="button" className="course-open-sequence-editor" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openSequenceCutEditor(sceneIndex, index, sequence); }}><strong>✂ OUVRIR L’ÉDITEUR</strong><span>{Math.max(0, Number(sequence.startSec || 0))}s → {Number(sequence.endSec || 0) > 0 ? `${Number(sequence.endSec)}s` : 'fin de la vidéo'}</span></button></div>
                                    <input value={sequence.name || ''} onChange={(event) => setVideoSequencer((current) => ({ ...current, slides: (current.slides || []).map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: (slide.scenes || []).map((item, sIndex) => sIndex === sceneIndex ? { ...item, sequences: (item.sequences || []).map((video, vIndex) => vIndex === index ? { ...video, name: event.target.value } : video) } : item) } : slide) }))} />
                                    <label className="course-video-close-after"><input type="checkbox" checked={sequence.closeAfterSequence === true} onChange={(event) => setVideoSequencer((current) => ({ ...current, slides: (current.slides || []).map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: (slide.scenes || []).map((item, sIndex) => sIndex === sceneIndex ? { ...item, sequences: (item.sequences || []).map((video, vIndex) => vIndex === index ? { ...video, closeAfterSequence: event.target.checked } : video) } : item) } : slide) }))} /> Fermer après</label>
                                    <button type="button" className="course-video-delete" onClick={() => setVideoSequencer((current) => ({ ...current, slides: (current.slides || []).map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: (slide.scenes || []).map((item, sIndex) => sIndex === sceneIndex ? { ...item, sequences: (item.sequences || []).filter((_, vIndex) => vIndex !== index) } : item) } : slide) }))}>×</button>
                                </div>)}{scene.sequences.length > 0 ? <div className={`course-video-drop-end ${draggedSequence ? 'active' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={() => moveSequenceVideo(sceneIndex, scene.sequences.length)}>Déposer ici pour placer à la fin</div> : null}</div>
                            </section>)}
                        </div>
                        <div className="course-animation-editor-actions">
                            <button type="button" className="courses-secondary-button" onClick={() => setVideoSequencer(null)} disabled={savingAnimation}>ANNULER</button>
                            <button type="button" className="courses-save-button" onClick={() => void saveVideoSequences()} disabled={savingAnimation || uploadingSequenceVideos}>{savingAnimation ? 'ENREGISTREMENT…' : 'ENREGISTRER LES SÉQUENCES'}</button>
                        </div>
                    </div>
                </div>
            )}
            {sequenceCutEditor && <SharedVideoSequenceEditor
                video={sequenceCutEditor.video}
                siblingSegments={videoSequencerScenes[sequenceCutEditor.sceneIndex]?.sequences || []}
                onClose={() => setSequenceCutEditor(null)}
                onSaveSegments={saveAllSequenceCuts}
            />}
            {(!playingCourse && !isPhone) ? renderProjectedClassPlan() : null}
        </section>
    );
}
