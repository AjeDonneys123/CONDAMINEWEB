import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SheetRichTextEditor from '../../prof/learning/SheetRichTextEditor';

const COLOR_PRESETS = [
    { id: 'amber', label: 'Ambre', bg: '#fef3c7', border: '#fde68a', text: '#92400e', badgeBg: '#fde68a' },
    { id: 'emerald', label: 'Vert', bg: '#dcfce7', border: '#bbf7d0', text: '#166534', badgeBg: '#bbf7d0' },
    { id: 'sky', label: 'Bleu', bg: '#e0f2fe', border: '#bae6fd', text: '#075985', badgeBg: '#bae6fd' },
    { id: 'purple', label: 'Violet', bg: '#f3e8ff', border: '#e9d5ff', text: '#6b21a8', badgeBg: '#e9d5ff' },
    { id: 'pink', label: 'Rose', bg: '#fce7f3', border: '#fbcfe8', text: '#9d174d', badgeBg: '#fbcfe8' }
];

export default function CollaborativeSuperfiche({
    moduleId,
    stepId,
    initialStep,
    user,
    isTeacher = false,
    classroom = ''
}) {
    const [sheet, setSheet] = useState(null);
    const [stepTitle, setStepTitle] = useState(initialStep?.title || 'Fiche de cours');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('workshop'); // 'workshop' | 'clean'
    const [showPeerContributions, setShowPeerContributions] = useState(true);

    // Éditeur en cours d'injection
    const [injectingParagraphId, setInjectingParagraphId] = useState(null); // paragraphId où l'élève ajoute
    const [editingContribId, setEditingContribId] = useState(null); // contributionId si modification
    const [draftHtml, setDraftHtml] = useState('');
    const [draftText, setDraftText] = useState('');
    const [draftColor, setDraftColor] = useState(COLOR_PRESETS[0].bg);
    const [savingContrib, setSavingContrib] = useState(false);

    // Commentaires
    const [openComments, setOpenComments] = useState({}); // { [contribId]: boolean }
    const [commentingContribId, setCommentingContribId] = useState(null); // contribId avec input ouvert
    const [commentDraft, setCommentDraft] = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const [deletingContribId, setDeletingContribId] = useState(null);

    const paragraphs = sheet?.paragraphs || [];
    const totalContributions = useMemo(() => {
        return (sheet?.paragraphs || []).reduce((acc, p) => acc + (p.contributions?.length || 0), 0);
    }, [sheet]);

    const studentId = String(user?._id || user?.id || '').trim();
    const studentName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.name || (isTeacher ? 'Professeur' : 'Élève');
    const studentFirstName = user?.firstName || user?.prenom || (user?.name ? user.name.split(' ')[0] : (isTeacher ? 'Prof' : 'Élève'));
    const effectiveClassroom = classroom || user?.currentClass || user?.classroom || user?.classe || '';

    const apiPrefix = isTeacher ? '/api/prof/learning' : '/api/eleve/learning';

    // Charger les données de la superfiche collaborative
    const fetchSheet = useCallback(async (isPolling = false) => {
        if (!moduleId || !stepId) return;
        try {
            if (!isPolling) setLoading(true);
            const query = new URLSearchParams();
            if (studentId) query.set('studentId', studentId);
            if (effectiveClassroom) query.set('classroom', effectiveClassroom);

            const res = await fetch(`${apiPrefix}/${moduleId}/collaborative-sheet/${stepId}?${query.toString()}`);
            if (!res.ok) throw new Error('Impossible de charger la superfiche collaborative');
            const data = await res.json();
            if (data?.ok && data?.sheet) {
                setSheet(data.sheet);
                if (data.stepTitle) setStepTitle(data.stepTitle);
                setError('');
            }
        } catch (e) {
            if (!isPolling) setError(e.message || 'Erreur de chargement');
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, [moduleId, stepId, studentId, effectiveClassroom, apiPrefix]);

    useEffect(() => {
        fetchSheet();
        const timer = setInterval(() => {
            fetchSheet(true);
        }, 8000);
        return () => clearInterval(timer);
    }, [fetchSheet]);

    // Ouvrir l'éditeur pour injecter une nouvelle contribution dans une section
    const handleStartInjection = (paragraphId) => {
        setInjectingParagraphId(paragraphId);
        setEditingContribId(null);
        setDraftHtml('');
        setDraftText('');
        setDraftColor(COLOR_PRESETS[0].bg);
    };

    // Ouvrir l'éditeur pour modifier sa propre contribution existante
    const handleStartEdit = (paragraphId, contrib) => {
        setInjectingParagraphId(paragraphId);
        setEditingContribId(contrib.contributionId || contrib._id);
        setDraftHtml(contrib.html || contrib.text || '');
        setDraftText(contrib.text || '');
        setDraftColor(contrib.color || COLOR_PRESETS[0].bg);
    };

    const handleCancelEditor = () => {
        setInjectingParagraphId(null);
        setEditingContribId(null);
        setDraftHtml('');
        setDraftText('');
    };

    // Enregistrer la contribution élève
    const handleSaveContribution = async () => {
        if (!injectingParagraphId || (!draftHtml.trim() && !draftText.trim()) || savingContrib) return;
        setSavingContrib(true);
        try {
            const res = await fetch(`${apiPrefix}/${moduleId}/collaborative-sheet/${stepId}/contribution`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paragraphId: injectingParagraphId,
                    contributionId: editingContribId,
                    html: draftHtml.trim(),
                    text: draftText.trim(),
                    color: draftColor,
                    studentId,
                    studentName,
                    studentFirstName,
                    classroom: effectiveClassroom
                })
            });
            const data = await res.json();
            if (data?.ok && data?.sheet) {
                setSheet(data.sheet);
                handleCancelEditor();
            } else {
                alert(data?.error || 'Erreur lors de l’enregistrement.');
            }
        } catch (e) {
            alert('Erreur de connexion : ' + e.message);
        } finally {
            setSavingContrib(false);
        }
    };

    // Supprimer une contribution
    const handleDeleteContribution = async (contribId) => {
        if (!contribId || deletingContribId) return;
        if (!window.confirm('Voulez-vous vraiment supprimer cette contribution ?')) return;
        setDeletingContribId(contribId);
        try {
            const query = new URLSearchParams();
            if (studentId) query.set('studentId', studentId);
            if (effectiveClassroom) query.set('classroom', effectiveClassroom);

            const res = await fetch(`${apiPrefix}/${moduleId}/collaborative-sheet/${stepId}/contribution/${contribId}?${query.toString()}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data?.ok && data?.sheet) {
                setSheet(data.sheet);
            } else {
                alert(data?.error || 'Impossible de supprimer la contribution.');
            }
        } catch (e) {
            alert('Erreur : ' + e.message);
        } finally {
            setDeletingContribId(null);
        }
    };

    // Basculer l'affichage des commentaires pour une contribution
    const toggleShowComments = (contribKey) => {
        setOpenComments((prev) => ({
            ...prev,
            [contribKey]: !prev[contribKey]
        }));
    };

    // Ouvrir la zone d'ajout d'un commentaire
    const toggleOpenCommentBox = (contribKey) => {
        setOpenComments((prev) => ({
            ...prev,
            [contribKey]: true
        }));
        setCommentingContribId((prev) => (prev === contribKey ? null : contribKey));
        setCommentDraft('');
    };

    // Envoyer un commentaire sur une contribution
    const handleSendComment = async (paragraphId, contribId) => {
        if (!commentDraft.trim() || sendingComment) return;
        setSendingComment(true);
        try {
            const res = await fetch(`${apiPrefix}/${moduleId}/collaborative-sheet/${stepId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paragraphId,
                    contributionId: contribId,
                    text: commentDraft.trim(),
                    authorId: studentId,
                    authorName: studentName,
                    authorRole: isTeacher ? 'teacher' : 'student',
                    classroom: effectiveClassroom
                })
            });
            const data = await res.json();
            if (data?.ok && data?.sheet) {
                setSheet(data.sheet);
                setCommentDraft('');
                setCommentingContribId(null);
                setOpenComments((prev) => ({ ...prev, [contribId]: true }));
            } else {
                alert(data?.error || 'Erreur lors de l’envoi du commentaire.');
            }
        } catch (e) {
            alert('Erreur : ' + e.message);
        } finally {
            setSendingComment(false);
        }
    };

    if (loading && !sheet) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-semibold text-sm">Chargement de la fiche participative...</p>
            </div>
        );
    }

    if (error && !sheet) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-center my-4">
                <p className="font-bold mb-2">Erreur</p>
                <p className="text-sm">{error}</p>
                <button
                    type="button"
                    onClick={() => fetchSheet()}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto py-4 px-2 sm:px-4 space-y-6">
            {/* Bannière d'en-tête de la fiche collaborative */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-wide uppercase text-indigo-200">
                            <span>🤝 Fiche Participative & Collaborative</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{effectiveClassroom ? `Classe ${effectiveClassroom}` : 'Partage de classe'}</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                            {stepTitle}
                        </h2>
                        <p className="text-xs sm:text-sm text-indigo-200/90 max-w-xl">
                            {viewMode === 'clean'
                                ? 'Fiche complète continue pour la révision et l’apprentissage. Tous les points du cours sont présentés sans coupure.'
                                : 'Le cours officiel du professeur est affiché ci-dessous. Tu peux sélectionner n’importe quelle partie pour y injecter tes modifications, compléments ou exemples, et échanger avec tes camarades !'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setViewMode((curr) => curr === 'clean' ? 'workshop' : 'clean')}
                            className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shadow-lg active:scale-95 ${
                                viewMode === 'clean'
                                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-950/20 ring-2 ring-white/50'
                                    : 'bg-white hover:bg-slate-100 text-indigo-950 shadow-indigo-950/20'
                            }`}
                        >
                            <span>{viewMode === 'clean' ? '✍️ Mode Atelier (Ajouts)' : '📖 Voir la fiche complète pour apprendre'}</span>
                        </button>

                        {viewMode === 'workshop' && (
                            <button
                                type="button"
                                onClick={() => handleStartInjection('new')}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-emerald-950/20 transition cursor-pointer"
                            >
                                <span>➕</span>
                                <span>Proposer une section libre</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {viewMode === 'clean' ? (
                /* VUE FICHE COMPLÈTE CONTINUE (POUR APPRENDRE ET RÉVISER DANS SON ENSEMBLE PROPREMENT) */
                <div className="space-y-6">
                    {/* Barre d'outils de révision */}
                    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-4 no-print">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📖</span>
                            <div>
                                <h3 className="text-sm font-black text-slate-900">Fiche complète d’apprentissage</h3>
                                <p className="text-xs text-slate-500 font-medium">Document d’un seul tenant, épuré des boutons d’édition, conçu pour la mémorisation et l’étude.</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {totalContributions > 0 && (
                                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 cursor-pointer text-xs font-bold text-slate-700 transition">
                                    <input
                                        type="checkbox"
                                        checked={showPeerContributions}
                                        onChange={(e) => setShowPeerContributions(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span>Ajouts des camarades ({totalContributions})</span>
                                </label>
                            )}

                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
                            >
                                <span>🖨️</span>
                                <span>Imprimer / PDF</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setViewMode('workshop')}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition shadow-sm cursor-pointer"
                            >
                                <span>✍️</span>
                                <span>Mode Atelier (Ajouts)</span>
                            </button>
                        </div>
                    </div>

                    {/* Feuille de cours continue propre */}
                    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-12 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
                        {paragraphs.length === 0 ? (
                            <p className="text-center text-slate-500 py-8">Aucun contenu sur cette fiche.</p>
                        ) : (
                            paragraphs.map((p, pIndex) => {
                                const contributions = p.contributions || [];

                                return (
                                    <div key={p.paragraphId || pIndex} className="space-y-4">
                                        {/* Rendu officiel du professeur */}
                                        <div
                                            className="teacher-rich-content text-slate-900 leading-relaxed text-base sm:text-lg space-y-1"
                                            dangerouslySetInnerHTML={{ __html: p.baseHtml || p.baseText }}
                                        />

                                        {/* Compléments des camarades intégrés proprement sous la sous-partie */}
                                        {showPeerContributions && contributions.length > 0 && (
                                            <div className="my-3 space-y-2.5 pl-3 sm:pl-5 border-l-4 border-indigo-200">
                                                {contributions.map((contrib, cIdx) => (
                                                    <div
                                                        key={contrib.contributionId || contrib._id || cIdx}
                                                        style={{ backgroundColor: contrib.color || COLOR_PRESETS[0].bg }}
                                                        className="rounded-2xl p-4 border border-black/10 shadow-2xs"
                                                    >
                                                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between gap-2">
                                                            <span className="flex items-center gap-1.5">
                                                                <span>💡 Complément ·</span>
                                                                <span className="text-slate-900">{contrib.studentName || 'Camarade'}</span>
                                                                {contrib.studentFirstName && <span className="text-slate-500">({contrib.studentFirstName})</span>}
                                                            </span>
                                                            {contrib.createdAt && (
                                                                <span className="text-[10px] text-slate-400 font-normal">
                                                                    {new Date(contrib.createdAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div
                                                            className="student-rich-content text-slate-900 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium"
                                                            dangerouslySetInnerHTML={{ __html: contrib.html || contrib.text }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            ) : (
                /* Structure du cours avec injection collaborative par zone (Atelier) */
                <div className="space-y-8">
                    {paragraphs.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500">
                            <p className="font-semibold text-sm">Aucune partie configurée sur cette fiche.</p>
                        </div>
                    ) : (
                    paragraphs.map((p, pIndex) => {
                        const contributions = p.contributions || [];
                        const isInjectingHere = injectingParagraphId === p.paragraphId;

                        return (
                            <div
                                key={p.paragraphId || pIndex}
                                className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                            >
                                {/* En-tête de section avec badge discret pour ne pas dupliquer le titre du prof affiché dans le corps */}
                                <div className="px-5 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        {(() => {
                                            let badgeLabel = `Partie ${pIndex + 1}`;
                                            if (p.romanPart && p.subpart) {
                                                badgeLabel = `Partie ${p.romanPart} · Sous-partie ${p.subpart}`;
                                            } else if (p.romanPart) {
                                                badgeLabel = `Partie ${p.romanPart}`;
                                            } else if (p.subpart) {
                                                badgeLabel = `Sous-partie ${p.subpart}`;
                                            } else {
                                                const rawTitle = String(p.title || '').trim();
                                                const romanMatch = rawTitle.match(/^([IVX]+)\./i);
                                                if (romanMatch) {
                                                    badgeLabel = `Partie ${romanMatch[1].toUpperCase()}`;
                                                } else if (/QCM/i.test(rawTitle)) {
                                                    badgeLabel = 'QCM de révision';
                                                } else if (/LEÇON\s*(\d+)/i.test(rawTitle)) {
                                                    badgeLabel = `Leçon ${rawTitle.match(/LEÇON\s*(\d+)/i)[1]}`;
                                                }
                                            }
                                            return (
                                                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-900 text-xs font-black tracking-wide uppercase">
                                                    {badgeLabel}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-400">
                                        {contributions.length > 0 ? `${contributions.length} ajout${contributions.length > 1 ? 's' : ''}` : 'Socle officiel'}
                                    </span>
                                </div>

                                {/* Contenu officiel du cours (HTML riche intégral préservant couleurs rouge/vert, gras, sous-titres, QCM) */}
                                <div className="p-5 sm:p-6 bg-white">
                                    {p.baseHtml ? (
                                        <div
                                            className="teacher-rich-content font-medium text-slate-900 leading-relaxed text-base sm:text-lg space-y-1"
                                            dangerouslySetInnerHTML={{ __html: p.baseHtml }}
                                        />
                                    ) : (
                                        <div className="teacher-rich-content whitespace-pre-wrap font-medium text-slate-900 leading-relaxed text-base sm:text-lg">
                                            {p.baseText}
                                        </div>
                                    )}
                                </div>

                                {/* Liste des contributions / modifications injectées par les élèves dans cette zone */}
                                {contributions.length > 0 && (
                                    <div className="px-4 sm:px-6 pb-4 space-y-4">
                                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 pt-2 flex items-center gap-2">
                                            <span>✨ Contributions et ajouts des camarades</span>
                                            <div className="h-px flex-1 bg-slate-200" />
                                        </div>

                                        {contributions.map((contrib, cIdx) => {
                                            const contribId = contrib.contributionId || contrib._id || `c_${cIdx}`;
                                            const isMyContrib = String(contrib.studentId) === String(studentId) || isTeacher;
                                            const isCommentsVisible = Boolean(openComments[contribId]);
                                            const isCommentInputOpen = commentingContribId === contribId;
                                            const comments = contrib.comments || [];
                                            const cardColor = contrib.color || COLOR_PRESETS[0].bg;

                                            return (
                                                <div
                                                    key={contribId}
                                                    style={{ backgroundColor: cardColor }}
                                                    className="rounded-2xl p-4 sm:p-5 border border-black/10 shadow-sm transition-all"
                                                >
                                                    {/* Contenu formaté de l'élève */}
                                                    <div
                                                        className="student-rich-content text-slate-900 font-medium leading-relaxed text-base whitespace-pre-wrap"
                                                        dangerouslySetInnerHTML={{ __html: contrib.html || contrib.text }}
                                                    />

                                                    {/* Pied de la zone ajoutée avec nom en bas à droite et boutons */}
                                                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-black/10">
                                                        {/* Actions auteur (modifier / supprimer) */}
                                                        <div className="flex items-center gap-3 text-xs">
                                                            {isMyContrib && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEdit(p.paragraphId, contrib)}
                                                                        className="text-slate-700 hover:text-indigo-700 font-bold transition flex items-center gap-1 cursor-pointer"
                                                                    >
                                                                        <span>✏️</span>
                                                                        <span>Modifier</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={deletingContribId === contribId}
                                                                        onClick={() => handleDeleteContribution(contribId)}
                                                                        className="text-slate-700 hover:text-red-700 font-bold transition flex items-center gap-1 cursor-pointer"
                                                                    >
                                                                        <span>🗑️</span>
                                                                        <span>Supprimer</span>
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Nom de l'élève en bas à droite + boutons commentaires */}
                                                        <div className="flex items-center gap-2 text-xs ml-auto">
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm font-bold text-slate-900 border border-black/10 shadow-2xs">
                                                                <span>👤</span>
                                                                <span>{contrib.studentName}</span>
                                                            </span>

                                                            <button
                                                                type="button"
                                                                onClick={() => toggleOpenCommentBox(contribId)}
                                                                className="px-3 py-1 rounded-xl bg-white/90 hover:bg-white text-indigo-700 font-bold border border-indigo-200 shadow-2xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                                                                title="Ajouter un commentaire sur cet ajout"
                                                            >
                                                                <span>💬</span>
                                                                <span>Commenter</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => toggleShowComments(contribId)}
                                                                className="px-3 py-1 rounded-xl bg-white/90 hover:bg-white text-slate-700 font-bold border border-slate-300/80 shadow-2xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                                                                title="Afficher ou cacher les commentaires"
                                                            >
                                                                <span>{isCommentsVisible ? '🙈' : '👁'}</span>
                                                                <span>{isCommentsVisible ? 'Cacher' : `Commentaires (${comments.length})`}</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Fil de commentaires déroulable */}
                                                    {(isCommentsVisible || isCommentInputOpen) && (
                                                        <div className="mt-4 pt-4 border-t border-black/10 space-y-3 bg-white/60 p-4 rounded-2xl">
                                                            <div className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                                                <span>💬</span>
                                                                <span>Fil de discussion ({comments.length})</span>
                                                            </div>

                                                            {comments.length === 0 ? (
                                                                <p className="text-xs text-slate-500 italic">Aucun commentaire pour l’instant. Sois le premier à réagir !</p>
                                                            ) : (
                                                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                                                    {comments.map((cmt, cIdx2) => (
                                                                        <div
                                                                            key={cIdx2}
                                                                            className={`p-3 rounded-xl text-xs space-y-1 ${
                                                                                cmt.authorRole === 'teacher'
                                                                                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-950'
                                                                                    : 'bg-white border border-slate-200 text-slate-800'
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center justify-between font-bold">
                                                                                <span>{cmt.authorRole === 'teacher' ? '👨‍🏫 ' : '👤 '}{cmt.authorName}</span>
                                                                                <span className="text-[10px] text-slate-400 font-normal">
                                                                                    {cmt.createdAt ? new Date(cmt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                                                </span>
                                                                            </div>
                                                                            <p className="leading-relaxed">{cmt.text}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Input d'ajout de commentaire */}
                                                            <div className="flex items-center gap-2 pt-2">
                                                                <input
                                                                    type="text"
                                                                    value={commentingContribId === contribId ? commentDraft : ''}
                                                                    onChange={(e) => {
                                                                        setCommentingContribId(contribId);
                                                                        setCommentDraft(e.target.value);
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            handleSendComment(p.paragraphId, contribId);
                                                                        }
                                                                    }}
                                                                    placeholder="Écris un commentaire ou une question..."
                                                                    className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    disabled={sendingComment || !commentDraft.trim() || commentingContribId !== contribId}
                                                                    onClick={() => handleSendComment(p.paragraphId, contribId)}
                                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                                                                >
                                                                    {sendingComment ? '...' : 'Envoyer'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Zone d'injection / Éditeur recyclé pour cette partie */}
                                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80">
                                    {isInjectingHere ? (
                                        <div className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl border-2 border-indigo-300 shadow-md">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                                <div className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                                                    <span>✍️</span>
                                                    <span>{editingContribId ? 'Modifier ma contribution' : 'Injecter une précision ou modification'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                                    <span>Fond de couleur :</span>
                                                    <div className="flex items-center gap-1">
                                                        {COLOR_PRESETS.map((col) => (
                                                            <button
                                                                key={col.id}
                                                                type="button"
                                                                onClick={() => setDraftColor(col.bg)}
                                                                style={{ backgroundColor: col.bg, borderColor: col.border }}
                                                                className={`w-6 h-6 rounded-full border-2 transition transform hover:scale-110 cursor-pointer ${
                                                                    draftColor === col.bg ? 'ring-2 ring-indigo-600 scale-110 shadow-sm' : ''
                                                                }`}
                                                                title={col.label}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Recyclage du composant SheetRichTextEditor */}
                                            <SheetRichTextEditor
                                                html={draftHtml}
                                                plainText={draftText}
                                                minHeight="min-h-[200px]"
                                                maxHeight="max-h-[380px]"
                                                placeholder="Rédige ici ton complément, ta reformulation ou tes précisions avec les outils de mise en forme (Gras, Puces, Numérotation, Couleurs)..."
                                                autoFocus
                                                onChange={({ html, text }) => {
                                                    setDraftHtml(html);
                                                    setDraftText(text);
                                                }}
                                            />

                                            {/* Boutons d'enregistrement et d'annulation */}
                                            <div className="flex items-center justify-end gap-3 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEditor}
                                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                                                >
                                                    Annuler
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={savingContrib || (!draftHtml.trim() && !draftText.trim())}
                                                    onClick={handleSaveContribution}
                                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <span>{savingContrib ? '⏳ Enregistrement...' : '💾 Enregistrer mon ajout'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleStartInjection(p.paragraphId)}
                                            className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white/70 hover:bg-indigo-50/50 text-indigo-700 hover:text-indigo-900 text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs group"
                                        >
                                            <span className="w-5 h-5 rounded-full bg-indigo-100 group-hover:bg-indigo-200 text-indigo-700 flex items-center justify-center text-xs">➕</span>
                                            <span>{p.subpart ? `Injecter sur la sous-partie ${p.subpart}` : 'Injecter une modification ou un complément sur cette partie'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Ajout d'une nouvelle section libre tout en bas */}
                {injectingParagraphId === 'new' ? (
                    <div className="space-y-4 bg-white p-5 rounded-3xl border-2 border-emerald-400 shadow-lg">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                            <div className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                                <span>➕</span>
                                <span>Ajouter une nouvelle section libre au cours</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                <span>Fond :</span>
                                <div className="flex items-center gap-1">
                                    {COLOR_PRESETS.map((col) => (
                                        <button
                                            key={col.id}
                                            type="button"
                                            onClick={() => setDraftColor(col.bg)}
                                            style={{ backgroundColor: col.bg, borderColor: col.border }}
                                            className={`w-6 h-6 rounded-full border-2 transition transform hover:scale-110 cursor-pointer ${
                                                draftColor === col.bg ? 'ring-2 ring-emerald-600 scale-110' : ''
                                            }`}
                                            title={col.label}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <SheetRichTextEditor
                            html={draftHtml}
                            plainText={draftText}
                            minHeight="min-h-[220px]"
                            maxHeight="max-h-[420px]"
                            placeholder="Rédige ici un nouveau paragraphe, un exemple complet ou une fiche de synthèse..."
                            autoFocus
                            onChange={({ html, text }) => {
                                setDraftHtml(html);
                                setDraftText(text);
                            }}
                        />

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleCancelEditor}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                disabled={savingContrib || (!draftHtml.trim() && !draftText.trim())}
                                onClick={handleSaveContribution}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <span>{savingContrib ? '⏳ Enregistrement...' : '💾 Publier cette section'}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center pt-2">
                        <button
                            type="button"
                            onClick={() => handleStartInjection('new')}
                            className="px-6 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-black transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                            <span>➕</span>
                            <span>Ajouter un complément libre en fin de fiche</span>
                        </button>
                    </div>
                )}
            </div>
            )}

            <style>{`
                .teacher-rich-content { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 1.05rem; }
                .teacher-rich-content div { min-height: 1.5em; line-height: 1.7; }
                .teacher-rich-content strong, .teacher-rich-content b { font-weight: 700; }
                .student-rich-content strong, .student-rich-content b { font-weight: 700; }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                }
            `}</style>
        </div>
    );
}
