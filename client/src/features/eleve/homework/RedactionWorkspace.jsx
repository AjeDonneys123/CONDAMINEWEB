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
    const [copyTargetMode, setCopyTargetMode] = useState('both'); // 'both' | 'draft' | 'essay'
    const [aiCopiedToast, setAiCopiedToast] = useState(false);
    const [isNotesFocusMode, setIsNotesFocusMode] = useState(false);
    const [pinnedAiNotes, setPinnedAiNotes] = useState('');
    const [finalPlanText, setFinalPlanText] = useState('');
    const [finalLessonsText, setFinalLessonsText] = useState('');

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

    // Helper to evaluate an attempt (at least 20 lines or 150 words)
    const formatAttemptData = (num, text, draft, mode) => {
        const clean = String(text || '').trim();
        const cleanDraft = String(draft || '').trim();
        const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
        const rawLines = clean ? clean.split('\n').filter(l => l.trim().length > 0).length : 0;
        const lines = Math.max(rawLines, Math.round(words / 9));
        const isSubstantial = lines >= 20 || words >= 150;
        return {
            attemptNumber: num,
            text: clean,
            draft: cleanDraft,
            targetMode: mode || 'both',
            wordsCount: words,
            linesCount: lines,
            isSubstantial,
            savedAt: new Date().toLocaleTimeString()
        };
    };

    // Save or update an attempt in history
    const archiveAttempt = (num, text, draft, mode) => {
        const entry = formatAttemptData(num, text, draft, mode);
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
        const cleanDraft = draftText.trim();
        const cleanEssay = essayText.trim();
        const isAttempt1 = attemptsCount === 1;

        // Validation rules based on attempt number and selected mode
        if (isAttempt1) {
            if (!cleanDraft || cleanDraft.length < 15) {
                showToast("⚠️ Sas d'engagement : posez d'abord vos idées et votre plan dans le brouillon.");
                return;
            }
            if (!cleanEssay || cleanEssay.length < 25) {
                showToast("⚠️ Sas d'engagement : rédigez votre 1er essai de devoir (V1) avant de solliciter l'IA.");
                return;
            }
        } else {
            if (copyTargetMode === 'draft') {
                if (!cleanDraft || cleanDraft.length < 15) {
                    showToast("⚠️ Votre brouillon est vide. Posez ou ajustez votre plan avant de le copier pour l'IA.");
                    return;
                }
            } else if (copyTargetMode === 'essay') {
                if (!cleanEssay || cleanEssay.length < 25) {
                    showToast("⚠️ Votre devoir rédigé est vide ou trop court.");
                    return;
                }
            } else {
                // 'both'
                if (!cleanDraft || cleanDraft.length < 15) {
                    showToast("⚠️ Votre brouillon est vide.");
                    return;
                }
                if (!cleanEssay || cleanEssay.length < 25) {
                    showToast("⚠️ Votre devoir rédigé est trop court.");
                    return;
                }
            }
        }

        archiveAttempt(attemptsCount, cleanEssay, cleanDraft, isAttempt1 ? 'both' : copyTargetMode);

        const currentToken = computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount);
        const watermark = computeInvisibleWatermark(user?._id || user?.id, homework?._id);

        const bonusGuidance = `
Système de bonus CondaWeb (applicable sur le prochain contrôle sur table, plafonné à 15,5/20) :
- Si ma copie a déjà un très bon niveau : dis-moi clairement "Très bonne base, tu n'as pas vraiment besoin de bonus toi ! Par contre voyons des détails qui te permettront d'améliorer ta rédaction pour de vrai : demande-moi ce que tu veux (exemples précis, anecdotes historiques, chiffres clés, citations d'époque, vocabulaire de spécialiste)."
- Si ma copie est encore fragile ou incomplète : dis-moi "Pour l'instant, il te reste une grande marge de progression (et de précieux points bonus à aller chercher pour ton DS !)", puis donne-moi 2 ou 3 pistes prioritaires sur la structure, les arguments oubliés et le plan, sans jamais rédiger à ma place.`;

        let textToCopy = '';

        if (isAttempt1) {
            textToCopy = `${watermark}[SUJET DU DEVOIR : "${topicText}"]

--- MON BROUILLON / PLAN INITIAL : ---
${cleanDraft}

--- MON 1ER ESSAI RÉDIGÉ (V1) : ---
${cleanEssay}

Consigne OBLIGATOIRE de contrôle CondaWeb (Jeton : #${currentToken}) :
Tu agis comme tuteur pédagogique exigeant et bienveillant. Analyse mon travail sans JAMAIS rédiger à ma place.
Tu dois OBLIGATOIREMENT commencer le tout premier mot de ta réponse par cette mention exacte :
"[CONSEILS_APPLIQUÉS : OUI | RÉF: ${currentToken}]"
${bonusGuidance}`;
        } else if (copyTargetMode === 'draft') {
            textToCopy = `${watermark}[SUJET DU DEVOIR : "${topicText}"]

--- MON PLAN / BROUILLON RÉVISÉ (Essai n°${attemptsCount}) : ---
${cleanDraft}

--- MES DERNIÈRES NOTES DE TES CONSEILS : ---
${aiNotesText.trim() || "(Conseils précédents)"}

Consigne OBLIGATOIRE de contrôle CondaWeb (Jeton : #${currentToken}) :
Tu agis comme tuteur pédagogique sans JAMAIS rédiger à ma place.
J'ai retravaillé mon plan et mes arguments au brouillon suite à tes remarques. 
Analyse spécifiquement mon brouillon : ce plan est-il équilibré et solide ? Mes exemples et arguments sont-ils pertinents avant que je ne passe à la rédaction ?
Tu dois OBLIGATOIREMENT commencer le tout premier mot de ta réponse par cette mention exacte :
"[CONSEILS_APPLIQUÉS : OUI / PARTIELLEMENT / NON | RÉF: ${currentToken}]"
suivi d'une courte phrase expliquant si ce plan corrigé prend bien en compte tes remarques.
${bonusGuidance}`;
        } else if (copyTargetMode === 'essay') {
            textToCopy = `${watermark}[SUJET DU DEVOIR : "${topicText}"]

--- MA NOUVELLE TENTATIVE RÉDIGÉE (Essai n°${attemptsCount}) : ---
${cleanEssay}

--- MES DERNIÈRES NOTES DE TES CONSEILS : ---
${aiNotesText.trim() || "(Conseils précédents)"}

Consigne OBLIGATOIRE de contrôle CondaWeb (Jeton : #${currentToken}) :
Tu agis comme tuteur pédagogique sans JAMAIS rédiger à ma place.
J'ai réécrit / enrichi ma copie. Analyse la rédaction : respect de la méthode AEI, fluidité, précision des arguments et clarté.
Tu dois OBLIGATOIREMENT commencer le tout premier mot de ta réponse par cette mention exacte :
"[CONSEILS_APPLIQUÉS : OUI / PARTIELLEMENT / NON | RÉF: ${currentToken}]"
suivi d'une courte phrase expliquant si cette nouvelle version a bien pris en compte tes conseils précédents.
${bonusGuidance}`;
        } else {
            // 'both'
            textToCopy = `${watermark}[SUJET DU DEVOIR : "${topicText}"]

--- MON BROUILLON & PLAN CONSOLIDÉ (Essai n°${attemptsCount}) : ---
${cleanDraft}

--- MA NOUVELLE TENTATIVE RÉDIGÉE : ---
${cleanEssay}

--- MES DERNIÈRES NOTES DE TES CONSEILS : ---
${aiNotesText.trim() || "(Conseils précédents)"}

Consigne OBLIGATOIRE de contrôle CondaWeb (Jeton : #${currentToken}) :
Tu agis comme tuteur pédagogique sans JAMAIS rédiger à ma place.
Analyse mon plan au brouillon et ma rédaction : équilibre, méthode AEI, faits précis.
Tu dois OBLIGATOIREMENT commencer le tout premier mot de ta réponse par cette mention exacte :
"[CONSEILS_APPLIQUÉS : OUI / PARTIELLEMENT / NON | RÉF: ${currentToken}]"
suivi d'une courte phrase expliquant si cette nouvelle version a bien pris en compte tes conseils précédents.
${bonusGuidance}`;
        }

        const modeLabel = isAttempt1
            ? 'V1 complète (Brouillon + Copie)'
            : copyTargetMode === 'draft'
            ? 'Plan / Brouillon révisé'
            : copyTargetMode === 'essay'
            ? 'Devoir rédigé'
            : 'Brouillon + Devoir';

        try {
            await navigator.clipboard.writeText(textToCopy);
            setIsNotesFocusMode(true);
            setAiCopiedToast(true);
            showToast(`📋 ${modeLabel} copié(e) avec jeton #${currentToken} ! Collez à Gemini.`);
        } catch (_) {
            setIsNotesFocusMode(true);
            setAiCopiedToast(true);
            showToast(`ℹ️ Collez votre ${modeLabel} à Gemini et notez ses conseils.`);
        }
    };

    // "J'ai fini de prendre mes notes" handler
    const handleFinishNotes = () => {
        const cleanNotes = aiNotesText.trim();
        if (cleanNotes.length < 15) {
            showToast("⚠️ Résumez au moins 2 ou 3 remarques clés du tuteur pour continuer.");
            return;
        }
        setPinnedAiNotes(cleanNotes);
        setIsNotesFocusMode(false);
        setShowAiNotes(true);
        if (attemptsCount === 1) {
            setAttemptsCount(2);
        }
        showToast("📌 Conseils épinglés en haut ! Modifiez maintenant votre brouillon et votre travail.");
    };

    // "Nouvelle tentative" handler
    const handleNewAttempt = () => {
        if (!confirm("Voulez-vous démarrer une nouvelle tentative ? Votre brouillon et vos notes sur l'IA seront conservés pour guider votre écriture.")) {
            return;
        }
        archiveAttempt(attemptsCount, essayText, draftText, copyTargetMode);
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
        if (!finalPlanText.trim()) {
            showToast("⚠️ Refaites d'abord votre plan consolidé au brouillon.");
            return;
        }
        if (!finalLessonsText.trim()) {
            showToast("⚠️ Formulez les 2 ou 3 conseils que vous avez appris de l'IA pour le DS.");
            return;
        }
        if (!aiConversationText.trim()) {
            showToast("⚠️ Collez votre échange avec l'IA pour finaliser l'envoi.");
            return;
        }

        setSubmitting(true);
        const finalEntry = formatAttemptData(attemptsCount, essayText, draftText, copyTargetMode);
        const historyToSend = attemptsHistory.filter(a => a.attemptNumber !== attemptsCount);
        historyToSend.push(finalEntry);

        const currentToken = computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount);
        const combinedMemoSheet = `--- PLAN CONSOLIDÉ AU BROUILLON ---\n${finalPlanText.trim()}\n\n--- CONSEILS ET PIÈGES RETENUS POUR LE DS ---\n${finalLessonsText.trim()}`;

        const payload = {
            homeworkId: homework._id,
            levelIndex: 0,
            playerId: user._id || user.id,
            userText: essayText,
            draftContent: draftText,
            aiNotes: aiNotesText,
            memoSheet: combinedMemoSheet,
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
                                Ce bonus sera ajouté par votre professeur à votre note du prochain contrôle sur table (applicable jusqu'au plafond de 15,5/20).
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

            {/* Pinned AI Notes Banner (Visible once notes have been taken) */}
            {pinnedAiNotes.trim() && (
                <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 border-b border-indigo-500/40 py-2.5 px-6 flex items-center justify-between gap-4 sticky top-[65px] z-30 shadow-md">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="text-lg flex-shrink-0">📌</span>
                        <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider block">
                                Conseils IA retenus pour cet essai :
                            </span>
                            <p className="text-xs text-slate-200 font-medium truncate m-0">
                                {pinnedAiNotes}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsNotesFocusMode(true)}
                        className="text-xs text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 px-3 py-1 rounded-lg flex-shrink-0 font-bold transition flex items-center gap-1.5"
                    >
                        <span>✏️</span>
                        <span>Modifier mes notes</span>
                    </button>
                </div>
            )}

            {/* Main Area: Editor (Left) & Persistent Draft (Right) */}
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
                        <div className="flex flex-wrap items-center gap-3">
                            {attemptsCount === 1 && !showAiNotes ? (
                                <button
                                    type="button"
                                    className="conda-btn-ia-copy"
                                    onClick={handleCopyForAI}
                                    title="Copie votre V1 (Brouillon + Copie obligatoires) avec votre jeton de session pour le soumettre à Gemini"
                                >
                                    <span>📋</span>
                                    <span>Copier ma V1 pour l'IA (Brouillon + Copie)</span>
                                </button>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="inline-flex bg-slate-900/90 border border-slate-700/80 rounded-2xl p-1 text-xs shadow-sm">
                                        <button
                                            type="button"
                                            onClick={() => setCopyTargetMode('draft')}
                                            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                                                copyTargetMode === 'draft'
                                                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                            title="Envoyer uniquement le plan / brouillon révisé pour valider la structure et les arguments"
                                        >
                                            <span>📝</span>
                                            <span>Plan seul (Brouillon)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCopyTargetMode('essay')}
                                            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                                                copyTargetMode === 'essay'
                                                    ? 'bg-indigo-600 text-white font-black shadow-sm'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                            title="Envoyer le devoir rédigé pour vérifier le style et la méthode AEI"
                                        >
                                            <span>✍️</span>
                                            <span>Devoir seul</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCopyTargetMode('both')}
                                            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                                                copyTargetMode === 'both'
                                                    ? 'bg-rose-600 text-white font-black shadow-sm'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                            title="Envoyer à la fois le brouillon et la copie pour un bilan complet"
                                        >
                                            <span>🌟</span>
                                            <span>Brouillon + Devoir</span>
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        className="conda-btn-ia-copy"
                                        onClick={handleCopyForAI}
                                        title="Copie le contenu sélectionné pour le soumettre à Gemini"
                                    >
                                        <span>📋</span>
                                        <span>
                                            {copyTargetMode === 'draft'
                                                ? 'Copier mon Plan / Brouillon pour l’IA'
                                                : copyTargetMode === 'essay'
                                                ? 'Copier mon Devoir rédigé pour l’IA'
                                                : 'Copier Brouillon + Devoir pour l’IA'}
                                        </span>
                                    </button>
                                </div>
                            )}

                            {showAiNotes && (
                                <button
                                    type="button"
                                    className="conda-redaction-tool-btn border-indigo-500/50 bg-indigo-950/40 text-indigo-300"
                                    onClick={handleNewAttempt}
                                    title="Démarrer une nouvelle tentative tout en conservant vos notes de brouillon"
                                >
                                    <span>🔄</span>
                                    <span>Nouvelle tentative ({attemptsCount + 1})</span>
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
                        Posez ici vos idées, votre plan et vos mots-clés. Ce brouillon reste modifiable tout au long de vos tentatives et s'ajuste selon les conseils de l'IA.
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
                </aside>
            </main>

            {/* FOCUS MODE: Prise de Notes IA Dédiée */}
            {isNotesFocusMode && (
                <div className="conda-redaction-modal-overlay">
                    <div className="bg-slate-900 border-2 border-indigo-500 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-5 text-left">
                        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                            <div className="flex items-center gap-2.5">
                                <span className="text-2xl">🤖</span>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                                        Phase de Consultation & Prise de Notes IA
                                    </h3>
                                    <span className="text-[11px] font-bold text-indigo-400">
                                        Tentative n°{attemptsCount}
                                    </span>
                                </div>
                            </div>
                            <span className="text-[11px] font-mono text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/30">
                                Jeton : #{computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount)}
                            </span>
                        </div>

                        <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-2xl p-3.5 text-xs text-indigo-200/90 leading-relaxed space-y-1.5">
                            <div className="font-bold text-white flex items-center gap-1.5">
                                <span>📋</span>
                                <span>Consigne de travail :</span>
                            </div>
                            <p className="m-0">
                                1. Votre texte a été copié dans votre presse-papier. Collez-le (Ctrl+V) dans le volet <strong>Demander à Gemini</strong> à droite.
                            </p>
                            <p className="m-0">
                                2. Lisez attentivement les remarques du tuteur.
                            </p>
                            <p className="m-0 font-semibold text-amber-300">
                                💡 Important pour votre bonus : Résumez ci-dessous avec vos propres mots les erreurs signalées et les axes d'amélioration. À la fin du devoir, pour valider l'étape, vous devrez refaire votre plan et citer ce que vous avez retenu !
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-300 block">
                                Mes notes sur les conseils du tuteur (obligatoire) :
                            </label>
                            <textarea
                                className="w-full h-40 p-3.5 rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                placeholder="Résumez ici :&#10;- Ce que l'IA a trouvé réussi&#10;- Les erreurs de vocabulaire ou de structure signalées&#10;- Ce que vous devez ajouter ou modifier dans votre prochain essai..."
                                value={aiNotesText}
                                onChange={handleAiNotesChange}
                                onKeyDown={handleKeyDown}
                                onPaste={handleBlockedPaste('les notes')}
                                onDrop={handleBlockedPaste('les notes')}
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                className="text-xs text-slate-400 hover:text-slate-200"
                                onClick={() => setIsNotesFocusMode(false)}
                            >
                                Revenir au brouillon
                            </button>
                            <button
                                type="button"
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg transition flex items-center gap-2"
                                onClick={handleFinishNotes}
                            >
                                <span>✅</span>
                                <span>J'ai fini de prendre mes notes ➔ Améliorer mon devoir</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Final Submission Modal: Assimilation Step + Collapsible Chat Paste */}
            {showFinalModal && (() => {
                const currentToken = computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount);
                const baseToken = computeSessionToken(user?._id || user?.id, homework?._id, 1);
                const watermark = computeInvisibleWatermark(user?._id || user?.id, homework?._id);
                const isTokenInChat = aiConversationText.includes(currentToken) || aiConversationText.includes(baseToken);
                const isWatermarkInChat = aiConversationText.includes(watermark);
                const hasChat = aiConversationText.trim().length > 20;

                return (
                    <div className="conda-redaction-modal-overlay">
                        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-4 text-left max-h-[92vh] overflow-y-auto">
                            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                                <span className="text-2xl">🧠</span>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                                        Validation Finale & Fiche Mémo DS
                                    </h3>
                                    <p className="text-xs text-slate-400 m-0">
                                        Prouvez ce que vous avez appris pour débloquer votre bonus (jusqu'à <strong>+2.5 pts</strong>, applicable jusqu'au palier de 15,5/20) !
                                    </p>
                                </div>
                            </div>

                            {/* Section 1: Refaire le plan au brouillon */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-200">
                                        1. Refais ton plan au brouillon (Plan consolidé) :
                                    </label>
                                    <span className="text-[10px] text-amber-400 font-bold">Obligatoire</span>
                                </div>
                                <textarea
                                    className="w-full h-20 p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                    placeholder="I. Une démocratie directe (Ecclésia, magistrats)...&#10;II. Les limites réelles (exclusion femmes, métèques, esclaves)..."
                                    value={finalPlanText}
                                    onChange={(e) => setFinalPlanText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handleBlockedPaste('le plan')}
                                    onDrop={handleBlockedPaste('le plan')}
                                />
                            </div>

                            {/* Section 2: Conseils & pièges retenus */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-200">
                                        2. Les 2 ou 3 conseils majeurs que tu as appris de l'IA pour le DS :
                                    </label>
                                    <span className="text-[10px] text-amber-400 font-bold">Obligatoire</span>
                                </div>
                                <textarea
                                    className="w-full h-18 p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                    placeholder="1. Bien définir la Misthophorie dès le début&#10;2. Soigner la transition entre fonctionnement et limites..."
                                    value={finalLessonsText}
                                    onChange={(e) => setFinalLessonsText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handleBlockedPaste('les conseils')}
                                    onDrop={handleBlockedPaste('les conseils')}
                                />
                            </div>

                            {/* Section 3: Échange avec l'IA (collapsible dès collage) */}
                            <div className="space-y-1 pt-1 border-t border-slate-800">
                                <label className="text-xs font-bold text-slate-200 block">
                                    3. Échange avec l'IA (Tutorat) :
                                </label>

                                {!hasChat ? (
                                    <textarea
                                        className="w-full h-24 p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                        placeholder="Collez ici votre conversation complète avec Gemini (Ctrl+V / Cmd+V autorisé)..."
                                        value={aiConversationText}
                                        onChange={(e) => setAiConversationText(e.target.value)}
                                    />
                                ) : (
                                    <div>
                                        {isWatermarkInChat ? (
                                            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xl">✅</span>
                                                    <div>
                                                        <div className="text-xs font-bold text-emerald-300">
                                                            Conversation avec l'IA bien reçue
                                                        </div>
                                                        <div className="text-[10px] text-emerald-400/80">
                                                            Échange authentifié avec succès
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setAiConversationText('')}
                                                    className="text-xs text-slate-400 hover:text-white underline font-medium"
                                                >
                                                    Recoller
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/60 flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xl">❌</span>
                                                    <div>
                                                        <div className="text-xs font-bold text-rose-300">
                                                            Échec : tu as caché une partie de la conversation
                                                        </div>
                                                        <div className="text-[10px] text-rose-400/80">
                                                            Bonus bloqué
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setAiConversationText('')}
                                                    className="text-xs text-slate-400 hover:text-white underline font-medium"
                                                >
                                                    Recoller
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="conda-redaction-modal-actions pt-2 border-t border-slate-800">
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
