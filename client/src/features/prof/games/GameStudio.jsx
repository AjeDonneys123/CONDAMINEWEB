// @signatures: GameStudio, handleSave
import React, { useState, useEffect } from 'react';
import './GameStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

export default function GameStudio({ initialData, chapters, globalClass, globalLevel, user, targetSection, onClose }) {
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(globalClass || "");
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState(() => {
        return initialData ? JSON.parse(JSON.stringify(initialData)) : { 
            title: '', levels: [{ name: "Niveau 1", questions: [{ q: 'Question ?', options: ['A', 'B', 'C', 'D'], a: 0 }], intro: {} }], 
            isTestGame: false, subject: targetSection || "GÉNÉRAL"
        };
    });

    useEffect(() => {
        api.get('/admin/students').then(setAllStudents);
        api.get('/admin/classrooms').then(setAllClasses);
    }, []);

    const handleSave = async () => {
        const targets = Object.keys(distribution); 
        if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
        setLoading(true);
        
        try {
            // 🔗 RÉCUPÉRATION DU VISUEL DEPUIS LE STUDIO
            const studioRes = await api.get(`/studio/projects/${user.id || user._id}`);
            const studioProject = studioRes[0];

            for (const clsName of targets) {
                const cfg = distribution[clsName];
                const payload = { 
                    ...formData,
                    // INJECTION MIROIR
                    scenes: studioProject?.scenes || [],
                    generatedCode: studioProject?.generatedCode || "",
                    
                    chapterId: cfg.chapterId, 
                    targetClassrooms: [clsName], 
                    assignedStudents: cfg.studentIds, 
                    isAllClass: cfg.studentIds.length === 0, 
                    teacherId: user.id || user._id
                };
                await api.post('/games', payload);
            }
            onClose();
        } catch(e) { alert("Erreur synchronisation miroir."); } 
        setLoading(false);
    };

    return (
        <div className="v84-game-container">
            <div className="v84-game-header">
                <div className="flex items-center gap-4 flex-1">
                    <span className="v84-game-icon">🎮</span>
                    <input className="v84-game-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU DÉFI..." />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            <div className="v84-game-body">
                <div className="v84-game-editor">
                    <div className="p-10 bg-white rounded-[40px] border-2 border-indigo-100 text-center">
                        <span className="text-5xl block mb-4">🧟</span>
                        <h2 className="text-xl font-black text-slate-800 uppercase">Mode Miroir Graphique</h2>
                        <p className="text-slate-400 text-sm mt-2">Le visuel créé dans l'onglet STUDIO sera automatiquement injecté à Julian.</p>
                    </div>
                </div>
                <StudioDistributionSidebar 
                    user={user} allClasses={allClasses} allStudents={allStudents} chapters={chapters} distribution={distribution} setDistribution={setDistribution} viewingClass={viewingClass} setViewingClass={setViewingClass} studentSearch="" setStudentSearch={() => {}} targetLevel={globalLevel} loading={loading} onSave={handleSave}
                    saveLabel="PUBLIER LE MIROIR 🚀"
                />
            </div>
        </div>
    );
}
