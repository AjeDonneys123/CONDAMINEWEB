// @signatures: GameStudio, handleSave, syncWithStudio
import React, { useState, useEffect, useRef } from 'react';
import './GameStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

export default function GameStudio({ initialData, chapters, globalClass, globalLevel, user, targetSection, onClose }) {
    
    const [previewAsset, setPreviewAsset] = useState(null);
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(globalClass || "");
    const [studentSearch, setStudentSearch] = useState(""); 
    const [loading, setLoading] = useState(false);
    
    const [aiTopic, setAiTopic] = useState('');
    const [aiCount, setAiCount] = useState(5); 
    const [aiGenerating, setAiGenerating] = useState(false);

    // INIT DATA
    const [formData, setFormData] = useState(() => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { 
            title: '', levels: [{ name: "Niveau 1", questions: [{ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }], intro: {} }], 
            globalIntro: { sheetUrl: "", videoUrl: "" }, isTestGame: false, subject: targetSection || "GÉNÉRAL"
        };
        return base;
    });

    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [activeQIdx, setActiveQIdx] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sts, cls] = await Promise.all([ api.get('/admin/students'), api.get('/admin/classrooms') ]);
            setAllStudents(sts || []); setAllClasses(cls || []); 
            
            if (formData && initialData) {
                const newDist = {};
                const targets = formData.targetClassrooms || [globalClass];
                targets.forEach(clsName => {
                    const ids = (sts || []).filter(s => s.currentClass === clsName && (formData.assignedStudents || []).includes(String(s._id))).map(s => String(s._id));
                    newDist[clsName] = { chapterId: formData.chapterId, studentIds: ids };
                });
                setDistribution(newDist);
            }
        } catch(e) {}
        setLoading(false);
    };

    const handleSave = async () => {
        const targets = Object.keys(distribution); 
        if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
        setLoading(true);
        
        try {
            // 🔗 LE PONT : On récupère le projet visuel actuel du Studio
            const studioRes = await api.get(`/studio/projects/${user.id || user._id}`);
            const studioProject = studioRes[0]; // On prend le dernier projet travaillé

            for (const clsName of targets) {
                const cfg = distribution[clsName];
                const payload = { 
                    ...formData,
                    // INJECTION DU VISUEL DANS LE JEU DE JULIAN
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
            alert("✅ Jeu mis à jour pour les élèves !");
            onClose();
        } catch(e) { alert("Erreur sauvegarde."); } 
        setLoading(false);
    };

    // (Reste des handlers de l'UI quiz inchangés...)
    const handleInput = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const updateQuestion = (field, value, optionIndex = null) => { 
        setFormData(p => {
            const next = JSON.parse(JSON.stringify(p));
            const q = next.levels[activeLevelIdx].questions[activeQIdx];
            if (field === 'q' || field === 'a') q[field] = value;
            else if (field === 'options') q.options[optionIndex] = value;
            return next;
        });
    };

    return (
        <div className="v84-game-container">
            <div className="v84-game-header">
                <div className="flex items-center gap-4 flex-1">
                    <span className="v84-game-icon">🎮</span>
                    <input className="v84-game-title-input" value={formData.title} onChange={e => handleInput('title', e.target.value)} placeholder="TITRE DU JEU POUR JULIAN..." />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            <div className="v84-game-body">
                {/* Liste des questions à gauche */}
                <div className="v84-q-list-sidebar custom-scrollbar">
                    {formData.levels[activeLevelIdx].questions.map((q, i) => (
                        <div key={i} onClick={() => setActiveQIdx(i)} className={`v84-q-item ${activeQIdx === i ? 'active' : ''}`}>
                            <div className="v84-q-preview">Q{i+1}: {q.q}</div>
                        </div>
                    ))}
                    <button className="v84-add-q-btn" onClick={() => {
                        const next = JSON.parse(JSON.stringify(formData));
                        next.levels[activeLevelIdx].questions.push({ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 });
                        setFormData(next);
                    }}>+ Question</button>
                </div>
                
                {/* Éditeur de question au centre */}
                <div className="v84-game-editor">
                    <div className="bg-indigo-50 p-4 rounded-2xl mb-6 border border-indigo-100 flex items-center justify-between">
                        <span className="text-[10px] font-black text-indigo-600 uppercase">Synchronisation Miroir Active</span>
                        <span className="text-[10px] text-slate-400">Le visuel du Studio sera injecté à la sauvegarde</span>
                    </div>

                    <div className="v84-q-card">
                        <textarea className="v84-q-input" value={formData.levels[activeLevelIdx].questions[activeQIdx].q} onChange={e => updateQuestion('q', e.target.value)} placeholder="Question..." />
                        <div className="v84-answers-grid">
                            {formData.levels[activeLevelIdx].questions[activeQIdx].options.map((opt, i) => (
                                <div key={i} className={`v84-ans-row ${formData.levels[activeLevelIdx].questions[activeQIdx].a === i ? 'correct' : ''}`}>
                                    <div className="v84-correct-radio" onClick={() => updateQuestion('a', i)}>{formData.levels[activeLevelIdx].questions[activeQIdx].a === i ? '✓' : ''}</div>
                                    <input className="v84-ans-input" value={opt} onChange={e => updateQuestion('options', e.target.value, i)} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <StudioDistributionSidebar 
                    user={user} allClasses={allClasses} allStudents={allStudents} chapters={chapters} distribution={distribution} setDistribution={setDistribution} viewingClass={viewingClass} setViewingClass={setViewingClass} studentSearch={studentSearch} setStudentSearch={setStudentSearch} targetLevel={globalLevel} loading={loading} onSave={handleSave}
                    saveLabel="PUBLIER POUR JULIAN 🚀"
                />
            </div>
        </div>
    );
}
