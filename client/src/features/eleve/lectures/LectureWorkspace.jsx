import React, { useEffect, useMemo, useRef, useState } from 'react';
import './LectureWorkspace.css';

const countLines = (txt = '') =>
    String(txt || '')
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
        .length;

const normalizeUrl = (raw = '') => {
    const txt = String(raw || '').trim();
    if (!txt) return '';
    try { return new URL(txt).toString(); } catch (_) { return txt; }
};

export default function LectureWorkspace({ lecture, user, onQuit }) {
    const sub = lecture?.studentSubmission || {};
    const [text, setText] = useState('');
    const [loadingText, setLoadingText] = useState(false);
    const [summary, setSummary] = useState(String(sub.summary || ''));
    const [scrollTop, setScrollTop] = useState(Math.max(0, Number(sub.scrollTop || 0)));
    const [maxScrollTop, setMaxScrollTop] = useState(Math.max(0, Number(sub.maxScrollTop || 0)));
    const [scrollHeight, setScrollHeight] = useState(Math.max(0, Number(sub.scrollHeight || 0)));
    const [clientHeight, setClientHeight] = useState(Math.max(0, Number(sub.clientHeight || 0)));
    const [reachedEnd, setReachedEnd] = useState(Boolean(sub.reachedEnd));
    const [rhythmAlerts, setRhythmAlerts] = useState(Math.max(0, Number(sub.rhythmAlerts || 0)));
    const [maxSpeedPxPerSec, setMaxSpeedPxPerSec] = useState(Math.max(0, Number(sub.maxSpeedPxPerSec || 0)));
    const [pasteBlockedCount, setPasteBlockedCount] = useState(Math.max(0, Number(sub.pasteBlockedCount || 0)));
    const [readElapsedSec, setReadElapsedSec] = useState(Math.max(0, Number(sub.readElapsedSec || 0)));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [scrollGuardMessage, setScrollGuardMessage] = useState('');

    const readerRef = useRef(null);
    const lastScrollRef = useRef({ t: 0, y: 0 });
    const saveTimerRef = useRef(null);
    const scrollGuardTimerRef = useRef(null);
    const ignoreNextScrollRef = useRef(false);

    const readingUrl = normalizeUrl(lecture?.readingUrl || '');
    const minLines = Math.max(1, Number(lecture?.requiredSummaryMinLines || 5));
    const maxLines = Math.max(minLines, Number(lecture?.requiredSummaryMaxLines || 10));
    const maxSpeed = Math.max(600, Number(lecture?.maxScrollSpeed || 2600));
    const effectiveMaxSpeed = Math.floor(maxSpeed * 1.2);
    const readingWpm = Math.max(120, Number(lecture?.readingWpm || 300));
    const wordCount = useMemo(() => String(text || '').trim().split(/\s+/).filter(Boolean).length, [text]);
    const requiredReadSeconds = Math.max(24, Math.ceil((Math.max(1, wordCount) / readingWpm) * 60 * 0.8));

    const summaryLines = countLines(summary);
    const summaryOk = summaryLines >= minLines && summaryLines <= maxLines;
    const complete = reachedEnd && summaryOk;

    const persist = async (patch = {}, silent = true) => {
        try {
            if (!silent) setSaving(true);
            const payload = {
                lectureId: String(lecture?._id || ''),
                studentId: String(user?._id || user?.id || ''),
                scrollTop,
                maxScrollTop,
                scrollHeight,
                clientHeight,
                reachedEnd,
                rhythmAlerts,
                maxSpeedPxPerSec,
                pasteBlockedCount,
                readElapsedSec,
                summary,
                ...patch
            };
            const res = await fetch('/api/eleve/lectures/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur sauvegarde');
            return data;
        } catch (e) {
            if (!silent) setError(e.message || 'Erreur sauvegarde');
            return null;
        } finally {
            if (!silent) setSaving(false);
        }
    };

    useEffect(() => {
        const run = async () => {
            if (!readingUrl) return;
            setLoadingText(true);
            try {
                const res = await fetch(`/api/eleve/lectures/content?url=${encodeURIComponent(readingUrl)}`);
                const data = res.ok ? await res.json() : null;
                if (!res.ok || !data?.text) throw new Error(data?.error || 'Texte indisponible');
                setText(String(data.text || ''));
            } catch (e) {
                setError(e.message || 'Lecture impossible');
                setText('');
            } finally {
                setLoadingText(false);
            }
        };
        run();
    }, [readingUrl]);

    useEffect(() => () => {
        if (scrollGuardTimerRef.current) clearTimeout(scrollGuardTimerRef.current);
    }, []);

    useEffect(() => {
        if (!readerRef.current) return;
        const t = setTimeout(() => {
            if (!readerRef.current) return;
            readerRef.current.scrollTop = Math.max(0, Number(sub.scrollTop || 0));
        }, 120);
        return () => clearTimeout(t);
    }, [sub.scrollTop, text]);

    useEffect(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => { persist({}, true); }, 900);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [scrollTop, maxScrollTop, scrollHeight, clientHeight, reachedEnd, rhythmAlerts, maxSpeedPxPerSec, pasteBlockedCount, readElapsedSec, summary]);

    useEffect(() => {
        if (!text) return;
        const t = setInterval(() => {
            setReadElapsedSec((v) => v + 1);
        }, 1000);
        return () => clearInterval(t);
    }, [text]);

    const onScrollReader = (e) => {
        const el = e.currentTarget;
        const nextTop = Math.max(0, Number(el.scrollTop || 0));
        const now = Date.now();
        const prev = lastScrollRef.current;
        if (ignoreNextScrollRef.current) {
            ignoreNextScrollRef.current = false;
            lastScrollRef.current = { t: now, y: Math.max(0, Number(el.scrollTop || 0)) };
            return;
        }
        if (prev.t > 0 && now > prev.t) {
            const dt = (now - prev.t) / 1000;
            const dy = Math.abs(nextTop - prev.y);
            const speed = dt > 0 ? (dy / dt) : 0;
            if (speed > effectiveMaxSpeed) {
                const safeTop = Math.max(0, Number(prev.y || 0));
                ignoreNextScrollRef.current = true;
                el.scrollTop = safeTop;
                setScrollTop(safeTop);
                setMaxScrollTop((v) => Math.max(v, safeTop));
                setScrollHeight(Math.max(0, Number(el.scrollHeight || 0)));
                setClientHeight(Math.max(0, Number(el.clientHeight || 0)));
                setRhythmAlerts((v) => v + 1);
                setScrollGuardMessage('Merci de lire le texte avec plus de tranquillité.');
                if (scrollGuardTimerRef.current) clearTimeout(scrollGuardTimerRef.current);
                scrollGuardTimerRef.current = setTimeout(() => setScrollGuardMessage(''), 2200);
                return;
            }
            setMaxSpeedPxPerSec((v) => Math.max(v, speed));
        }

        const nextHeight = Math.max(0, Number(el.scrollHeight || 0));
        const nextClient = Math.max(0, Number(el.clientHeight || 0));
        const maxScrollable = Math.max(0, nextHeight - nextClient);
        const progressByTime = Math.max(0, Math.min(1, readElapsedSec / Math.max(1, requiredReadSeconds)));
        const allowedTop = Math.min(maxScrollable, Math.floor(maxScrollable * progressByTime) + 16);
        if (nextTop > allowedTop) {
            const safeTop = Math.max(0, Math.min(allowedTop, Number(prev.y || 0)));
            ignoreNextScrollRef.current = true;
            el.scrollTop = safeTop;
            setScrollTop(safeTop);
            setMaxScrollTop((v) => Math.max(v, safeTop));
            setScrollHeight(nextHeight);
            setClientHeight(nextClient);
            setScrollGuardMessage('Merci de lire le texte avec plus de tranquillité.');
            if (scrollGuardTimerRef.current) clearTimeout(scrollGuardTimerRef.current);
            scrollGuardTimerRef.current = setTimeout(() => setScrollGuardMessage(''), 2200);
            return;
        }

        lastScrollRef.current = { t: now, y: nextTop };
        const atEnd = nextTop + nextClient >= nextHeight - 8;

        setScrollTop(nextTop);
        setMaxScrollTop((v) => Math.max(v, nextTop));
        setScrollHeight(nextHeight);
        setClientHeight(nextClient);
        if (atEnd) setReachedEnd(true);
    };

    const blockPaste = (e) => {
        e.preventDefault();
        setPasteBlockedCount((v) => v + 1);
        setError('Copier-coller désactivé pour le résumé.');
    };

    const saveSummary = async () => {
        setError('');
        if (!summaryOk) {
            setError(`Le résumé doit contenir ${minLines} à ${maxLines} lignes.`);
            return;
        }
        if (!reachedEnd) {
            setError(`Tu dois lire jusqu'à la fin (temps minimal: ${Math.ceil(requiredReadSeconds / 60)} min).`);
            return;
        }
        const data = await persist({ summary }, false);
        if (!data?.ok) return;
    };

    return (
        <div className="lecture-wrap">
            <div className="lecture-top">
                <button className="learning-btn ghost" onClick={onQuit}>✕ Quitter</button>
                <div className="lecture-title">{lecture?.title || 'Lecture'}</div>
                <button className="learning-btn" onClick={saveSummary} disabled={saving}>{saving ? 'Sauvegarde...' : 'Valider lecture'}</button>
            </div>

            <div className="lecture-grid">
                <div className="lecture-left">
                    <label>Résumé ({minLines}-{maxLines} lignes)</label>
                    <textarea
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        onPaste={blockPaste}
                        onDrop={blockPaste}
                        placeholder="Écris ton résumé ici (sans copier-coller)."
                    />
                    <div className="lecture-meta">Lignes: {summaryLines} (attendu {minLines}-{maxLines})</div>
                    <div className="lecture-meta">Progression scroll: {reachedEnd ? 'fin atteinte' : 'en cours'}</div>
                    <div className="lecture-meta">Vitesse max détectée: {Math.round(maxSpeedPxPerSec)} px/s (seuil {effectiveMaxSpeed})</div>
                    {scrollGuardMessage && <div className="lecture-guard">{scrollGuardMessage}</div>}
                    {complete ? (
                        <div className="lecture-ok">✅ Lecture validée</div>
                    ) : (
                        <div className="lecture-warning">⚠️ Valide en scrollant jusqu'en bas puis en envoyant un résumé conforme.</div>
                    )}
                    {error && <div className="learning-error mt-2">{error}</div>}
                </div>

                <div className="lecture-right">
                    {!!readingUrl && <a href={readingUrl} target="_blank" rel="noreferrer" className="text-[11px] font-black text-blue-600 underline mb-2 inline-block">Source originale</a>}
                    <div className="lecture-reader" ref={readerRef} onScroll={onScrollReader}>
                        {loadingText ? (
                            <div className="learning-missing">Chargement du texte...</div>
                        ) : text ? (
                            <div className="lecture-reader-text">{text}</div>
                        ) : (
                            <div className="learning-missing">Texte non disponible pour cette URL.</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="lecture-footer">
                <div className="text-[12px] font-bold text-slate-500">Le scroll reprend là où tu t'es arrêté. Temps lu: {Math.floor(readElapsedSec / 60)}m {readElapsedSec % 60}s / ~{Math.ceil(requiredReadSeconds / 60)}m min.</div>
                <button className="learning-btn ghost" onClick={() => persist({}, false)}>Enregistrer maintenant</button>
            </div>
        </div>
    );
}
