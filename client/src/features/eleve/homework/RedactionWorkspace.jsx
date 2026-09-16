import React, { useState, useEffect, useRef, useCallback } from 'react';
import './RedactionWorkspace.css';

export const computeSessionToken = (studentId, homeworkId, attemptNum) => {
    const raw = `${String(studentId || '')}_${String(homeworkId || '')}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
    return `CW-${hex}-T${attemptNum || 1}`;
};

export const computeInvisibleWatermark = (studentId, homeworkId) => {
    const raw = `${String(studentId || '')}_${String(homeworkId || '')}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
    }
    const binary = (Math.abs(hash) & 0xFFFF).toString(2).padStart(16, '0');
    const encoded = binary.split('').map(b => (b === '1' ? '\u200C' : '\u200B')).join('');
    return `\u200D\u200B${encoded}\u200C\u200D`;
};

export default function RedactionWorkspace({ homework, user, onQuit }) {
    // 1. Text & Undo/Redo State
    const [essayText, setEssayText] = useState('');
    const [history, setHistory] = useState(['']);
    const [historyIdx, setHistoryIdx] = useState(0);

    // 2. Draft & AI Notes State (Persists across attempts)
    const [draftText, setDraftText] = useState('');
    const [aiNotesText, setAiNotesText] = useState('');
    const [memoSheetText, setMemoSheetText] = useState('');
    const [showAiNotes, setShowAiNotes] = useState(false);
    const [attemptsCount, setAttemptsCount] = useState(1);
    const [attemptsHistory, setAttemptsHistory] = useState([]);
    const [aiCopiedToast, setAiCopiedToast] = useState(false);

    // 3. Timing & Anti-Cheat Telemetry
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [pasteAttemptCount, setPasteAttemptCount] = useState(0);
    const [toastMessage, setToastMessage] = useState('');
    const toastTimerRef = useRef(null);

    // 4. Modals State
    const [showShortWarning, setShowShortWarning] = useState(false);
    const [tooShortWarned, setToShortWarned] = useState(false);
    const [showFinalModal, setShowFinalModal] = useState(false);
    const [aiConversationText, setAiConversationText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submittedResult, setSubmittedResult] = useState(null);

    // Homework configuration
    const minTimeMinutes = Number(homework?.minTimeMinutes || 25);
    const topicText = String(homework?.promptTopic || homework?.levels?.[0]?.instruction || homework?.title || 'Sujet de rédaction');

    // Live timer (ticks every 1s)
    useEffect(() => {
        const interval = setInterval(() => {
            setSessionSeconds((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTimer = (totalSec) => {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage('');
        }, 3200);
    };

    const draftWarnedRef = useRef(false);

    // Text edition with Undo/Redo tracking & burst paste protection
    const handleTextChange = (e) => {
        const newText = e.target.value;
        const prevText = essayText;

        // If starting to write while draft is empty, remind student
        if (!draftText.trim() && newText.trim().length > 0 && !draftWarnedRef.current) {
            draftWarnedRef.current = true;
            showToast("⚠️ Rédige d'abord ton plan et des idées au brouillon.");
        }

        // If a single change inserts more than 20 characters at once (context-menu paste, autofill, etc.)
        if (newText.length - prevText.length > 20) {
            setPasteAttemptCount((prev) => prev + 1);
            showToast("⚠️ Copier-coller interdit.");
            return;
        }
        setEssayText(newText);
        // Truncate future history and push new state
        const updated = history.slice(0, historyIdx + 1);
        if (updated[updated.length - 1] !== newText) {
            updated.push(newText);
            if (updated.length > 60) updated.shift();
            setHistory(updated);
            setHistoryIdx(updated.length - 1);
        }
    };

    const handleDraftChange = (e) => {
        const newText = e.target.value;
        if (newText.length - draftText.length > 20) {
            setPasteAttemptCount((prev) => prev + 1);
            showToast("⚠️ Copier-coller interdit.");
            return;
        }
        setDraftText(newText);
    };

    const handleAiNotesChange = (e) => {
        const newText = e.target.value;
        if (newText.length - aiNotesText.length > 20) {
            setPasteAttemptCount((prev) => prev + 1);
            showToast("⚠️ Copier-coller interdit.");
            return;
        }
        setAiNotesText(newText);
    };

    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
            e.preventDefault();
            e.stopPropagation();
            setPasteAttemptCount((prev) => prev + 1);
            showToast("⚠️ Copier-coller interdit.");
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            e.stopPropagation();
            showToast("⚠️ Utilisez le bouton '📋 Copier mon travail pour l'IA' pour exporter votre devoir.");
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
            e.preventDefault();
            e.stopPropagation();
            showToast("⚠️ Couper interdit. Utilisez la touche Suppr.");
        }
    };

    const handleBlockedCopy = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast("⚠️ Utilisez le bouton '📋 Copier mon travail pour l'IA' pour exporter votre devoir.");
    };

    const handleUndo = () => {
        if (historyIdx > 0) {
            const nextIdx = historyIdx - 1;
            setHistoryIdx(nextIdx);
            setEssayText(history[nextIdx]);
        }
    };

    const handleRedo = () => {
        if (historyIdx < history.length - 1) {
            const nextIdx = historyIdx + 1;
            setHistoryIdx(nextIdx);
            setEssayText(history[nextIdx]);
        }
    };

    // Block external paste on essay and draft
    const handleBlockedPaste = () => (e) => {
        e.preventDefault();
        e.stopPropagation();
        setPasteAttemptCount((prev) => prev + 1);
        showToast("⚠️ Copier-coller interdit.");
    };

    // Helper to evaluate a substantial attempt (at least 20 lines or 150 words)
    const formatAttemptData = (num, text) => {
        const clean = String(text || '').trim();
        const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
        const rawLines = clean ? clean.split('\n').filter(l => l.trim().length > 0).length : 0;
        const lines = Math.max(rawLines, Math.round(words / 9));
        const isSubstantial = lines >= 20 || words >= 150;
        return {
            attemptNumber: num,
            text: clean,
            wordsCount: words,
            linesCount: lines,
            isSubstantial,
            savedAt: new Date().toLocaleTimeString()
        };
    };

    // Save or update an attempt in history
    const archiveAttempt = (num, text) => {
        const entry = formatAttemptData(num, text);
        setAttemptsHistory((prev) => {
            const idx = prev.findIndex((a) => a.attemptNumber === num);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = entry;
                return next;
            }
            return [...prev, entry];
        });
        return entry;
    };

    // "Copier pour l'IA" handler with smart instruction prompt & unique session token
    const handleCopyForAI = async () => {
        const cleanEssay = essayText.trim();
        if (!cleanEssay) {
            showToast("⚠️ Écrivez d'abord votre texte avant de le copier pour l'IA.");
            return;
        }
        archiveAttempt(attemptsCount, essayText);

        const currentToken = computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount);
        const watermark = computeInvisibleWatermark(user?._id || user?.id, homework?._id);

        let textToCopy = '';
        if (attemptsCount === 1) {
            textToCopy = `${watermark}[SUJET DU DEVOIR : "${topicText}"]

--- MON BROUILLON / PLAN INITIAL : ---
${draftText.trim() || "(Plan en cours d'élaboration)"}

--- MON 1ER ESSAI : ---
${cleanEssay}

Consigne OBLIGATOIRE de contrôle CondaWeb (Jeton : #${currentToken}) :
Tu agis comme tuteur pédagogique exigeant et bienveillant. Analyse mon travail sans JAMAIS rédiger à ma place.
Tu dois OBLIGATOIREMENT commencer le tout premier mot de ta réponse par cette mention exacte :
"[CONSEILS_APPLIQUÉS : OUI | RÉF: ${currentToken}]"
puis donne-moi 2 ou 3 pistes précises d'amélioration sur le fond, le vocabulaire historique/géographique et la structure.`;
        } else {
            textToCopy = `${watermark}[SUJET DU DEVOIR : "${topicText}"]

--- MA NOUVELLE TENTATIVE (Essai n°${attemptsCount}) : ---
${cleanEssay}

--- MES DERNIÈRES NOTES DE TES CONSEILS : ---
${aiNotesText.trim() || "(Conseils précédents)"}

Consigne OBLIGATOIRE de contrôle CondaWeb (Jeton : #${currentToken}) :
Tu agis comme tuteur pédagogique sans JAMAIS rédiger à ma place.
Tu dois OBLIGATOIREMENT commencer le tout premier mot de ta réponse par cette mention exacte :
"[CONSEILS_APPLIQUÉS : OUI / PARTIELLEMENT / NON | RÉF: ${currentToken}]"
suivi d'une courte phrase expliquant si cette nouvelle version a bien pris en compte tes conseils précédents. Ensuite, donne-moi de nouveaux retours constructifs sans rédiger à ma place.`;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            setShowAiNotes(true);
            setAiCopiedToast(true);
            showToast(`📋 Travail copié avec votre jeton #${currentToken} ! Collez-le à Gemini.`);
        } catch (_) {
            setShowAiNotes(true);
            setAiCopiedToast(true);
            showToast(`ℹ️ Notez les conseils de l'IA (votre jeton : #${currentToken}).`);
        }
    };

    // "Nouvelle tentative" handler
    const handleNewAttempt = () => {
        if (!confirm("Voulez-vous démarrer une nouvelle tentative ? Votre brouillon et vos notes sur l'IA seront conservés pour guider votre écriture.")) {
            return;
        }
        archiveAttempt(attemptsCount, essayText);
        setAttemptsCount((prev) => prev + 1);
        setAiCopiedToast(false);
        showToast(`🔄 Tentative ${attemptsCount + 1} démarrée. Gardez vos notes de l'IA sous les yeux !`);
    };

    // Validation trigger
    const handleValidateClick = () => {
        if (!draftText.trim()) {
            alert("⚠️ Brouillon obligatoire : vous devez d'abord poser votre plan et vos idées dans le brouillon pour valider (+0.5 pt bonus de base garanti).");
            return;
        }
        if (!essayText.trim()) {
            alert("⚠️ Veuillez rédiger votre travail avant de valider.");
            return;
        }
        const minTimeSec = minTimeMinutes * 60;
        if (sessionSeconds < minTimeSec && !tooShortWarned) {
            setShowShortWarning(true);
            return;
        }
        setShowFinalModal(true);
    };

    const handleConfirmValidateAnyway = () => {
        setToShortWarned(true);
        setShowShortWarning(false);
        setShowFinalModal(true);
    };

    // Final submission
    const handleFinalSubmit = async () => {
        setSubmitting(true);
        const finalEntry = formatAttemptData(attemptsCount, essayText);
        const historyToSend = attemptsHistory.filter(a => a.attemptNumber !== attemptsCount);
        historyToSend.push(finalEntry);

        const currentToken = computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount);

        const payload = {
            homeworkId: homework._id,
            levelIndex: 0,
            playerId: user._id || user.id,
            userText: essayText,
            draftContent: draftText,
            aiNotes: aiNotesText,
            memoSheet: memoSheetText,
            sessionToken: currentToken,
            aiConversationLog: aiConversationText,
            timeSpentSeconds: sessionSeconds,
            attemptsCount,
            attemptsHistory: historyToSend
        };

        try {
            const res = await fetch('/api/eleve/homework/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            setSubmitting(false);
            setShowFinalModal(false);
            if (data.error) {
                alert(`Erreur: ${data.error}`);
                return;
            }
            setSubmittedResult(data);
        } catch (err) {
            setSubmitting(false);
            setShowFinalModal(false);
            alert(`Erreur réseau: ${err.message}`);
        }
    };

    const wordsCount = essayText.trim() ? essayText.trim().split(/\s+/).filter(Boolean).length : 0;

    // Render completion confirmation
    if (submittedResult) {
        const eff = submittedResult.learningEfficiency;
        const bonus = submittedResult.examBonusPoints ?? eff?.examBonusPoints ?? 0.5;
        const studentMsg = eff?.studentMessage || "Bravo pour votre investissement et votre rigueur !";
        const attemptsEval = eff?.attemptsEvaluation || [];

        return (
            <div className="conda-redaction-container flex items-center justify-center p-6 text-center">
                <div className="bg-slate-900 border border-amber-500/50 rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6">
                    <div className="text-5xl">🎟️</div>
                    <div className="space-y-1">
                        <div className="text-[11px] font-black uppercase text-amber-400 tracking-widest">Récompense d'Apprentissage</div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-wider">Devoir Terminé & Transmis !</h2>
                    </div>

                    {/* Gold Bonus Banner or Blocked Banner */}
                    {bonus > 0 ? (
                        <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border-2 border-amber-400/60 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden">
                            <div className="text-xs font-black uppercase tracking-widest text-amber-300">Bonus pour le Prochain Contrôle sur Table</div>
                            <div className="text-5xl font-black text-amber-300 my-2 drop-shadow-md">
                                +{bonus} <span className="text-2xl font-bold text-amber-200">pt{bonus > 1 ? 's' : ''}</span>
                            </div>
                            <p className="text-xs text-amber-100/90 font-medium max-w-lg mx-auto">
                                Ce bonus sera ajouté directement par votre professeur à votre note du prochain devoir surveillé sur table !
                            </p>
                        </div>
                    ) : (
                        <div className="bg-rose-950/40 border-2 border-rose-500/60 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden">
                            <div className="text-xs font-black uppercase tracking-widest text-rose-400">Bonus Bloqué</div>
                            <div className="text-4xl font-black text-rose-300 my-2">
                                0 pt
                            </div>
                            <p className="text-xs text-rose-200 font-bold max-w-lg mx-auto">
                                ❌ Échec : tu as caché une partie de la conversation avec l'IA. Ton bonus d'examen est bloqué pour cette session.
                            </p>
                        </div>
                    )}

                    {/* Personal Encouragement / Feedback */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 text-left space-y-3">
                        <div className="text-[11px] font-black uppercase text-indigo-400 tracking-wider">Diagnostic Pédagogique</div>
                        <p className="text-sm text-slate-200 font-medium leading-relaxed">
                            {studentMsg}
                        </p>

                        {/* Breakdown per attempt */}
                        {attemptsEval.length > 0 && (
                            <div className="pt-3 border-t border-slate-700 space-y-2 text-xs">
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Détail des versions évaluées :</div>
                                {attemptsEval.map((att, idx) => (
                                    <div key={idx} className="flex items-start justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                                        <div>
                                            <span className="font-bold text-slate-200">Essai n°{att.attemptNumber || idx + 1} :</span>{' '}
                                            <span className="text-slate-300">{att.comment || (att.isSubstantial ? 'Essai consistant' : 'Essai court')}</span>
                                        </div>
                                        {att.adviceStatus && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                att.adviceStatus === 'OUI' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                            }`}>
                                                Conseils : {att.adviceStatus}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="inline-block bg-slate-800 border border-slate-700 px-6 py-2.5 rounded-2xl text-slate-400 font-semibold text-xs">
                        ✍️ Copie enregistrée • Pas de note chiffrée automatique • Votre professeur validera votre bonus lors du prochain DS
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={onQuit}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm px-8 py-3.5 rounded-xl shadow-lg transition"
                        >
                            Retour à la liste des devoirs
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="conda-redaction-container">
            {/* Header */}
            <header className="conda-redaction-header">
                <div className="conda-redaction-header-left">
                    <span className="conda-redaction-badge">✍️ Rédaction</span>
                    <h1 className="conda-redaction-title">{homework.title || 'Devoir Rédaction'}</h1>
                </div>
                <div className="conda-redaction-header-right">
                    <span className="text-[11px] font-mono text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30 hidden sm:inline-flex items-center gap-1.5" title="Jeton de session authentifiant vos échanges avec l'IA">
                        <span>🛡️</span>
                        <span>#{computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount)}</span>
                    </span>
                    <div className="conda-redaction-timer" title="Temps de travail actif">
                        <span>⏱️</span>
                        <span>{formatTimer(sessionSeconds)}</span>
                        <span className="text-[10px] font-bold text-slate-400">/ min {minTimeMinutes}m</span>
                    </div>
                    <button type="button" className="conda-redaction-quit-btn" onClick={onQuit}>
                        Quitter
                    </button>
                </div>
            </header>

            {/* Fixed Topic Banner */}
            <section className="conda-redaction-topic-banner">
                <div className="conda-redaction-topic-label">
                    <span>📌</span>
                    <span>Sujet de la Rédaction</span>
                </div>
                <p className="conda-redaction-topic-text">{topicText}</p>
            </section>

            {/* Main Area: Editor (Left) & Persistent Draft with AI Notes (Right) */}
            <main className="conda-redaction-main">
                {/* Writing Sheet */}
                <div className="conda-redaction-editor-panel">
                    <div className="conda-redaction-toolbar">
                        <div className="conda-redaction-tool-group">
                            <button
                                type="button"
                                className="conda-redaction-tool-btn"
                                onClick={handleUndo}
                                disabled={historyIdx <= 0}
                                title="Annuler la dernière saisie (Ctrl+Z)"
                            >
                                <span>↶</span>
                                <span>Annuler</span>
                            </button>
                            <button
                                type="button"
                                className="conda-redaction-tool-btn"
                                onClick={handleRedo}
                                disabled={historyIdx >= history.length - 1}
                                title="Rétablir (Ctrl+Y)"
                            >
                                <span>↷</span>
                                <span>Rétablir</span>
                            </button>
                            <span className="text-[11px] font-bold text-slate-500 ml-2">
                                Tentative {attemptsCount}
                            </span>
                        </div>
                        <div className="conda-redaction-words-counter">
                            {wordsCount} mot{wordsCount > 1 ? 's' : ''}
                        </div>
                    </div>

                    <textarea
                        className="conda-redaction-textarea"
                        placeholder="Rédigez votre devoir ici..."
                        value={essayText}
                        onChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            if (!draftText.trim() && !essayText.trim() && !draftWarnedRef.current) {
                                draftWarnedRef.current = true;
                                showToast("⚠️ Rédige d'abord ton plan et des idées au brouillon.");
                            }
                        }}
                        onCopy={handleBlockedCopy}
                        onCut={handleBlockedCopy}
                        onPaste={handleBlockedPaste()}
                        onDrop={handleBlockedPaste()}
                    />

                    <div className="conda-redaction-actions-bar">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                className="conda-btn-ia-copy"
                                onClick={handleCopyForAI}
                                title="Copie votre travail avec votre jeton de session pour le soumettre à Gemini"
                            >
                                <span>📋</span>
                                <span>Copier mon travail pour l'IA</span>
                            </button>
                            {showAiNotes && (
                                <button
                                    type="button"
                                    className="conda-redaction-tool-btn border-indigo-500/50 bg-indigo-950/40 text-indigo-300"
                                    onClick={handleNewAttempt}
                                    title="Démarrer une nouvelle tentative tout en conservant vos notes de brouillon"
                                >
                                    <span>🔄</span>
                                    <span>Nouvelle tentative</span>
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            className="conda-btn-validate"
                            onClick={handleValidateClick}
                        >
                            <span>✅</span>
                            <span>Validation finale</span>
                        </button>
                    </div>
                </div>

                {/* Persistent Draft Panel */}
                <aside className="conda-redaction-draft-panel">
                    <div className="conda-draft-header">
                        <div className="conda-draft-title">
                            <span>📝</span>
                            <span>Brouillon de travail</span>
                        </div>
                        <span className="conda-draft-badge">Persistant</span>
                    </div>

                    <p className="text-[11px] text-slate-400 m-0 leading-relaxed">
                        Posez ici vos idées, votre plan et vos mots-clés. Ce brouillon est conservé tout au long de vos tentatives.
                    </p>

                    <textarea
                        className="conda-draft-textarea"
                        placeholder="Mon plan, mes idées, mes arguments..."
                        value={draftText}
                        onChange={handleDraftChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handleBlockedPaste('le brouillon')}
                        onDrop={handleBlockedPaste('le brouillon')}
                    />

                    {/* Section Conseils de l'IA */}
                    {showAiNotes && (
                        <div className="conda-ai-notes-box">
                            <div className="conda-ai-notes-title">
                                <span>🤖</span>
                                <span>Conseils & pistes de l'IA</span>
                            </div>
                            <p className="conda-ai-notes-hint">
                                Collez votre travail dans le volet <strong>Demander à Gemini</strong> (à droite). Résumez ici ses remarques méthodologiques et les points à améliorer pour votre prochaine tentative.
                            </p>
                            <textarea
                                className="conda-ai-notes-textarea"
                                placeholder="Notes obligatoires sur les conseils de l'IA : points forts, faiblesses signalées, vocabulaire à enrichir..."
                                value={aiNotesText}
                                onChange={handleAiNotesChange}
                                onKeyDown={handleKeyDown}
                                onPaste={handleBlockedPaste('les notes')}
                                onDrop={handleBlockedPaste('les notes')}
                            />
                        </div>
                    )}

                    {/* Section Fiche Mémo DS : s'affiche dès qu'il y a eu un retour IA ou tentative >= 2 */}
                    {(showAiNotes || attemptsCount >= 2) && (
                        <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-left space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                                    <span>🧠</span>
                                    <span>Fiche Mémo Contrôle sur table</span>
                                </div>
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30">
                                    Bonus Max (+2.5 pts)
                                </span>
                            </div>
                            <p className="text-[11px] text-amber-200/80 leading-relaxed">
                                Prouvez que vous avez assimilé le travail sans dépendre de l'IA :
                                <br />
                                <strong>1. Votre plan final structuré</strong> (Partie I, Partie II...)
                                <br />
                                <strong>2. Les notions et pièges clés</strong> à ne pas oublier le jour du DS.
                            </p>
                            <textarea
                                className="w-full h-28 p-2.5 rounded-xl border border-amber-500/30 bg-slate-900 text-slate-100 text-xs font-mono outline-none focus:border-amber-400 resize-y placeholder:text-slate-600"
                                placeholder="1. Mon plan final consolidé (I. ..., II. ...)&#10;2. Les 2-3 notions ou pièges retenus pour le DS..."
                                value={memoSheetText}
                                onChange={(e) => setMemoSheetText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onPaste={handleBlockedPaste('la fiche mémo')}
                                onDrop={handleBlockedPaste('la fiche mémo')}
                            />
                        </div>
                    )}
                </aside>
            </main>

            {/* Warning Modal: Short Working Time */}
            {showShortWarning && (
                <div className="conda-redaction-modal-overlay">
                    <div className="conda-redaction-modal">
                        <div className="conda-redaction-warning-icon">⏱️</div>
                        <h3 className="conda-redaction-modal-title">C'est un peu court...</h3>
                        <p className="conda-redaction-modal-text">
                            Vous n'avez passé que <strong>{Math.max(1, Math.round(sessionSeconds / 60))} minute(s)</strong> sur cette rédaction, alors qu'un travail approfondi de Seconde demande au minimum <strong>{minTimeMinutes} minutes</strong>.
                            <br /><br />
                            Avez-vous bien relu votre texte, exploité les conseils de l'IA dans votre brouillon et développé tous vos arguments ?
                        </p>
                        <div className="conda-redaction-modal-actions">
                            <button
                                type="button"
                                className="conda-modal-btn-cancel"
                                onClick={() => setShowShortWarning(false)}
                            >
                                ✏️ Reprendre et enrichir mon travail
                            </button>
                            <button
                                type="button"
                                className="conda-modal-btn-danger"
                                onClick={handleConfirmValidateAnyway}
                            >
                                ⚠️ Valider quand même (signalé au professeur)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Final Submission Modal: Paste AI Conversation with Token Check */}
            {showFinalModal && (() => {
                const currentToken = computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount);
                const baseToken = computeSessionToken(user?._id || user?.id, homework?._id, 1);
                const watermark = computeInvisibleWatermark(user?._id || user?.id, homework?._id);
                const isTokenInChat = aiConversationText.includes(currentToken) || aiConversationText.includes(baseToken);
                const isWatermarkInChat = aiConversationText.includes(watermark);

                return (
                    <div className="conda-redaction-modal-overlay">
                        <div className="conda-redaction-modal">
                            <div className="text-3xl mb-2">📋</div>
                            <h3 className="conda-redaction-modal-title">Clôture du devoir & Échange avec l'IA</h3>
                            <p className="conda-redaction-modal-text">
                                Pour finaliser votre envoi, veuillez <strong>copier-coller ci-dessous l'intégralité de votre conversation avec Gemini / l'IA</strong>.
                                Elle sera transmise à votre professeur pour valider votre démarche et authentifier votre jeton de session :
                            </p>

                            <div className="mb-3 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400">Jeton requis :</span>
                                        <code className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 font-mono font-bold">#{currentToken}</code>
                                    </div>
                                    <div>
                                        {aiConversationText.trim().length > 15 ? (
                                            isTokenInChat ? (
                                                <span className="text-emerald-400 font-bold flex items-center gap-1">✅ Jeton authentifié</span>
                                            ) : (
                                                <span className="text-amber-400 font-bold flex items-center gap-1">⚠️ Jeton non détecté</span>
                                            )
                                        ) : (
                                            <span className="text-slate-500 text-[11px]">En attente...</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                                    <span className="text-slate-400">Intégrité de l'échange :</span>
                                    <div>
                                        {aiConversationText.trim().length > 15 ? (
                                            isWatermarkInChat ? (
                                                <span className="text-emerald-400 font-semibold">✅ Échange complet validé</span>
                                            ) : (
                                                <span className="text-rose-400 font-bold">❌ Échec : tu as caché une partie de la conversation. Bonus bloqué.</span>
                                            )
                                        ) : (
                                            <span className="text-slate-500">Non vérifié</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <textarea
                                className="w-full h-40 p-3 rounded-xl border border-slate-600 bg-slate-900 text-slate-100 text-xs font-mono mb-4 outline-none focus:border-indigo-500 resize-y"
                                placeholder="Collez ici votre conversation avec Gemini (Ctrl+V / Cmd+V autorisé)..."
                                value={aiConversationText}
                                onChange={(e) => setAiConversationText(e.target.value)}
                            />
                            <div className="conda-redaction-modal-actions">
                                <button
                                    type="button"
                                    className="conda-modal-btn-cancel"
                                    onClick={() => setShowFinalModal(false)}
                                    disabled={submitting}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="button"
                                    className="conda-modal-btn-confirm"
                                    onClick={handleFinalSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Envoi en cours...' : 'Envoyer définitivement mon devoir'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Toast Alert */}
            {toastMessage && (
                <div className="conda-redaction-toast">
                    {toastMessage}
                </div>
            )}
        </div>
    );
}
