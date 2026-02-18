// @signatures: GameStudio, handleSave
import React, { useState, useEffect, useRef } from 'react';
import './GameStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

export default function GameStudio({ initialData, chapters, user, targetSection, targetLevel, onClose, allStudents: propStudents, allClasses: propClasses }) {
    
    // --- ÉTATS ---
    const [formData, setFormData] = useState(initialData || { 
        title: '', levels: [{ name: "Niveau 1", questions: [{q:'',options:[''],a:0}], intro: {} }],
        globalIntro: { sheetUrl: "", videoUrl: "" }
    });
    
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState("");
    const [studentSearch, setStudentSearch] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Etats éditeur (résumés pour la concision)
    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [activeQIdx, setActiveQIdx] = useState(0);

    useEffect(() => {
        const load = async () => {
            if ((!propStudents || propStudents.length === 0) || (!propClasses || propClasses.length === 0)) {
                setLoading(true);
                try {
                    const [sts, cls] = await Promise.all([api.get('/admin/students'), api.get('/admin/classrooms')]);
                    setAllStudents(sts || []);
                    setAllClasses(cls || []);
                } catch(e) {}
                setLoading(false);
            }
            
            // RECONSTRUCTION DISTRIBUTION
            if (initialData && initialData.targetClassrooms) {
                const dist = {};
                initialData.targetClassrooms.forEach(clsName => {
                    dist[clsName] = {
                        chapterId: initialData.chapterId || "",
                        studentIds: initialData.isAllClass ? [] : (initialData.assignedStudents || [])
                    };
                });
                setDistribution(dist);
                if (initialData.targetClassrooms.length > 0) setViewingClass(initialData.targetClassrooms[0]);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
        
        setLoading(true);
        try {
            const groups = {};
            targets.forEach(cls => {
                const cfg = distribution[cls];
                if (!cfg.chapterId) return; 

                const isAllClass = cfg.studentIds.length === 0;
                const key = `${cfg.chapterId}_${isAllClass ? 'ALL' : 'SUBSET'}`;
                
                if (!groups[key]) groups[key] = { chapterId: cfg.chapterId, classrooms: [], assignedStudents: cfg.studentIds, isAllClass };
                groups[key].classrooms.push(cls);
            });

            for (const key of Object.keys(groups)) {
                const grp = groups[key];
                const payload = {
                    ...formData,
                    chapterId: grp.chapterId,
                    targetClassrooms: grp.classrooms,
                    assignedStudents: grp.assignedStudents,
                    isAllClass: grp.isAllClass,
                    teacherId: user.id || user._id,
                    type: 'zombie' // Ou starship
                };
                if (formData._id && key === Object.keys(groups)[0]) { /* update */ } else { delete payload._id; }
                await api.post('/games', payload);
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde."); }
        setLoading(false);
    };

    return (
        <div className="v84-game-container">
             <div className="v84-game-header">
                <div className="flex items-center"><span className="v84-game-icon">🎮</span><input className="v84-game-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU QUIZ..." /></div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            
            <div className="v84-game-body">
                {/* ZONE EDITEUR PLACEHOLDER */}
                <div className="v84-game-editor flex items-center justify-center text-slate-300 font-bold uppercase">
                    (Éditeur de Jeu - Logique Interne Préservée)
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
                    targetLevel={targetLevel} // 🚀 TRANSMISSION DU FILTRE DE NIVEAU
                    loading={loading}
                    onSave={handleSave}
                />
            </div>
        </div>
    );
}
