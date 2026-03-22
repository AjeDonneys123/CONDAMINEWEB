import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';
import '../exposes/ExposeStudio.css';

const DEFAULT_DATA = {
    title: '',
    subject: '',
    chapterId: '',
    targetClassrooms: [],
    assignedStudents: [],
    isAllClass: true,
    presentationUrl: '',
    selectedSlides: [],
    teacherInstructions: '',
    submissions: []
};

const extractGoogleSlidesId = (raw = '') => {
    const txt = String(raw || '').trim();
    const match = txt.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
};

export default function RevisionStudio({
    initialData,
    chapters,
    user,
    targetSection,
    targetLevel,
    onClose,
    allStudents: propStudents,
    allClasses: propClasses,
    globalClass
}) {
    const [formData, setFormData] = useState(() => ({ ...DEFAULT_DATA, ...(initialData || {}) }));
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(globalClass || '');
    const [studentSearch, setStudentSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [slidesLoading, setSlidesLoading] = useState(false);
    const [slidesError, setSlidesError] = useState('');
    const [slidesManifest, setSlidesManifest] = useState([]);

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

    useEffect(() => {
        const presentationUrl = String(formData.presentationUrl || '').trim();
        if (!presentationUrl) {
            setSlidesManifest([]);
            setSlidesError('');
            return;
        }
        const ctrl = new AbortController();
        (async () => {
            setSlidesLoading(true);
            setSlidesError('');
            try {
                const res = await fetch('/api/learning/slides/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        presentationUrl,
                        slideSelection: '',
                        filterCondition: '',
                        includeThumbnails: false
                    }),
                    signal: ctrl.signal
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(String(data?.error || 'Slides indisponibles'));
                setSlidesManifest(Array.isArray(data?.slides) ? data.slides : []);
            } catch (e) {
                if (ctrl.signal.aborted) return;
                setSlidesManifest([]);
                setSlidesError(String(e?.message || 'Slides indisponibles'));
            } finally {
                if (!ctrl.signal.aborted) setSlidesLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [formData.presentationUrl]);

    const selectedSlides = useMemo(() => new Set((formData.selectedSlides || []).map((x) => Number(x)).filter(Boolean)), [formData.selectedSlides]);
    const toggleSlide = (slideNumber) => {
        const n = Number(slideNumber || 0);
        if (!n) return;
        setFormData((prev) => {
            const current = new Set((prev.selectedSlides || []).map((x) => Number(x)).filter(Boolean));
            if (current.has(n)) current.delete(n);
            else current.add(n);
            return { ...prev, selectedSlides: [...current].sort((a, b) => a - b) };
        });
    };

    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title.trim()) return alert('Titre requis.');
        if (!String(formData.presentationUrl || '').trim()) return alert('Lien Google Slides requis.');
        if ((formData.selectedSlides || []).length === 0) return alert('Sélectionne au moins une slide.');
        if (targets.length === 0) return alert('Sélectionne au moins une classe.');
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
            const groupEntries = Object.values(grouped);
            if (groupEntries.length === 0) {
                setLoading(false);
                return alert('Chaque classe active doit avoir un dossier.');
            }
            for (let i = 0; i < groupEntries.length; i += 1) {
                const grp = groupEntries[i];
                const payload = {
                    ...formData,
                    subject: targetSection || formData.subject || 'GÉNÉRAL',
                    chapterId: grp.chapterId,
                    targetClassrooms: grp.classrooms,
                    assignedStudents: grp.assignedStudents,
                    isAllClass: grp.isAllClass,
                    teacherId: user.id || user._id
                };
                if (!(formData._id && i === 0)) delete payload._id;
                await api.post('/revisions', payload);
            }
            onClose();
        } catch (e) {
            alert(`Erreur sauvegarde: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const submissions = Array.isArray(formData.submissions) ? formData.submissions : [];
    const studentById = useMemo(() => new Map((allStudents || []).map((s) => [String(s._id || s.id), s])), [allStudents]);
    const expectedStudentIds = useMemo(() => {
        const targets = new Set((formData.targetClassrooms || []).map((c) => String(c || '').trim().toUpperCase()).filter(Boolean));
        if (targets.size === 0) return [];
        if (!formData.isAllClass && Array.isArray(formData.assignedStudents) && formData.assignedStudents.length > 0) {
            return [...new Set(formData.assignedStudents.map((id) => String(id)))];
        }
        return (allStudents || []).filter((s) => targets.has(String(s?.currentClass || '').trim().toUpperCase())).map((s) => String(s._id || s.id));
    }, [formData.targetClassrooms, formData.isAllClass, formData.assignedStudents, allStudents]);
    const submissionByStudent = useMemo(() => new Map(submissions.map((s) => [String(s?.studentId || ''), s])), [submissions]);

    const presentationId = extractGoogleSlidesId(formData.presentationUrl);

    return (
        <div className="expose-studio-shell">
            <div className="expose-studio-header">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🧩</span>
                    <input
                        className="expose-title-input"
                        placeholder="RÉVISION..."
                        value={formData.title}
                        onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                        autoFocus
                    />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>

            <div className="expose-studio-body">
                <div className="expose-editor-card">
                    <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Google Slides</div>
                    <input
                        className="expose-subject-input"
                        value={formData.presentationUrl || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, presentationUrl: e.target.value }))}
                        placeholder="https://docs.google.com/presentation/d/..."
                    />
                    <div className="text-[11px] font-black uppercase text-slate-400 mt-4 mb-2">Consigne professeur</div>
                    <textarea
                        className="expose-subject-input"
                        style={{ minHeight: 100, resize: 'vertical' }}
                        value={formData.teacherInstructions || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, teacherInstructions: e.target.value }))}
                        placeholder="Ex: crée 5 questions de révision, écris les réponses, ajoute les mots-clés puis teste-toi."
                    />
                    <div className="text-[11px] font-black uppercase text-slate-400 mt-4 mb-2">Slides à afficher à l'élève</div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        {slidesLoading && <div className="text-[11px] font-bold text-slate-500">Chargement des slides...</div>}
                        {!slidesLoading && slidesError && <div className="text-[11px] font-bold text-red-500">{slidesError}</div>}
                        {!slidesLoading && !slidesError && slidesManifest.length === 0 && <div className="text-[11px] font-bold text-slate-400">Colle un lien Google Slides pour charger les slides.</div>}
                        {!slidesLoading && slidesManifest.length > 0 && (
                            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 max-h-[340px] overflow-auto">
                                {slidesManifest.map((slide) => {
                                    const slideNumber = Number(slide?.slideNumber || 0);
                                    const active = selectedSlides.has(slideNumber);
                                    const thumbUrl = presentationId ? `/api/learning/slides/thumbnail?presentationId=${encodeURIComponent(presentationId)}&pageObjectId=${encodeURIComponent(String(slide?.objectId || ''))}&slideNumber=${encodeURIComponent(String(slideNumber || ''))}` : '';
                                    return (
                                        <button key={String(slide?.objectId || slideNumber)} type="button" onClick={() => toggleSlide(slideNumber)} className={`rounded-2xl border p-2 text-left transition-all ${active ? 'border-fuchsia-500 bg-fuchsia-50 shadow-md' : 'border-slate-200 bg-white'}`}>
                                            <div className="aspect-[16/9] overflow-hidden rounded-xl bg-slate-100 border border-slate-200 mb-2">
                                                {thumbUrl ? <img src={thumbUrl} alt={`Slide ${slideNumber}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black">Slide {slideNumber}</div>}
                                            </div>
                                            <div className="text-[10px] font-black uppercase text-slate-700">Slide {slideNumber}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="text-[11px] font-black uppercase text-slate-400 mt-4 mb-2">Révisions rendues</div>
                    <div className="max-h-[280px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-2">
                        {expectedStudentIds.length === 0 && submissions.length === 0 && <div className="text-[11px] font-bold text-slate-400">Aucune révision pour le moment.</div>}
                        {expectedStudentIds.map((studentId, idx) => {
                            const sub = submissionByStudent.get(String(studentId)) || null;
                            const resolvedId = String(sub?.studentId || expectedStudentIds[idx] || '');
                            const st = studentById.get(resolvedId);
                            const name = st ? `${st.lastName || ''} ${st.firstName || ''}`.trim() : resolvedId;
                            const done = Array.isArray(sub?.questions) && sub.questions.length > 0;
                            return (
                                <div key={`${resolvedId}_${idx}`} className="rounded-lg border border-slate-200 bg-white p-2">
                                    <div className="text-[12px] font-black text-slate-700">{name || 'Élève'}</div>
                                    <div className="text-[11px] font-bold mt-1">{done ? '✅ Révision créée' : '⏳ En attente'}</div>
                                    <div className="text-[10px] font-bold text-slate-500 mt-1">{done ? `${Number(sub?.questionCount || sub?.questions?.length || 0)} question(s)` : 'Aucune question enregistrée.'}</div>
                                    {done && (
                                        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 max-h-[160px] overflow-auto text-[12px] text-slate-700 space-y-2">
                                            {(sub.questions || []).map((q, qIdx) => (
                                                <div key={qIdx}>
                                                    <div className="font-black">{qIdx + 1}. {q.question || 'Question'}</div>
                                                    <div>Réponse: {q.expectedAnswer || '—'}</div>
                                                    <div>Mots-clés: {(q.expectedKeywords || []).join(', ') || '—'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
                    saveLabel={loading ? 'SAUVEGARDE...' : 'ENREGISTRER RÉVISION'}
                />
            </div>
        </div>
    );
}
