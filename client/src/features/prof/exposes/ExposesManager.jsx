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

    const uploadPresenterRecording = async (blob, meta) => {
        if (!selected?._id || !meta?.studentId || !blob) return;
        setUploadingRecording(true);
        try {
            const fd = new FormData();
            fd.append('studentId', String(meta.studentId || ''));
            fd.append('presentationTitle', String(meta.presentationTitle || ''));
            fd.append('presenterName', String(meta.presenterName || ''));
            fd.append('slideNumber', String(meta.slideNumber || 1));
            fd.append('recordingDurationSec', String(Math.max(1, Number(recordingSec || 0))));
            fd.append('recordingPitch', String(Math.max(0.5, Math.min(2, Number(meta.recordingPitch || 1)))));
            fd.append('audio', blob, `expose_${Date.now()}.webm`);
            const res = await fetch(`/api/exposes/${encodeURIComponent(String(selected._id))}/presenter-recording`, {
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
        if (!selected?._id || !meta?.studentId || !meta?.presentationTitle) return;
        setSavingPitch(true);
        try {
            const res = await fetch(`/api/exposes/${encodeURIComponent(String(selected._id))}/presenter-recording-settings`, {
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
            audio.playbackRate = Math.max(0.5, Math.min(2, Number(selectedRecorder?.recordingPitch || 1)));
            audio.onended = () => {
                previewAudioRef.current = null;
                setPlayingPreview(false);
            };
            audio.onerror = () => {
                previewAudioRef.current = null;
                setPlayingPreview(false);
            };
            previewAudioRef.current = audio;
            setPlayingPreview(true);
            audio.play().catch(() => {
                previewAudioRef.current = null;
                setPlayingPreview(false);
            });
        } catch (_) {}
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
        <div className="p-6 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="text-[10px] font-black uppercase text-slate-400 mb-3">Exposés enregistrés</div>
                <div className="space-y-2 max-h-[72vh] overflow-auto pr-1">
                    {filtered.map((x) => {
                        const chapter = chapterById.get(String(x.chapterId));
                        const active = String(x._id) === String(selectedId);
                        return (
                            <button
                                key={x._id}
                                onClick={() => setSelectedId(String(x._id))}
                                className={`w-full text-left p-3 rounded-xl border ${active ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`}
                            >
                                <div className="font-black text-slate-800 text-sm uppercase">{x.title}</div>
                                <div className="text-[10px] font-black text-slate-400 uppercase">
                                    {chapter ? `${chapter.section || ''} / ${chapter.title || ''}` : 'CHAPITRE'}
                                </div>
                                <div className="text-[10px] font-black text-slate-500 mt-1">
                                    {Array.isArray(x.presentations) ? x.presentations.length : 0} présentations
                                </div>
                            </button>
                        );
                    })}
                    {!loading && filtered.length === 0 && (
                        <div className="text-xs text-slate-400 font-bold p-4">Aucun exposé pour cette classe.</div>
                    )}
                    {loading && <div className="text-xs text-indigo-500 font-black p-4">Chargement...</div>}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
                {!selected && <div className="text-slate-400 font-bold">Sélectionne un exposé.</div>}
                {selected && (
                    <>
                        <div className="text-2xl font-black uppercase text-slate-800 mb-1">{selected.title}</div>
                        <div className="text-[11px] font-black uppercase text-slate-400 mb-4">
                            {(chapterById.get(String(selected.chapterId))?.section || 'GÉNÉRAL')} / {(chapterById.get(String(selected.chapterId))?.title || 'CHAPITRE')}
                        </div>
                        <div className="space-y-4 max-h-[72vh] overflow-auto pr-1">
                            {grouped.map((g) => (
                                <div key={g.presentationTitle} className="border border-rose-200 bg-rose-50 rounded-2xl p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-black text-rose-700 uppercase">{g.presentationTitle}</div>
                                        <button
                                            type="button"
                                            onClick={() => deletePresentationGroup(g.presentationTitle)}
                                            className="w-7 h-7 rounded-full border border-red-300 bg-white text-red-600 font-black leading-none hover:bg-red-50"
                                            title={`Supprimer "${g.presentationTitle}"`}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="text-[11px] font-black text-slate-500 mb-2">
                                        {g.items.length} élève{g.items.length > 1 ? 's' : ''}
                                    </div>
                                    <div className="space-y-3">
                                        {g.items.map((p, idx) => (
                                            <div key={`${g.presentationTitle}_${idx}`} className="bg-white border border-slate-200 rounded-xl p-3">
                                                <div className="text-[12px] font-black text-slate-800">
                                                    {studentNameById.get(extractId(p.studentId)) || 'Élève'}
                                                </div>
                                                <div className="text-[11px] font-bold text-slate-500 mb-2">Slides: {p.slidesText || 'non indiqué'}</div>
                                                {p.canvasUrl && (
                                                    <div className="mb-2">
                                                        <a className="text-[11px] font-black text-blue-600 underline" href={toEmbeddableCanvasUrl(p.canvasUrl)} target="_blank" rel="noreferrer">
                                                            Ouvrir la présentation
                                                        </a>
                                                    </div>
                                                )}
                                                {p.canvasUrl && (
                                                    <iframe
                                                        src={toEmbeddableCanvasUrl(p.canvasUrl)}
                                                        title={`canvas_${extractId(p.studentId)}_${idx}`}
                                                        className="w-full h-[320px] border rounded-xl mb-2"
                                                    />
                                                )}
                                                {p.recordingUrl && (
                                                    <audio controls className="w-full">
                                                        <source src={p.recordingUrl} />
                                                        Votre navigateur ne supporte pas l'audio.
                                                    </audio>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                                        <div className="text-[10px] font-black uppercase text-slate-400 mb-3">Plan audio des présentateurs</div>
                                        <div
                                            className="grid gap-3"
                                            style={(() => {
                                                const planStudents = g.items
                                                    .map((p) => studentsById.get(extractId(p.studentId)))
                                                    .filter(Boolean);
                                                const hasPlan = planStudents.length > 0 && planStudents.every((student) => Number.isFinite(Number(student?.seatX)) && Number.isFinite(Number(student?.seatY)));
                                                if (!hasPlan) return { gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' };
                                                const maxX = Math.max(...planStudents.map((student) => Number(student.seatX || 0)));
                                                return { gridTemplateColumns: `repeat(${Math.max(1, maxX + 1)}, minmax(140px, 1fr))` };
                                            })()}
                                        >
                                            {g.items.map((p, idx) => {
                                                const student = studentsById.get(extractId(p.studentId)) || null;
                                                const fullName = (studentNameById.get(extractId(p.studentId)) || p.presenterName || 'Élève').trim();
                                                const presenterName = String(p.presenterName || fullName).trim();
                                                const slideNumber = Math.max(1, Number(p.presenterSlideNumber || guessSlideNumberFromText(p.slidesText)));
                                                const hasRecording = Boolean(String(p.recordingUrl || '').trim());
                                                const isActive = String(selectedRecorder?.studentId || '') === String(extractId(p.studentId));
                                                const cardStyle = Number.isFinite(Number(student?.seatX)) && Number.isFinite(Number(student?.seatY))
                                                    ? { gridColumn: Number(student.seatX || 0) + 1, gridRow: Number(student.seatY || 0) + 1 }
                                                    : undefined;
                                                return (
                                                    <button
                                                        key={`rec_${g.presentationTitle}_${idx}`}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedRecorder({
                                                                studentId: extractId(p.studentId),
                                                                presentationTitle: g.presentationTitle,
                                                                presenterName,
                                                                slideNumber,
                                                                studentLabel: fullName,
                                                                recordingUrl: String(p.recordingUrl || ''),
                                                                recordingPitch: Math.max(0.5, Math.min(2, Number(p.recordingPitch || 1)))
                                                            });
                                                            setRecordingSec(Number(p.recordingDurationSec || 0));
                                                        }}
                                                        style={cardStyle}
                                                        className={`rounded-2xl border p-3 text-left transition ${hasRecording ? 'bg-orange-100 border-orange-300' : 'bg-slate-50 border-slate-200'} ${isActive ? 'ring-2 ring-indigo-400' : ''}`}
                                                    >
                                                        <div className="text-sm font-black text-slate-800">{fullName}</div>
                                                        <div className="text-[11px] font-black uppercase text-slate-500 mt-1">Slide {slideNumber}</div>
                                                        <div className="text-[11px] font-bold mt-2 text-slate-500">{hasRecording ? 'Audio enregistré' : 'Aucun audio'}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {selectedRecorder ? (
                                            <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <div>
                                                        <div className="text-sm font-black text-slate-800">{selectedRecorder.studentLabel}</div>
                                                        <div className="text-[11px] font-black uppercase text-slate-500">
                                                            {selectedRecorder.presentationTitle} • Slide {selectedRecorder.slideNumber} • {selectedRecorder.presenterName}
                                                        </div>
                                                    </div>
                                                    <button type="button" className="px-3 py-2 rounded-xl bg-white border border-slate-200 font-black text-[11px]" onClick={() => setSelectedRecorder(null)}>
                                                        Retour au plan
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    {!recording ? (
                                                        <button
                                                            type="button"
                                                            className="px-4 py-3 rounded-2xl bg-red-600 text-white font-black text-[12px] uppercase"
                                                            onClick={() => void startRecording()}
                                                            disabled={uploadingRecording}
                                                        >
                                                            Rec
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="px-4 py-3 rounded-2xl bg-slate-900 text-white font-black text-[12px] uppercase"
                                                            onClick={stopRecording}
                                                        >
                                                            Stop
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="px-4 py-3 rounded-2xl bg-white border border-slate-200 font-black text-[12px] uppercase disabled:opacity-40"
                                                        onClick={togglePreview}
                                                        disabled={!String(selectedRecorder.recordingUrl || '').trim()}
                                                    >
                                                        {playingPreview ? 'Stop lecture' : 'Lecture'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="px-4 py-3 rounded-2xl bg-white border border-slate-200 font-black text-[12px] uppercase"
                                                        onClick={() => {
                                                            const nextPitch = Math.max(0.5, Math.min(2, Number(selectedRecorder.recordingPitch || 1) - 0.1));
                                                            setSelectedRecorder((prev) => prev ? { ...prev, recordingPitch: nextPitch } : prev);
                                                            void savePitch(selectedRecorder, nextPitch);
                                                        }}
                                                        disabled={savingPitch}
                                                    >
                                                        Pitch -
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="px-4 py-3 rounded-2xl bg-white border border-slate-200 font-black text-[12px] uppercase"
                                                        onClick={() => {
                                                            const nextPitch = Math.max(0.5, Math.min(2, Number(selectedRecorder.recordingPitch || 1) + 0.1));
                                                            setSelectedRecorder((prev) => prev ? { ...prev, recordingPitch: nextPitch } : prev);
                                                            void savePitch(selectedRecorder, nextPitch);
                                                        }}
                                                        disabled={savingPitch}
                                                    >
                                                        Pitch +
                                                    </button>
                                                    <div className="text-[12px] font-black text-slate-600">
                                                        {recording ? `Enregistrement ${recordingSec}s` : (uploadingRecording ? 'Envoi...' : `Dernière durée ${recordingSec || 0}s`)}
                                                    </div>
                                                    <div className="text-[12px] font-black text-slate-600">
                                                        Pitch {Number(selectedRecorder.recordingPitch || 1).toFixed(1)}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                            {grouped.length === 0 && (
                                <div className="text-slate-400 text-sm font-bold">Aucune présentation élève enregistrée.</div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
