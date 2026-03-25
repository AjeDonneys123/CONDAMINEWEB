import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';
import { resolveBackendAssetUrl, resolveDriveAssetUrl } from '../../../utils/driveUrl';
import '../exposes/ExposeStudio.css';

const buildDefaultPrompt = (targetLevel = '') => `Tu es un coach methodologique en histoire-geographie pour un eleve de seconde.

L'eleve est en ${String(targetLevel || 'classe non precisee')}.

Regle absolue :

* Tu ne rediges JAMAIS a la place de l'eleve
* Tu ne proposes AUCUN paragraphe redige
* Tu guides uniquement

Objectif :
Faire progresser l'eleve etape par etape (pas de perfection immediate).

Important :

* Tu dois adapter ton niveau d'exigence au niveau de l'eleve (debutant, intermediaire, avance).
* Ne sois jamais trop exigeant pour un eleve faible.
* Ne corrige que les PRIORITES adaptees a son niveau.

Ta mission :

1. Evaluer mon travail avec UN SEUL niveau :

* "En cours d'apprentissage"
* "Bien"
* "Tres bien"

2. Donner un feedback COURT (maximum 5 lignes) sous forme de points :

* 1 ou 2 points reussis
* 1 ou 2 points a ameliorer (prioritaires uniquement)

3. Donner 2 conseils maximum, tres concrets

4. Pose 1 ou 2 questions pour aider l'eleve a reflechir

Important :

* Ne corrige PAS tout
* Concentre-toi sur les PRIORITES
* Accepte que le travail soit imparfait
* Favorise une progression progressive

5. Quand le travail atteint le niveau "Bien", ecris :
👉 COMPETENCES VALIDEES

Tu ne dois JAMAIS :

* faire une correction complete
* lister tous les defauts
* etre exhaustif
* donner un feedback trop long ou decourageant

Voici mon travail :`;

const DEFAULT_DATA = {
    title: '',
    subject: 'HISTOIRE GÉOGRAPHIE',
    chapterId: '',
    targetClassrooms: [],
    assignedStudents: [],
    isAllClass: true,
    teacherInstructions: '',
    teacherPrompt: '',
    promptLevel: '',
    documentUrls: [],
    documentExtractions: []
};

function resolveDocumentUrl(url) {
    return resolveBackendAssetUrl(resolveDriveAssetUrl(url));
}

export default function CommentStudio({ initialData, chapters, user, targetSection, targetLevel, onClose, allStudents: propStudents, allClasses: propClasses, globalClass }) {
    const [formData, setFormData] = useState(() => ({ ...DEFAULT_DATA, ...(initialData || {}) }));
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(globalClass || '');
    const [studentSearch, setStudentSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [extractState, setExtractState] = useState({});
    const [dropActive, setDropActive] = useState(false);
    const [pasteHint, setPasteHint] = useState('');
    const [pasteDebug, setPasteDebug] = useState('');
    const [lastImportSignature, setLastImportSignature] = useState('');
    const [assistantResponse, setAssistantResponse] = useState('');
    const [copyMessage, setCopyMessage] = useState('');
    const clipboardImportLockRef = useRef(false);
    const clipboardAcceptLockRef = useRef(false);
    const first = String(user?.firstName || '').trim().toLowerCase();
    const last = String(user?.lastName || '').trim().toLowerCase();
    const isJpVuillet = first === 'jp' || (first === 'jean' && last === 'vuillet') || (first === 'jean-pierre' && last === 'vuillet');

    useEffect(() => {
        if (initialData?.teacherPrompt) return;
        setFormData((prev) => {
            if (String(prev.teacherPrompt || '').trim()) return prev;
            return { ...prev, teacherPrompt: buildDefaultPrompt(targetLevel) };
        });
    }, [initialData?.teacherPrompt, targetLevel]);

    useEffect(() => {
        setFormData((prev) => {
            if (String(prev.promptLevel || '').trim()) return prev;
            return { ...prev, promptLevel: String(initialData?.promptLevel || targetLevel || '').trim() };
        });
    }, [initialData?.promptLevel, targetLevel]);

    useEffect(() => {
        if ((!propStudents || propStudents.length === 0) || (!propClasses || propClasses.length === 0)) {
            setLoading(true);
            Promise.all([api.get('/admin/students'), api.get('/admin/classrooms')])
                .then(([sts, cls]) => {
                    setAllStudents(sts || []);
                    setAllClasses(cls || []);
                })
                .finally(() => setLoading(false));
        }
    }, [propStudents, propClasses]);

    useEffect(() => {
        if (!(initialData && initialData.targetClassrooms)) return;
        const dist = {};
        initialData.targetClassrooms.forEach((clsName) => {
            dist[clsName] = {
                chapterId: initialData.chapterId || '',
                studentIds: initialData.isAllClass ? [] : (initialData.assignedStudents || [])
            };
        });
        setDistribution(dist);
        if (initialData.targetClassrooms.length > 0) setViewingClass(initialData.targetClassrooms[0]);
    }, [initialData]);

    const triggerDocsUpload = async (files, options = {}) => {
        const normalizedFiles = Array.from(files || []).filter(Boolean);
        if (normalizedFiles.length === 0) return;
        if (options.fromClipboard && clipboardImportLockRef.current) {
            setPasteHint("Ajout ignore: import presse-papiers deja en cours.");
            return;
        }
        if (options.fromClipboard) clipboardImportLockRef.current = true;
        const signature = normalizedFiles.map((f) => `${String(f?.name || 'blob')}::${String(f?.type || '')}::${Number(f?.size || 0)}`).join('|');
        if (signature && signature === lastImportSignature) {
            setPasteHint('Ajout ignore: meme image detectee deux fois de suite.');
            if (options.fromClipboard) clipboardImportLockRef.current = false;
            return;
        }
        setLastImportSignature(signature);
        setLoading(true);
        const fd = new FormData();
        normalizedFiles.forEach((f, index) => {
            const mime = String(f?.type || '').toLowerCase();
            const fallbackExt = mime.startsWith('image/') ? (mime.split('/')[1] || 'png') : 'bin';
            const safeName = String(f?.name || '').trim() || `document-${Date.now()}-${index}.${fallbackExt}`;
            fd.append('files', f, safeName);
        });
        try {
            const res = await fetch('/api/homework/upload', { method: 'POST', body: fd }).then((r) => r.json());
            const rawUrls = Array.isArray(res.urls) ? res.urls : [];
            const keptUrls = options.keepFirstOnly ? rawUrls.slice(0, 1) : rawUrls;
            if (options.fromClipboard && clipboardAcceptLockRef.current) {
                return;
            }
            if (keptUrls.length) {
                if (options.fromClipboard) clipboardAcceptLockRef.current = true;
                setFormData((prev) => {
                    const previousUrls = Array.isArray(prev.documentUrls) ? prev.documentUrls : [];
                    const trulyNewUrls = options.keepFirstOnly
                        ? keptUrls.filter((url) => !previousUrls.includes(url)).slice(0, 1)
                        : keptUrls;
                    const nextUrls = [...new Set([...previousUrls, ...trulyNewUrls])].slice(0, 12);
                    const nextExtractions = nextUrls.map((url) => {
                        const existing = (prev.documentExtractions || []).find((row) => String(row?.url || '') === String(url));
                        return existing || { url, extraction: '' };
                    });
                    return { ...prev, documentUrls: nextUrls, documentExtractions: nextExtractions };
                });
            }
            else {
                setPasteHint("Upload recu mais aucune URL n'a ete renvoyee.");
            }
        } catch (_) {
            alert('Erreur upload');
        } finally {
            setLoading(false);
            window.setTimeout(() => setLastImportSignature(''), 1200);
            if (options.fromClipboard) {
                window.setTimeout(() => {
                    clipboardImportLockRef.current = false;
                    clipboardAcceptLockRef.current = false;
                }, 1200);
            }
        }
    };

    const readClipboardImage = async () => {
        try {
            if (!navigator.clipboard?.read) {
                setPasteHint("Le navigateur ne permet pas la lecture directe du presse-papiers. Utilise glisser-deposer ou Selection fichiers.");
                return;
            }
            const items = await navigator.clipboard.read();
            setPasteDebug(`clipboard.read(): ${items.map((item) => (item.types || []).join('|')).join(', ') || 'none'}`);
            for (const item of items) {
                const imageType = (item.types || []).find((type) => String(type || '').toLowerCase().startsWith('image/'));
                if (!imageType) continue;
                const blob = await item.getType(imageType);
                const fileLike = new File([blob], `document-presse-papiers.${String(imageType.split('/')[1] || 'png').toLowerCase()}`, { type: imageType });
                setPasteHint('');
                await triggerDocsUpload([fileLike], { keepFirstOnly: true, fromClipboard: true });
                return;
            }
            setPasteHint("Aucune image reelle detectee dans le presse-papiers. Le site source fournit seulement du texte ou une URL.");
        } catch (e) {
            setPasteHint("Impossible de lire l'image dans le presse-papiers. Utilise glisser-deposer ou Selection fichiers.");
        }
    };

    const handlePasteDocuments = (event) => {
        event.preventDefault();
        const items = Array.from(event.clipboardData?.items || []);
        setPasteDebug(`items: ${items.map((item) => `${item.kind}:${item.type || 'unknown'}`).join(', ') || 'none'}`);
        const files = items
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter(Boolean);
        if (files.length > 0) {
            setPasteHint('');
            triggerDocsUpload(files, { keepFirstOnly: true, fromClipboard: true });
            return;
        }

        const html = String(event.clipboardData?.getData('text/html') || '').trim();
        const text = String(event.clipboardData?.getData('text/plain') || '').trim();
        const htmlMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        const candidateUrl = htmlMatch?.[1] ? String(htmlMatch[1]).trim() : text;

        if (!candidateUrl) {
            setPasteHint('Image non detectee. Fais Ctrl+V ici ou utilise glisser-deposer.');
            return;
        }

        (async () => {
            try {
                const res = await fetch(resolveDocumentUrl(candidateUrl));
                if (!res.ok) throw new Error('Lien non exploitable');
                const blob = await res.blob();
                const mime = String(blob.type || '').toLowerCase();
                if (!mime.startsWith('image/')) throw new Error("Le collage a fourni un lien texte, pas une image exploitable.");
                const ext = mime.split('/')[1] || 'png';
                const file = new File([blob], `document-colle.${ext}`, { type: mime });
                setPasteHint('');
                triggerDocsUpload([file], { keepFirstOnly: true, fromClipboard: true });
            } catch (_) {
                setPasteHint("Le collage a fourni une URL ou un texte. Copie l'image elle-meme ou utilise le glisser-deposer.");
            }
        })();
    };

    const handleDropDocuments = (event) => {
        event.preventDefault();
        setDropActive(false);
        const files = Array.from(event.dataTransfer?.files || []).filter(Boolean);
        if (files.length === 0) return;
        triggerDocsUpload(files);
    };

    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!String(formData.title || '').trim()) return alert('Sujet requis.');
        if (targets.length === 0) return alert('Sélectionne au moins une classe.');
        const missingExtractions = (formData.documentUrls || []).some((url) => {
            const row = (formData.documentExtractions || []).find((item) => String(item?.url || '') === String(url));
            return !String(row?.extraction || '').trim();
        });
        if (missingExtractions) return alert('Une extraction est obligatoire pour chaque document.');
        setLoading(true);
        try {
            const grouped = {};
            targets.forEach((cls) => {
                const cfg = distribution[cls];
                if (!cfg?.chapterId) return;
                const isAllClass = !Array.isArray(cfg.studentIds) || cfg.studentIds.length === 0;
                const key = `${cfg.chapterId}_${isAllClass ? 'ALL' : 'SUBSET_' + [...cfg.studentIds].sort().join('-')}`;
                if (!grouped[key]) grouped[key] = { chapterId: cfg.chapterId, classrooms: [], assignedStudents: isAllClass ? [] : cfg.studentIds, isAllClass };
                grouped[key].classrooms.push(cls);
            });
            for (const [index, grp] of Object.values(grouped).entries()) {
                const payload = {
                    ...formData,
                    subject: targetSection || formData.subject || 'HISTOIRE GÉOGRAPHIE',
                    chapterId: grp.chapterId,
                    targetClassrooms: grp.classrooms,
                    assignedStudents: grp.assignedStudents,
                    isAllClass: grp.isAllClass,
                    teacherId: user.id || user._id
                };
                if (!(formData._id && index === 0)) delete payload._id;
                await api.post('/comments', payload);
            }
            onClose();
        } catch (e) {
            alert(`Erreur sauvegarde: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const copyExtractionPrompt = async (_url, _index) => {
        const text = [
            `Determine d'abord s'il s'agit principalement d'un document textuel lisible ou d'une image a decrire.`,
            `Si c'est un document textuel lisible, fais UNIQUEMENT l'extraction du texte.`,
            `Si c'est une image non textuelle, fais UNIQUEMENT une description precise de l'image.`,
            `Ne melange jamais extraction de texte et description d'image dans la meme reponse.`,
            `Liste aussi les informations attendues dans une analyse de document niveau lycee.`,
            `Ne redige pas le devoir a la place de l'eleve.`
        ].join('\n');
        try {
            await navigator.clipboard.writeText(text);
            setCopyMessage('Prompt copie.');
            window.setTimeout(() => setCopyMessage(''), 1800);
        } catch (_) {
            alert('Impossible de copier le prompt.');
        }
    };

    const copyExtractionDocument = async (url) => {
        try {
            const res = await fetch(resolveDocumentUrl(url));
            if (!res.ok) throw new Error('Document inaccessible');
            const blob = await res.blob();
            if (!String(blob.type || '').toLowerCase().startsWith('image/')) {
                throw new Error("Ce document n'est pas copiable comme image.");
            }
            await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
            const index = (formData.documentUrls || []).findIndex((row) => String(row || '') === String(url));
            setCopyMessage(`Doc ${index + 1} copie.`);
            window.setTimeout(() => setCopyMessage(''), 1800);
        } catch (e) {
            alert(String(e?.message || 'Impossible de copier le document.'));
        }
    };

    const openGeminiPopup = () => {
        const popup = window.open('', 'conda-commentaire-gemini', 'popup=yes,width=520,height=620,left=120,top=90,resizable=yes,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no');
        if (!popup) {
            alert("La popup Gemini a ete bloquee par le navigateur.");
            return;
        }
        try {
            popup.document.write(`
                <!doctype html>
                <html>
                  <head>
                    <meta charset="utf-8" />
                    <title>Ouverture Gemini...</title>
                    <style>
                      body {
                        margin: 0;
                        min-height: 100vh;
                        display: grid;
                        place-items: center;
                        font-family: Arial, sans-serif;
                        background: #f8fafc;
                        color: #0f172a;
                      }
                    </style>
                  </head>
                  <body>Ouverture de Gemini...</body>
                </html>
            `);
            popup.document.close();
        } catch (_) {}
        popup.focus();
        window.setTimeout(() => {
            try {
                popup.location.href = 'https://gemini.google.com/app';
                popup.focus();
            } catch (_) {}
        }, 120);
    };

    const commitExtractionDraft = () => {
        const draft = String(assistantResponse || '').trim();
        if (!draft) return;
        setFormData((prev) => {
            const nextRows = (prev.documentUrls || []).map((url) => {
                const existing = (prev.documentExtractions || []).find((row) => String(row?.url || '') === String(url));
                return { url, extraction: existing?.extraction || draft };
            });
            return { ...prev, documentExtractions: nextRows };
        });
        setAssistantResponse('');
    };

    return (
        <div className="expose-studio-shell">
            <div className="expose-studio-header">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🧾</span>
                    <input className="expose-title-input" placeholder="SUJET DU COMMENTAIRE..." value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} autoFocus />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            <div className="expose-studio-body">
                <div className="expose-editor-card space-y-4">
                    <textarea className="expose-subject-input" value={formData.teacherInstructions || ''} onChange={(e) => setFormData((p) => ({ ...p, teacherInstructions: e.target.value }))} placeholder="Consigne élève: ce qu'il doit produire sur les documents." />
                    <input
                        className="expose-subject-input"
                        value={formData.promptLevel || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, promptLevel: e.target.value }))}
                        placeholder="Niveau pour l'IA: 6e, 2de, 1ere, Terminale..."
                    />
                    <textarea className="expose-subject-input" style={{ minHeight: 160, resize: 'vertical' }} value={formData.teacherPrompt || ''} onChange={(e) => setFormData((p) => ({ ...p, teacherPrompt: e.target.value }))} placeholder="Prompt IA professeur: critères à valider pour considérer le commentaire réussi." />
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Documents</div>
                        <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-3 items-stretch">
                            <div className="flex flex-wrap gap-2">
                                <input type="file" multiple onChange={(e) => triggerDocsUpload(e.target.files)} />
                                <button
                                    type="button"
                                    onClick={readClipboardImage}
                                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black text-slate-700"
                                >
                                    Coller l&apos;image
                                </button>
                            </div>
                            <div
                                tabIndex={-1}
                                onPaste={handlePasteDocuments}
                                onDrop={handleDropDocuments}
                                onDragOver={(e) => { e.preventDefault(); setDropActive(true); }}
                                onDragEnter={(e) => { e.preventDefault(); setDropActive(true); }}
                                onDragLeave={() => setDropActive(false)}
                                className={`rounded-2xl border-2 border-dashed bg-white transition ${dropActive ? 'border-sky-400 bg-sky-50' : 'border-slate-200'}`}
                            >
                                <textarea
                                    defaultValue=""
                                    onPaste={(e) => {
                                        handlePasteDocuments(e);
                                        e.currentTarget.value = '';
                                    }}
                                    placeholder="Colle vos fichiers ici. Tu peux aussi les ajouter par drag and drop ou Ctrl+V ici."
                                    className={`w-full min-h-[58px] resize-none bg-transparent px-4 py-3 text-[13px] font-bold outline-none ${dropActive ? 'text-sky-700 placeholder:text-sky-700' : 'text-slate-500 placeholder:text-slate-400'}`}
                                />
                            </div>
                        </div>
                        {pasteHint && <div className="mt-2 text-[12px] font-black text-orange-600">{pasteHint}</div>}
                        {pasteDebug && <div className="mt-1 text-[11px] font-bold text-slate-500">{pasteDebug}</div>}
                        <div className="mt-3 space-y-4">
                            {!!formData.documentUrls?.length && (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {(formData.documentUrls || []).map((url, index) => (
                                            <div key={`${url}_${index}`} className="rounded-xl border border-slate-200 bg-white p-2 space-y-2">
                                                <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                                                    <span>Doc {index + 1}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData((p) => ({
                                                            ...p,
                                                            documentUrls: (p.documentUrls || []).filter((_, idx) => idx !== index),
                                                            documentExtractions: (p.documentExtractions || []).filter((row) => String(row?.url || '') !== String(url))
                                                        }))}
                                                        className="text-red-500"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <img
                                                    src={resolveDocumentUrl(url)}
                                                    alt={`Document ${index + 1}`}
                                                    className="w-full h-[120px] object-cover rounded-lg border border-slate-100 bg-slate-50"
                                                />
                                                {String((formData.documentExtractions || []).find((row) => String(row?.url || '') === String(url))?.extraction || '').trim() && (
                                                    <textarea
                                                        className="expose-subject-input"
                                                        style={{ minHeight: 110, resize: 'vertical' }}
                                                        value={(formData.documentExtractions || []).find((row) => String(row?.url || '') === String(url))?.extraction || ''}
                                                        onChange={(e) => setFormData((prev) => {
                                                            const nextRows = [...(prev.documentExtractions || [])];
                                                            const rowIndex = nextRows.findIndex((row) => String(row?.url || '') === String(url));
                                                            const nextRow = { url, extraction: e.target.value };
                                                            if (rowIndex >= 0) nextRows[rowIndex] = nextRow;
                                                            else nextRows.push(nextRow);
                                                            return { ...prev, documentExtractions: nextRows };
                                                        })}
                                                        placeholder={`Extraction du document ${index + 1}`}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-3">
                                        <div className="text-[12px] font-black text-orange-700">
                                            Ouvrir Gemini puis coller chacun des elements suivants. Envoyer ensuite la reponse dans le champ.
                                        </div>
                                        {copyMessage && <div className="text-[12px] font-black text-emerald-600">{copyMessage}</div>}
                                        <div className="flex flex-wrap gap-2">
                                            <button type="button" onClick={openGeminiPopup} className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-900 text-white text-[12px] font-black">Ouvrir Gemini</button>
                                            <button type="button" onClick={() => copyExtractionPrompt('', 0)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black">Copier prompt</button>
                                            {(formData.documentUrls || []).map((url, index) => (
                                                <button key={`copy_doc_${index}`} type="button" onClick={() => copyExtractionDocument(url)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black">
                                                    Copier doc {index + 1}
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            className="expose-subject-input"
                                            style={{ minHeight: 120, resize: 'vertical' }}
                                            value={assistantResponse}
                                            onChange={(e) => setAssistantResponse(e.target.value)}
                                            placeholder="Copier ici la reponse de l'IA."
                                        />
                                        {String(assistantResponse || '').trim() && (
                                            <button
                                                type="button"
                                                onClick={commitExtractionDraft}
                                                className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-black"
                                            >
                                                Valider
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <StudioDistributionSidebar
                    user={user}
                    allClasses={allClasses}
                    allStudents={allStudents}
                    chapters={chapters}
                    distribution={distribution}
                    setDistribution={setDistribution}
                    viewingClass={viewingClass}
                    setViewingClass={setViewingClass}
                    studentSearch={studentSearch}
                    setStudentSearch={setStudentSearch}
                    targetLevel={targetLevel}
                    targetSection={targetSection}
                    loading={loading}
                    onSave={handleSave}
                    saveLabel="ENREGISTRER COMMENTAIRE"
                />
            </div>
        </div>
    );
}
