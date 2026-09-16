import React, { useState, useEffect, useRef, useCallback } from 'react';
import './RedactionWorkspace.css';

export default function RedactionWorkspace({ homework, user, onQuit }) {
    // 1. Text & Undo/Redo State
    const [essayText, setEssayText] = useState('');
    const [history, setHistory] = useState(['']);
    const [historyIdx, setHistoryIdx] = useState(0);

    // 2. Draft & AI Notes State (Persists across attempts)
    const [draftText, setDraftText] = useState('');
    const [aiNotesText, setAiNotesText] = useState('');
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

    // "Copier pour l'IA" handler with smart instruction prompt
    const handleCopyForAI = async () => {
        const cleanEssay = essayText.trim();
        if (!cleanEssay) {
            showToast("⚠️ Écrivez d'abord votre texte avant de le copier pour l'IA.");
            return;
        }
        archiveAttempt(attemptsCount, essayText);

        let textToCopy = '';
        if (attemptsCount === 1) {
            textToCopy = `[SUJET DU DEVOIR : "${topicText}"]

--- MON BROUILLON / PLAN INITIAL : ---
${draftText.trim() || "(Plan en cours d'élaboration)"}

--- MON 1ER ESSAI : ---
${cleanEssay}

Consigne pour l'IA (tuteur) :
Agis en tuteur pédagogique bienveillant et exigeant. Analyse mon travail sans rédiger à ma place. Donne-moi 2 ou 3 pistes précises d'amélioration sur le fond, le vocabulaire historique/géographique et la structure.`;
        } else {
            textToCopy = `[SUJET DU DEVOIR : "${topicText}"]

--- MA NOUVELLE TENTATIVE (Essai n°${attemptsCount}) : ---
${cleanEssay}

--- MES DERNIÈRES NOTES DE TES CONSEILS : ---
${aiNotesText.trim() || "(Conseils précédents)"}

Consigne OBLIGATOIRE pour l'IA (tuteur) :
Commence OBLIGATOIREMENT le tout début de ta réponse par cette mention exacte :
"[CONSEILS_APPLIQUÉS : OUI / PARTIELLEMENT / NON]" suivi d'une courte phrase expliquant si cette nouvelle version a bien pris en compte tes conseils précédents. Ensuite, donne-moi de nouveaux retours constructifs sans rédiger à ma place.`;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            setShowAiNotes(true);
            setAiCopiedToast(true);
            showToast("📋 Travail copié ! Collez-le à Gemini (panneau à droite) et notez ses conseils ci-dessous.");
        } catch (_) {
            setShowAiNotes(true);
            setAiCopiedToast(true);
            showToast("ℹ️ Notez les conseils de l'IA dans la section dédiée de votre brouillon.");
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

        const payload = {
            homeworkId: homework._id,
            levelIndex: 0,
            playerId: user._id || user.id,
            userText: essayText,
            draftContent: draftText,
            aiNotes: aiNotesText,
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

                    {/* Gold Bonus Banner */}
                    <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border-2 border-amber-400/60 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden">
                        <div className="text-xs font-black uppercase tracking-widest text-amber-300">Bonus pour le Prochain Contrôle sur Table</div>
                        <div className="text-5xl font-black text-amber-300 my-2 drop-shadow-md">
                            +{bonus} <span className="text-2xl font-bold text-amber-200">pt{bonus > 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-xs text-amber-100/90 font-medium max-w-lg mx-auto">
                            Ce bonus sera ajouté directement par votre professeur à votre note du prochain devoir surveillé sur table !
                        </p>
                    </div>

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
                        onPaste={handleBlockedPaste()}
                        onDrop={handleBlockedPaste()}
                    />

                    <div className="conda-redaction-actions-bar">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                className="conda-btn-ia-copy"
                                onClick={handleCopyForAI}
                                title="Copie votre travail pour le soumettre à Gemini et ouvre la section de prise de notes"
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

                    {/* Section Conseils de l'IA (s'affiche dès qu'on clique sur Copier pour l'IA) */}
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

            {/* Final Submission Modal: Paste AI Conversation */}
            {showFinalModal && (
                <div className="conda-redaction-modal-overlay">
                    <div className="conda-redaction-modal">
                        <div className="text-3xl mb-2">📋</div>
                        <h3 className="conda-redaction-modal-title">Clôture du devoir & Échange avec l'IA</h3>
                        <p className="conda-redaction-modal-text">
                            Pour finaliser votre envoi, veuillez <strong>copier-coller ci-dessous l'intégralité de votre conversation avec Gemini / l'IA</strong>.
                            Elle sera transmise à votre professeur pour valider votre démarche de travail :
                        </p>
                        <textarea
                            className="w-full h-44 p-3 rounded-xl border border-slate-600 bg-slate-900 text-slate-100 text-xs font-mono mb-4 outline-none focus:border-indigo-500 resize-y"
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
            )}

            {/* Toast Alert */}
            {toastMessage && (
                <div className="conda-redaction-toast">
                    {toastMessage}
                </div>
            )}
        </div>
    );
}
