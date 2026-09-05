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

const getGoogleSlidesVideoEmbedUrl = (value = '') => {
    const url = String(value || '').trim();
    const youtubeUrl = getYoutubeEmbedUrl(url);
    if (youtubeUrl) return youtubeUrl;
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('drive.google.com')) {
            const fileId = parsed.pathname.match(/\/d\/([^/]+)/)?.[1] || parsed.searchParams.get('id') || '';
            return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : '';
        }
    } catch (_) { }
    return '';
};

const AUDIO_FILE_PATTERN = /\.(?:mp3|m4a|aac|wav|ogg|oga|flac)(?:[?#].*)?$/i;
const isAudioSequence = (sequence = {}) => (
    String(sequence?.sourceType || '').toLowerCase() === 'audio'
    || String(sequence?.mimeType || '').toLowerCase().startsWith('audio/')
    || AUDIO_FILE_PATTERN.test(String(sequence?.url || sequence?.name || ''))
);

function YoutubeSequencePlayer({ video, playVersion, pauseVersion = 0, isPlaying = false, isVisible = true, autoplayOnMount = false, onEnded, onBufferProgress }) {
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

    useEffect(() => {
        if (!readyRef.current || !playerRef.current || isPlaying) return;
        try { playerRef.current.pauseVideo(); } catch (_) { }
        playAuthorizedRef.current = false;
        if (endTimerRef.current) window.clearInterval(endTimerRef.current);
        endTimerRef.current = null;
    }, [pauseVersion, isPlaying]);

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

const buildSlideTransitionItems = (elements = [], perParagraph = true) => {
    const items = [];
    (Array.isArray(elements) ? elements : []).forEach((el) => {
        if (el.type !== 'text' || !String(el.content || '').trim()) return;
        const rawText = String(el.content).replace(/\r\n?/g, '\n');
        let paragraphs = rawText.split(/[\n\v\u2028\u2029]+/).filter((paragraph) => paragraph.trim());
        // Some Google Slides text runs lose paragraph markers during import.
        // For a numbered list, its numbered starts remain reliable boundaries
        // and let "Par paragraphe" still reveal 1-, 2-, 3- one at a time.
        if (paragraphs.length <= 1) {
            const numberedParagraphs = rawText
                .split(/(?=(?:^|\s)\d{1,2}\s*[-–—.)]\s*)/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean);
            if (numberedParagraphs.length > 1) paragraphs = numberedParagraphs;
        }
        const parts = perParagraph && paragraphs.length > 1 ? paragraphs : [String(el.content).trim()];
        const totalHeight = Number(el.height ?? 0);
        const elementY = Number(el.y ?? el.top ?? 0);
        const elementX = Number(el.x ?? el.left ?? 0);
        const elementWidth = Number(el.width ?? 0);
        parts.forEach((text, paragraphIndex) => {
            const partHeight = perParagraph && paragraphs.length > 1 ? totalHeight / parts.length : totalHeight;
            items.push({
                id: perParagraph && paragraphs.length > 1 ? `${el.id || el.googleObjectId || ''}_p${paragraphIndex}` : String(el.id || el.googleObjectId || ''),
                elementId: String(el.id || el.googleObjectId || ''),
                paragraphIndex,
                text: String(text).trim(),
                left: elementX,
                top: perParagraph && paragraphs.length > 1 ? elementY + (paragraphIndex * partHeight) : elementY,
                width: elementWidth,
                height: partHeight,
                style: el.style || {}
            });
        });
    });
    return items;
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
    const [liveSyncKey, setLiveSyncKey] = useState(Date.now());
    const [slideImageUrl, setSlideImageUrl] = useState('');
    const [renderedSlideIndex, setRenderedSlideIndex] = useState(null);
    const [slideImageLoading, setSlideImageLoading] = useState(false);
    // Keep decoded slide images available while the teacher navigates.  This is
    // deliberately local to the presentation: going back and forth must not
    // wait for a new request to Google Slides.
    const slideImageCacheRef = useRef(new Map());
    const renderedSlideIndexRef = useRef(null);
    const [slideElementsMap, setSlideElementsMap] = useState({});
    const [slideTransitions, setSlideTransitions] = useState({});
    const [diaporamaActive, setDiaporamaActive] = useState(false);
    // Step 1 is the initial state; configured step 2 appears on the first click.
    const [currentDiaporamaStep, setCurrentDiaporamaStep] = useState(1);
    const [transitionEditorOpen, setTransitionEditorOpen] = useState(false);
    const [transitionEditMode, setTransitionEditMode] = useState(false);
    const [savingTransitions, setSavingTransitions] = useState(false);
    const [transitionDraft, setTransitionDraft] = useState({ enabled: true, perParagraph: true, stepsMap: {}, masks: [] });
    const [selectedMaskId, setSelectedMaskId] = useState('');
    const [editingMaskId, setEditingMaskId] = useState('');
    const [maskRevealPixels, setMaskRevealPixels] = useState({});
    const [editSlideNumberDraft, setEditSlideNumberDraft] = useState('');
    const [lastEditSlideNumber, setLastEditSlideNumber] = useState(null);
    const [playingVideoIndex, setPlayingVideoIndex] = useState(0);
    const [heldProjectedVideo, setHeldProjectedVideo] = useState(null);
    const [projectedClassPlan, setProjectedClassPlan] = useState(null);
    const animationFrameRef = useRef(null);
    const sequenceVideoRef = useRef(null);
    const sequenceCutVideoRef = useRef(null);
    const coursePlayerRef = useRef(null);
    const presentationIframeRef = useRef(null);
    const externalSlidesEditorOpenedRef = useRef(false);
    const completedProjectedVideoRef = useRef('');
    const consumedYoutubePlayVersionRef = useRef(0);
    // The class remote is polled every 650ms. Keep a short guard after a local
    // slide change so a poll that started just before the save cannot undo it.
    const pendingSlideSyncRef = useRef(null);
    const slideNavigationLockRef = useRef(null);
    const diaporamaToggleLockRef = useRef(null);
    const slideNavigationVersionRef = useRef(0);
    const slideNavigationQueueRef = useRef(Promise.resolve());
    const maskHoldDelayRef = useRef(null);
    const maskHoldProgressRef = useRef(null);
    const maskHoldCompletedRef = useRef(false);
    const maskHoldActiveRef = useRef(false);
    const maskEditorDragRef = useRef(null);
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
                    fetch(`/api/classroom/${globalClassId}?live=${Date.now()}`, { cache: 'no-store' }),
                    fetch(`/api/classroom/debts/${globalClassId}?teacherId=${encodeURIComponent(teacherId)}&live=${Date.now()}`, { cache: 'no-store' })
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

    const activeScoreAlerts = useMemo(() => {
        const rows = Array.isArray(liveClassroom?.activeScoreAlerts)
            ? [...liveClassroom.activeScoreAlerts]
            : [];
        const fallbackTime = liveClassroom?.activeStudentBonusAlertTime;
        const fallbackMessage = String(liveClassroom?.activeStudentBonusAlert || '').trim();
        if (fallbackTime && fallbackMessage && !rows.some((row) => String(row?.message || '') === fallbackMessage && String(row?.createdAt || '') === String(fallbackTime))) {
            rows.push({ id: `score-fallback-${fallbackTime}`, message: fallbackMessage, createdAt: fallbackTime });
        }
        return rows
        .filter((row) => {
            const createdAt = new Date(row?.createdAt || 0).getTime();
            return Number.isFinite(createdAt) && liveClock - createdAt >= 0 && liveClock - createdAt < 3000;
        })
        .slice(-6);
    }, [liveClassroom?.activeScoreAlerts, liveClassroom?.activeStudentBonusAlert, liveClassroom?.activeStudentBonusAlertTime, liveClock]);

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
        if (!playingCourse?._id) {
            setSlideElementsMap({});
            setSlideTransitions({});
            setDiaporamaActive(false);
            setCurrentDiaporamaStep(1);
            return undefined;
        }
        if (playingCourse.slideTransitions && typeof playingCourse.slideTransitions === 'object') {
            setSlideTransitions(playingCourse.slideTransitions);
        } else {
            setSlideTransitions({});
        }

        fetch(`/api/courses/${playingCourse._id}/slides/native`)
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data?.nativeSlides || data?.slides)) {
                    const list = data.nativeSlides || data.slides;
                    const map = {};
                    list.forEach((s) => {
                        const num = Number(s.slideNumber || 1);
                        map[num] = {
                            elements: Array.isArray(s.elements) ? s.elements : [],
                            backgroundColor: s.background?.color || s.backgroundColor || '#ffffff'
                        };
                    });
                    setSlideElementsMap(map);
                }
            })
            .catch(() => {});
    }, [playingCourse?._id]);

    useEffect(() => {
        if (!globalClassId) return undefined;
        const poll = async () => {
            try {
                const response = await fetch(`/api/courses/presentation-remote/active?classId=${encodeURIComponent(globalClassId)}`, { cache: 'no-store' });
                const data = await response.json();
                if (!data?.active) {
                    setPresentationRemote(null);
                    return;
                }
                setPresentationRemote((current) => {
                    const pending = pendingSlideSyncRef.current;
                    const remoteSlideIndex = Number(data?.remote?.slideIndex || 0);
                    const navigationLock = slideNavigationLockRef.current;
                    if (navigationLock && Date.now() < navigationLock.expiresAt && remoteSlideIndex !== navigationLock.slideIndex) {
                        return current;
                    }
                    if (navigationLock && Date.now() >= navigationLock.expiresAt) {
                        slideNavigationLockRef.current = null;
                    }
                    // Keep the last local target locked until its own queued
                    // command confirms it. An earlier command may temporarily
                    // reach the same slide number, then be followed by another
                    // older request from the queue.
                    if (pending && remoteSlideIndex !== pending.slideIndex) return current;
                    return data;
                });
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

    // Refresh the visible Google Slide while it is being edited in another tab.
    // Returning to CondaWeb also triggers an immediate refresh because browsers
    // may slow timers down in a background tab.
    useEffect(() => {
        if (!playingCourse?._id || isPhone) return undefined;
        const refreshVisibleSlide = () => setLiveSyncKey(Date.now());
        const intervalId = window.setInterval(() => {
            refreshVisibleSlide();
        }, 2000);
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') refreshVisibleSlide();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [playingCourse?._id, isPhone]);



    const sendPresentationCommand = async (action, options = {}, remoteData = presentationRemote) => {
        const courseId = String(remoteData?.courseId || playingCourse?._id || '');
        if (!courseId) return;
        if (['play', 'play_pause', 'animation_hide', 'slide_previous', 'slide_next', 'sequence_previous', 'sequence_next', 'sequence_select', 'scene_previous', 'scene_next', 'scene_select', 'sync'].includes(action)) {
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
            body: JSON.stringify({ action, ...options, slideTotal: Math.max(1, slideManifest.length || 1), sceneTotal: Math.max(1, Number(options.sceneTotal || scenes.length)), sequenceTotal })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) setPresentationRemote((current) => {
            const pending = pendingSlideSyncRef.current;
            const remoteSlideIndex = Number(data?.remote?.slideIndex || 0);
            const navigationVersion = Number(options.localNavigationVersion || 0);
            // Several quick clicks can leave responses arriving out of order.
            // Never let an earlier response replace the most recent selection.
            if (action === 'sync' && navigationVersion && navigationVersion !== slideNavigationVersionRef.current) return current;
            if (action === 'sync' && pending && remoteSlideIndex !== pending.slideIndex) return current;
            if (action === 'sync' && pending && remoteSlideIndex === pending.slideIndex) {
                pendingSlideSyncRef.current = null;
            }
            return { ...(current || remoteData || {}), active: true, courseId, videoSlides, remote: data.remote };
        });
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
        const navigationVersion = slideNavigationVersionRef.current + 1;
        slideNavigationVersionRef.current = navigationVersion;
        pendingSlideSyncRef.current = { slideIndex, requestedAt: Date.now(), navigationVersion };
        slideNavigationLockRef.current = { slideIndex, expiresAt: Date.now() + 2500 };
        // Update the projected view first. The remote command still keeps the
        // phone controller and other connected screens in sync, but should not
        // make the teacher wait for a network round trip to see the next slide.
        setPresentationRemote((current) => current ? {
            ...current,
            remote: {
                ...(current.remote || {}),
                slideIndex,
                sceneIndex: 0,
                sequenceIndex: 0,
                transitionStep: 1,
                playerMode
            }
        } : current);
        if (playerMode === 'edit') {
            const editSlideObjectId = String(slideManifest[slideIndex]?.objectId || '').trim();
            setPlayingCourse((current) => current ? { ...current, editSlideObjectId } : current);
        }
        // Preserve click order on the server. Without this queue, a delayed
        // request for slide 27 can arrive after the request for slide 29 and
        // make the remote state jump backwards once clicking stops.
        const queuedCommand = slideNavigationQueueRef.current
            .catch(() => undefined)
            .then(() => {
                if (navigationVersion !== slideNavigationVersionRef.current) return undefined;
                return sendPresentationCommand('sync', {
                    slideIndex,
                    sceneIndex: 0,
                    sequenceIndex: 0,
                    playerMode,
                    localNavigationVersion: navigationVersion
                });
        });
        slideNavigationQueueRef.current = queuedCommand;
        try {
            await queuedCommand;
        } catch (_) {
            if (navigationVersion === slideNavigationVersionRef.current) {
                pendingSlideSyncRef.current = null;
            }
        }
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
        setSlideImageUrl('');
        setRenderedSlideIndex(null);
        renderedSlideIndexRef.current = null;
        setSlideImageLoading(false);
        slideImageCacheRef.current.clear();
        pendingSlideSyncRef.current = null;
        slideNavigationLockRef.current = null;
        diaporamaToggleLockRef.current = null;
        slideNavigationVersionRef.current += 1;
        slideNavigationQueueRef.current = Promise.resolve();
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
    const projectedSlideObjectId = String(
        slideManifest[projectedSlideIndex]?.objectId || playingCourse?.editSlideObjectId || ''
    ).trim();
    const presentationReloadNonce = Number(playingCourse?.presentationReloadNonce || 0);
    const projectedSlidesUrl = projectedSlideObjectId
        ? `${getEmbedUrl(playingCourse?.slidesUrl)}&slide=id.${encodeURIComponent(projectedSlideObjectId)}&condaReload=${presentationReloadNonce}`
        : `${getEmbedUrl(playingCourse?.slidesUrl)}&condaReload=${presentationReloadNonce}`;
    const editSlidesUrl = useMemo(() => {
        if (!playingCourse?.slidesUrl) return '';
        const base = getEditUrl(playingCourse?.slidesUrl);
        return projectedSlideObjectId
            ? `${base}?rm=minimal#slide=id.${encodeURIComponent(projectedSlideObjectId)}`
            : `${base}?rm=minimal`;
    }, [playingCourse?.slidesUrl, projectedSlideObjectId]);

    // Loads the current image without blanking the previous slide. Adjacent
    // slides are normally already decoded by the preloader below.
    useEffect(() => {
        const presId = extractPresentationId(playingCourse?.slidesUrl);
        if (!presId) return;
        const pageId = String(projectedSlideObjectId || slideManifest[projectedSlideIndex]?.objectId || '').trim();
        const slideNum = projectedSlideIndex + 1;
        const cacheKey = `${presId}:${pageId}:${slideNum}`;
        // `force=1` bypasses the server thumbnail cache: edits made in another
        // Google Slides tab therefore appear on the projected slide within 2s.
        const targetUrl = `/api/learning/slides/thumbnail?presentationId=${encodeURIComponent(presId)}&pageObjectId=${encodeURIComponent(pageId)}&slideNumber=${slideNum}&force=1&refresh=${liveSyncKey}`;
        const cachedUrl = slideImageCacheRef.current.get(cacheKey);
        const commitVisibleSlide = (url) => {
            // Reset transition state in the same React update as the visual
            // switch. Resetting it in an effect happens one paint too late and
            // briefly exposes masks from the previous slide.
            if (renderedSlideIndexRef.current !== projectedSlideIndex) {
                setCurrentDiaporamaStep(1);
                setMaskRevealPixels({});
            }
            renderedSlideIndexRef.current = projectedSlideIndex;
            setSlideImageUrl(url);
            setRenderedSlideIndex(projectedSlideIndex);
        };
        if (cachedUrl) {
            commitVisibleSlide(cachedUrl);
        }

        let isCancelled = false;
        setSlideImageLoading(true);
        const img = new Image();
        img.src = targetUrl;
        img.onload = () => {
            if (!isCancelled) {
                slideImageCacheRef.current.set(cacheKey, targetUrl);
                commitVisibleSlide(targetUrl);
                setSlideImageLoading(false);
            }
        };
        img.onerror = () => {
            if (!isCancelled) {
                setSlideImageLoading(false);
            }
        };
        return () => { isCancelled = true; };
    }, [playingCourse?.slidesUrl, projectedSlideIndex, projectedSlideObjectId, slideManifest, liveSyncKey]);

    // Keep the old image and its masks together until the next slide image has
    // been decoded. This prevents masks from flashing on the wrong slide.
    const visibleSlideIndex = renderedSlideIndex === null ? projectedSlideIndex : renderedSlideIndex;
    const isSlideSwitching = visibleSlideIndex !== projectedSlideIndex;
    const currentSlideNumber = visibleSlideIndex + 1;
    const currentSlideData = slideElementsMap[currentSlideNumber];
    const currentSlideElements = currentSlideData?.elements || [];
    const currentSlideBgColor = currentSlideData?.backgroundColor || '#ffffff';
    const currentSlideTransition = slideTransitions[currentSlideNumber] || null;
    const transitionsEnabled = currentSlideTransition?.enabled !== false;

    const currentSlideTransitionItems = useMemo(
        () => buildSlideTransitionItems(currentSlideElements, currentSlideTransition?.perParagraph !== false),
        [currentSlideElements, currentSlideTransition?.perParagraph]
    );
    const editorTransitionItems = useMemo(
        () => buildSlideTransitionItems(currentSlideElements, transitionDraft.perParagraph !== false),
        [currentSlideElements, transitionDraft.perParagraph]
    );

    // Compute max steps for current slide
    const maxSlideSteps = useMemo(() => {
        const steps = currentSlideTransition?.steps;
        return Math.max(1, ...currentSlideTransitionItems.map((_item, index) => index + 2), ...(Array.isArray(steps) ? steps : []).map((s) => Number(s.step) || 1), ...(currentSlideTransition?.masks || []).map((mask) => Number(mask.step) || 1));
    }, [currentSlideTransition?.masks, currentSlideTransition?.steps, currentSlideTransition?.useCustomMasks, currentSlideTransitionItems]);

    const currentSlideMasks = useMemo(() => {
        const usesCustomMasks = currentSlideTransition?.useCustomMasks === true;
        const textMasks = usesCustomMasks ? [] : currentSlideTransitionItems.map((item, index) => {
            const stepConf = (currentSlideTransition?.steps || []).find((step) => (step.elementIds || []).includes(item.id));
            return { id: `text-${item.id}`, number: index + 1, step: Number(stepConf?.step || index + 2), x: item.left, y: item.top, width: item.width, height: item.height };
        });
        const manualMasks = (Array.isArray(currentSlideTransition?.masks) ? currentSlideTransition.masks : []).map((mask, index) => ({
            id: String(mask.id || `manual-${index}`), number: textMasks.length + index + 1,
            step: Math.max(1, Number(mask.step) || 1),
            x: Math.max(0, Number(mask.x) || 0),
            y: Math.max(0, Number(mask.y) || 0),
            width: Math.max(1, Number(mask.width) || 1),
            height: Math.max(1, Number(mask.height) || 1)
        }));
        return [...textMasks, ...manualMasks];
    }, [currentSlideTransition?.masks, currentSlideTransition?.steps, currentSlideTransitionItems]);
    const nextMaskedStep = useMemo(() => {
        const pendingSteps = currentSlideMasks
            .filter((mask) => mask.step > currentDiaporamaStep)
            .map((mask) => mask.step);
        return pendingSteps.length ? Math.min(...pendingSteps) : null;
    }, [currentDiaporamaStep, currentSlideMasks]);

    const advanceDiaporama = useCallback(() => {
        if (isSlideSwitching) return;
        if (transitionsEnabled && nextMaskedStep !== null) {
            const nextStep = nextMaskedStep;
            setCurrentDiaporamaStep(nextStep);
            setPresentationRemote((current) => current ? {
                ...current,
                remote: { ...(current.remote || {}), transitionStep: nextStep }
            } : current);
            sendPresentationCommand('transition_next', { step: nextStep }).catch(() => {});
        } else {
            const total = Math.max(1, slideManifest.length || 1);
            if (projectedSlideIndex < total - 1) {
                void selectProjectedSlide(projectedSlideIndex + 1);
            }
        }
    }, [isSlideSwitching, transitionsEnabled, nextMaskedStep, slideManifest.length, projectedSlideIndex, selectProjectedSlide, sendPresentationCommand]);

    const stopMaskHold = useCallback((advanceShortPress = false) => {
        if (maskHoldDelayRef.current) window.clearTimeout(maskHoldDelayRef.current);
        if (maskHoldProgressRef.current) window.clearInterval(maskHoldProgressRef.current);
        const wasHolding = maskHoldActiveRef.current;
        maskHoldDelayRef.current = null;
        maskHoldProgressRef.current = null;
        maskHoldActiveRef.current = false;
        // A long press deliberately keeps the partially revealed mask where it
        // is. A short press always removes the active mask (or changes slide).
        if (advanceShortPress && !wasHolding && !maskHoldCompletedRef.current) {
            maskHoldCompletedRef.current = true;
            advanceDiaporama();
        }
    }, [advanceDiaporama]);

    const startMaskHold = useCallback(() => {
        maskHoldCompletedRef.current = false;
        if (!diaporamaActive || !transitionsEnabled || nextMaskedStep === null) return;
        maskHoldDelayRef.current = window.setTimeout(() => {
            const nextStep = nextMaskedStep;
            const startedAt = Date.now();
            const initialPixels = Number(maskRevealPixels[nextStep] || 0);
            maskHoldActiveRef.current = true;
            maskHoldProgressRef.current = window.setInterval(() => {
                // 12px every 500ms = 24px/s. Updates every 16ms preserve a
                // continuous motion while making the progressive reveal useful
                // at presentation speed.
                const revealedPixels = initialPixels + ((Date.now() - startedAt) * 0.024);
                setMaskRevealPixels((current) => ({ ...current, [nextStep]: revealedPixels }));
            }, 16);
        }, 180);
    }, [transitionsEnabled, diaporamaActive, maskRevealPixels, nextMaskedStep]);

    const reverseDiaporama = useCallback(() => {
        const hasTransitions = transitionsEnabled && maxSlideSteps > 1;
        if (hasTransitions && currentDiaporamaStep > 1) {
            const prevStep = currentDiaporamaStep - 1;
            setCurrentDiaporamaStep(prevStep);
            setPresentationRemote((current) => current ? {
                ...current,
                remote: { ...(current.remote || {}), transitionStep: prevStep }
            } : current);
            sendPresentationCommand('transition_previous', { step: prevStep }).catch(() => {});
        } else {
            if (projectedSlideIndex > 0) {
                void selectProjectedSlide(projectedSlideIndex - 1);
            }
        }
    }, [transitionsEnabled, maxSlideSteps, currentDiaporamaStep, projectedSlideIndex, selectProjectedSlide, sendPresentationCommand]);

    useEffect(() => {
        if (typeof presentationRemote?.remote?.diaporamaActive === 'boolean') {
            const remoteActive = presentationRemote.remote.diaporamaActive;
            const toggleLock = diaporamaToggleLockRef.current;
            // Ignore the poll that was sent before the teacher pressed the
            // button. Otherwise the label briefly goes Diaporama → Normal →
            // Diaporama even though the server did receive the command.
            if (!toggleLock || Date.now() >= toggleLock.expiresAt || remoteActive === toggleLock.value) {
                setDiaporamaActive(remoteActive);
                if (toggleLock && (Date.now() >= toggleLock.expiresAt || remoteActive === toggleLock.value)) {
                    diaporamaToggleLockRef.current = null;
                }
            }
        }
        if (Number.isInteger(presentationRemote?.remote?.transitionStep)) {
            setCurrentDiaporamaStep(presentationRemote.remote.transitionStep);
        }
    }, [presentationRemote?.remote?.diaporamaActive, presentationRemote?.remote?.transitionStep]);

    // Pre-decode nearby slides so arrows, keyboard navigation and the thumbnail
    // rail all feel immediate.
    useEffect(() => {
        const presId = extractPresentationId(playingCourse?.slidesUrl);
        if (!presId || !playingCourse?._id) return;
        const total = Math.max(1, slideManifest.length || 1);
        const indicesToPreload = [
            projectedSlideIndex + 1,
            projectedSlideIndex + 2,
            projectedSlideIndex - 1
        ].filter((idx) => idx >= 0 && idx < total);

        indicesToPreload.forEach((idx) => {
            const pageId = String(slideManifest[idx]?.objectId || '').trim();
            const slideNum = idx + 1;
            const cacheKey = `${presId}:${pageId}:${slideNum}`;
            if (slideImageCacheRef.current.has(cacheKey)) return;
            const url = `/api/learning/slides/thumbnail?presentationId=${encodeURIComponent(presId)}&pageObjectId=${encodeURIComponent(pageId)}&slideNumber=${slideNum}`;
            const img = new Image();
            img.onload = () => slideImageCacheRef.current.set(cacheKey, url);
            img.src = url;
        });
    }, [playingCourse?.slidesUrl, playingCourse?._id, projectedSlideIndex, slideManifest]);

    useEffect(() => {
        if (!transitionEditMode) return;
        const existing = slideTransitions[currentSlideNumber];
        const stepsMap = {};
        if (existing?.steps && Array.isArray(existing.steps) && existing.steps.length > 0) {
            existing.steps.forEach((s) => {
                (s.elementIds || []).forEach((id) => {
                    stepsMap[id] = Number(s.step) || 1;
                });
            });
        } else {
            currentSlideTransitionItems.forEach((item, idx) => {
                stepsMap[item.id] = idx + 1;
            });
        }
        const editableMasks = existing?.useCustomMasks === true
            ? (Array.isArray(existing?.masks) ? existing.masks : [])
            : [
                ...currentSlideTransitionItems.map((item, index) => ({
                    id: `mask_detected_${item.id}`,
                    x: item.left, y: item.top, width: item.width, height: item.height,
                    step: Number(stepsMap[item.id] || index + 2)
                })),
                ...(Array.isArray(existing?.masks) ? existing.masks : [])
            ];
        setTransitionDraft({
            enabled: existing?.enabled ?? true,
            perParagraph: existing?.perParagraph !== false,
            stepsMap,
            masks: editableMasks
        });
        setSelectedMaskId('');
    }, [transitionEditMode, currentSlideNumber, slideTransitions, currentSlideTransitionItems]);

    useEffect(() => {
        if (!transitionEditMode) return undefined;
        const onPointerMove = (event) => {
            const drag = maskEditorDragRef.current;
            if (!drag) return;
            const deltaX = ((event.clientX - drag.startX) / drag.bounds.width) * 100;
            const deltaY = ((event.clientY - drag.startY) / drag.bounds.height) * 100;
            setTransitionDraft((previous) => ({
                ...previous,
                masks: (previous.masks || []).map((mask) => {
                    if (mask.id !== drag.id) return mask;
                    if (drag.mode === 'resize') return {
                        ...mask,
                        width: Math.max(2, Math.min(100 - Number(drag.mask.x || 0), Number(drag.mask.width || 0) + deltaX)),
                        height: Math.max(2, Math.min(100 - Number(drag.mask.y || 0), Number(drag.mask.height || 0) + deltaY))
                    };
                    return {
                        ...mask,
                        x: Math.max(0, Math.min(100 - Number(drag.mask.width || 0), Number(drag.mask.x || 0) + deltaX)),
                        y: Math.max(0, Math.min(100 - Number(drag.mask.height || 0), Number(drag.mask.y || 0) + deltaY))
                    };
                })
            }));
        };
        const onPointerUp = () => { maskEditorDragRef.current = null; };
        const onKeyDown = (event) => {
            const tag = String(event.target?.tagName || '').toLowerCase();
            if ((event.key !== 'Delete' && event.key !== 'Backspace') || !selectedMaskId || ['input', 'textarea', 'select'].includes(tag)) return;
            event.preventDefault();
            setTransitionDraft((previous) => ({ ...previous, masks: (previous.masks || []).filter((mask) => mask.id !== selectedMaskId) }));
            setSelectedMaskId('');
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [transitionEditMode, selectedMaskId]);

    const saveSlideTransitions = async (updatedConfig) => {
        if (!playingCourse?._id) return;
        setSavingTransitions(true);
        try {
            const nextTransitions = {
                ...slideTransitions,
                [currentSlideNumber]: updatedConfig
            };
            const res = await fetch(`/api/courses/${playingCourse._id}/slides/transitions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slideTransitions: nextTransitions })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur enregistrement transitions');
            setSlideTransitions(nextTransitions);
            setTransitionEditMode(false);
            if (updatedConfig.enabled) {
                setDiaporamaActive(true);
                setCurrentDiaporamaStep(1);
            }
        } catch (err) {
            alert(`Impossible d’enregistrer les transitions : ${err.message}`);
        } finally {
            setSavingTransitions(false);
        }
    };

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
        if (isPhone || !playingCourse?._id || playerMode !== 'presentation' || videoSequencer || sequenceCutEditor || transitionEditMode) return undefined;
        const handlePresentationShortcut = (event) => {
            const tag = String(event.target?.tagName || '').toLowerCase();
            if (['input', 'textarea', 'select', 'button'].includes(tag) || event.target?.isContentEditable || event.repeat) return;

            if (diaporamaActive) {
                if (event.code === 'Space') {
                    event.preventDefault();
                    startMaskHold();
                    return;
                }
                if (event.key === 'Enter') {
                    event.preventDefault();
                    void sendPresentationCommand('animation_toggle');
                    return;
                }
                if (event.key === 'ArrowRight' || event.key === 'PageDown') {
                    event.preventDefault();
                    advanceDiaporama();
                    return;
                } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                    event.preventDefault();
                    reverseDiaporama();
                    return;
                }
            }

            let action = '';
            if (event.key === 'Enter') {
                action = 'animation_toggle';
            } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                action = 'slide_previous';
            } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
                action = 'slide_next';
            } else if (event.key === 'ArrowUp') {
                action = 'sequence_previous';
            } else if (event.key === 'ArrowDown') {
                action = 'sequence_next';
            }
            if (!action) return;
            event.preventDefault();
            void sendPresentationCommand(action);
        };
        const handlePresentationKeyUp = (event) => {
            if (diaporamaActive && event.code === 'Space') {
                event.preventDefault();
                stopMaskHold(true);
            }
        };
        window.addEventListener('keydown', handlePresentationShortcut, true);
        window.addEventListener('keyup', handlePresentationKeyUp, true);
        return () => {
            window.removeEventListener('keydown', handlePresentationShortcut, true);
            window.removeEventListener('keyup', handlePresentationKeyUp, true);
        };
    }, [isPhone, playingCourse?._id, playerMode, presentationRemote, slideManifest.length, videoSequencer, sequenceCutEditor, transitionEditMode, diaporamaActive, advanceDiaporama, reverseDiaporama, sendPresentationCommand, startMaskHold, stopMaskHold]);

    useEffect(() => {
        if (isPhone || !playingCourse?._id || playerMode !== 'presentation') return;
        coursePlayerRef.current?.focus({ preventScroll: true });
    }, [isPhone, playingCourse?._id, playerMode]);

    useEffect(() => { setPlayingVideoIndex(0); }, [projectedSceneIndex, projectedSequenceIndex]);
    useEffect(() => {
        if (!presentationRemote?.remote?.playVersion || presentationRemote.remote.animationVisible === false) return;
        setPlayingVideoIndex(0);
        window.setTimeout(() => sequenceVideoRef.current?.play().catch(() => { }), 0);
    }, [presentationRemote?.remote?.playVersion]);
    useEffect(() => {
        if (playingVideoIndex > 0) sequenceVideoRef.current?.play().catch(() => { });
    }, [playingVideoIndex]);

    useEffect(() => {
        if (presentationRemote?.remote?.animationPlaying === false) sequenceVideoRef.current?.pause?.();
    }, [presentationRemote?.remote?.pauseVersion, presentationRemote?.remote?.animationPlaying]);

    useEffect(() => {
        const version = Number(presentationRemote?.remote?.googleAnimationVersion || 0);
        if (!version || playerMode !== 'presentation') return;
        const frame = presentationIframeRef.current;
        const direction = presentationRemote?.remote?.googleAnimationDirection === 'previous' ? 'previous' : 'next';
        const key = direction === 'previous' ? 'ArrowLeft' : 'ArrowRight';
        try {
            frame?.focus({ preventScroll: true });
            frame?.contentWindow?.postMessage({ type: 'conda-google-slides-navigation', direction, key }, '*');
            frame?.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true }));
        } catch (_) { }
    }, [presentationRemote?.remote?.googleAnimationVersion, presentationRemote?.remote?.googleAnimationDirection, playerMode]);

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
        const files = Array.from(fileList || []).filter((file) => (
            /^(?:audio|video)\//i.test(String(file.type || ''))
            || /\.(?:mp3|m4a|aac|wav|ogg|oga|flac|mp4|webm)$/i.test(String(file.name || ''))
        ));
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
                const sourceType = String(file.type || '').startsWith('audio/') || AUDIO_FILE_PATTERN.test(file.name) ? 'audio' : 'mp4';
                uploaded.push({ id: `media_${Date.now()}_${uploaded.length}`, name: file.name.replace(/\.(?:mp3|m4a|aac|wav|ogg|oga|flac|mp4|webm)$/i, ''), url: data.url, driveFileId: data.driveFileId || '', sourceType, mimeType: file.type || '', mergeWithNext: false, closeAfterSequence: false, startSec: 0, endSec: 0 });
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

    const openModification = (course, requestedSlideIndex = projectedSlideIndex) => {
        openGoogleSlidesExternal(course, requestedSlideIndex);
    };

    const openGoogleSlidesExternal = async (course, requestedSlideIndex = projectedSlideIndex) => {
        setError('');
        const total = Math.max(1, slideManifest.length || 1);
        const targetSlideIndex = Math.min(
            total - 1,
            Math.max(0, Number(requestedSlideIndex) || 0)
        );
        const editSlideObjectId = String(slideManifest[targetSlideIndex]?.objectId || projectedSlideObjectId || '').trim();
        const editorWindow = window.open('about:blank', '_blank');
        try {
            const response = await fetch(`/api/courses/${course._id}/editor-access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherEmail: user?.email || user?.mail || '' })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Accès en modification impossible');
            const editBaseUrl = getEditUrl(data.editUrl || course.slidesUrl);
            const targetUrl = editSlideObjectId
                ? `${editBaseUrl}#slide=id.${encodeURIComponent(editSlideObjectId)}`
                : editBaseUrl;
            if (editorWindow) editorWindow.location.replace(targetUrl);
            else window.open(targetUrl, '_blank', 'noopener,noreferrer');
            if (globalClassId) {
                fetch(`/api/courses/${course._id}/presentation-remote/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        classId: globalClassId,
                        courseId: course._id,
                        slideIndex: targetSlideIndex,
                        playerMode: 'presentation'
                    })
                }).catch(() => {});
            }
            externalSlidesEditorOpenedRef.current = true;
            setLastEditSlideNumber(targetSlideIndex + 1);
            setEditSlideNumberDraft('');
        } catch (accessError) {
            try { editorWindow?.close(); } catch (_) { }
            setError(accessError.message);
            alert(`Impossible d’ouvrir cette présentation dans Google Slides : ${accessError.message}`);
        }
    };

    const togglePlayerMode = async () => {
        const nextMode = playerMode === 'presentation' ? 'edit' : 'presentation';
        setPlayerMode(nextMode);
        if (nextMode === 'edit' && playingCourse?._id) {
            fetch(`/api/courses/${playingCourse._id}/editor-access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherEmail: user?.email || user?.mail || '' })
            }).catch(() => {});
        } else if (nextMode === 'presentation' && playingCourse?._id) {
            setPlayingCourse((current) => current ? { ...current, presentationReloadNonce: Date.now() } : current);
            // Re-fetch fresh live slides immediately upon returning to lecture mode
            fetch(`/api/courses/${playingCourse._id}/slides/native?sync=1&live=${Date.now()}`)
                .then(r => r.json())
                .then(d => {
                    if (Array.isArray(d?.nativeSlides || d?.slides)) {
                        const list = d.nativeSlides || d.slides;
                        const map = {};
                        list.forEach((s) => {
                            const num = Number(s.slideNumber || 1);
                            map[num] = {
                                elements: Array.isArray(s.elements) ? s.elements : [],
                                backgroundColor: s.background?.color || s.backgroundColor || '#ffffff'
                            };
                        });
                        setSlideElementsMap(map);
                    }
                })
                .catch(() => {});
        }
        sendPresentationCommand('sync', {
            slideIndex: projectedSlideIndex,
            sceneIndex: projectedSceneIndex,
            sequenceIndex: projectedSequenceIndex,
            playerMode: nextMode
        }).catch(() => {});
    };

    const reimportFromGoogleSlides = async () => {
        if (!playingCourse?._id) return;
        try {
            const [response, nativeResponse] = await Promise.all([
                fetch('/api/learning/slides/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ presentationUrl: playingCourse.slidesUrl, includeThumbnails: false })
                }),
                // This imports only the slide structure and the video links
                // (YouTube / Drive IDs), never the video files themselves.
                fetch(`/api/courses/${playingCourse._id}/slides/native?sync=1&live=${Date.now()}`)
            ]);
            const data = await response.json();
            if (Array.isArray(data?.slides)) {
                setSlideManifest(data.slides);
            }
            const nativeData = await nativeResponse.json().catch(() => ({}));
            const nativeSlides = nativeData?.nativeSlides || nativeData?.slides;
            if (Array.isArray(nativeSlides)) {
                const map = {};
                nativeSlides.forEach((slide) => {
                    const number = Number(slide?.slideNumber || 1);
                    map[number] = {
                        elements: Array.isArray(slide?.elements) ? slide.elements : [],
                        backgroundColor: slide?.background?.color || slide?.backgroundColor || '#ffffff'
                    };
                });
                setSlideElementsMap(map);
            }
            setLiveSyncKey(Date.now());
        } catch (_) { }
    };

    useEffect(() => {
        if (isPhone || !playingCourse?._id) return undefined;
        const refreshAfterExternalEdit = () => {
            if (!externalSlidesEditorOpenedRef.current || document.visibilityState === 'hidden') return;
            fetch('/api/learning/slides/manifest', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ presentationUrl: playingCourse.slidesUrl, includeThumbnails: false })
            }).then((response) => response.json())
                .then((data) => setSlideManifest(Array.isArray(data?.slides) ? data.slides : []))
                .catch(() => { });
        };
        window.addEventListener('focus', refreshAfterExternalEdit);
        document.addEventListener('visibilitychange', refreshAfterExternalEdit);
        return () => {
            window.removeEventListener('focus', refreshAfterExternalEdit);
            document.removeEventListener('visibilitychange', refreshAfterExternalEdit);
        };
    }, [isPhone, playingCourse?._id, playingCourse?.slidesUrl]);

    const refreshSlidesFromGoogle = () => {
        if (!playingCourse?.slidesUrl) return;
        setPlayingCourse((current) => current ? { ...current, presentationReloadNonce: Date.now() } : current);
        fetch('/api/learning/slides/manifest', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presentationUrl: playingCourse.slidesUrl, includeThumbnails: false })
        }).then((response) => response.json())
            .then((data) => setSlideManifest(Array.isArray(data?.slides) ? data.slides : []))
            .catch(() => { });
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
                            const isAudio = group.some((item) => isAudioSequence(item));
                            const radius = 19;
                            const circ = 2 * Math.PI * radius; // ~119.38
                            const strokeOffset = circ - (circ * pct) / 100;
                            return (
                                <button
                                    key={group[0]?.id || index}
                                    type="button"
                                    className={`course-phone-seq-camembert ${isSelected ? 'selected' : ''} ${isReady ? 'ready' : ''} ${isAudio ? 'audio' : ''}`}
                                    disabled={!isReady}
                                    onClick={() => { if (isReady) void sendPresentationCommand('sequence_select', { sequenceIndex: index }); }}
                                    title={`${isAudio ? 'Chanson / audio' : 'Séquence'} ${index + 1} : ${pct}% chargé ${isReady ? '(Prêt)' : '(chargement en cours)'}`}
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
                    <div className="course-phone-slide-row">
                        <button onClick={() => void sendPresentationCommand('slide_previous')}><span>◀</span>Slide précédente</button>
                        <button onClick={() => void sendPresentationCommand('google_animation_next')}><span>☝️</span>Clic Google</button>
                        <button onClick={() => void sendPresentationCommand('slide_next')}><span>▶</span>Slide suivante</button>
                    </div>
                    <div className="course-phone-animation-row">
                        <button onClick={() => void sendPresentationCommand('sequence_previous')}><span>⏮</span>Précédente</button>
                        {(() => {
                            const currentBufferKey = `${phoneSlideIndex}_${phoneSceneIndex}_${phoneSequenceIndex}`;
                            const currentBufferPct = Math.min(100, Math.max(0, Number(presentationRemote?.remote?.sequenceBuffers?.[currentBufferKey] ?? 0)));
                            const isCurrentReady = presentationRemote?.remote?.isReady === true || currentBufferPct >= 65;
                            return (
                                <button
                                    type="button"
                                    className={`play ${isCurrentReady ? 'ready' : 'buffering'}`}
                                    onClick={() => void sendPresentationCommand('play_pause')}
                                    title={isCurrentReady ? 'Lire ou mettre en pause la séquence' : `Mémoire tampon à ${currentBufferPct}% · Toucher pour forcer`}
                                >
                                    <span>{presentationRemote?.remote?.animationPlaying ? 'Ⅱ' : (isCurrentReady ? '▶' : '⏳')}</span>
                                    {presentationRemote?.remote?.animationPlaying ? 'Pause' : (isCurrentReady ? 'Play' : `${currentBufferPct}%`)}
                                </button>
                            );
                        })()}
                        <button
                            type="button"
                            className={presentationRemote?.remote?.animationVisible ? 'active stop-animation' : 'stop-animation'}
                            onClick={() => void sendPresentationCommand('animation_hide')}
                        >
                            <span>■</span>Stop / cacher
                        </button>
                        <button onClick={() => void sendPresentationCommand('sequence_next')}><span>⏭</span>Suivante</button>
                    </div>
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
                                                {!course.isSourcePresentation && <button type="button" className="course-google-ext-launch-button" onClick={() => openGoogleSlidesExternal(course, 0)} title="Lancer directement dans Google Slides avec l'extension CondaWeb">⚡ SLIDES</button>}
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
                        <div className="course-presentation-layout">
                            <nav className="course-slide-thumbnail-rail" aria-label="Navigateur de diapositives">
                                <div className="course-slide-thumbnail-rail-title">DIAPOS</div>
                                <div className="course-slide-thumbnail-list">
                                    {slideManifest.map((slide, index) => {
                                        const slideNumber = Number(slide?.slideNumber || index + 1);
                                        const thumbnailUrl = slide?.thumbnailProxyUrl || slide?.thumbnailPublicUrl || '';
                                        const isActive = index === projectedSlideIndex;
                                        return (
                                            <button
                                                key={slide?.objectId || `${slideNumber}-${index}`}
                                                type="button"
                                                className={`course-slide-thumbnail-button ${isActive ? 'active' : ''}`}
                                                onClick={() => void selectProjectedSlide(index)}
                                                aria-label={`Aller à la diapositive ${slideNumber}`}
                                                aria-current={isActive ? 'true' : undefined}
                                                title={`Diapositive ${slideNumber}`}
                                            >
                                                {thumbnailUrl ? (
                                                    <img src={thumbnailUrl} alt="" loading={Math.abs(index - projectedSlideIndex) <= 2 ? 'eager' : 'lazy'} draggable="false" />
                                                ) : (
                                                    <span className="course-slide-thumbnail-placeholder">{slideNumber}</span>
                                                )}
                                                <span className="course-slide-thumbnail-number">{slideNumber}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </nav>

                            {/* Rendu direct haute fidélité de la diapositive active */}
                            <div
                                className={`google-slide-stage-container ${diaporamaActive ? 'is-diaporama' : ''}`}
                                onPointerDown={diaporamaActive ? (event) => {
                                    event.currentTarget.setPointerCapture?.(event.pointerId);
                                    startMaskHold();
                                } : undefined}
                                onPointerUp={diaporamaActive ? (event) => {
                                    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
                                    stopMaskHold(true);
                                } : undefined}
                                onPointerCancel={diaporamaActive ? (event) => {
                                    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
                                    stopMaskHold(false);
                                } : undefined}
                            >
                            {slideImageUrl ? (
                                <img
                                    key={`google-slide-${visibleSlideIndex}`}
                                    src={slideImageUrl}
                                    alt={`Google Slide ${visibleSlideIndex + 1}`}
                                    className="google-slide-image-display"
                                    draggable={false}
                                />
                            ) : (
                                <div className="conda-slides-loader-stage">
                                    <div className="conda-slides-spinner" />
                                    <span>Chargement de la présentation Google Slides…</span>
                                </div>
                            )}

                            {/* Calque des éléments transparents et sélectionnables + Masques de diaporama */}
                            <div className="google-slide-elements-overlay">
                                {/* Boîtes de texte transparentes sélectionnables */}
                                {currentSlideTransitionItems.map((item) => (
                                    <div
                                        key={`text-box-${item.id}`}
                                        className="slide-selectable-text-box"
                                        style={{
                                            left: `${item.left}%`,
                                            top: `${item.top}%`,
                                            width: `${item.width}%`,
                                            height: `${item.height}%`,
                                        }}
                                        onPointerDown={(e) => {
                                            e.stopPropagation();
                                        }}
                                        onClick={(e) => {
                                            const sel = window.getSelection()?.toString()?.trim();
                                            if (sel) {
                                                e.stopPropagation();
                                            }
                                        }}
                                    >
                                        <div
                                            className="slide-selectable-text-content"
                                            style={{
                                                fontSize: item.style?.fontSize ? `${Math.max(12, Math.round(Number(item.style.fontSize) * 0.9))}px` : undefined,
                                                textAlign: item.style?.align || 'left',
                                                fontWeight: item.style?.bold ? 'bold' : 'normal',
                                                fontStyle: item.style?.italic ? 'italic' : 'normal',
                                            }}
                                            title="Texte sélectionnable"
                                        >
                                            {item.text}
                                        </div>
                                    </div>
                                ))}

                                {/* Les miniatures Google Slides sont des PNG : une vidéo intégrée
                                    doit donc être rendue séparément à sa position d'origine. */}
                                {currentSlideElements.filter((item) => item?.type === 'video_youtube' && getGoogleSlidesVideoEmbedUrl(item.url)).map((video) => (
                                    <iframe
                                        key={`google-slide-video-${video.id}`}
                                        className="google-slide-embedded-video"
                                        src={getGoogleSlidesVideoEmbedUrl(video.url)}
                                        title="Vidéo intégrée à la diapositive Google Slides"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                        style={{
                                            left: `${video.x}%`,
                                            top: `${video.y}%`,
                                            width: `${video.width}%`,
                                            height: `${video.height}%`,
                                            pointerEvents: transitionEditMode ? 'none' : 'auto',
                                        }}
                                    />
                                ))}

                                {/* Masques de texte et rectangles créés dans l'éditeur */}
                                {diaporamaActive && transitionsEnabled && currentSlideMasks.map((mask) => {
                                    const isMasked = mask.step > currentDiaporamaStep;
                                    const revealedPixels = isMasked ? Number(maskRevealPixels[mask.step] || 0) : 0;
                                    const activeStep = Math.min(...currentSlideMasks.filter((item) => item.step > currentDiaporamaStep).map((item) => item.step));
                                    const isActive = isMasked && mask.step === activeStep;
                                    return (
                                        <div
                                            key={`mask-${mask.id}`}
                                            className={`slide-diaporama-mask ${isMasked ? 'is-masked' : 'is-revealed'} ${isActive ? 'is-active' : ''}`}
                                            style={{
                                                left: `${mask.x}%`,
                                                top: `${mask.y}%`,
                                                width: `${mask.width}%`,
                                                height: `${mask.height}%`,
                                                backgroundColor: '#ffffff',
                                                clipPath: revealedPixels > 0 ? `inset(${revealedPixels.toFixed(2)}px 0 0 0)` : undefined
                                            }}
                                        ><span className="slide-diaporama-mask-number">{mask.number}</span></div>
                                    );
                                })}
                            </div>

                            {transitionEditMode && (
                                <div className="course-transition-stage-editor" onPointerDown={(event) => {
                                    if (event.target !== event.currentTarget) return;
                                    const bounds = event.currentTarget.getBoundingClientRect();
                                    const x = Math.max(0, Math.min(85, ((event.clientX - bounds.left) / bounds.width) * 100 - 7.5));
                                    const y = Math.max(0, Math.min(90, ((event.clientY - bounds.top) / bounds.height) * 100 - 5));
                                    setTransitionDraft((previous) => ({ ...previous, masks: [...(previous.masks || []), { id: `mask_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x, y, width: 15, height: 10, step: (previous.masks || []).length + 2 }]}));
                                }}>
                                    {(transitionDraft.masks || []).map((mask, index) => <button key={mask.id || index} type="button" className={`course-transition-stage-mask ${selectedMaskId === mask.id ? 'selected' : ''}`} style={{ left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.width}%`, height: `${mask.height}%` }} onPointerDown={(event) => {
                                        event.preventDefault(); event.stopPropagation(); setSelectedMaskId(mask.id);
                                        const bounds = event.currentTarget.parentElement.getBoundingClientRect();
                                        maskEditorDragRef.current = { id: mask.id, mode: event.target.dataset.resize === 'true' ? 'resize' : 'move', startX: event.clientX, startY: event.clientY, bounds, mask: { ...mask } };
                                        event.currentTarget.setPointerCapture?.(event.pointerId);
                                    }} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedMaskId(mask.id); setEditingMaskId(mask.id); }}>{editingMaskId === mask.id ? <input className="course-transition-stage-number-input" type="number" min="1" autoFocus defaultValue={Number(mask.step || index + 2)} onPointerDown={(event) => event.stopPropagation()} onBlur={() => setEditingMaskId('')} onKeyDown={(event) => { if (event.key === 'Enter') { event.currentTarget.blur(); } }} onChange={(event) => setTransitionDraft((previous) => ({ ...previous, masks: (previous.masks || []).map((row) => row.id === mask.id ? { ...row, step: Math.max(1, Number(event.target.value) || 1) } : row) }))} /> : Number(mask.step || index + 2)}<span className="course-transition-stage-resize" data-resize="true" /></button>)}
                                    <div className="course-transition-stage-toolbar">
                                        <span>Mode édition des masques · Clique dans une zone vide pour ajouter · Suppr pour enlever</span>
                                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setTransitionEditMode(false)}>ANNULER</button>
                                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => void saveSlideTransitions({ enabled: true, perParagraph: transitionDraft.perParagraph !== false, useCustomMasks: true, masks: transitionDraft.masks || [], steps: currentSlideTransition?.steps || [] })}>ENREGISTRER</button>
                                    </div>
                                </div>
                            )}

                            {/* Bannière Mode Diaporama */}
                            {diaporamaActive && (
                                <div className="course-diaporama-banner">
                                    <span className="diaporama-badge">📽️ MODE DIAPORAMA ACTIF</span>
                                    <span>Étape {currentDiaporamaStep} / {maxSlideSteps} (Clique ou appuie sur Espace)</span>
                                </div>
                            )}

                            {/* Flèches latérales de navigation au survol */}
                            {projectedSlideIndex > 0 && (
                                <button
                                    type="button"
                                    className="course-stage-nav-arrow prev"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); void selectProjectedSlide(projectedSlideIndex - 1); }}
                                    aria-label="Diapositive précédente"
                                    title="Diapositive précédente"
                                >
                                    ‹
                                </button>
                            )}
                            {projectedSlideIndex < Math.max(0, (slideManifest.length || 1) - 1) && (
                                <button
                                    type="button"
                                    className="course-stage-nav-arrow next"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); void selectProjectedSlide(projectedSlideIndex + 1); }}
                                    aria-label="Diapositive suivante"
                                    title="Diapositive suivante"
                                >
                                    ›
                                </button>
                            )}
                            </div>
                        </div>
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
                                const isAudio = isAudioSequence(item.video);
                                const itemKey = `${item.slideIndex}_${item.sceneIndex}_${item.sequenceIndex}_${item.video?.id || item.video?.url || ''}`;
                                return (
                                    <div
                                        key={itemKey}
                                        className={`course-sequence-video-layer ${isCurrentActive ? 'active' : 'prewarming'} ${isAudio ? 'audio' : ''}`}
                                    >
                                        {isYoutube ? (
                                            <YoutubeSequencePlayer
                                                video={item.video}
                                                playVersion={item.isCurrent ? presentationRemote?.remote?.playVersion : 0}
                                                pauseVersion={presentationRemote?.remote?.pauseVersion}
                                                isPlaying={item.isCurrent && presentationRemote?.remote?.animationPlaying === true}
                                                isVisible={isCurrentActive}
                                                autoplayOnMount={item.isCurrent ? youtubeAutoplayOnMount : false}
                                                onEnded={item.isCurrent ? finishProjectedVideo : undefined}
                                                onBufferProgress={(fraction) => handleItemBufferProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, fraction)}
                                            />
                                        ) : isAudio ? (
                                            <audio
                                                ref={item.isCurrent ? sequenceVideoRef : undefined}
                                                src={item.video.url}
                                                preload="auto"
                                                onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.max(0, Number(item.video.startSec || 0)); }}
                                                onLoadedData={() => handleItemBufferProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, .25)}
                                                onCanPlay={() => handleItemBufferProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, .65)}
                                                onCanPlayThrough={() => handleItemBufferProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, 1)}
                                                onProgress={(event) => handleNativeItemProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, event)}
                                                onTimeUpdate={(event) => {
                                                    handleNativeItemProgress(item.slideIndex, item.sceneIndex, item.sequenceIndex, event);
                                                    const end = Math.max(0, Number(item.video.endSec || 0));
                                                    if (item.isCurrent && end > 0 && event.currentTarget.currentTime >= end) { event.currentTarget.pause(); finishProjectedVideo(); }
                                                }}
                                                onEnded={item.isCurrent ? finishProjectedVideo : undefined}
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
                            <div className={`course-sequence-video-layer ${presentationRemote?.remote?.animationVisible ? 'active' : 'prewarming'} ${isAudioSequence(visibleProjectedVideo) ? 'audio' : ''}`}>
                                {visibleVideoIsYoutube ? (
                                    <YoutubeSequencePlayer
                                        video={visibleProjectedVideo}
                                        playVersion={presentationRemote?.remote?.playVersion}
                                        pauseVersion={presentationRemote?.remote?.pauseVersion}
                                        isPlaying={presentationRemote?.remote?.animationPlaying === true}
                                        isVisible={presentationRemote?.remote?.animationVisible === true}
                                        autoplayOnMount={youtubeAutoplayOnMount}
                                        onEnded={finishProjectedVideo}
                                        onBufferProgress={(fraction) => handleItemBufferProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, fraction)}
                                    />
                                ) : isAudioSequence(visibleProjectedVideo) ? (
                                    <audio
                                        ref={sequenceVideoRef}
                                        src={visibleProjectedVideo.url}
                                        preload="auto"
                                        onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.max(0, Number(visibleProjectedVideo.startSec || 0)); }}
                                        onLoadedData={() => handleItemBufferProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, .25)}
                                        onCanPlay={() => handleItemBufferProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, .65)}
                                        onCanPlayThrough={() => handleItemBufferProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, 1)}
                                        onProgress={(event) => handleNativeItemProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, event)}
                                        onTimeUpdate={(event) => {
                                            handleNativeItemProgress(projectedSlideIndex, projectedSceneIndex, projectedSequenceIndex, event);
                                            const end = Math.max(0, Number(visibleProjectedVideo.endSec || 0));
                                            if (end > 0 && event.currentTarget.currentTime >= end) { event.currentTarget.pause(); finishProjectedVideo(); }
                                        }}
                                        onEnded={finishProjectedVideo}
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
                            <div className="course-player-slide-stepper">
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
                                <button type="button" onClick={() => void selectProjectedSlide(projectedSlideIndex + 1)} disabled={projectedSlideIndex >= Math.max(0, (slideManifest.length || 1) - 1)} aria-label="Diapo suivante">›</button>
                            </div>
                            <button
                                type="button"
                                className={`course-diaporama-toggle-btn ${diaporamaActive ? 'active' : ''}`}
                                onClick={() => {
                                    const nextActive = !diaporamaActive;
                                    diaporamaToggleLockRef.current = { value: nextActive, expiresAt: Date.now() + 2500 };
                                    setDiaporamaActive(nextActive);
                                    setCurrentDiaporamaStep(1);
                                    setPresentationRemote((current) => current ? {
                                        ...current,
                                        remote: { ...(current.remote || {}), diaporamaActive: nextActive, transitionStep: 1 }
                                    } : current);
                                    sendPresentationCommand('diaporama_toggle', { diaporamaActive: nextActive }).catch(() => {});
                                }}
                                title="Activer/désactiver le Mode Diaporama avec transitions au clic"
                            >
                                {diaporamaActive ? '📽️ QUITTER DIAPORAMA' : '📽️ MODE DIAPORAMA'}
                            </button>
                            <button
                                type="button"
                                className={`course-diaporama-toggle-btn ${presentationRemote?.remote?.animationVisible ? 'active' : ''}`}
                                onClick={() => void sendPresentationCommand('animation_toggle')}
                                title="Afficher ou cacher l’animation de la diapositive (raccourci : Entrée)"
                            >
                                {presentationRemote?.remote?.animationVisible ? '🎬 CACHER L’ANIMATION' : '🎬 AFFICHER L’ANIMATION'}
                            </button>
                            <div className="course-edit-mode-control">
                                <span className="course-live-sync-pill" title="Les modifications apportées dans Google Slides sont automatiquement répercutées ici toutes les 2 secondes">
                                    <span className="live-sync-dot pulsing" />
                                    <span>Google Slides live (2s)</span>
                                </span>
                                <button
                                    type="button"
                                    className="course-google-ext-btn"
                                    onClick={() => void openGoogleSlidesExternal(playingCourse, projectedSlideIndex)}
                                    title={`Ouvrir la slide ${projectedSlideIndex + 1} dans Google Slides pour modifier`}
                                >
                                    ↗ Ouvrir dans Google Slides
                                </button>
                            </div>
                            <button type="button" className="course-sync-board-button" onClick={() => void forceSyncRemote()} title="Envoyer la diapo CondaWeb active au téléphone">
                                ↻ SYNCHRONISER LE TÉLÉPHONE
                            </button>
                            <button type="button" className="course-sync-board-button" onClick={reimportFromGoogleSlides} title="Réimporter toutes les diapositives depuis Google Slides">
                                ↻ RÉIMPORTER DEPUIS GOOGLE
                            </button>
                            <div className="course-add-wrap">
                                <button type="button" className="course-animation-button" onClick={() => setAddMenuOpen((current) => !current)}>
                                    ＋ AJOUTER
                                </button>
                                {addMenuOpen && (
                                    <div className="course-add-menu">
                                        <button type="button" onClick={() => { setAddMenuOpen(false); setTransitionEditMode(true); }}>✨ AJOUTER UNE TRANSITION</button>
                                        <button type="button" onClick={openVideoSequencer}>🎬 AJOUTER UNE ANIMATION</button>
                                        <button type="button" onClick={openControlOnCourse}>📝 AFFICHER UN CONTRÔLE</button>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
            {transitionEditorOpen && (
                <div className="course-transition-editor-backdrop" role="dialog" aria-modal="true" aria-label="Éditeur de transitions">
                    <div className="course-transition-editor-window">
                        <div className="course-transition-editor-heading">
                            <div>
                                <strong>TRANSITIONS — DIAPOSITIVE {currentSlideNumber}</strong>
                                <span>{playingCourse?.title}</span>
                            </div>
                            <button type="button" onClick={() => !savingTransitions && setTransitionEditorOpen(false)} aria-label="Fermer">×</button>
                        </div>
                        <div className="course-transition-editor-body">
                            <p className="course-transition-editor-intro">
                                Configure l’ordre d’apparition des paragraphes et éléments de cette diapositive. En <b>Mode Diaporama</b>, chaque clic ou appui sur Espace révélera l’étape suivante.
                            </p>

                            <div
                                className="course-transition-slide-preview"
                                title="Clique sur la diapositive pour créer un masque libre à cet endroit"
                                onClick={(event) => {
                                    const rect = event.currentTarget.getBoundingClientRect();
                                    const x = Math.max(0, Math.min(85, ((event.clientX - rect.left) / rect.width) * 100 - 7.5));
                                    const y = Math.max(0, Math.min(90, ((event.clientY - rect.top) / rect.height) * 100 - 5));
                                    setTransitionDraft((previous) => ({
                                        ...previous,
                                        masks: [...(previous.masks || []), { id: `mask_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x, y, width: 15, height: 10, step: 2 }]
                                    }));
                                }}
                            >
                                {slideImageUrl && <img src={slideImageUrl} alt={`Aperçu de la diapositive ${currentSlideNumber}`} draggable="false" />}
                                {(transitionDraft.masks || []).map((mask, index) => <button key={mask.id || index} type="button" className={`course-transition-preview-mask ${selectedMaskId === mask.id ? 'selected' : ''}`} style={{ left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.width}%`, height: `${mask.height}%` }} onPointerDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setSelectedMaskId(mask.id);
                                    const bounds = event.currentTarget.parentElement.getBoundingClientRect();
                                    maskEditorDragRef.current = { id: mask.id, mode: event.target.dataset.resize === 'true' ? 'resize' : 'move', startX: event.clientX, startY: event.clientY, bounds, mask: { ...mask } };
                                    event.currentTarget.setPointerCapture?.(event.pointerId);
                                }}>{index + 1}<span className="course-transition-preview-resize" data-resize="true" /></button>)}
                                <span className="course-transition-slide-preview-hint">Clique pour ajouter un masque libre</span>
                            </div>
                            
                            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                                    <input
                                        type="checkbox"
                                        checked={transitionDraft.enabled}
                                        onChange={(e) => setTransitionDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                                    />
                                    Activer les transitions sur cette diapositive
                                </label>
                            </div>

                            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                                    <input
                                        type="checkbox"
                                        checked={transitionDraft.perParagraph !== false}
                                        onChange={(event) => {
                                            const perParagraph = event.target.checked;
                                            const items = buildSlideTransitionItems(currentSlideElements, perParagraph);
                                            const stepsMap = {};
                                            items.forEach((item, index) => {
                                                stepsMap[item.id] = transitionDraft.stepsMap[item.id]
                                                    || (perParagraph ? index + 2 : 2);
                                            });
                                            setTransitionDraft((previous) => ({ ...previous, perParagraph, stepsMap }));
                                        }}
                                    />
                                    Par paragraphe <span style={{ color: '#94a3b8', fontWeight: 500 }}>(un retour à la ligne = une apparition)</span>
                                </label>
                            </div>

                            {transitionDraft.enabled && (
                                <>
                                    <div className="course-transition-quick-actions">
                                        <button
                                            type="button"
                                            className="courses-secondary-button"
                                            onClick={() => {
                                                const stepsMap = {};
                                                editorTransitionItems.forEach((item, idx) => {
                                                    stepsMap[item.id] = idx + 2;
                                                });
                                                setTransitionDraft((prev) => ({ ...prev, stepsMap }));
                                            }}
                                        >
                                            ⚡ Transitions automatiques (1 par 1)
                                        </button>
                                        <button
                                            type="button"
                                            className="courses-secondary-button"
                                            onClick={() => {
                                                const stepsMap = {};
                                                editorTransitionItems.forEach((item) => {
                                                    stepsMap[item.id] = 1;
                                                });
                                                setTransitionDraft((prev) => ({ ...prev, stepsMap }));
                                            }}
                                        >
                                            👁 Tout afficher dès le début
                                        </button>
                                    </div>

                                    <div className="course-transition-manual-masks">
                                        <div className="course-transition-manual-masks-heading">
                                            <strong>Masques libres</strong>
                                            <button
                                                type="button"
                                                className="courses-secondary-button"
                                                onClick={() => setTransitionDraft((previous) => ({
                                                    ...previous,
                                                    masks: [...(previous.masks || []), {
                                                        id: `mask_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                                        x: 20, y: 20, width: 25, height: 12, step: 2
                                                    }]
                                                }))}
                                            >
                                                ＋ AJOUTER UN MASQUE
                                            </button>
                                        </div>
                                        {(transitionDraft.masks || []).map((mask, index) => (
                                            <div className="course-transition-mask-row" key={mask.id || index}>
                                                <span>Masque {index + 1}</span>
                                                {[['x', 'X'], ['y', 'Y'], ['width', 'L'], ['height', 'H'], ['step', 'Clic']].map(([field, label]) => (
                                                    <label key={field}>{label}<input type="number" min={field === 'step' ? 1 : 0} max={field === 'step' ? 99 : 100} value={Number(mask[field] || 0)} onChange={(event) => {
                                                        const value = Number(event.target.value);
                                                        setTransitionDraft((previous) => ({ ...previous, masks: (previous.masks || []).map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row) }));
                                                    }} /></label>
                                                ))}
                                                <button type="button" onClick={() => setTransitionDraft((previous) => ({ ...previous, masks: (previous.masks || []).filter((_, rowIndex) => rowIndex !== index) }))} aria-label={`Supprimer le masque ${index + 1}`}>×</button>
                                            </div>
                                        ))}
                                    </div>

                                    {editorTransitionItems.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                            Aucun texte ou paragraphe détecté sur cette diapositive.
                                        </div>
                                    ) : (
                                        <div className="course-transition-elements-list">
                                            {editorTransitionItems.map((item, idx) => {
                                                const currentStep = transitionDraft.stepsMap[item.id] || 1;
                                                return (
                                                    <div className="course-transition-element-card" key={item.id}>
                                                        <div className="course-transition-element-preview">
                                                            <span className="element-num">#{idx + 1}</span>
                                                            <p>{item.text}</p>
                                                        </div>
                                                        <div className="course-transition-step-selector">
                                                            <label>Apparaît à :</label>
                                                            <select
                                                                value={currentStep}
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value);
                                                                    setTransitionDraft((prev) => ({
                                                                        ...prev,
                                                                        stepsMap: { ...prev.stepsMap, [item.id]: val }
                                                                    }));
                                                                }}
                                                            >
                                                                {Array.from({ length: Math.max(editorTransitionItems.length + 1, 6) }, (_, i) => i + 1).map((s) => (
                                                                    <option key={s} value={s}>
                                                                        {s === 1 ? '1 — Au départ' : `Étape ${s} (Clic ${s - 1})`}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="course-transition-editor-actions">
                            <button
                                type="button"
                                className="courses-secondary-button"
                                onClick={() => setTransitionEditorOpen(false)}
                                disabled={savingTransitions}
                            >
                                ANNULER
                            </button>
                            <button
                                type="button"
                                className="courses-save-button"
                                disabled={savingTransitions}
                                onClick={() => {
                                    const stepGroups = {};
                                    const visibleItemIds = new Set(editorTransitionItems.map((item) => item.id));
                                    Object.entries(transitionDraft.stepsMap).forEach(([id, step]) => {
                                        if (!visibleItemIds.has(id)) return;
                                        if (!stepGroups[step]) stepGroups[step] = [];
                                        stepGroups[step].push(id);
                                    });
                                    const steps = Object.entries(stepGroups).map(([step, elementIds]) => ({
                                        step: Number(step),
                                        elementIds
                                    })).sort((a, b) => a.step - b.step);

                                    void saveSlideTransitions({
                                        enabled: transitionDraft.enabled,
                                        perParagraph: transitionDraft.perParagraph !== false,
                                        useCustomMasks: true,
                                        masks: (transitionDraft.masks || []).map((mask) => ({
                                            id: String(mask.id || `mask_${Date.now()}`),
                                            x: Math.max(0, Math.min(100, Number(mask.x) || 0)),
                                            y: Math.max(0, Math.min(100, Number(mask.y) || 0)),
                                            width: Math.max(1, Math.min(100, Number(mask.width) || 1)),
                                            height: Math.max(1, Math.min(100, Number(mask.height) || 1)),
                                            step: Math.max(1, Number(mask.step) || 1)
                                        })),
                                        steps
                                    });
                                }}
                            >
                                {savingTransitions ? 'ENREGISTREMENT…' : 'ENREGISTRER LES TRANSITIONS'}
                            </button>
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
                                <div className="course-video-scene-head"><span>{sceneIndex + 1}</span><input value={scene.name} onChange={(event) => setVideoSequencer((current) => ({ ...current, slides: current.slides.map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: slide.scenes.map((item, index) => index === sceneIndex ? { ...item, name: event.target.value } : item) } : slide) }))} /><label className="course-video-upload-button">{uploadingSequenceVideos ? 'IMPORT…' : '＋ MÉDIA'}<input type="file" accept="video/*,audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,.mp4,.webm" multiple hidden disabled={uploadingSequenceVideos} onChange={(event) => void uploadSequenceVideos(event.target.files, sceneIndex)} /></label>{videoSequencerScenes.length > 1 ? <button type="button" className="course-video-delete" onClick={() => setVideoSequencer((current) => ({ ...current, slides: current.slides.map((slide) => slide.slideNumber === current.activeSlideNumber ? { ...slide, scenes: slide.scenes.filter((_, index) => index !== sceneIndex) } : slide) }))}>×</button> : null}</div>
                                <div className="course-video-youtube-add"><input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Coller un lien YouTube" value={youtubeDrafts[sceneIndex] || ''} onChange={(event) => setYoutubeDrafts((current) => ({ ...current, [sceneIndex]: event.target.value }))} onPaste={(event) => event.stopPropagation()} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); addYoutubeSequence(sceneIndex); } }} /><button type="button" onClick={() => addYoutubeSequence(sceneIndex)}>＋ AJOUTER LE LIEN</button></div>
                                {scene.sequences.length === 0 ? <div className={`course-video-empty ${draggedSequence ? 'drop-ready' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={() => moveSequenceVideo(sceneIndex, 0)}>Importe les vidéos de cette scène.</div> : null}
                                <div className="course-video-sequence-list">{scene.sequences.map((sequence, index) => <div className={`course-video-sequence-row ${draggedSequence?.sceneIndex === sceneIndex && draggedSequence?.videoIndex === index ? 'dragging' : ''}`} key={sequence.id || index} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={() => moveSequenceVideo(sceneIndex, index)}>
                                    <span className="course-video-drag-handle" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(sequence.id || index)); setDraggedSequence({ sceneIndex, videoIndex: index }); }} onDragEnd={() => setDraggedSequence(null)} title="Glisser pour déplacer">⋮⋮</span><input className="course-video-sequence-number" type="number" min="1" max={scene.sequences.length} defaultValue={index + 1} key={`${sequence.id || index}_${index}`} aria-label={`Position du média ${index + 1}`} onBlur={(event) => moveSequenceVideoByNumber(sceneIndex, index, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><div className={`course-video-media-cell ${isAudioSequence(sequence) ? 'audio' : ''}`}>{sequence.sourceType === 'youtube' || getYoutubeVideoId(sequence.url) ? <iframe src={getYoutubeEmbedUrl(sequence.url)} title={sequence.name || 'Vidéo YouTube'} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : isAudioSequence(sequence) ? <audio src={sequence.url} preload="metadata" controls /> : <video src={sequence.url} preload="metadata" controls />}<button type="button" className="course-open-sequence-editor" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openSequenceCutEditor(sceneIndex, index, sequence); }}><strong>✂ OUVRIR L’ÉDITEUR</strong><span>{Math.max(0, Number(sequence.startSec || 0))}s → {Number(sequence.endSec || 0) > 0 ? `${Number(sequence.endSec)}s` : 'fin du média'}</span></button></div>
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
