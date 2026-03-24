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
    productionType: 'fiche',
    presentationUrl: '',
    selectedSlides: [],
    teacherInstructions: '',
    gameId: '',
    questions: [],
    submissions: []
};

const uid = () => `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emptyQuestionnaireRow = () => ({ id: uid(), prompt: '', expectedAnswer: '', expectedKeywords: [], oralPreferred: true });
const emptyQcmRow = () => ({ id: uid(), prompt: '', options: ['', '', '', ''], correctIndex: 0 });

export default function ProductionStudio({
    initialData,
    chapters,
    user,
    targetSection,
    targetLevel,
    onClose,
    allStudents: propStudents,
    allClasses: propClasses
}) {
    const [formData, setFormData] = useState(() => ({
        ...DEFAULT_DATA,
        ...(initialData || {}),
        productionType: ['fiche', 'questionnaire', 'qcm'].includes(String(initialData?.productionType || ''))
            ? String(initialData.productionType)
            : 'fiche',
        questions: Array.isArray(initialData?.questions) ? initialData.questions : []
    }));
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    const [games, setGames] = useState([]);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [sts, cls, gms] = await Promise.all([
                    (propStudents && propStudents.length > 0) ? Promise.resolve(propStudents) : api.get('/admin/students'),
                    (propClasses && propClasses.length > 0) ? Promise.resolve(propClasses) : api.get('/admin/classrooms'),
                    api.get('/games/all')
                ]);
                setAllStudents(sts || []);
                setAllClasses(cls || []);
                setGames(gms || []);
            } finally {
                setLoading(false);
            }
        };
        load();
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
        setFormData((prev) => {
            if (prev.productionType === 'fiche') return { ...prev, questions: [] };
            if ((prev.questions || []).length > 0) return prev;
            return { ...prev, questions: [prev.productionType === 'qcm' ? emptyQcmRow() : emptyQuestionnaireRow()] };
        });
    }, [formData.productionType]);

    const gameOptions = useMemo(() => {
        return (Array.isArray(games) ? games : []).sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || '')));
    }, [games]);

    const updateQuestion = (index, patch) => {
        setFormData((prev) => ({
            ...prev,
            questions: (prev.questions || []).map((row, idx) => idx === index ? { ...row, ...patch } : row)
        }));
    };

    const addQuestion = () => {
        setFormData((prev) => ({
            ...prev,
            questions: [...(prev.questions || []), prev.productionType === 'qcm' ? emptyQcmRow() : emptyQuestionnaireRow()]
        }));
    };

    const removeQuestion = (index) => {
        setFormData((prev) => ({
            ...prev,
            questions: (prev.questions || []).filter((_, idx) => idx !== index)
        }));
    };

    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!String(formData.title || '').trim()) return alert('Titre requis.');
        if (targets.length === 0) return alert('Sélectionne au moins une classe.');
        if (formData.productionType === 'fiche' && !String(formData.presentationUrl || '').trim()) return alert('Lien Google Slides requis.');
        if (formData.productionType === 'questionnaire' && !(formData.questions || []).some((row) => String(row?.prompt || '').trim())) return alert("Ajoute au moins une question.");
        if (formData.productionType === 'qcm' && !(formData.questions || []).some((row) => String(row?.prompt || '').trim() && (row?.options || []).filter(Boolean).length >= 2)) return alert("Ajoute au moins un QCM valide.");

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

            for (const [index, entry] of Object.values(grouped).entries()) {
                const payload = {
                    ...formData,
                    title: String(formData.title || '').trim(),
                    subject: String(targetSection || formData.subject || 'GÉNÉRAL').trim(),
                    chapterId: entry.chapterId,
                    targetClassrooms: entry.classrooms,
                    assignedStudents: entry.assignedStudents,
                    isAllClass: entry.isAllClass,
                    teacherId: user.id || user._id
                };
                if (!(formData._id && index === 0)) delete payload._id;
                await api.post('/productions', payload);
            }
            onClose();
        } catch (e) {
            alert(`Erreur sauvegarde: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="expose-studio-shell">
            <div className="expose-studio-header">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🏗️</span>
                    <input
                        className="expose-title-input"
                        placeholder="PRODUCTION..."
                        value={formData.title}
                        onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                        autoFocus
                    />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>

            <div className="expose-studio-body">
                <div className="expose-editor-card space-y-5">
                    <div>
                        <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Type de production</div>
                        <div className="flex flex-wrap gap-2">
                            {[
                                ['fiche', '🗂️ Fiche'],
                                ['questionnaire', "🎙️ Questionnaire d'apprentissage"],
                                ['qcm', '🎮 QCM pour les jeux']
                            ].map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFormData((p) => ({ ...p, productionType: key }))}
                                    className={`rounded-2xl border px-4 py-3 text-[12px] font-black transition ${formData.productionType === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <textarea
                        className="expose-subject-input"
                        style={{ minHeight: 100, resize: 'vertical' }}
                        value={formData.teacherInstructions || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, teacherInstructions: e.target.value }))}
                        placeholder="Consigne professeur"
                    />

                    {formData.productionType === 'fiche' && (
                        <input
                            className="expose-subject-input"
                            value={formData.presentationUrl || ''}
                            onChange={(e) => setFormData((p) => ({ ...p, presentationUrl: e.target.value }))}
                            placeholder="https://docs.google.com/presentation/d/..."
                        />
                    )}

                    {formData.productionType === 'qcm' && (
                        <select
                            className="expose-subject-input"
                            value={formData.gameId || ''}
                            onChange={(e) => setFormData((p) => ({ ...p, gameId: e.target.value }))}
                        >
                            <option value="">Jeu associé optionnel</option>
                            {gameOptions.map((game) => (
                                <option key={String(game._id)} value={String(game._id)}>{game.title || 'Jeu sans titre'}</option>
                            ))}
                        </select>
                    )}

                    {formData.productionType !== 'fiche' && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-[11px] font-black uppercase text-slate-400">Contenu élève</div>
                                <button type="button" onClick={addQuestion} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-black text-slate-700">
                                    + Ajouter
                                </button>
                            </div>
                            {(formData.questions || []).map((row, index) => (
                                <div key={row.id || index} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[11px] font-black uppercase text-slate-400">Question {index + 1}</div>
                                        <button type="button" onClick={() => removeQuestion(index)} className="text-[11px] font-black text-red-500">Supprimer</button>
                                    </div>
                                    <textarea
                                        className="expose-subject-input"
                                        style={{ minHeight: 90, resize: 'vertical' }}
                                        value={row.prompt || ''}
                                        onChange={(e) => updateQuestion(index, { prompt: e.target.value })}
                                        placeholder="Question"
                                    />
                                    {formData.productionType === 'questionnaire' && (
                                        <>
                                            <textarea
                                                className="expose-subject-input"
                                                style={{ minHeight: 90, resize: 'vertical' }}
                                                value={row.expectedAnswer || ''}
                                                onChange={(e) => updateQuestion(index, { expectedAnswer: e.target.value })}
                                                placeholder="Réponse attendue"
                                            />
                                            <input
                                                className="expose-subject-input"
                                                value={(row.expectedKeywords || []).join(', ')}
                                                onChange={(e) => updateQuestion(index, {
                                                    expectedKeywords: String(e.target.value || '').split(',').map((part) => part.trim()).filter(Boolean)
                                                })}
                                                placeholder="Mots-clés attendus"
                                            />
                                        </>
                                    )}
                                    {formData.productionType === 'qcm' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {(row.options || []).map((option, optIdx) => (
                                                    <input
                                                        key={optIdx}
                                                        className="expose-subject-input"
                                                        value={option || ''}
                                                        onChange={(e) => {
                                                            const next = [...(row.options || [])];
                                                            next[optIdx] = e.target.value;
                                                            updateQuestion(index, { options: next });
                                                        }}
                                                        placeholder={`Option ${optIdx + 1}`}
                                                    />
                                                ))}
                                            </div>
                                            <select
                                                className="expose-subject-input"
                                                value={Number(row.correctIndex || 0)}
                                                onChange={(e) => updateQuestion(index, { correctIndex: Number(e.target.value || 0) })}
                                            >
                                                {(row.options || []).map((_, optIdx) => (
                                                    <option key={optIdx} value={optIdx}>Bonne réponse: option {optIdx + 1}</option>
                                                ))}
                                            </select>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
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
                    saveLabel="PUBLIER LA PRODUCTION"
                />
            </div>
        </div>
    );
}
