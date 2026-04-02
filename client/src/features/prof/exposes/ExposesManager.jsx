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
    const [playingPreview, setPlayingPreview] = useState(false);
    const [savingPitch, setSavingPitch] = useState(false);

    const recorderRef = React.useRef(null);
    const streamRef = React.useRef(null);
    const chunksRef = React.useRef([]);
    const startedAtRef = React.useRef(0);
    const timerRef = React.useRef(null);
    const previewAudioRef = React.useRef(null);
    const previewRestartRef = React.useRef(false);
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

    const chapterById = useMemo(() => {
        const m = new Map();
        (chapters || []).forEach((ch) => m.set(String(ch._id), ch));
        return m;
    }, [chapters]);

    const studentNameById = useMemo(() => {
        const m = new Map();
        (students || []).forEach((s) => m.set(String(s._id), `${s.firstName || ''} ${s.lastName || ''}`.trim()));
        return m;
    }, [students]);

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
    const buildRecorderState = React.useCallback((student, exposePresentation) => ({
        studentId: String(student?._id || ''),
        presentationTitle: String(exposePresentation?.presentationTitle || `${globalClass} - ${student?.firstName || ''} ${student?.lastName || ''}`).trim(),
        presenterName: `${student?.firstName || ''} ${student?.lastName || ''}`.trim(),
        slideNumber: Math.max(1, Number(exposePresentation?.presenterSlideNumber || guessSlideNumberFromText(exposePresentation?.slidesText || '1'))),
        studentLabel: `${student?.firstName || ''} ${student?.lastName || ''}`.trim(),
        recordingUrl: String(exposePresentation?.recordingUrl || ''),
        recordingPitch: Math.max(0.5, Math.min(2, Number(exposePresentation?.recordingPitch || 1)))
    }), [globalClass]);

    const grouped = useMemo(() => {
        const map = new Map();
        const list = selected?.presentations || [];
        list.forEach((p, idx) => {
            const title = String(p?.presentationTitle || '').trim() || 'Sans titre';
            if (!map.has(title)) map.set(title, []);
            map.get(title).push({ ...p, _idx: idx });
        });
        return [...map.entries()].map(([presentationTitle, items]) => ({ presentationTitle, items }));
    }, [selected]);

    const studentsById = useMemo(() => {
        const map = new Map();
        (students || []).forEach((student) => map.set(String(student._id), student));
        return map;
    }, [students]);

    useEffect(() => {
        if (!selectedRecorder?.studentId) return;
        const student = studentsById.get(String(selectedRecorder.studentId));
        if (!student) return;
        const exposePresentation = (activeExpose?.presentations || []).find((row) => String(row?.studentId || '') === String(selectedRecorder.studentId)) || null;
        setSelectedRecorder((prev) => {
            if (!prev) return prev;
            const next = buildRecorderState(student, exposePresentation);
            return {
                ...prev,
                presentationTitle: next.presentationTitle,
                presenterName: next.presenterName,
                slideNumber: next.slideNumber,
                studentLabel: next.studentLabel,
                recordingUrl: next.recordingUrl,
                recordingPitch: next.recordingPitch
            };
        });
        setRecordingSec(Number(exposePresentation?.recordingDurationSec || 0));
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
            setPlayingPreview(false);
            setSelectedRecorder((prev) => prev ? { ...prev, recordingUrl: '' } : prev);
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

    const savePitch = async (meta, nextPitch) => {
        if (!meta?.studentId || !meta?.presentationTitle) return;
        setSavingPitch(true);
        try {
            const expose = await ensureActiveExpose();
            const res = await fetch(`/api/exposes/${encodeURIComponent(String(expose._id))}/presenter-recording-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: String(meta.studentId || ''),
                    presentationTitle: String(meta.presentationTitle || ''),
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

    const togglePreview = () => {
        const url = String(selectedRecorder?.recordingUrl || '').trim();
        if (!url) return;
        if (previewAudioRef.current) {
            try {
                previewAudioRef.current.pause();
                previewAudioRef.current.currentTime = 0;
            } catch (_) {}
            previewAudioRef.current = null;
            setPlayingPreview(false);
            return;
        }
        try {
            const audio = new Audio(url);
            const nextRate = Math.max(0.5, Math.min(2, Number(selectedRecorder?.recordingPitch || 1)));
            audio.playbackRate = nextRate;
            try { audio.preservesPitch = false; } catch (_) {}
            try { audio.mozPreservesPitch = false; } catch (_) {}
            try { audio.webkitPreservesPitch = false; } catch (_) {}
            audio.onended = () => {
                previewAudioRef.current = null;
                setPlayingPreview(false);
                if (previewRestartRef.current) {
                    previewRestartRef.current = false;
                    setTimeout(() => togglePreview(), 0);
                }
            };
            audio.onerror = () => {
                previewAudioRef.current = null;
                setPlayingPreview(false);
                previewRestartRef.current = false;
            };
            previewAudioRef.current = audio;
            setPlayingPreview(true);
            audio.play().catch(() => {
                previewAudioRef.current = null;
                setPlayingPreview(false);
                previewRestartRef.current = false;
            });
        } catch (_) {}
    };

    const applyPitchPreset = (preset) => {
        if (!selectedRecorder) return;
        const map = {
            vite: 1.75,
            lent: 0.8,
            robot: 0.62
        };
        const nextPitch = Math.max(0.5, Math.min(2, Number(map[preset] || 1)));
        setSelectedRecorder((prev) => prev ? { ...prev, recordingPitch: nextPitch } : prev);
        if (previewAudioRef.current) {
            previewRestartRef.current = true;
            togglePreview();
        }
        void savePitch(selectedRecorder, nextPitch);
    };

    const deletePresentationGroup = async (presentationTitle = '') => {
        if (!selected?._id) return;
        const title = String(presentationTitle || '').trim();
        if (!title) return;
        const ok = window.confirm(`Supprimer le groupe de présentation "${title}" ?`);
        if (!ok) return;
        try {
            const res = await fetch(
                `/api/exposes/${encodeURIComponent(String(selected._id))}/presentation-group?title=${encodeURIComponent(title)}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Suppression impossible');
            }
            await loadData();
        } catch (e) {
            alert(`Erreur suppression groupe: ${e.message}`);
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
                    <div className="text-slate-400 font-black">🔎 Trouver un élève de la classe...</div>
                </div>
                <div className="overflow-auto">
                    <div className="min-w-[960px]">
                        <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: `repeat(${exposeGridCols}, minmax(120px, 1fr))` }}>
                            {Array.from({ length: exposeGridCols }).map((_, idx) => (
                                <div key={`hdr_${idx}`} className="text-center text-[12px] font-black uppercase text-slate-400">
                                    Col {idx + 1}
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${exposeGridCols}, minmax(120px, 1fr))` }}>
                            {classStudents.map((student) => {
                                const studentId = String(student?._id || '');
                                const exposePresentation = (activeExpose?.presentations || []).find((row) => String(row?.studentId || '') === studentId) || null;
                                const active = String(selectedRecorder?.studentId || '') === studentId;
                                const hasAudio = String(exposePresentation?.recordingUrl || '').trim();
                                return (
                                    <button
                                        key={studentId}
                                        onClick={() => {
                                            setSelectedRecorder(buildRecorderState(student, exposePresentation));
                                            setRecordingSec(Number(exposePresentation?.recordingDurationSec || 0));
                                        }}
                                        className={`rounded-[18px] border p-3 min-h-[126px] shadow-sm transition-all ${
                                            active
                                                ? 'bg-rose-50 border-rose-300'
                                                : (hasAudio ? 'bg-orange-50 border-orange-200 hover:bg-orange-100' : 'bg-white border-slate-200 hover:bg-slate-50')
                                        }`}
                                    >
                                        <div className="flex items-center justify-center gap-2 text-[10px] font-black min-h-[14px]">
                                            <span className="text-red-500">0</span>
                                            <span className="text-violet-500">0</span>
                                            <span className="text-emerald-500">{hasAudio ? '1' : '0'}</span>
                                        </div>
                                        <div className="text-[28px] leading-none mt-2">{String(student.gender || '').toUpperCase() === 'F' ? '👧' : '👦'}</div>
                                        <div className="mt-2 text-[14px] font-black text-slate-700 leading-tight">
                                            {student.firstName}
                                            <br />
                                            {String(student.lastName || '').slice(0, 1)}.
                                        </div>
                                        <div className="mt-2 flex items-center justify-center gap-2 text-[12px] font-black">
                                            <span className="text-red-500">✖0</span>
                                            <span className="text-emerald-500">☆{hasAudio ? '1' : '0'}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {!loading && classStudents.length === 0 && (
                        <div className="text-xs text-slate-400 font-bold p-4">
                            Aucun élève trouvé pour cette classe.
                        </div>
                    )}
                    {loading && <div className="text-xs text-indigo-500 font-black p-4">Chargement...</div>}
                </div>
            </div>

            {selectedRecorder && (
                <div className="fixed inset-0 z-[140] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="w-full max-w-5xl rounded-[30px] border border-slate-200 bg-white shadow-2xl overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 flex items-center justify-between gap-4">
                            <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">Studio Audio Exposé</div>
                                <div className="text-3xl font-black uppercase text-slate-800 mt-1">{selectedRecorder.studentLabel}</div>
                                <div className="text-[11px] font-black uppercase text-slate-400 mt-1">
                                    {globalClass || 'CLASSE'} • Slide {selectedRecorder.slideNumber}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-700 font-black text-xl"
                                onClick={() => setSelectedRecorder(null)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="rounded-[28px] border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 overflow-hidden">
                                <div className="px-5 py-4 border-b border-indigo-100 flex items-center justify-between gap-4">
                                    <input
                                        readOnly
                                        value={`${selectedRecorder.studentLabel || 'audio'}.webm`}
                                        className="w-full max-w-[320px] px-4 py-3 rounded-2xl border border-slate-200 bg-white font-black text-slate-700 outline-none"
                                    />
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            className="px-4 py-3 rounded-2xl bg-white border border-slate-200 font-black text-[12px] uppercase"
                                            onClick={() => setSelectedRecorder(null)}
                                        >
                                            Quitter
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.85fr] gap-0">
                                    <div className="p-5 border-r border-indigo-100">
                                        <div className="rounded-[24px] border border-indigo-100 bg-[#f7f1ff] min-h-[360px] p-5 relative overflow-hidden">
                                            <div className="absolute left-5 top-5 px-3 py-2 rounded-xl bg-slate-800 text-white text-[12px] font-black">
                                                DIAGNOSTIC:
                                                <br />
                                                AUDIO OK: {Number(recordingSec || 0).toFixed(1)}s
                                            </div>
                                            <div className="h-full w-full flex items-center justify-center">
                                                <div className="w-full">
                                                    <div className="relative h-[220px] rounded-[22px] bg-white/60 border border-indigo-100 overflow-hidden">
                                                        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-fuchsia-400/70" />
                                                        <div
                                                            className="absolute top-0 bottom-0 w-[3px] bg-red-500"
                                                            style={{ left: `${Math.max(0, Math.min(100, (Number(recordingSec || 0) > 0 ? 100 : 0)))}%` }}
                                                        />
                                                        <div className="absolute inset-0 flex items-center gap-[2px] px-10">
                                                            {Array.from({ length: 70 }).map((_, idx) => {
                                                                const base = String(selectedRecorder.recordingUrl || '').trim()
                                                                    ? (Math.sin(idx * 0.55) * 0.5 + 0.5)
                                                                    : 0.08;
                                                                const amp = Math.max(0.08, base);
                                                                return (
                                                                    <div
                                                                        key={`bar_${idx}`}
                                                                        className="flex-1 rounded-full bg-fuchsia-500/75"
                                                                        style={{ height: `${22 + amp * 120}px` }}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                    {String(selectedRecorder.recordingUrl || '').trim() ? (
                                                        <audio key={`${selectedRecorder.recordingUrl}_${selectedRecorder.recordingPitch}`} controls className="w-full mt-5">
                                                            <source src={selectedRecorder.recordingUrl} />
                                                        </audio>
                                                    ) : (
                                                        <div className="mt-5 text-sm font-black text-slate-400">Aucun audio enregistré.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-white">
                                        <div className="text-sm font-black text-slate-800">{selectedRecorder.studentLabel}</div>
                                        <div className="text-[11px] font-black uppercase text-slate-500 mt-1">
                                            {selectedRecorder.presentationTitle} • Slide {selectedRecorder.slideNumber}
                                        </div>
                                        <div className="mt-6 flex items-center gap-4">
                                            <button
                                                type="button"
                                                className="w-20 h-20 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white text-3xl shadow-lg flex items-center justify-center"
                                                onClick={togglePreview}
                                                disabled={!String(selectedRecorder.recordingUrl || '').trim()}
                                            >
                                                {playingPreview ? '■' : '▶'}
                                            </button>
                                            {!recording ? (
                                                <button
                                                    type="button"
                                                    className="w-20 h-20 rounded-full bg-red-500 text-white font-black text-[14px] uppercase shadow-lg"
                                                    onClick={() => void startRecording()}
                                                    disabled={uploadingRecording}
                                                >
                                                    Rec
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="w-20 h-20 rounded-full bg-slate-900 text-white font-black text-[14px] uppercase shadow-lg"
                                                    onClick={stopRecording}
                                                >
                                                    Stop
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-6 grid grid-cols-3 gap-3">
                                            <button
                                                type="button"
                                                className="px-4 py-4 rounded-2xl border border-slate-200 bg-white font-black text-[12px] uppercase"
                                                onClick={() => applyPitchPreset('vite')}
                                            >
                                                Vite
                                            </button>
                                            <button
                                                type="button"
                                                className="px-4 py-4 rounded-2xl border border-slate-200 bg-white font-black text-[12px] uppercase"
                                                onClick={() => applyPitchPreset('lent')}
                                            >
                                                Lent
                                            </button>
                                            <button
                                                type="button"
                                                className="px-4 py-4 rounded-2xl border border-slate-200 bg-white font-black text-[12px] uppercase"
                                                onClick={() => applyPitchPreset('robot')}
                                            >
                                                Robot
                                            </button>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                className="px-4 py-4 rounded-2xl bg-white border border-slate-200 font-black text-[12px] uppercase"
                                                onClick={() => {
                                                    const nextPitch = Math.max(0.5, Math.min(2, Number(selectedRecorder.recordingPitch || 1) - 0.1));
                                                    setSelectedRecorder((prev) => prev ? { ...prev, recordingPitch: nextPitch } : prev);
                                                    if (previewAudioRef.current) {
                                                        previewRestartRef.current = true;
                                                        togglePreview();
                                                    }
                                                    void savePitch(selectedRecorder, nextPitch);
                                                }}
                                                disabled={savingPitch}
                                            >
                                                Pitch -
                                            </button>
                                            <button
                                                type="button"
                                                className="px-4 py-4 rounded-2xl bg-white border border-slate-200 font-black text-[12px] uppercase"
                                                onClick={() => {
                                                    const nextPitch = Math.max(0.5, Math.min(2, Number(selectedRecorder.recordingPitch || 1) + 0.1));
                                                    setSelectedRecorder((prev) => prev ? { ...prev, recordingPitch: nextPitch } : prev);
                                                    if (previewAudioRef.current) {
                                                        previewRestartRef.current = true;
                                                        togglePreview();
                                                    }
                                                    void savePitch(selectedRecorder, nextPitch);
                                                }}
                                                disabled={savingPitch}
                                            >
                                                Pitch +
                                            </button>
                                        </div>
                                        <div className="mt-6 grid grid-cols-2 gap-3 text-[12px] font-black text-slate-600">
                                            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                                                {recording ? `Enregistrement ${recordingSec}s` : (uploadingRecording ? 'Envoi...' : `Dernière durée ${recordingSec || 0}s`)}
                                            </div>
                                            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                                                Pitch {Number(selectedRecorder.recordingPitch || 1).toFixed(1)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
