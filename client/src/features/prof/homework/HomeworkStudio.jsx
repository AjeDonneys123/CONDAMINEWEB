// @signatures: HomeworkStudio, handleSave
import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

const DEFAULT_HW_DATA = { 
    title: '', content: '', date: '', teacherId: null, 
    levels: [{ instruction: '', instructionUrls: [], attachmentUrls: [], aiHints: '' }],
    isPunishment: false
};

export default function HomeworkStudio({ initialData, chapters, user, targetSection, onClose }) {
    const [formData, setFormData] = useState(() => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...DEFAULT_HW_DATA };
        if (!base.levels || base.levels.length === 0) base.levels = [{ instruction: '', instructionUrls: [], attachmentUrls: [], aiHints: '' }];
        if (!base.date) {
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            base.date = tomorrow.toISOString().split('T')[0];
        } else base.date = base.date.split('T')[0];
        return base;
    });

    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState("");
    const [studentSearch, setStudentSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    // CHARGEMENT DONNÉES
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [sts, cls] = await Promise.all([ 
                    api.get('/admin/students'), 
                    api.get('/admin/classrooms') 
                ]);
                setAllStudents(sts || []);
                setAllClasses(cls || []);

                // RECONSTRUCTION DE LA DISTRIBUTION SI EDITION
                if (initialData && initialData.targetClassrooms) {
                    const dist = {};
                    initialData.targetClassrooms.forEach(clsName => {
                        dist[clsName] = {
                            chapterId: initialData.chapterId || "",
                            // Si isAllClass est true, studentIds est vide. Sinon on met les IDs assignés.
                            studentIds: initialData.isAllClass ? [] : (initialData.assignedStudents || [])
                        };
                    });
                    setDistribution(dist);
                    if (initialData.targetClassrooms.length > 0) setViewingClass(initialData.targetClassrooms[0]);
                }
            } catch(e) {}
            setLoading(false);
        };
        load();
    }, []);

    // HANDLERS
    const handleInput = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const handleLevelInput = (idx, f, v) => {
        const lvls = [...formData.levels];
        lvls[idx][f] = v;
        setFormData(p => ({ ...p, levels: lvls }));
    };
    
    const handleAddAttachment = async (file) => {
        setLoading(true);
        const fd = new FormData(); fd.append('files', file);
        try {
            const res = await fetch('/api/homework/upload', { method: 'POST', body: fd }).then(r => r.json());
            if (res.urls && res.urls.length > 0) {
                const lvls = [...formData.levels];
                lvls[0].attachmentUrls.push(res.urls[0]); 
                setFormData(p => ({ ...p, levels: lvls }));
            }
        } catch(e) { alert("Erreur upload"); }
        setLoading(false);
        fileInputRef.current.value = "";
    };

    // ALGORITHME DE SAUVEGARDE GROUPÉE
    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title || targets.length === 0) return alert("❌ Titre et au moins une Classe requis !");
        
        setLoading(true);
        try {
            const groups = {};
            
            targets.forEach(cls => {
                const cfg = distribution[cls];
                if (!cfg.chapterId) return; 
                
                const isAllClass = cfg.studentIds.length === 0;
                // Clé unique pour regrouper les configurations identiques
                const key = `${cfg.chapterId}_${isAllClass ? 'ALL' : 'SUBSET_' + cfg.studentIds.sort().join('-')}`;
                
                if (!groups[key]) {
                    groups[key] = {
                        chapterId: cfg.chapterId,
                        classrooms: [],
                        assignedStudents: cfg.studentIds,
                        isAllClass: isAllClass
                    };
                }
                groups[key].classrooms.push(cls);
            });

            // Envoi par groupe
            for (const key of Object.keys(groups)) {
                const grp = groups[key];
                const payload = {
                    ...formData,
                    chapterId: grp.chapterId,
                    targetClassrooms: grp.classrooms,
                    assignedStudents: grp.assignedStudents,
                    isAllClass: grp.isAllClass,
                    teacherId: user.id || user._id
                };
                
                // Si on édite, le premier groupe garde l'ID (Update), les autres sont des clones (Create)
                if (formData._id && key === Object.keys(groups)[0]) {
                    // Garde l'ID
                } else {
                    delete payload._id; // Force Create
                }

                await api.post('/homework', payload); // Utilisation de /homework (Singulier, corrigé selon le router)
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde: " + e.message); }
        setLoading(false);
    };

    return (
        <div className="v84-hw-container">
            <input type="file" ref={fileInputRef} className="hidden" onChange={e => handleAddAttachment(e.target.files[0])} />
            
            <div className="v84-hw-header">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">📝</span>
                    <input className="v84-hw-title-input" value={formData.title} onChange={e => handleInput('title', e.target.value)} placeholder="TITRE DU DEVOIR..." autoFocus />
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase text-red-500 flex items-center gap-2 cursor-pointer bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                        <input type="checkbox" checked={formData.isPunishment} onChange={e => handleInput('isPunishment', e.target.checked)} />
                        Punition
                    </label>
                    <input type="date" className="v84-hw-date-input" value={formData.date} onChange={e => handleInput('date', e.target.value)} />
                    <button onClick={onClose} className="v84-close-btn">✕</button>
                </div>
            </div>

            <div className="v84-hw-body">
                <div className="v84-hw-editor custom-scrollbar">
                    <div className="v84-hw-card">
                        <textarea 
                            className="v84-hw-textarea custom-scrollbar" 
                            placeholder="Consignes du devoir..." 
                            value={formData.levels[0].instruction} 
                            onChange={e => handleLevelInput(0, 'instruction', e.target.value)} 
                        />
                        <div className="v84-hw-attachments">
                            {formData.levels[0].attachmentUrls.map((url, i) => (
                                <div key={i} className="v84-att-chip">
                                    <span>📎 Document {i+1}</span>
                                    <button onClick={() => {
                                        const lvls = [...formData.levels];
                                        lvls[0].attachmentUrls = lvls[0].attachmentUrls.filter((_, idx) => idx !== i);
                                        setFormData(p => ({...p, levels: lvls}));
                                    }} className="ml-2 text-red-400 font-bold">✕</button>
                                </div>
                            ))}
                            <button onClick={() => fileInputRef.current.click()} className="v84-att-add-btn">+ AJOUTER DOC</button>
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
                    targetSection={targetSection} 
                    loading={loading}
                    onSave={handleSave}
                />
            </div>
        </div>
    );
}
