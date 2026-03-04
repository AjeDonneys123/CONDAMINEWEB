import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';
import './ExposeStudio.css';

const DEFAULT_DATA = {
    title: '',
    subject: '',
    chapterId: '',
    targetClassrooms: [],
    assignedStudents: [],
    isAllClass: true
};

export default function ExposeStudio({
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
                await api.post('/exposes', payload);
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
                    <span className="text-3xl">🗣️</span>
                    <input
                        className="expose-title-input"
                        placeholder="SUJET DE L'EXPOSÉ..."
                        value={formData.title}
                        onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                        autoFocus
                    />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>

            <div className="expose-studio-body">
                <div className="expose-editor-card">
                    <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Sujet prof</div>
                    <textarea
                        className="expose-subject-input"
                        value={formData.title}
                        onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Ex: Les inégalités dans le monde"
                    />
                    <div className="text-[11px] text-slate-500 font-bold leading-6 mt-3">
                        Les élèves ouvriront cet exposé, colleront leur lien Canvas, indiqueront leurs slides,
                        puis enregistreront leur présentation audio.
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
                    saveLabel={loading ? 'SAUVEGARDE...' : 'ENREGISTRER EXPOSÉ'}
                />
            </div>
        </div>
    );
}
