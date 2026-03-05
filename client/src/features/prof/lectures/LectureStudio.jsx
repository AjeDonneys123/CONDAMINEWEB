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
    readingUrl: '',
    maxScrollSpeed: 2600,
    readingWpm: 300,
    requiredSummaryMinLines: 5,
    requiredSummaryMaxLines: 10,
    submissions: []
};

const countLines = (txt = '') =>
    String(txt || '')
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
        .length;

export default function LectureStudio({
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

    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title.trim()) return alert('Titre requis.');
        if (!String(formData.readingUrl || '').trim()) return alert('URL lecture requise.');
        if (targets.length === 0) return alert('Sélectionne au moins une classe.');
        setLoading(true);
        try {
            const grouped = {};
            targets.forEach((cls) => {
                const cfg = distribution[cls];
                if (!cfg?.chapterId) return;
                const isAllClass = !Array.isArray(cfg.studentIds) || cfg.studentIds.length === 0;
                const key = `${cfg.chapterId}_${isAllClass ? 'ALL' : 'SUBSET_' + [...cfg.studentIds].sort().join('-')}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        chapterId: cfg.chapterId,
                        classrooms: [],
                        assignedStudents: isAllClass ? [] : cfg.studentIds,
                        isAllClass
                    };
                }
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
                await api.post('/lectures', payload);
            }
            onClose();
        } catch (e) {
            alert(`Erreur sauvegarde: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const submissions = Array.isArray(formData.submissions) ? formData.submissions : [];
    const studentById = useMemo(
        () => new Map((allStudents || []).map((s) => [String(s._id || s.id), s])),
        [allStudents]
    );
    const expectedStudentIds = useMemo(() => {
        const targets = new Set((formData.targetClassrooms || []).map((c) => String(c || '').trim().toUpperCase()).filter(Boolean));
        if (targets.size === 0) return [];
        if (!formData.isAllClass && Array.isArray(formData.assignedStudents) && formData.assignedStudents.length > 0) {
            return [...new Set(formData.assignedStudents.map((id) => String(id)))];
        }
        return (allStudents || [])
            .filter((s) => targets.has(String(s?.currentClass || '').trim().toUpperCase()))
            .map((s) => String(s._id || s.id));
    }, [formData.targetClassrooms, formData.isAllClass, formData.assignedStudents, allStudents]);
    const submissionByStudent = useMemo(
        () => new Map(submissions.map((s) => [String(s?.studentId || ''), s])),
        [submissions]
    );

    return (
        <div className="expose-studio-shell">
            <div className="expose-studio-header">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">📖</span>
                    <input
                        className="expose-title-input"
                        placeholder="LECTURE..."
                        value={formData.title}
                        onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                        autoFocus
                    />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>

            <div className="expose-studio-body">
                <div className="expose-editor-card">
                    <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Source internet</div>
                    <input
                        className="expose-subject-input"
                        value={formData.readingUrl || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, readingUrl: e.target.value }))}
                        placeholder="https://..."
                    />
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Vitesse max scroll (px/s)</div>
                            <input
                                type="number"
                                min="600"
                                max="8000"
                                className="expose-subject-input"
                                value={Number(formData.maxScrollSpeed || 2600)}
                                onChange={(e) => setFormData((p) => ({ ...p, maxScrollSpeed: Number(e.target.value || 2600) }))}
                            />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Lecture cible (mots/min)</div>
                            <input
                                type="number"
                                min="120"
                                max="500"
                                className="expose-subject-input"
                                value={Number(formData.readingWpm || 300)}
                                onChange={(e) => setFormData((p) => ({ ...p, readingWpm: Number(e.target.value || 300) }))}
                            />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Résumé (lignes min-max)</div>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    className="expose-subject-input"
                                    value={Number(formData.requiredSummaryMinLines || 5)}
                                    onChange={(e) => setFormData((p) => ({ ...p, requiredSummaryMinLines: Number(e.target.value || 5) }))}
                                />
                                <input
                                    type="number"
                                    min={Number(formData.requiredSummaryMinLines || 5)}
                                    max="30"
                                    className="expose-subject-input"
                                    value={Number(formData.requiredSummaryMaxLines || 10)}
                                    onChange={(e) => setFormData((p) => ({ ...p, requiredSummaryMaxLines: Number(e.target.value || 10) }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="text-[11px] font-black uppercase text-slate-400 mt-4 mb-2">Suivi élèves</div>
                    <div className="max-h-[280px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-2">
                        {expectedStudentIds.length === 0 && submissions.length === 0 && (
                            <div className="text-[11px] font-bold text-slate-400">Aucune soumission pour le moment.</div>
                        )}
                        {expectedStudentIds.map((studentId, idx) => {
                            const sub = submissionByStudent.get(String(studentId)) || null;
                            const sidFromSubmission = String(sub?.studentId || '');
                            const resolvedId = String(sidFromSubmission || expectedStudentIds[idx] || '');
                            const st = studentById.get(resolvedId);
                            const name = st ? `${st.lastName || ''} ${st.firstName || ''}`.trim() : resolvedId;
                            const lines = countLines(sub?.summary || '');
                            const minL = Math.max(1, Number(formData.requiredSummaryMinLines || 5));
                            const maxL = Math.max(minL, Number(formData.requiredSummaryMaxLines || 10));
                            const warnNoData = !sub;
                            const warnNoEnd = !sub?.reachedEnd;
                            const warnNoSummary = !(lines >= minL && lines <= maxL);
                            const warnRhythm = Number(sub?.rhythmAlerts || 0) > 0;
                            const done = !warnNoData && !warnNoEnd && !warnNoSummary;
                            return (
                                <div key={`${resolvedId}_${idx}`} className="rounded-lg border border-slate-200 bg-white p-2">
                                    <div className="text-[12px] font-black text-slate-700 flex items-center justify-between gap-2">
                                        <span>{name || 'Élève'}</span>
                                        {sub?.draftDocUrl && (
                                            <a
                                                href={sub.draftDocUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[10px] font-black text-blue-700 underline"
                                            >
                                                Ouvrir brouillon Doc
                                            </a>
                                        )}
                                    </div>
                                    <div className="text-[11px] font-bold mt-1">
                                        {done ? '✅ Lecture validée' : '⚠️ Avertissements'}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 mt-1">
                                        {warnNoData ? '• Aucun suivi reçu pour cet élève. ' : ''}
                                        {warnNoEnd ? '• Scroll pas arrivé à la fin. ' : ''}
                                        {warnNoSummary ? `• Résumé ${minL}-${maxL} lignes non validé. ` : ''}
                                        {warnRhythm ? '• Scroll trop rapide détecté. ' : ''}
                                    </div>
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
                    saveLabel={loading ? 'SAUVEGARDE...' : 'ENREGISTRER LECTURE'}
                />
            </div>
        </div>
    );
}
