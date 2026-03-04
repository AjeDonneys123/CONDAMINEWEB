import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ExposeWorkspace.css';

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

        // Lien "design" Canva: conserver tous les segments d'accès.
        // Ex: /design/ID/TOKEN/view -> on garde /design/ID/TOKEN/view
        // Ex: /design/ID/TOKEN/edit -> /design/ID/TOKEN/view
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

export default function ExposeWorkspace({ expose, user, onQuit }) {
    const existing = expose?.studentSubmission || {};
    const [presentationTitle, setPresentationTitle] = useState(String(existing.presentationTitle || ''));
    const [titleSuggestions, setTitleSuggestions] = useState([]);
    const [canvasUrl, setCanvasUrl] = useState(String(existing.canvasUrl || ''));
    const [slidesText, setSlidesText] = useState(String(existing.slidesText || ''));
    const [recordingDurationSec, setRecordingDurationSec] = useState(Number(existing.recordingDurationSec || 0));
    const [audioUrl, setAudioUrl] = useState(String(existing.recordingUrl || ''));
    const [audioBlob, setAudioBlob] = useState(null);
    const [recording, setRecording] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [presentationClosed, setPresentationClosed] = useState(Boolean(existing?.updatedAt));

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const startedAtRef = useRef(0);
    const timerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
            if (audioBlob && audioUrl && audioUrl.startsWith('blob:')) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioBlob, audioUrl]);

    const iframeUrl = useMemo(() => toEmbeddableCanvasUrl(canvasUrl), [canvasUrl]);

    useEffect(() => {
        const exposeId = String(expose?._id || '').trim();
        if (!exposeId) return;
        const run = async () => {
            try {
                const q = encodeURIComponent(String(presentationTitle || '').trim());
                const res = await fetch(`/api/eleve/exposes/title-suggestions/${encodeURIComponent(exposeId)}?q=${q}`);
                const data = res.ok ? await res.json() : [];
                setTitleSuggestions(Array.isArray(data) ? data : []);
            } catch (_) {
                setTitleSuggestions([]);
            }
        };
        run();
    }, [expose?._id, presentationTitle]);

    const startRecording = async () => {
        setError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            chunksRef.current = [];
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl((prev) => {
                    if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(blob);
                });
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop());
                    streamRef.current = null;
                }
            };
            recorder.start();
            startedAtRef.current = Date.now();
            setRecording(true);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setRecordingDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
            }, 250);
        } catch (e) {
            setError("Micro non autorisé.");
        }
    };

    const stopRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setRecording(false);
        setRecordingDurationSec(Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    };

    const resetRecording = () => {
        if (recording) stopRecording();
        setAudioBlob(null);
        setAudioUrl((prev) => {
            if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
            return '';
        });
        setRecordingDurationSec(0);
        setError('');
    };

    const handleSave = async () => {
        setError('');
        if (!presentationTitle.trim()) return setError('Titre de présentation requis.');
        if (!canvasUrl.trim()) return setError('Lien Canvas requis.');
        if (!slidesText.trim()) return setError('Indique les slides présentés.');
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('exposeId', String(expose?._id || ''));
            fd.append('studentId', String(user?._id || user?.id || ''));
            fd.append('presentationTitle', presentationTitle.trim());
            fd.append('canvasUrl', canvasUrl.trim());
            fd.append('slidesText', slidesText.trim());
            fd.append('recordingDurationSec', String(recordingDurationSec || 0));
            if (audioBlob) fd.append('audio', audioBlob, `presentation_${Date.now()}.webm`);
            const res = await fetch('/api/eleve/exposes/submit', { method: 'POST', body: fd });
            const data = res.ok ? await res.json() : null;
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'Échec sauvegarde');
            if (data?.submission?.recordingUrl) setAudioUrl(data.submission.recordingUrl);
            if (data?.warning) setError(data.warning);
            setPresentationClosed(true);
        } catch (e) {
            setError(e.message || 'Échec sauvegarde.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="expose-wrap">
            <div className="expose-top">
                <button className="learning-btn ghost" onClick={onQuit}>✕ Quitter</button>
                <div className="expose-title">{expose?.title || 'Exposé'}</div>
                <button className="learning-btn" disabled={saving} onClick={handleSave}>
                    {saving ? 'Sauvegarde...' : 'Enregistrer votre présentation'}
                </button>
            </div>

            <div className="expose-grid">
                <div className="expose-left">
                    <label>Titre de la présentation</label>
                    <input
                        value={presentationTitle}
                        onChange={(e) => setPresentationTitle(e.target.value)}
                        placeholder="Ex: Dubaï - démographie"
                        list="expose-title-suggestions"
                    />
                    <datalist id="expose-title-suggestions">
                        {titleSuggestions.map((t) => (
                            <option key={t} value={t} />
                        ))}
                    </datalist>
                    <label>Lien Canvas</label>
                    <input
                        value={canvasUrl}
                        onChange={(e) => setCanvasUrl(e.target.value)}
                        placeholder="https://www.canva.com/design/..."
                    />
                    <label>Slides présentés</label>
                    <input
                        value={slidesText}
                        onChange={(e) => setSlidesText(e.target.value)}
                        placeholder="Ex: slides 4-8 et 11"
                    />
                    <div className="expose-audio-box">
                        <div className="text-[12px] font-black uppercase text-slate-500">Enregistrement voix</div>
                        <div className="flex gap-2 items-center mt-2">
                            {!recording ? (
                                <button className="learning-btn" onClick={startRecording}>🎤 Démarrer</button>
                            ) : (
                                <button className="learning-btn danger" onClick={stopRecording}>■ Stop</button>
                            )}
                            <button className="learning-btn ghost" onClick={resetRecording}>↺ Recommencer</button>
                            <span className="text-xs font-black text-slate-500">{recordingDurationSec}s</span>
                        </div>
                        {audioUrl && (
                            <audio className="mt-3 w-full" controls src={audioUrl}>
                                <track kind="captions" />
                            </audio>
                        )}
                    </div>
                    {error && <div className="learning-error">{error}</div>}
                </div>

                <div className="expose-right">
                    {presentationClosed ? (
                        <div className="h-full min-h-[70vh] flex items-center justify-center p-6">
                            <div className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                                <div className="text-lg font-black text-emerald-700 uppercase mb-2">Présentation enregistrée</div>
                                <div className="text-sm font-bold text-slate-600 mb-5">
                                    Tu peux la réouvrir ici pour modifier ton lien, tes slides ou ton audio.
                                </div>
                                <button className="learning-btn" onClick={() => setPresentationClosed(false)}>
                                    Réouvrir et modifier
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                    {iframeUrl && (
                        <div className="px-3 pt-3">
                            <a
                                href={iframeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-black uppercase text-blue-600 underline"
                            >
                                Ouvrir la présentation dans un nouvel onglet
                            </a>
                        </div>
                    )}
                    {iframeUrl ? (
                        <iframe
                            src={iframeUrl}
                            title="canvas-expose"
                            className="expose-iframe"
                            allow="microphone; autoplay; clipboard-read; clipboard-write"
                        />
                    ) : (
                        <div className="learning-missing">Colle un lien Canvas pour ouvrir l'iframe.</div>
                    )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
