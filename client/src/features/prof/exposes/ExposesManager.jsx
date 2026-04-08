import React, { useEffect, useMemo, useState } from 'react';

const norm = (value = '') =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

const extractId = (value) => String(value?._id || value?.id || value || '');
const guessSlideNumberFromText = (value = '') => {
    const match = String(value || '').match(/(\d+)/);
    const parsed = Number(match?.[1] || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const toEmbeddableCanvasUrl = (raw = '') => {
    const txt = String(raw || '').trim();
    if (!txt) return '';

    let normalized = txt
        .replace(/^https?:\/\/canvas\.com/i, 'https://www.canva.com')
        .replace(/^https?:\/\/www\.canvas\.com/i, 'https://www.canva.com');

    try {
        const u = new URL(normalized);
        const host = String(u.hostname || '').toLowerCase();
        if (!host.includes('canva.com')) return normalized;
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'design' && parts.length >= 2) {
            const designId = parts[1];
            const accessToken = parts[2] || '';
            const mode = (parts[3] || '').toLowerCase();
            const tail = accessToken ? `/${accessToken}` : '';
            if (mode === 'edit' || mode === '' || mode === 'preview') {
                u.pathname = `/design/${designId}${tail}/view`;
            }
            u.searchParams.set('embed', '1');
            return u.toString();
        }
        return u.toString();
    } catch (_) {
        return normalized;
    }
};

const createSpriteAction = (index = 0, soundUrl = '', soundPitch = 1) => ({
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: index === 0 ? 'Parler' : `Action ${index + 1}`,
    frames: [],
    frameUrlInput: '',
    soundUrl: String(soundUrl || '').trim(),
    soundPitch: Math.max(0.5, Math.min(2, Number(soundPitch || 1))),
    frameDurationSec: 0.18,
    startSec: Math.max(0, index * 2),
    durationSec: 2
});

const createSpriteAnimationBlock = (actorImageUrl = '', soundUrl = '', soundPitch = 1) => ({
    type: 'animation',
    title: 'Animation sprite',
    actorName: 'Personnage',
    actorImageUrl: String(actorImageUrl || '').trim(),
    actorX: 120,
    actorY: 120,
    actorWidth: 140,
    actorHeight: 140,
    savedActions: [],
    actions: [createSpriteAction(0, soundUrl, soundPitch)]
});

export default function ExposesManager({ globalClass, globalClassId = '' }) {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [students, setStudents] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [selectedRecorder, setSelectedRecorder] = useState(null);
    const [recording, setRecording] = useState(false);
    const [recordingSec, setRecordingSec] = useState(0);
    const [uploadingRecording, setUploadingRecording] = useState(false);
    const [previewingRecordingId, setPreviewingRecordingId] = useState('');
    const [savingPitch, setSavingPitch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [studioTab, setStudioTab] = useState('audio');
    const [uploadingImages, setUploadingImages] = useState(false);
    const [imageCameraError, setImageCameraError] = useState('');
    const [imageCameraReady, setImageCameraReady] = useState(false);
    const [selectedSpriteUrl, setSelectedSpriteUrl] = useState('');
    const [spriteEditorOpen, setSpriteEditorOpen] = useState(false);
    const [spriteAnimationDraft, setSpriteAnimationDraft] = useState(null);
    const [savingSpriteAnimation, setSavingSpriteAnimation] = useState(false);

    const recorderRef = React.useRef(null);
    const streamRef = React.useRef(null);
    const chunksRef = React.useRef([]);
    const startedAtRef = React.useRef(0);
    const timerRef = React.useRef(null);
    const previewAudioRef = React.useRef(null);
    const imageInputRef = React.useRef(null);
    const imageVideoRef = React.useRef(null);
    const imageCanvasRef = React.useRef(null);
    const exposeGridCols = 6;

    const classStudents = useMemo(() => {
        const classKey = norm(globalClass || '');
        return (students || [])
            .filter((student) => norm(student?.currentClass || '') === classKey)
            .sort((a, b) => {
                const last = String(a?.lastName || '').localeCompare(String(b?.lastName || ''), 'fr', { sensitivity: 'base' });
                if (last !== 0) return last;
                return String(a?.firstName || '').localeCompare(String(b?.firstName || ''), 'fr', { sensitivity: 'base' });
            });
    }, [students, globalClass]);
    const filteredStudents = useMemo(() => {
        const safeSearch = norm(searchTerm || '');
        if (!safeSearch) return classStudents;
        return classStudents.filter((student) => {
            const label = norm(`${student?.firstName || ''} ${student?.lastName || ''}`);
            return label.includes(safeSearch);
        });
    }, [classStudents, searchTerm]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [exposesRes, studentsRes, chaptersRes] = await Promise.all([
                fetch('/api/exposes/all'),
                fetch('/api/admin/students'),
                fetch('/api/structure/chapters')
            ]);
            const [exposes, sts, chs] = await Promise.all([
                exposesRes.ok ? exposesRes.json() : [],
                studentsRes.ok ? studentsRes.json() : [],
                chaptersRes.ok ? chaptersRes.json() : []
            ]);
            setRows(Array.isArray(exposes) ? exposes : []);
            setStudents(Array.isArray(sts) ? sts : []);
            setChapters(Array.isArray(chs) ? chs : []);
        } catch (_) {
            setRows([]);
            setStudents([]);
            setChapters([]);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);
    useEffect(() => () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (previewAudioRef.current) {
            try {
                previewAudioRef.current.pause();
            } catch (_) {}
            previewAudioRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        const stopImageCamera = () => {
            if (imageVideoRef.current?.srcObject) {
                imageVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
                imageVideoRef.current.srcObject = null;
            }
            if (streamRef.current) {
                try {
                    streamRef.current.getTracks().forEach((track) => track.stop());
                } catch (_) {}
                streamRef.current = null;
            }
            setImageCameraReady(false);
        };

        const startImageCamera = async () => {
            if (!selectedRecorder || studioTab !== 'image') {
                stopImageCamera();
                return;
            }
            setImageCameraError('');
            setImageCameraReady(false);
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('media_devices_unavailable');
                }
                stopImageCamera();
                let stream = null;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: 'environment' } },
                        audio: false
                    });
                } catch (_) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false
                    });
                }
                streamRef.current = stream;
                if (imageVideoRef.current) {
                    imageVideoRef.current.srcObject = stream;
                    imageVideoRef.current.onloadedmetadata = () => {
                        setImageCameraReady(true);
                        if (imageVideoRef.current?.play) {
                            imageVideoRef.current.play().catch(() => {});
                        }
                    };
                } else {
                    setImageCameraReady(true);
                }
            } catch (error) {
                setImageCameraError("Caméra indisponible.");
            }
        };

        void startImageCamera();
        return () => stopImageCamera();
    }, [selectedRecorder, studioTab]);

    const filtered = useMemo(() => {
        const key = norm(globalClass || '');
        return (rows || []).filter((x) => {
            const targets = (x.targetClassrooms || []).map(norm);
            return !key || targets.includes(key);
        });
    }, [rows, globalClass]);

    useEffect(() => {
        if (!filtered.length) { setSelectedId(''); return; }
        const still = filtered.some((x) => String(x._id) === String(selectedId));
        if (!still) setSelectedId(String(filtered[0]._id));
    }, [filtered, selectedId]);

    const selected = filtered.find((x) => String(x._id) === String(selectedId)) || null;
    const activeExpose = selected || null;
    const buildRecorderState = React.useCallback((student, expose) => {
        const studentId = String(student?._id || '');
        const recordings = (expose?.presentations || [])
            .filter((row) => String(row?.studentId || '') === studentId && String(row?.recordingUrl || '').trim())
            .sort((a, b) => {
                if (Boolean(a?.selectedForPresenter) !== Boolean(b?.selectedForPresenter)) {
                    return a?.selectedForPresenter ? -1 : 1;
                }
                return new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime();
            });
        const selectedEntry = recordings.find((row) => row?.selectedForPresenter) || recordings[0] || null;
        return {
            studentId,
            studentLabel: `${student?.firstName || ''} ${student?.lastName || ''}`.trim(),
            presentationTitle: String(selectedEntry?.presentationTitle || `${globalClass} - ${student?.firstName || ''} ${student?.lastName || ''}`).trim(),
            presenterName: String(selectedEntry?.presenterName || `${student?.firstName || ''} ${student?.lastName || ''}`).trim(),
            slideNumber: Math.max(1, Number(selectedEntry?.presenterSlideNumber || guessSlideNumberFromText(selectedEntry?.slidesText || '1'))),
            recordingPitch: Math.max(0.5, Math.min(2, Number(selectedEntry?.recordingPitch || 1))),
            recordings,
            selectedRecordingId: String(selectedEntry?._id || ''),
            spriteImageUrls: (expose?.presentations || [])
                .filter((row) => String(row?.studentId || '') === studentId)
                .flatMap((row) => (Array.isArray(row?.spriteImageUrls) ? row.spriteImageUrls : []))
                .map((url) => String(url || '').trim())
                .filter(Boolean),
            spriteAnimations: (expose?.presentations || [])
                .filter((row) => String(row?.studentId || '') === studentId)
                .flatMap((row) => (Array.isArray(row?.spriteAnimations) ? row.spriteAnimations : []))
                .map((item) => ({
                    imageUrl: String(item?.imageUrl || '').trim(),
                    animationBlock: item?.animationBlock && typeof item.animationBlock === 'object' ? item.animationBlock : null
                }))
                .filter((item) => item.imageUrl)
        };
    }, [globalClass]);

    const studentsById = useMemo(() => {
        const map = new Map();
        (students || []).forEach((student) => map.set(String(student._id), student));
        return map;
    }, [students]);

    useEffect(() => {
        if (!selectedRecorder?.studentId) return;
        const student = studentsById.get(String(selectedRecorder.studentId));
        if (!student) return;
        const next = buildRecorderState(student, activeExpose);
        setSelectedRecorder(next);
        const selectedEntry = next.recordings.find((row) => String(row?._id || '') === String(next.selectedRecordingId)) || next.recordings[0] || null;
        setRecordingSec(Number(selectedEntry?.recordingDurationSec || 0));
    }, [activeExpose, studentsById, selectedRecorder?.studentId, buildRecorderState]);

    const stopRecordingState = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        recorderRef.current = null;
        chunksRef.current = [];
        setRecording(false);
    };

    const ensureActiveExpose = async () => {
        if (activeExpose?._id) return activeExpose;
        const payload = {
            title: `Exposé ${String(globalClass || '').trim() || 'Classe'}`,
            subject: 'GENERAL',
            chapterId: '',
            targetClassrooms: [String(globalClass || '').trim()],
            assignedStudents: [],
            isAllClass: true,
            isEnabled: true
        };
        const res = await fetch('/api/exposes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = res.ok ? await res.json() : null;
        if (!res.ok || !data?._id) throw new Error('Impossible de créer le support exposé de la classe');
        await loadData();
        setSelectedId(String(data._id));
        return data;
    };

    const uploadPresenterRecording = async (blob, meta) => {
        if (!meta?.studentId || !blob) return;
        setUploadingRecording(true);
        try {
            const expose = await ensureActiveExpose();
            const fd = new FormData();
            fd.append('studentId', String(meta.studentId || ''));
            fd.append('presentationTitle', String(meta.presentationTitle || ''));
            fd.append('presenterName', String(meta.presenterName || ''));
            fd.append('slideNumber', String(meta.slideNumber || 1));
            fd.append('recordingDurationSec', String(Math.max(1, Number(recordingSec || 0))));
            fd.append('recordingPitch', String(Math.max(0.5, Math.min(2, Number(meta.recordingPitch || 1)))));
            fd.append('audio', blob, `expose_${Date.now()}.webm`);
            const res = await fetch(`/api/exposes/${encodeURIComponent(String(expose._id))}/presenter-recording`, {
                method: 'POST',
                body: fd
            });
            const data = res.ok ? await res.json() : {};
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'Echec enregistrement audio');
            await loadData();
        } catch (e) {
            alert(e.message || 'Echec enregistrement audio');
        } finally {
            setUploadingRecording(false);
        }
    };

    const startRecording = async () => {
        if (!selectedRecorder) return;
        try {
            if (previewAudioRef.current) {
                try {
                    previewAudioRef.current.pause();
                    previewAudioRef.current.currentTime = 0;
                } catch (_) {}
                previewAudioRef.current = null;
            }
            setPreviewingRecordingId('');
            setRecordingSec(0);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = (event) => {
                if (event.data?.size) chunksRef.current.push(event.data);
            };
            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const duration = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
                setRecordingSec(duration);
                stopRecordingState();
                await uploadPresenterRecording(blob, { ...selectedRecorder, recordingDurationSec: duration });
            };
            recorderRef.current = recorder;
            startedAtRef.current = Date.now();
            setRecordingSec(0);
            setRecording(true);
            timerRef.current = window.setInterval(() => {
                setRecordingSec(Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)));
            }, 250);
            recorder.start();
        } catch (_) {
            alert('Micro non autorisé.');
        }
    };

    const stopRecording = () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
        }
    };

    const savePitch = async (recordingEntryId, nextPitch) => {
        if (!recordingEntryId) return;
        setSavingPitch(true);
        try {
            const expose = await ensureActiveExpose();
            const res = await fetch(`/api/exposes/${encodeURIComponent(String(expose._id))}/presenter-recording-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recordingEntryId: String(recordingEntryId || ''),
                    recordingPitch: nextPitch
                })
            });
            const data = res.ok ? await res.json() : {};
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'Echec sauvegarde pitch');
            await loadData();
        } catch (e) {
            alert(e.message || 'Echec sauvegarde pitch');
        } finally {
            setSavingPitch(false);
        }
    };

    const togglePreview = (recordingEntry, explicitPitch = null) => {
        const entryId = String(recordingEntry?._id || '');
        const url = String(recordingEntry?.recordingUrl || '').trim();
        if (!url) return;
        if (previewAudioRef.current && String(previewingRecordingId || '') === entryId) {
            try {
                previewAudioRef.current.pause();
                previewAudioRef.current.currentTime = 0;
            } catch (_) {}
            previewAudioRef.current = null;
            setPreviewingRecordingId('');
            return;
        }
        if (previewAudioRef.current) {
            try {
                previewAudioRef.current.pause();
                previewAudioRef.current.currentTime = 0;
            } catch (_) {}
            previewAudioRef.current = null;
        }
        try {
            const audio = new Audio(url);
            const nextRate = Math.max(0.5, Math.min(2, Number(explicitPitch ?? recordingEntry?.recordingPitch ?? 1)));
            audio.playbackRate = nextRate;
            try { audio.preservesPitch = false; } catch (_) {}
            try { audio.mozPreservesPitch = false; } catch (_) {}
            try { audio.webkitPreservesPitch = false; } catch (_) {}
            audio.onended = () => {
                previewAudioRef.current = null;
                setPreviewingRecordingId('');
            };
            audio.onerror = () => {
                previewAudioRef.current = null;
                setPreviewingRecordingId('');
            };
            previewAudioRef.current = audio;
            setPreviewingRecordingId(entryId);
            audio.play().catch(() => {
                previewAudioRef.current = null;
                setPreviewingRecordingId('');
            });
        } catch (_) {}
    };

    const applyPitchPreset = (recordingEntry, preset) => {
        if (!recordingEntry?._id) return;
        const map = {
            vite: 1.75,
            lent: 0.8
        };
        const nextPitch = Math.max(0.5, Math.min(2, Number(map[preset] || 1)));
        setSelectedRecorder((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                recordings: (prev.recordings || []).map((row) => (
                    String(row?._id || '') === String(recordingEntry._id) ? { ...row, recordingPitch: nextPitch } : row
                ))
            };
        });
        void savePitch(recordingEntry._id, nextPitch);
    };

    const selectRecording = async (recordingEntryId) => {
        if (!recordingEntryId || !activeExpose?._id) return;
        try {
            const res = await fetch(`/api/exposes/${encodeURIComponent(String(activeExpose._id))}/presenter-recording-select`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordingEntryId })
            });
            const data = res.ok ? await res.json() : {};
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'Selection impossible');
            await loadData();
        } catch (e) {
            alert(e.message || 'Selection impossible');
        }
    };

    const deleteRecording = async (recordingEntryId) => {
        if (!recordingEntryId || !activeExpose?._id) return;
        const ok = window.confirm('Supprimer cet audio ?');
        if (!ok) return;
        try {
            const res = await fetch(
                `/api/exposes/${encodeURIComponent(String(activeExpose._id))}/presenter-recording/${encodeURIComponent(String(recordingEntryId))}`,
                { method: 'DELETE' }
            );
            const data = res.ok ? await res.json() : {};
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'Suppression impossible');
            if (String(previewingRecordingId || '') === String(recordingEntryId) && previewAudioRef.current) {
                try {
                    previewAudioRef.current.pause();
                    previewAudioRef.current.currentTime = 0;
                } catch (_) {}
                previewAudioRef.current = null;
                setPreviewingRecordingId('');
            }
            await loadData();
        } catch (e) {
            alert(e.message || 'Suppression impossible');
        }
    };

    const uploadPresenterImages = async (fileList) => {
        if (!selectedRecorder?.studentId || !fileList?.length) return;
        setUploadingImages(true);
        try {
            const expose = await ensureActiveExpose();
            const fd = new FormData();
            fd.append('studentId', String(selectedRecorder.studentId || ''));
            fd.append('presentationTitle', String(selectedRecorder.presentationTitle || ''));
            fd.append('presenterName', String(selectedRecorder.presenterName || selectedRecorder.studentLabel || ''));
            fd.append('slideNumber', String(selectedRecorder.slideNumber || 1));
            Array.from(fileList).forEach((file) => {
                fd.append('images', file, file.name || `sprite_${Date.now()}.png`);
            });
            const res = await fetch(`/api/exposes/${encodeURIComponent(String(expose._id))}/presenter-images`, {
                method: 'POST',
                body: fd
            });
            const data = res.ok ? await res.json() : {};
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'Echec import images');
            await loadData();
        } catch (e) {
            alert(e.message || 'Echec import images');
        } finally {
            setUploadingImages(false);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const capturePresenterImage = () => {
        const video = imageVideoRef.current;
        const canvas = imageCanvasRef.current;
        if (!video || !canvas || !imageCameraReady) return;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], `sprite_${Date.now()}.jpg`, { type: 'image/jpeg' });
            void uploadPresenterImages([file]);
        }, 'image/jpeg', 0.92);
    };

    const deletePresenterImage = async (imageUrl) => {
        if (!activeExpose?._id || !selectedRecorder?.studentId || !imageUrl) return;
        try {
            const res = await fetch(`/api/exposes/${encodeURIComponent(String(activeExpose._id))}/presenter-image`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: String(selectedRecorder.studentId || ''),
                    presenterName: String(selectedRecorder.presenterName || selectedRecorder.studentLabel || ''),
                    slideNumber: String(selectedRecorder.slideNumber || 1),
                    imageUrl: String(imageUrl || '')
                })
            });
            const data = res.ok ? await res.json() : {};
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'Suppression image impossible');
            await loadData();
        } catch (e) {
            alert(e.message || 'Suppression image impossible');
        }
    };

    const openSpriteEditor = (imageUrl) => {
        const safeUrl = String(imageUrl || '').trim();
        if (!safeUrl || !selectedRecorder) return;
        const existingAnimation = (selectedRecorder.spriteAnimations || []).find((item) => String(item?.imageUrl || '').trim() === safeUrl)?.animationBlock || null;
        const selectedEntry = selectedRecorder.recordings.find((row) => String(row?._id || '') === String(selectedRecorder.selectedRecordingId || '')) || selectedRecorder.recordings[0] || null;
        setSelectedSpriteUrl(safeUrl);
        setSpriteAnimationDraft(existingAnimation || createSpriteAnimationBlock(
            safeUrl,
            String(selectedEntry?.recordingUrl || ''),
            Number(selectedEntry?.recordingPitch || selectedRecorder.recordingPitch || 1)
        ));
        setSpriteEditorOpen(true);
    };

    const updateSpriteAction = (actionId, patch) => {
        setSpriteAnimationDraft((prev) => {
            if (!prev || !Array.isArray(prev.actions)) return prev;
            return {
                ...prev,
                actions: prev.actions.map((action) => String(action?.id || '') === String(actionId || '') ? { ...action, ...patch } : action)
            };
        });
    };

    const addSpriteAction = () => {
        setSpriteAnimationDraft((prev) => {
            if (!prev) return prev;
            const actions = Array.isArray(prev.actions) ? prev.actions : [];
            return {
                ...prev,
                actions: [...actions, createSpriteAction(actions.length)]
            };
        });
    };

    const removeSpriteAction = (actionId) => {
        setSpriteAnimationDraft((prev) => {
            if (!prev) return prev;
            const actions = Array.isArray(prev.actions) ? prev.actions : [];
            if (actions.length <= 1) return prev;
            return {
                ...prev,
                actions: actions.filter((action) => String(action?.id || '') !== String(actionId || ''))
            };
        });
    };

    const appendSpriteFrames = async (actionId, fileList) => {
        const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
        if (!files.length) return;
        const urls = await Promise.all(files.map((file) => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.readAsDataURL(file);
        })));
        const currentFrames = ((spriteAnimationDraft?.actions || []).find((action) => String(action?.id || '') === String(actionId || ''))?.frames || []);
        updateSpriteAction(actionId, {
            frames: [
                ...currentFrames,
                ...urls.filter(Boolean).map((url) => ({ url, width: 140, height: 140, scale: 1, offsetX: 0, offsetY: 0 }))
            ]
        });
    };

    const saveSpriteAnimation = async () => {
        if (!activeExpose?._id || !selectedRecorder?.studentId || !selectedRecorder?.presenterName || !selectedRecorder?.slideNumber || !selectedSpriteUrl || !spriteAnimationDraft) return;
        setSavingSpriteAnimation(true);
        try {
            const res = await fetch(`/api/exposes/${encodeURIComponent(String(activeExpose._id))}/presenter-image-animation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: selectedRecorder.studentId,
                    presenterName: selectedRecorder.presenterName,
                    slideNumber: selectedRecorder.slideNumber,
                    imageUrl: selectedSpriteUrl,
                    animationBlock: spriteAnimationDraft
                })
            });
            const data = res.ok ? await res.json() : {};
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'Sauvegarde animation impossible');
            await loadData();
            setSpriteEditorOpen(false);
        } catch (e) {
            alert(e.message || 'Sauvegarde animation impossible');
        } finally {
            setSavingSpriteAnimation(false);
        }
    };

    return (
        <div className="p-6 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-[28px] p-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="text-2xl font-black uppercase text-slate-800">Mode Liste</div>
                    <div className="flex items-center gap-3">
                        <div className="px-5 py-4 rounded-2xl border border-slate-200 bg-white text-[13px] font-black text-indigo-500 shadow-sm">A</div>
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 mb-4">
                    <input
                        className="w-full bg-transparent outline-none text-slate-700 font-black"
                        placeholder="🔎 Trouver un élève de la classe..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
                <div className="overflow-auto">
                    <div className="min-w-[720px]">
                        <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: `repeat(${exposeGridCols}, minmax(92px, 1fr))` }}>
                            {Array.from({ length: exposeGridCols }).map((_, idx) => (
                                <div key={`hdr_${idx}`} className="text-center text-[11px] font-black uppercase text-slate-400">
                                    Col {idx + 1}
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${exposeGridCols}, minmax(92px, 1fr))` }}>
                            {filteredStudents.map((student) => {
                                const studentId = String(student?._id || '');
                                const studentRecordings = (activeExpose?.presentations || []).filter((row) => (
                                    String(row?.studentId || '') === studentId && String(row?.recordingUrl || '').trim()
                                ));
                                const studentImages = (activeExpose?.presentations || []).filter((row) => (
                                    String(row?.studentId || '') === studentId
                                    && Array.isArray(row?.spriteImageUrls)
                                    && row.spriteImageUrls.some((url) => String(url || '').trim())
                                ));
                                const imageCount = studentImages.reduce((sum, row) => (
                                    sum + (Array.isArray(row?.spriteImageUrls) ? row.spriteImageUrls.filter((url) => String(url || '').trim()).length : 0)
                                ), 0);
                                const active = String(selectedRecorder?.studentId || '') === studentId;
                                const hasAudio = studentRecordings.length > 0;
                                const hasImages = imageCount > 0;
                                return (
                                    <button
                                        key={studentId}
                                        onClick={() => {
                                            const next = buildRecorderState(student, activeExpose);
                                            setSelectedRecorder(next);
                                            setStudioTab('audio');
                                            const selectedEntry = next.recordings.find((row) => String(row?._id || '') === String(next.selectedRecordingId)) || next.recordings[0] || null;
                                            setRecordingSec(Number(selectedEntry?.recordingDurationSec || 0));
                                        }}
                                        className={`rounded-[16px] border px-2 py-3 min-h-[108px] shadow-sm transition-all ${
                                            active
                                                ? 'bg-rose-50 border-rose-300'
                                                : (hasAudio ? 'bg-orange-50 border-orange-200 hover:bg-orange-100' : 'bg-white border-slate-200 hover:bg-slate-50')
                                        }`}
                                    >
                                        <div className="text-[24px] leading-none">{String(student.gender || '').toUpperCase() === 'F' ? '👧' : '👦'}</div>
                                        <div className="mt-2 text-[13px] font-black text-slate-700 leading-tight">
                                            {student.firstName}
                                        </div>
                                        <div className="text-[11px] font-black text-slate-500 leading-tight">
                                            {student.lastName}
                                        </div>
                                        <div className={`mt-2 text-[10px] font-black ${(hasAudio || hasImages) ? 'text-orange-600' : 'text-slate-300'}`}>
                                            {[hasAudio ? `${studentRecordings.length} audio${studentRecordings.length > 1 ? 's' : ''}` : '', hasImages ? `${imageCount} image${imageCount > 1 ? 's' : ''}` : ''].filter(Boolean).join(' • ')}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {!loading && filteredStudents.length === 0 && (
                        <div className="text-xs text-slate-400 font-bold p-4">
                            Aucun élève trouvé.
                        </div>
                    )}
                    {loading && <div className="text-xs text-indigo-500 font-black p-4">Chargement...</div>}
                </div>
            </div>

            {selectedRecorder ? (
                <div className="fixed inset-0 z-[140] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="w-full max-w-4xl rounded-[30px] border border-slate-200 bg-white shadow-2xl overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 flex items-center justify-between gap-4">
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">Studio Exposé</div>
                                <div className="text-3xl font-black uppercase text-slate-800 mt-1">{selectedRecorder.studentLabel}</div>
                                <div className="text-[11px] font-black uppercase text-slate-400 mt-1">{globalClass || 'CLASSE'}</div>
                            </div>
                            <button type="button" className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-700 font-black text-xl" onClick={() => setSelectedRecorder(null)}>×</button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="flex items-center gap-3">
                                <button type="button" className={`px-4 py-2 rounded-2xl font-black text-[12px] uppercase border ${studioTab === 'audio' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`} onClick={() => setStudioTab('audio')}>Audio</button>
                                <button type="button" className={`px-4 py-2 rounded-2xl font-black text-[12px] uppercase border ${studioTab === 'image' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`} onClick={() => setStudioTab('image')}>Image</button>
                            </div>

                            {studioTab === 'audio' ? (
                                <div className="space-y-5">
                                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                                        <div className="flex flex-wrap items-center gap-3">
                                            {!recording ? (
                                                <button type="button" className="px-5 py-3 rounded-2xl bg-red-500 text-white font-black text-[12px] uppercase shadow-lg" onClick={() => void startRecording()} disabled={uploadingRecording}>Rec</button>
                                            ) : (
                                                <button type="button" className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-[12px] uppercase shadow-lg" onClick={stopRecording}>Stop</button>
                                            )}
                                            <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-[12px] font-black text-slate-600">
                                                {recording ? `Enregistrement ${recordingSec}s` : (uploadingRecording ? 'Envoi...' : 'Prêt')}
                                            </div>
                                            <div className="text-[12px] font-black text-slate-500">{selectedRecorder.presenterName || selectedRecorder.studentLabel}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {(selectedRecorder.recordings || []).length === 0 ? (
                                            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-black text-slate-400">Aucun audio enregistré.</div>
                                        ) : null}
                                        {(selectedRecorder.recordings || []).map((recordingEntry, index) => {
                                            const isSelected = Boolean(recordingEntry?.selectedForPresenter);
                                            const isPreviewing = String(previewingRecordingId || '') === String(recordingEntry?._id || '');
                                            return (
                                                <div key={String(recordingEntry?._id || `recording_${index}`)} className={`rounded-[22px] border px-4 py-4 flex flex-wrap items-center gap-3 ${isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                                                    <div className="min-w-[170px]">
                                                        <div className="text-sm font-black text-slate-800">Rec {index + 1}</div>
                                                        <div className="text-[11px] font-black uppercase text-slate-500 mt-1">
                                                            {Number(recordingEntry?.recordingDurationSec || 0)}s
                                                            {isSelected ? ' • sélectionné' : ''}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                                                        <button type="button" className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]" onClick={() => togglePreview(recordingEntry)}>{isPreviewing ? 'Stop' : 'Play'}</button>
                                                        <button type="button" className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]" onClick={() => { applyPitchPreset(recordingEntry, 'vite'); togglePreview(recordingEntry, 1.75); }} disabled={savingPitch}>Vite</button>
                                                        <button type="button" className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]" onClick={() => { applyPitchPreset(recordingEntry, 'lent'); togglePreview(recordingEntry, 0.8); }} disabled={savingPitch}>Lent</button>
                                                        <button type="button" className={`px-4 py-2 rounded-2xl font-black text-[12px] ${isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`} onClick={() => void selectRecording(recordingEntry?._id)}>{isSelected ? 'Choisi' : 'Choisir'}</button>
                                                        <button type="button" className="w-10 h-10 rounded-full border border-red-200 bg-red-50 text-red-600 font-black" onClick={() => void deleteRecording(recordingEntry?._id)}>X</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                                        <div className="flex flex-wrap items-center gap-3 mb-3">
                                            <button type="button" className="px-5 py-3 rounded-2xl bg-indigo-600 text-white font-black text-[12px] uppercase shadow-lg" onClick={capturePresenterImage} disabled={!imageCameraReady || uploadingImages}>
                                                {uploadingImages ? 'Envoi...' : 'Prendre photo'}
                                            </button>
                                            <div className="text-[12px] font-black text-slate-500">{selectedRecorder.presenterName || selectedRecorder.studentLabel}</div>
                                        </div>
                                        <div className="rounded-[18px] overflow-hidden bg-slate-900 min-h-[240px] flex items-center justify-center">
                                            {imageCameraError ? (
                                                <div className="text-white font-black text-sm">{imageCameraError}</div>
                                            ) : (
                                                <video
                                                    ref={imageVideoRef}
                                                    autoPlay
                                                    playsInline
                                                    muted
                                                    className="w-full max-h-[360px] object-cover"
                                                />
                                            )}
                                        </div>
                                        <canvas ref={imageCanvasRef} className="hidden" />
                                    </div>
                                    {(selectedRecorder.spriteImageUrls || []).length > 0 ? (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {(selectedRecorder.spriteImageUrls || []).map((url, index) => (
                                                <div
                                                    key={`${url}_${index}`}
                                                    className={`relative rounded-[18px] border bg-slate-50 p-2 ${selectedSpriteUrl === url ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}`}
                                                >
                                                    <button
                                                        type="button"
                                                        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white border border-red-200 text-red-600 font-black"
                                                        onClick={() => void deletePresenterImage(url)}
                                                    >
                                                        ×
                                                    </button>
                                                    <button type="button" className="block w-full" onClick={() => setSelectedSpriteUrl(url)}>
                                                        <img src={toEmbeddableCanvasUrl(url) || url} alt={`Sprite ${index + 1}`} className="w-full h-32 object-contain rounded-xl bg-white" />
                                                    </button>
                                                </div>
                                            ))}
                                            </div>
                                            {selectedSpriteUrl ? (
                                                <div className="rounded-[18px] border border-slate-200 bg-white p-4 space-y-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-[12px] font-black uppercase text-slate-500">Sprite sélectionné</div>
                                                        <button type="button" className="px-4 py-2 rounded-2xl bg-indigo-600 text-white font-black text-[12px] uppercase" onClick={() => openSpriteEditor(selectedSpriteUrl)}>Editer</button>
                                                    </div>
                                                    <img src={toEmbeddableCanvasUrl(selectedSpriteUrl) || selectedSpriteUrl} alt="" className="w-28 h-28 object-contain rounded-xl bg-slate-50 border border-slate-200" />
                                                </div>
                                            ) : null}
                                            {spriteEditorOpen && spriteAnimationDraft ? (
                                                <div className="rounded-[24px] border border-indigo-200 bg-white p-5 space-y-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-[12px] font-black uppercase text-indigo-500">Edition sprite</div>
                                                            <div className="text-xl font-black text-slate-800">Actions animées</div>
                                                        </div>
                                                        <button type="button" className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px] uppercase" onClick={() => setSpriteEditorOpen(false)}>Fermer</button>
                                                    </div>
                                                    <div className="flex items-start gap-4">
                                                        <img src={toEmbeddableCanvasUrl(selectedSpriteUrl) || selectedSpriteUrl} alt="" className="w-28 h-28 object-contain rounded-xl bg-slate-50 border border-slate-200" />
                                                        <div className="flex-1 space-y-3">
                                                            {(spriteAnimationDraft.actions || []).map((action, actionIndex) => (
                                                                <div key={action.id} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 space-y-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <input
                                                                            className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-white font-black text-slate-800"
                                                                            value={String(action?.name || '')}
                                                                            onChange={(event) => updateSpriteAction(action.id, { name: event.target.value })}
                                                                        />
                                                                        <button type="button" className="px-3 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]" onClick={() => removeSpriteAction(action.id)}>×</button>
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-3">
                                                                        <label className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px] uppercase cursor-pointer">
                                                                            +ordi
                                                                            <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void appendSpriteFrames(action.id, event.target.files)} />
                                                                        </label>
                                                                        <button type="button" className="px-3 py-2 rounded-2xl border border-slate-200 bg-white font-black" onClick={() => updateSpriteAction(action.id, { frameDurationSec: Math.max(0.05, Number(action?.frameDurationSec || 0.18) - 0.05) })}>-</button>
                                                                        <div className="text-sm font-black text-slate-600">{Number(action?.frameDurationSec || 0.18).toFixed(2)}s</div>
                                                                        <button type="button" className="px-3 py-2 rounded-2xl border border-slate-200 bg-white font-black" onClick={() => updateSpriteAction(action.id, { frameDurationSec: Math.min(1.5, Number(action?.frameDurationSec || 0.18) + 0.05) })}>+</button>
                                                                    </div>
                                                                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                                                        {(action.frames || []).map((frame, frameIndex) => (
                                                                            <img key={`${action.id}_${frameIndex}`} src={String(frame?.url || frame || '')} alt="" className="w-full h-20 object-contain rounded-xl bg-white border border-slate-200" />
                                                                        ))}
                                                                        {(!action.frames || action.frames.length === 0) ? (
                                                                            <div className="col-span-full text-[12px] font-black text-slate-400">Aucun sprite chargé.</div>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <div className="flex items-center justify-between gap-3">
                                                                <button type="button" className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px] uppercase" onClick={addSpriteAction}>+ Action</button>
                                                                <button type="button" className="px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black text-[12px] uppercase" onClick={() => void saveSpriteAnimation()} disabled={savingSpriteAnimation}>
                                                                    {savingSpriteAnimation ? 'Enregistrement...' : 'Enregistrer animation'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-black text-slate-400">Aucune image enregistrée.</div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end">
                                <button type="button" className="px-4 py-3 rounded-2xl bg-white border border-slate-200 font-black text-[12px] uppercase" onClick={() => setSelectedRecorder(null)}>Quitter</button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
