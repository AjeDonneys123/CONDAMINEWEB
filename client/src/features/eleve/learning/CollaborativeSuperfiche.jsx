import React, { useState, useEffect, useCallback, useMemo } from 'react';

export default function CollaborativeSuperfiche({
    moduleId,
    stepId,
    initialStep,
    user,
    isTeacher = false,
    classroom = ''
}) {
    const [sheet, setSheet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedVersions, setSelectedVersions] = useState({}); // { [paragraphId]: 'base' | studentId }
    const [openComments, setOpenComments] = useState({}); // { [`${pId}_${versionKey}`]: boolean }
    const [editingParagraphId, setEditingParagraphId] = useState(null);
    const [editDraftText, setEditDraftText] = useState('');
    const [savingContrib, setSavingContrib] = useState(false);
    const [commentDrafts, setCommentDrafts] = useState({}); // { [`${pId}_${versionKey}`]: string }
    const [sendingComment, setSendingComment] = useState(false);
    const [showNewParagraphModal, setShowNewParagraphModal] = useState(false);
    const [newParagraphText, setNewParagraphText] = useState('');
    const [editingBaseParagraphId, setEditingBaseParagraphId] = useState(null);
    const [baseEditDraft, setBaseEditDraft] = useState('');

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
        }, 8000); // synchronisation discrète toutes les 8s
        return () => clearInterval(timer);
    }, [fetchSheet]);

    // Version sélectionnée pour un paragraphe (par défaut 'base')
    const getActiveVersionKey = (paragraphId) => {
        return selectedVersions[paragraphId] || 'base';
    };

    const handleSelectVersion = (paragraphId, versionKey) => {
        setSelectedVersions((prev) => ({
            ...prev,
            [paragraphId]: versionKey
        }));
    };

    // Ouvrir l'éditeur de contribution pour l'élève connecté
    const handleOpenEditContribution = (paragraph) => {
        const myContrib = (paragraph?.contributions || []).find(
            (c) => String(c.studentId) === String(studentId)
        );
        setEditDraftText(myContrib ? myContrib.text : paragraph.baseText);
        setEditingParagraphId(paragraph.paragraphId);
    };

    // Enregistrer la version élève
    const handleSaveContribution = async () => {
        if (!editingParagraphId || !editDraftText.trim() || savingContrib) return;
        setSavingContrib(true);
        try {
            const res = await fetch(`${apiPrefix}/${moduleId}/collaborative-sheet/${stepId}/contribution`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paragraphId: editingParagraphId,
                    text: editDraftText.trim(),
                    studentId,
                    studentName,
                    studentFirstName,
                    classroom: effectiveClassroom
                })
            });
            const data = await res.json();
            if (data?.ok && data?.sheet) {
                setSheet(data.sheet);
                // Sélectionner automatiquement sa propre version
                setSelectedVersions((prev) => ({
                    ...prev,
                    [editingParagraphId]: studentId
                }));
                setEditingParagraphId(null);
                setEditDraftText('');
            } else {
                alert(data?.error || 'Erreur lors de l’enregistrement de votre contribution.');
            }
        } catch (e) {
            alert('Erreur de connexion : ' + e.message);
        } finally {
            setSavingContrib(false);
        }
    };

    // Ajouter un nouveau paragraphe/complément par un élève
    const handleCreateNewParagraph = async () => {
        if (!newParagraphText.trim() || savingContrib) return;
        setSavingContrib(true);
        try {
            const res = await fetch(`${apiPrefix}/${moduleId}/collaborative-sheet/${stepId}/new-paragraph`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: newParagraphText.trim(),
                    studentId,
                    studentName,
                    studentFirstName,
                    classroom: effectiveClassroom
                })
            });
            const data = await res.json();
            if (data?.ok && data?.sheet) {
                setSheet(data.sheet);
                setShowNewParagraphModal(false);
                setNewParagraphText('');
            } else {
                alert(data?.error || 'Erreur lors de l’ajout du paragraphe.');
            }
        } catch (e) {
            alert('Erreur de connexion : ' + e.message);
        } finally {
            setSavingContrib(false);
        }
    };

    // Professeur : éditer la base du paragraphe
    const handleSaveBaseText = async () => {
        if (!editingBaseParagraphId || savingContrib) return;
        setSavingContrib(true);
        try {
            const res = await fetch(`/api/prof/learning/${moduleId}/collaborative-sheet/${stepId}/base`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paragraphId: editingBaseParagraphId,
                    baseText: baseEditDraft.trim(),
                    classroom: effectiveClassroom
                })
            });
            const data = await res.json();
            if (data?.ok && data?.sheet) {
                setSheet(data.sheet);
                setEditingBaseParagraphId(null);
                setBaseEditDraft('');
            } else {
                alert(data?.error || 'Erreur lors de la mise à jour de la base.');
            }
        } catch (e) {
            alert('Erreur : ' + e.message);
        } finally {
            setSavingContrib(false);
        }
    };

    // Envoyer un commentaire sur une version
    const handleSendComment = async (paragraphId, versionKey) => {
        const commentIdKey = `${paragraphId}_${versionKey}`;
        const text = (commentDrafts[commentIdKey] || '').trim();
        if (!text || sendingComment) return;

        setSendingComment(true);
        try {
            const res = await fetch(`${apiPrefix}/${moduleId}/collaborative-sheet/${stepId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paragraphId,
                    targetVersionKey: versionKey,
                    text,
                    authorId: studentId,
                    authorName: studentName,
                    authorRole: isTeacher ? 'teacher' : 'student',
                    classroom: effectiveClassroom
                })
            });
            const data = await res.json();
            if (data?.ok && data?.sheet) {
                setSheet(data.sheet);
                setCommentDrafts((prev) => ({ ...prev, [commentIdKey]: '' }));
            } else {
                alert(data?.error || 'Erreur lors de l’envoi du commentaire.');
            }
        } catch (e) {
            alert('Erreur : ' + e.message);
        } finally {
            setSendingComment(false);
        }
    };

    const toggleComments = (paragraphId, versionKey) => {
        const commentIdKey = `${paragraphId}_${versionKey}`;
        setOpenComments((prev) => ({
            ...prev,
            [commentIdKey]: !prev[commentIdKey]
        }));
    };

    if (loading && !sheet) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-semibold text-sm">Chargement de la superfiche collaborative...</p>
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
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    const paragraphs = sheet?.paragraphs || [];

    return (
        <div className="w-full max-w-4xl mx-auto py-4 px-2 sm:px-4 space-y-6">
            {/* Bannière d'en-tête collaborative */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-wide uppercase text-indigo-200">
                            <span>🤝 Fiche Collaborative</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Classe de Seconde</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                            Superfiche enrichie par la classe
                        </h2>
                        <p className="text-xs sm:text-sm text-indigo-200/90 max-w-xl">
                            La base du professeur est le socle officiel du cours. Proposez vos enrichissements, explorez les versions de vos camarades et débattez dans le fil de commentaires !
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowNewParagraphModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-emerald-950/20 transition cursor-pointer"
                    >
                        <span>➕</span>
                        <span>Proposer un paragraphe</span>
                    </button>
                </div>
            </div>

            {/* Liste des Paragraphes */}
            <div className="space-y-6">
                {paragraphs.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500">
                        <p className="font-semibold text-sm">Aucun paragraphe disponible pour le moment.</p>
                    </div>
                ) : (
                    paragraphs.map((p, pIndex) => {
                        const activeKey = getActiveVersionKey(p.paragraphId);
                        const isBaseActive = activeKey === 'base';
                        const activeContrib = !isBaseActive
                            ? (p.contributions || []).find((c) => String(c.studentId) === String(activeKey))
                            : null;

                        const displayText = activeContrib ? activeContrib.text : p.baseText;
                        const myContrib = (p.contributions || []).find(
                            (c) => String(c.studentId) === String(studentId)
                        );
                        const hasMyContrib = Boolean(myContrib);

                        const activeComments = activeContrib
                            ? (activeContrib.comments || [])
                            : (p.baseComments || []);

                        const commentIdKey = `${p.paragraphId}_${activeKey}`;
                        const isCommentsOpen = Boolean(openComments[commentIdKey]);

                        return (
                            <div
                                key={p.paragraphId || pIndex}
                                className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                                    p.authorRole === 'student'
                                        ? 'border-emerald-200 ring-2 ring-emerald-500/10'
                                        : 'border-slate-200'
                                }`}
                            >
                                {/* Header du paragraphe */}
                                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center">
                                            {pIndex + 1}
                                        </span>
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                            {p.authorRole === 'student' ? (
                                                <span className="text-emerald-700">🌱 Complément ajouté par {p.createdByName}</span>
                                            ) : (
                                                <span>Section {pIndex + 1}</span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Professeur : bouton pour modifier la base */}
                                        {isTeacher && isBaseActive && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setBaseEditDraft(p.baseText);
                                                    setEditingBaseParagraphId(p.paragraphId);
                                                }}
                                                className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                            >
                                                ✏️ Modifier la base prof
                                            </button>
                                        )}

                                        {/* Élève : bouton pour créer/modifier sa version */}
                                        {!isTeacher && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditContribution(p)}
                                                className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                                                    hasMyContrib
                                                        ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'
                                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                                }`}
                                            >
                                                {hasMyContrib ? '✏️ Modifier ma version' : '✨ Proposer ma version'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Contenu du paragraphe (Texte affiché selon la version active) */}
                                <div className="p-5 sm:p-6">
                                    {/* Alerte discrète si c'est une version élève */}
                                    {!isBaseActive && activeContrib && (
                                        <div className="mb-3 px-3 py-1.5 bg-violet-50/80 border border-violet-100 rounded-xl inline-flex items-center gap-2 text-xs text-violet-700 font-semibold">
                                            <span>👤</span>
                                            <span>Version proposée par <strong>{activeContrib.studentName}</strong></span>
                                            {String(activeContrib.studentId) === String(studentId) && (
                                                <span className="px-1.5 py-0.5 bg-violet-200/80 text-violet-800 text-[10px] rounded-full font-bold">Vous</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="text-slate-800 leading-relaxed text-sm sm:text-base font-medium whitespace-pre-line select-text">
                                        {displayText}
                                    </div>
                                </div>

                                {/* BARRE DE TABS / SÉLECTEUR DE VERSION */}
                                <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mr-1">
                                            Versions :
                                        </span>

                                        {/* Onglet Base Prof */}
                                        <button
                                            type="button"
                                            onClick={() => handleSelectVersion(p.paragraphId, 'base')}
                                            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                                isBaseActive
                                                    ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30'
                                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                            }`}
                                        >
                                            <span>👨‍🏫</span>
                                            <span>Base Prof</span>
                                        </button>

                                        {/* Onglets des contributions élèves */}
                                        {(p.contributions || []).map((contrib) => {
                                            const isSelected = activeKey === String(contrib.studentId);
                                            const isMe = String(contrib.studentId) === String(studentId);
                                            const name = contrib.studentFirstName || contrib.studentName.split(' ')[0];

                                            return (
                                                <button
                                                    key={String(contrib.studentId)}
                                                    type="button"
                                                    onClick={() => handleSelectVersion(p.paragraphId, String(contrib.studentId))}
                                                    className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-violet-600 text-white shadow-sm ring-2 ring-violet-600/30'
                                                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                                    }`}
                                                >
                                                    <span>👤</span>
                                                    <span>{name} {isMe ? '(Moi)' : ''}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Bouton d'accès au fil de commentaires de la version active */}
                                    <button
                                        type="button"
                                        onClick={() => toggleComments(p.paragraphId, activeKey)}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                            isCommentsOpen
                                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                        }`}
                                    >
                                        <span>💬</span>
                                        <span>{activeComments.length > 0 ? `Débat (${activeComments.length})` : 'Commenter'}</span>
                                    </button>
                                </div>

                                {/* FIL DE COMMENTAIRES DÉPLIABLE SOUS LA VERSION ACTIVE */}
                                {isCommentsOpen && (
                                    <div className="bg-amber-50/40 border-t border-amber-100 p-4 sm:p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                                                <span>💬 Discussion sur la version :</span>
                                                <span className="px-2 py-0.5 bg-amber-200/80 rounded-full text-[11px]">
                                                    {isBaseActive ? '👨‍🏫 Base Professeur' : `👤 ${activeContrib?.studentName}`}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => toggleComments(p.paragraphId, activeKey)}
                                                className="text-slate-600 hover:text-slate-600 text-xs font-bold"
                                            >
                                                Fermer
                                            </button>
                                        </div>

                                        {/* Liste des commentaires */}
                                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                            {activeComments.length === 0 ? (
                                                <p className="text-xs text-slate-500 italic py-2">
                                                    Aucun commentaire sur cette version. Soyez le premier à donner votre avis ou poser une question !
                                                </p>
                                            ) : (
                                                activeComments.map((comment, cIdx) => (
                                                    <div
                                                        key={comment._id || cIdx}
                                                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                                            comment.authorRole === 'teacher'
                                                                ? 'bg-indigo-50 border border-indigo-100 text-indigo-950'
                                                                : 'bg-white border border-slate-200 text-slate-800 shadow-2xs'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <div className="flex items-center gap-1.5 font-bold">
                                                                <span>{comment.authorRole === 'teacher' ? '👨‍🏫' : '👤'}</span>
                                                                <span>{comment.authorName}</span>
                                                                {comment.authorRole === 'teacher' && (
                                                                    <span className="px-1.5 py-0.2 bg-indigo-200 text-indigo-800 text-[10px] rounded font-extrabold uppercase">
                                                                        Prof
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-600">
                                                                {comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </span>
                                                        </div>
                                                        <div className="whitespace-pre-line pl-5">
                                                            {comment.text}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Formulaire d'envoi de commentaire */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={commentDrafts[commentIdKey] || ''}
                                                onChange={(e) => setCommentDrafts({
                                                    ...commentDrafts,
                                                    [commentIdKey]: e.target.value
                                                })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSendComment(p.paragraphId, activeKey);
                                                    }
                                                }}
                                                placeholder={`Réagir à la version de ${isBaseActive ? 'Base Prof' : activeContrib?.studentName}...`}
                                                className="flex-1 px-4 py-2 bg-white border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-600 outline-none transition"
                                            />
                                            <button
                                                type="button"
                                                disabled={sendingComment || !(commentDrafts[commentIdKey] || '').trim()}
                                                onClick={() => handleSendComment(p.paragraphId, activeKey)}
                                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-sm transition cursor-pointer"
                                            >
                                                Envoyer
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* MODAL / TIROIR DE MODIFICATION D'UNE CONTRIBUTION ÉLÈVE */}
            {editingParagraphId && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">✨</span>
                                <h3 className="text-base font-bold text-slate-900">
                                    Votre contribution sur ce paragraphe
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingParagraphId(null)}
                                className="text-slate-600 hover:text-slate-600 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-slate-500">
                            Enrichissez ce passage avec des définitions, exemples, précisions ou une reformulation claire. Vos ajouts apparaîtront sous votre prénom pour toute la classe.
                        </p>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Votre texte enrichi :
                            </label>
                            <textarea
                                value={editDraftText}
                                onChange={(e) => setEditDraftText(e.target.value)}
                                rows={7}
                                className="w-full p-4 text-sm bg-slate-50 border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 rounded-2xl text-slate-800 outline-none leading-relaxed resize-y"
                                placeholder="Rédigez votre version..."
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setEditingParagraphId(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                disabled={savingContrib || !editDraftText.trim()}
                                onClick={handleSaveContribution}
                                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-950/20 transition cursor-pointer"
                            >
                                {savingContrib ? 'Enregistrement...' : 'Publier ma version'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL D'AJOUT D'UN NOUVEAU PARAGRAPHE ÉLÈVE */}
            {showNewParagraphModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">➕</span>
                                <h3 className="text-base font-bold text-slate-900">
                                    Proposer un nouveau paragraphe ou complément
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowNewParagraphModal(false)}
                                className="text-slate-600 hover:text-slate-600 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-slate-500">
                            Vous souhaitez apporter une notion essentielle, une citation d'auteur, un contexte historique ou un point de méthode ? Rédigez-le ici : il sera ajouté à la fiche collaborative avec votre nom !
                        </p>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Contenu du paragraphe :
                            </label>
                            <textarea
                                value={newParagraphText}
                                onChange={(e) => setNewParagraphText(e.target.value)}
                                rows={6}
                                className="w-full p-4 text-sm bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-2xl text-slate-800 outline-none leading-relaxed resize-y"
                                placeholder="Tapez ici le paragraphe ou le complément que vous souhaitez apporter au cours..."
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowNewParagraphModal(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                disabled={savingContrib || !newParagraphText.trim()}
                                onClick={handleCreateNewParagraph}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/20 transition cursor-pointer"
                            >
                                {savingContrib ? 'Ajout...' : 'Ajouter à la superfiche'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ÉDITION BASE PROF */}
            {isTeacher && editingBaseParagraphId && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">👨‍🏫</span>
                                <h3 className="text-base font-bold text-slate-900">
                                    Modifier la base officielle du professeur
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingBaseParagraphId(null)}
                                className="text-slate-600 hover:text-slate-600 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <textarea
                            value={baseEditDraft}
                            onChange={(e) => setBaseEditDraft(e.target.value)}
                            rows={7}
                            className="w-full p-4 text-sm bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-2xl text-slate-800 outline-none leading-relaxed"
                        />

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setEditingBaseParagraphId(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                disabled={savingContrib || !baseEditDraft.trim()}
                                onClick={handleSaveBaseText}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-950/20 transition cursor-pointer"
                            >
                                {savingContrib ? 'Enregistrement...' : 'Mettre à jour la base'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
