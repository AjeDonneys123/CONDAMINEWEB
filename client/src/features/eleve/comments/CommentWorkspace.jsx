import React, { useMemo, useState } from 'react';
import { resolveBackendAssetUrl, resolveDriveAssetUrl } from '../../../utils/driveUrl';

function schoolLevelLabel(user = {}) {
    const cls = String(user?.currentClass || '').trim();
    if (!cls) return 'niveau non precise';
    return cls;
}

function resolveDocumentUrl(url) {
    return resolveBackendAssetUrl(resolveDriveAssetUrl(url));
}

function ResizeHandle() {
    return (
        <div className="flex items-center justify-center pb-2 cursor-ns-resize select-none">
            <div className="flex items-center justify-center w-10 h-5 rounded-full border border-slate-300 bg-white text-slate-500 text-[14px] leading-none">
                ↕
            </div>
        </div>
    );
}

export default function CommentWorkspace({ activity, user, onQuit }) {
    const previousRounds = Array.isArray(activity?.studentSubmission?.rounds) ? activity.studentSubmission.rounds : [];
    const [rounds, setRounds] = useState(previousRounds.length > 0 ? previousRounds : [{ draft: '', aiFeedback: '' }]);
    const [aiValidated, setAiValidated] = useState(activity?.studentSubmission?.aiValidated === true);
    const [methodologyReflection, setMethodologyReflection] = useState(activity?.studentSubmission?.methodologyReflection || '');
    const [saving, setSaving] = useState(false);
    const [docPreviewMode, setDocPreviewMode] = useState({});
    const [phase, setPhase] = useState('draft');
    const [copyMessage, setCopyMessage] = useState('');
    const currentRound = rounds[rounds.length - 1] || { draft: '', aiFeedback: '' };
    const previousRound = rounds.length > 1 ? rounds[rounds.length - 2] : null;

    const compiledPrompt = useMemo(() => {
        const levelLabel = String(activity?.promptLevel || '').trim() || schoolLevelLabel(user);
        return [
            `Niveau de l'eleve indique par le professeur: ${levelLabel}`,
            '',
            String(activity?.teacherPrompt || '').trim(),
            '',
            `Sujet donne a l'eleve:`,
            String(activity?.teacherInstructions || '').trim(),
            '',
            `Documents analyses et extraits prepares par le professeur:`,
            ...(Array.isArray(activity?.documentExtractions) ? activity.documentExtractions : []).map((row, index) => (
                `Document ${index + 1}:\n${String(row?.extraction || '').trim()}`
            ))
        ].join('\n');
    }, [activity?.promptLevel, activity?.teacherInstructions, activity?.teacherPrompt, activity?.documentExtractions, user]);

    const compiledWork = useMemo(() => {
        return [
            `Travail actuel de l'eleve:`,
            String(currentRound?.draft || '').trim()
        ].join('\n');
    }, [currentRound?.draft]);

    const save = async (nextRounds = rounds, nextValidated = aiValidated, nextReflection = methodologyReflection) => {
        setSaving(true);
        try {
            const res = await fetch('/api/eleve/comments/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commentId: String(activity?._id || ''),
                    studentId: String(user?._id || user?.id || ''),
                    rounds: nextRounds,
                    aiValidated: nextValidated,
                    methodologyReflection: nextReflection
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(String(data?.error || 'Sauvegarde impossible'));
        } catch (e) {
            alert(String(e?.message || 'Sauvegarde impossible'));
        } finally {
            setSaving(false);
        }
    };

    const flashCopyMessage = (message) => {
        setCopyMessage(message);
        window.setTimeout(() => setCopyMessage(''), 1800);
    };

    const handleCopyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(compiledPrompt);
            flashCopyMessage('Prompt et sujet copies.');
        } catch (_) {
            alert('Impossible de copier automatiquement.');
        }
    };

    const handleCopyWork = async () => {
        try {
            await navigator.clipboard.writeText(compiledWork);
            flashCopyMessage('Travail copie.');
        } catch (_) {
            alert('Impossible de copier automatiquement.');
        }
    };

    const handleCopyBundle = async () => {
        try {
            await navigator.clipboard.writeText([compiledPrompt, '', compiledWork].join('\n'));
            flashCopyMessage('Sujet complet copie pour l IA.');
        } catch (_) {
            alert('Impossible de copier automatiquement.');
        }
    };

    const handleValidateRound = async () => {
        const draft = String(currentRound?.draft || '').trim();
        const feedback = String(currentRound?.aiFeedback || '').trim();
        if (!draft) return alert('Il faut d abord rediger ton commentaire.');
        if (!feedback) return alert("Il faut coller les conseils de l'IA avant de continuer.");
        const nextRounds = [...rounds, { draft: '', aiFeedback: '' }];
        setRounds(nextRounds);
        setPhase('draft');
        await save(nextRounds, aiValidated, methodologyReflection);
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6">
            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b bg-gradient-to-r from-orange-50 via-white to-sky-50 flex items-center justify-between gap-4">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-orange-600">Commentaire</div>
                        <div className="text-2xl font-black text-slate-800">{activity?.title || 'Commentaire'}</div>
                        <div className="text-sm font-semibold text-slate-500">{schoolLevelLabel(user)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => save()} className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px] text-slate-700">{saving ? '...' : 'Enregistrer'}</button>
                        <button onClick={onQuit} className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px] text-slate-500">Fermer</button>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Sujet</div>
                        <div className="text-sm font-semibold text-slate-600 whitespace-pre-wrap">{activity?.teacherInstructions || 'Analyse les documents puis redige un commentaire.'}</div>
                    </div>

                    <div
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 overflow-auto"
                        style={{ resize: 'vertical', height: '360px', minHeight: '180px' }}
                    >
                        <ResizeHandle />
                        <div className="text-[11px] font-black uppercase text-slate-400">Documents</div>
                        <div className="space-y-3 overflow-y-auto h-full pr-1">
                            {(activity?.documentUrls || []).map((url, index) => {
                                const previewUrl = resolveDocumentUrl(url);
                                const mode = docPreviewMode[index] || 'image';
                                return (
                                    <div key={`${url}_${index}`} className="rounded-xl bg-white p-3 space-y-3 border border-slate-200">
                                        <a href={previewUrl} target="_blank" rel="noreferrer" className="block text-[12px] font-black text-blue-700 break-all">
                                            Document {index + 1}
                                        </a>
                                        {mode === 'image' && (
                                            <img
                                                src={previewUrl}
                                                alt={`Document ${index + 1}`}
                                                className="w-full max-h-[70vh] object-contain rounded-xl border border-slate-100 bg-slate-50"
                                                onError={() => setDocPreviewMode((prev) => ({ ...prev, [index]: 'pdf' }))}
                                            />
                                        )}
                                        {mode === 'pdf' && (
                                            <iframe
                                                src={previewUrl}
                                                title={`Document ${index + 1}`}
                                                className="w-full h-[720px] rounded-xl border border-slate-100 bg-white"
                                            />
                                        )}
                                        {mode === 'fallback' && (
                                            <div className="text-[12px] font-semibold text-slate-500">
                                                Apercu indisponible. Ouvre le document dans un nouvel onglet.
                                            </div>
                                        )}
                                        {mode === 'pdf' && (
                                            <button
                                                type="button"
                                                onClick={() => setDocPreviewMode((prev) => ({ ...prev, [index]: 'fallback' }))}
                                                className="text-[12px] font-black text-slate-500 underline underline-offset-2"
                                            >
                                                Si le document ne s&apos;affiche pas, ouvrir le lien ci-dessus
                                            </button>
                                        )}
                                        {(() => {
                                            const extracted = (Array.isArray(activity?.documentExtractions) ? activity.documentExtractions : []).find((row) => String(row?.url || '') === String(url));
                                            if (!String(extracted?.extraction || '').trim()) return null;
                                            return (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                                    <div className="text-[11px] font-black uppercase text-amber-700 mb-1">Extraction preparee par le professeur</div>
                                                    <div className="text-sm font-semibold text-slate-700 whitespace-pre-wrap">{extracted.extraction}</div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-5">
                        {previousRound?.aiFeedback && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <div
                                    className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 space-y-2 overflow-y-auto"
                                    style={{ resize: 'vertical', height: '250px', minHeight: '150px' }}
                                >
                                    <ResizeHandle />
                                    <div className="text-[11px] font-black uppercase text-cyan-700">Conseils de l&apos;IA de la version precedente</div>
                                    <div className="text-sm font-semibold text-slate-700 whitespace-pre-wrap">{previousRound.aiFeedback}</div>
                                </div>
                                <div
                                    className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 overflow-y-auto"
                                    style={{ resize: 'vertical', height: '250px', minHeight: '150px' }}
                                >
                                    <ResizeHandle />
                                    <div className="text-[11px] font-black uppercase text-slate-500">Version precedente</div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 whitespace-pre-wrap">
                                        {String(previousRound?.draft || '').trim() || 'Aucune version precedente enregistree.'}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 overflow-auto"
                            style={{ resize: 'vertical', height: '320px', minHeight: '190px' }}
                        >
                            <ResizeHandle />
                            <div className="text-[11px] font-black uppercase text-slate-400">Version {rounds.length}</div>
                            <textarea
                                className="w-full min-h-[140px] h-[160px] resize-y rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold placeholder:text-slate-300"
                                value={currentRound.draft || ''}
                                onChange={(e) => setRounds((prev) => prev.map((row, idx) => idx === prev.length - 1 ? { ...row, draft: e.target.value } : row))}
                                placeholder="Redige ici ton commentaire."
                            />

                            {phase === 'draft' && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPhase('ai')}
                                        className="px-4 py-2 rounded-2xl border border-slate-200 bg-slate-900 text-white font-black text-[12px]"
                                    >
                                        J&apos;ai fini
                                    </button>
                                </div>
                            )}

                            {phase === 'ai' && (
                                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                                    <div className="text-[11px] font-black uppercase text-orange-700">Phase 2. Copier pour l&apos;IA</div>
                                    <div className="text-sm font-semibold text-slate-600">
                                        Ouvre ChatGPT, puis copie le sujet complet. Il contient le niveau, le prompt, le sujet, les extractions des documents et ton travail.
                                    </div>
                                    {copyMessage && <div className="text-[12px] font-black text-emerald-600">{copyMessage}</div>}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button type="button" onClick={() => window.open('https://chatgpt.com/', 'conda-commentaire-chatgpt', 'popup=yes,width=520,height=620,left=120,top=90')} className="px-4 py-2 rounded-2xl border border-slate-200 bg-slate-900 text-white font-black text-[12px]">Ouvrir ChatGPT</button>
                                        <button type="button" onClick={handleCopyBundle} className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]">Copier le sujet</button>
                                    </div>
                                </div>
                            )}

                            <textarea
                                className="w-full min-h-[120px] h-[130px] resize-y rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold placeholder:text-slate-300"
                                value={currentRound.aiFeedback || ''}
                                onChange={(e) => setRounds((prev) => prev.map((row, idx) => idx === prev.length - 1 ? { ...row, aiFeedback: e.target.value } : row))}
                                placeholder="Colle ici les conseils de l'IA."
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={handleValidateRound} className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]">Valider ma reponse</button>
                            <button type="button" onClick={() => { const next = !aiValidated; setAiValidated(next); save(rounds, next, methodologyReflection); }} className={`px-4 py-2 rounded-2xl font-black text-[12px] ${aiValidated ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                                {aiValidated ? 'Competences validees' : "L'IA confirme que c'est valide"}
                            </button>
                        </div>

                        {aiValidated && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                                <div className="text-[11px] font-black uppercase text-emerald-700">Synthese methodologique</div>
                                <textarea
                                    className="w-full min-h-[160px] rounded-2xl border-2 border-emerald-200 px-4 py-3 font-semibold placeholder:text-slate-300"
                                    value={methodologyReflection}
                                    onChange={(e) => setMethodologyReflection(e.target.value)}
                                    placeholder="Explique ce que tu as compris grace aux conseils de l'IA et ce que tu as change dans ta methode."
                                />
                                <button type="button" onClick={() => save(rounds, aiValidated, methodologyReflection)} className="px-4 py-2 rounded-2xl bg-emerald-700 text-white font-black text-[12px]">
                                    Valider la synthese
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
