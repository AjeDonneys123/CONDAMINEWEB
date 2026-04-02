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

export default function ExposesManager({ globalClass }) {
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

    const recorderRef = React.useRef(null);
    const streamRef = React.useRef(null);
    const chunksRef = React.useRef([]);
    const startedAtRef = React.useRef(0);
    const timerRef = React.useRef(null);
    const previewAudioRef = React.useRef(null);
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
            selectedRecordingId: String(selectedEntry?._id || '')
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
                                const active = String(selectedRecorder?.studentId || '') === studentId;
                                const hasAudio = studentRecordings.length > 0;
                                return (
                                    <button
                                        key={studentId}
                                        onClick={() => {
                                            const next = buildRecorderState(student, activeExpose);
                                            setSelectedRecorder(next);
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
                                        <div className={`mt-2 text-[10px] font-black ${hasAudio ? 'text-orange-600' : 'text-slate-300'}`}>
                                            {hasAudio ? `${studentRecordings.length} audio${studentRecordings.length > 1 ? 's' : ''}` : ''}
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

            {selectedRecorder && (
                <div className="fixed inset-0 z-[140] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="w-full max-w-4xl rounded-[30px] border border-slate-200 bg-white shadow-2xl overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 flex items-center justify-between gap-4">
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">Studio Audio Exposé</div>
                                <div className="text-3xl font-black uppercase text-slate-800 mt-1">{selectedRecorder.studentLabel}</div>
                                <div className="text-[11px] font-black uppercase text-slate-400 mt-1">{globalClass || 'CLASSE'}</div>
                            </div>
                            <button
                                type="button"
                                className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-700 font-black text-xl"
                                onClick={() => setSelectedRecorder(null)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                                <div className="flex flex-wrap items-center gap-3">
                                    {!recording ? (
                                        <button
                                            type="button"
                                            className="px-5 py-3 rounded-2xl bg-red-500 text-white font-black text-[12px] uppercase shadow-lg"
                                            onClick={() => void startRecording()}
                                            disabled={uploadingRecording}
                                        >
                                            Rec
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-[12px] uppercase shadow-lg"
                                            onClick={stopRecording}
                                        >
                                            Stop
                                        </button>
                                    )}
                                    <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-[12px] font-black text-slate-600">
                                        {recording ? `Enregistrement ${recordingSec}s` : (uploadingRecording ? 'Envoi...' : 'Prêt')}
                                    </div>
                                    <div className="text-[12px] font-black text-slate-500">
                                        {selectedRecorder.presenterName || selectedRecorder.studentLabel} • Slide {selectedRecorder.slideNumber}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {(selectedRecorder.recordings || []).length === 0 && (
                                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-black text-slate-400">
                                        Aucun audio enregistré.
                                    </div>
                                )}
                                {(selectedRecorder.recordings || []).map((recordingEntry, index) => {
                                    const isSelected = Boolean(recordingEntry?.selectedForPresenter);
                                    const isPreviewing = String(previewingRecordingId || '') === String(recordingEntry?._id || '');
                                    return (
                                        <div
                                            key={String(recordingEntry?._id || `recording_${index}`)}
                                            className={`rounded-[22px] border px-4 py-4 flex flex-wrap items-center gap-3 ${
                                                isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'
                                            }`}
                                        >
                                            <div className="min-w-[170px]">
                                                <div className="text-sm font-black text-slate-800">
                                                    Slide {Math.max(1, Number(recordingEntry?.presenterSlideNumber || selectedRecorder.slideNumber || 1))}
                                                </div>
                                                <div className="text-[11px] font-black uppercase text-slate-500 mt-1">
                                                    {Number(recordingEntry?.recordingDurationSec || 0)}s
                                                    {isSelected ? ' • sélectionné' : ''}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 ml-auto">
                                                <button
                                                    type="button"
                                                    className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]"
                                                    onClick={() => togglePreview(recordingEntry)}
                                                >
                                                    {isPreviewing ? 'Stop' : 'Play'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]"
                                                    onClick={() => {
                                                        applyPitchPreset(recordingEntry, 'vite');
                                                        togglePreview(recordingEntry, 1.75);
                                                    }}
                                                    disabled={savingPitch}
                                                >
                                                    Vite
                                                </button>
                                                <button
                                                    type="button"
                                                    className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]"
                                                    onClick={() => {
                                                        applyPitchPreset(recordingEntry, 'lent');
                                                        togglePreview(recordingEntry, 0.8);
                                                    }}
                                                    disabled={savingPitch}
                                                >
                                                    Lent
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`px-4 py-2 rounded-2xl font-black text-[12px] ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'border border-slate-200 bg-white text-slate-700'
                                                    }`}
                                                    onClick={() => void selectRecording(recordingEntry?._id)}
                                                >
                                                    {isSelected ? 'Choisi' : 'Choisir'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="w-10 h-10 rounded-full border border-red-200 bg-red-50 text-red-600 font-black"
                                                    onClick={() => void deleteRecording(recordingEntry?._id)}
                                                >
                                                    X
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        className="px-4 py-3 rounded-2xl bg-white border border-slate-200 font-black text-[12px] uppercase"
                                        onClick={() => setSelectedRecorder(null)}
                                    >
                                        Quitter
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
