// @signatures: GameStudio, handleAddQuestion, handleGenerateAI, handleInput, handleSave, handleSelectClass, handleSelectQuestion, handleToggleStudent, isMain, loadData, myClassesIds, toggleAllStudents, updateQuestion
import React, { useState, useEffect, useRef } from 'react';
import './GameStudio.css';
import { api } from '../../../services/api';
// CHEMIN ET EXPORTS VÉRIFIÉS
import { getChaptersForClass, findDefaultChapterId, getStudentsForViewingClass, SUBJECTS_LIST } from '../homework/HomeworkStudio'; 

// State par défaut pour un quiz vide
const DEFAULT_QUIZ_DATA = { 
    title: '', 
    chapterId: '', 
    teacherId: null, 
    targetClassrooms: [], 
    assignedStudents: [], 
    isAllClass: true,
    questions: [{ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }] 
};

export default function GameStudio({ initialData, chapters, classFilter, user, targetSection, onClose }) {
    const [formData, setFormData] = useState(initialData || { 
        ...DEFAULT_QUIZ_DATA, 
        teacherId: user.id || user._id, 
        targetClassrooms: classFilter ? [classFilter] : [],
        chapterId: findDefaultChapterId(classFilter, chapters, []) // chapters et allClasses ne sont pas encore chargés, on passe [] pour éviter le crash
    });
    
    const [activeQIndex, setActiveQIndex] = useState(0);
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(classFilter || "");
    const [loading, setLoading] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    
    // Récupération de données nécessaires (similaire à HomeworkStudio)
    const loadData = async () => {
        setLoading(true);
        try {
            const [sts, cls] = await Promise.all([
                api.get('/admin/students'),
                api.get('/admin/classrooms')
            ]);
            setAllStudents(sts);
            setAllClasses(cls);

            // Remplir la distribution si on est en édition
            if (initialData) {
                const targets = initialData.targetClassrooms || [initialData.classroom];
                const newDist = {};
                targets.forEach(clsName => {
                    const clsObj = cls.find(c => c.name === clsName);
                    const clsId = clsObj ? String(clsObj._id) : null;
                    let classStudentIds = sts.filter(s => {
                        const isMain = (s.currentClass||"").trim().toUpperCase() === clsName.trim().toUpperCase();
                        const isOption = clsId && (s.assignedGroups||[]).some(gId => String(gId) === clsId);
                        return (isMain || isOption) && (initialData.assignedStudents||[]).includes(s._id);
                    }).map(s => s._id);
                    newDist[clsName] = { chapterId: initialData.chapterId, studentIds: classStudentIds };
                });
                setDistribution(newDist);
                if (targets.length > 0) setViewingClass(targets[0]);
            }
             else if (classFilter) {
                setViewingClass(classFilter);
                const defId = findDefaultChapterId(classFilter, chapters, allClasses);
                setDistribution({ [classFilter]: { chapterId: defId, studentIds: [] } });
            }
        } catch(e) { console.error("GameStudio Load Error:", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [classFilter]);

    // --- MANIPULATIONS LOCALES ---
    
    const handleInput = (field, value) => setFormData(p => ({ ...p, [field]: value }));

    const handleSelectQuestion = (index) => setActiveQIndex(index);
    
    const handleAddQuestion = () => {
        setFormData(p => ({ 
            ...p, 
            questions: [...p.questions, { q: `Nouvelle question ${p.questions.length + 1}`, options: ['', '', '', ''], a: 0 }] 
        }));
        setActiveQIndex(formData.questions.length);
    };

    const updateQuestion = (field, value, optionIndex = null) => {
        setFormData(p => {
            const nextQuestions = [...p.questions];
            const currentQ = { ...nextQuestions[activeQIndex] };

            if (field === 'q' || field === 'a') {
                currentQ[field] = value;
            } else if (field === 'options' && optionIndex !== null) {
                const nextOptions = [...currentQ.options];
                nextOptions[optionIndex] = value;
                currentQ.options = nextOptions;
            }
            nextQuestions[activeQIndex] = currentQ;
            return { ...p, questions: nextQuestions };
        });
    };
    
    // --- ACTIONS IA ---
    const handleGenerateAI = async () => {
        if (!aiTopic) return alert("Entrez un sujet pour l'IA !");
        setAiGenerating(true);
        try {
            const result = await api.post('/games/generate', { topic: aiTopic, count: 5 });
            const cleaned = Array.isArray(result) ? result : [];
            
            if (cleaned.length === 0) {
                 alert("L'IA n'a pas pu générer de questions. Réessayez.");
                 setAiGenerating(false);
                 return;
            }
            
            // On ajoute les nouvelles questions
            setFormData(p => ({ 
                ...p, 
                questions: [
                    ...p.questions, 
                    ...cleaned.filter(q => q.q && q.options && q.options.length === 4 && q.a !== undefined)
                ] 
            }));
            setActiveQIndex(formData.questions.length);
        } catch(e) {
            alert("Erreur de connexion à l'IA.");
        }
        setAiGenerating(false);
    };

    // --- LOGIQUE DE DISTRIBUTION (Réutilisation de HomeworkStudio) ---
    const targetLevel = allClasses.find(c => c.name === viewingClass)?.level;
    const myClassesIds = (user.assignedClasses || []).map(c => String(c._id || c));
    
    const availableClasses = allClasses.filter(c => { 
        if (targetLevel) if (String(c.level) !== String(targetLevel)) return false; 
        if (user.isDeveloper || user.role === 'admin') return true; 
        return myClassesIds.includes(String(c._id)); 
    }).sort((a,b) => a.name.localeCompare(b.name));
    
    const studentsToDisplay = getStudentsForViewingClass(viewingClass, allStudents, allClasses);
    
    const handleSelectClass = (name) => setViewingClass(name);

    const handleToggleStudent = (sId) => {
        setDistribution(prev => {
            const next = { ...prev };
            const cfg = next[viewingClass];
            const allIds = studentsToDisplay.map(s => s._id);

            if (!cfg) {
                const defId = findDefaultChapterId(viewingClass, chapters, allClasses);
                next[viewingClass] = { chapterId: defId, studentIds: [sId] };
            } else {
                let newIds = cfg.studentIds.length === 0 ? allIds.filter(id => id !== sId) : (cfg.studentIds.includes(sId) ? cfg.studentIds.filter(id => id !== sId) : [...cfg.studentIds, sId]);
                
                if (newIds.length === 0) delete next[viewingClass]; // Supprimer si la liste devient vide (et que ce n'était pas la liste 'all')
                else if (newIds.length === allIds.length) next[viewingClass] = { ...cfg, studentIds: [] }; // Liste complète devient 'all'
                else next[viewingClass] = { ...cfg, studentIds: newIds };
            }
            return next;
        });
    };
    
    const toggleAllStudents = () => {
        setDistribution(prev => {
            const next = { ...prev };
            if (next[viewingClass]) delete next[viewingClass]; // Désélectionner = supprimer de la distribution
            else {
                const defId = findDefaultChapterId(viewingClass, chapters, allClasses);
                next[viewingClass] = { chapterId: defId, studentIds: [] }; // Sélectionner tous (studentIds vide = isAllClass = true)
            }
            return next;
        });
    };
    
    // --- SAUVEGARDE FINALE ---
    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
        if (formData.questions.length === 0) return alert("❌ Ajoutez des questions !");
        
        setLoading(true);
        try {
            for (const cls of targets) {
                const cfg = distribution[cls];
                // Récupération de l'ID de chapitre (avec fallback)
                let realChapterId = cfg.chapterId || findDefaultChapterId(cls, chapters, allClasses);
                
                // Calcul des assignedStudents et isAllClass
                let finalIds = [];
                let isGlobal = true;
                if (cfg.studentIds.length > 0) { 
                    isGlobal = false; 
                    finalIds = cfg.studentIds; 
                } else {
                    // Si studentIds est vide, c'est toute la classe (on injecte les IDs pour le côté serveur)
                    isGlobal = true;
                    finalIds = studentsToDisplay.map(s => s._id); 
                }
                
                const payload = { 
                    ...formData, 
                    chapterId: realChapterId, 
                    targetClassrooms: [cls], 
                    teacherId: user.id || user._id, 
                    assignedStudents: finalIds, 
                    isAllClass: isGlobal,
                    type: 'zombie' // Hardcoded pour le moment
                };
                
                await api.post('/games', payload);
            }
            onClose();
        } catch(e) {
            alert("Erreur sauvegarde : " + e.message);
        }
        setLoading(false);
    };
    
    const currentQ = formData.questions[activeQIndex];
    const distCfg = distribution[viewingClass];
    const isSelected = !!distribution[viewingClass];
    
    return (
        <div className="v84-game-container">
            <div className="v84-game-header">
                <div className="flex items-center">
                    <span className="v84-game-icon">🎮</span>
                    <input 
                        className="v84-game-title-input" 
                        value={formData.title} 
                        onChange={e => handleInput('title', e.target.value)} 
                        placeholder="TITRE DU QUIZ..."
                        disabled={loading}
                    />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            
            <div className="v84-game-body">
                {/* GAUCHE : LISTE DES QUESTIONS */}
                <div className="v84-q-list-sidebar custom-scrollbar">
                    <span className="v84-sidebar-label">Questions ({formData.questions.length})</span>
                    {formData.questions.map((q, index) => (
                        <div 
                            key={index} 
                            className={`v84-q-item ${activeQIndex === index ? 'active' : ''}`}
                            onClick={() => handleSelectQuestion(index)}
                        >
                            <div className="v84-q-preview">Q{index + 1}: {q.q.substring(0, 30)}...</div>
                            <div className="v84-q-sub">Rép. correcte: {q.options[q.a]}</div>
                        </div>
                    ))}
                    <button className="v84-add-q-btn" onClick={handleAddQuestion} disabled={loading}>+ AJOUTER MANUELLEMENT</button>
                </div>

                {/* CENTRE : ÉDITEUR */}
                <div className="v84-game-editor custom-scrollbar">
                    
                    {/* WIDGET IA */}
                    <div className="v84-ai-widget">
                        <span className="text-3xl">🤖</span>
                        <input 
                            className="v84-ai-input" 
                            placeholder="Sujet pour générer un quiz (ex: 'Les rois de France')"
                            value={aiTopic}
                            onChange={e => setAiTopic(e.target.value)}
                            disabled={aiGenerating || loading}
                        />
                        <button 
                            className="v84-ai-btn" 
                            onClick={handleGenerateAI}
                            disabled={aiGenerating || loading}
                        >
                            {aiGenerating ? 'GÉNÉRATION...' : 'GÉNÉRER 5 QCM'}
                        </button>
                    </div>

                    {/* ÉDITEUR DE QUESTION ACTIVE */}
                    {currentQ && (
                        <div className="v84-q-card">
                            <span className="v84-field-label">Énoncé de la question {activeQIndex + 1}</span>
                            <textarea 
                                className="v84-q-input" 
                                value={currentQ.q} 
                                onChange={e => updateQuestion('q', e.target.value)}
                                rows="3"
                                disabled={loading}
                            />
                            
                            <span className="v84-field-label mt-8">Réponses possibles</span>
                            <div className="v84-answers-grid">
                                {currentQ.options.map((opt, index) => (
                                    <div key={index} className={`v84-ans-row ${currentQ.a === index ? 'correct' : ''}`}>
                                        <div 
                                            className="v84-correct-radio"
                                            onClick={() => updateQuestion('a', index)}
                                        >
                                            {currentQ.a === index ? '✓' : ''}
                                        </div>
                                        <input 
                                            className="v84-ans-input" 
                                            placeholder={`Option ${index + 1}`}
                                            value={opt}
                                            onChange={e => updateQuestion('options', e.target.value, index)}
                                            disabled={loading}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* DROITE : DISTRIBUTION */}
                <div className="v84-dist-sidebar custom-scrollbar">
                    <span className="v84-sidebar-label">Distribution du Quiz</span>
                    
                    <div className="mb-4 flex flex-wrap gap-2">
                        {availableClasses.map(c => (
                            <button 
                                key={c._id} 
                                onClick={() => handleSelectClass(c.name)} 
                                className={`v84-tab-btn-game ${distribution[c.name] ? 'active' : 'inactive'} ${viewingClass === c.name ? 'border-2 border-purple-700' : ''}`}
                                style={c.type === 'GROUP' ? { color: '#f59e0b', borderColor: '#fcd34d' } : {}}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                    
                    {viewingClass && (
                        <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 p-4">
                            <div 
                                className="flex justify-between items-center mb-4 cursor-pointer" 
                                onClick={toggleAllStudents}
                            >
                                <span className="font-black text-slate-700 uppercase">{viewingClass}</span>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                    {isSelected && <span className="text-white text-xs">✓</span>}
                                </div>
                            </div>
                            
                            {isSelected && (
                                <>
                                    <div className="p-3 bg-slate-50 border-b border-slate-100">
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Ranger dans :</label>
                                        <select 
                                            className="w-full p-2 rounded-lg text-xs font-bold border border-slate-300 outline-none bg-white" 
                                            value={distCfg?.chapterId || ""} 
                                            onChange={(e) => setDistribution(p => ({ ...p, [viewingClass]: { ...p[viewingClass], chapterId: e.target.value } }))}
                                            disabled={loading}
                                        >
                                            <option value="">-- CHOISIR DOSSIER --</option>
                                            {getChaptersForClass(viewingClass, chapters, allClasses).map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {studentsToDisplay.map(s => { 
                                            // Si studentIds est vide, c'est 'all class', donc tout le monde est coché
                                            const checked = isSelected && (distCfg.studentIds.length === 0 || distCfg.studentIds.includes(s._id));
                                            return (
                                                <div 
                                                    key={s._id} 
                                                    onClick={() => handleToggleStudent(s._id)} 
                                                    className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checked ? 'bg-purple-100 text-purple-700' : 'hover:bg-slate-100 text-slate-500'}`}
                                                >
                                                    <div className={`w-4 h-4 rounded border ${checked ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}></div>
                                                    <span className="text-xs font-bold">{s.lastName} {s.firstName}</span>
                                                </div>
                                            ); 
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    <button 
                        className="v84-game-publish-btn" 
                        onClick={handleSave} 
                        disabled={loading || formData.questions.length === 0}
                    >
                        {loading ? 'PUBLICATION...' : (initialData ? 'MODIFIER LE QUIZ' : 'PUBLIER LE QUIZ 🚀')}
                    </button>
                </div>
            </div>
        </div>
    );
}
