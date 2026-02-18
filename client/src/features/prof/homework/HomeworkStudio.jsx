// @signatures: HomeworkStudio, handleSave
import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

const DEFAULT_LEVEL = { 
    instruction: '', 
    instructionUrls: [], // Tableau, mais l'UI en force 1 max pour la fiche sujet
    attachmentUrls: [],  // Tableau illimité pour les docs
    aiHints: '' 
};

const DEFAULT_HW_DATA = { 
    title: '', 
    date: '', 
    teacherId: null, 
    levels: [{ ...DEFAULT_LEVEL }],
    isPunishment: false
};

export default function HomeworkStudio({ initialData, chapters, user, targetSection, onClose, allStudents: propStudents, allClasses: propClasses }) {
    
    // --- 1. ÉTATS DU DEVOIR ---
    const [formData, setFormData] = useState(() => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...DEFAULT_HW_DATA };
        
        // Sécurité Structure
        if (!base.levels || base.levels.length === 0) base.levels = [{ ...DEFAULT_LEVEL }];
        
        // Sécurité Date
        if (!base.date) {
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            base.date = tomorrow.toISOString().split('T')[0];
        } else base.date = base.date.split('T')[0];
        
        return base;
    });

    const [activeLevelIdx, setActiveLevelIdx] = useState(0);

    // --- 2. ÉTATS CONTEXTUELS ---
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState("");
    const [studentSearch, setStudentSearch] = useState("");
    const [loading, setLoading] = useState(false);
    
    // --- 3. UPLOAD REFS ---
    const fileInputRef = useRef(null);
    const [uploadType, setUploadType] = useState(null); // 'sheet' ou 'docs'

    // --- 4. CHARGEMENT INITIAL (SI MANQUANT) ---
    useEffect(() => {
        const initDistribution = () => {
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

        if ((!propStudents || propStudents.length === 0) || (!propClasses || propClasses.length === 0)) {
            setLoading(true);
            Promise.all([api.get('/admin/students'), api.get('/admin/classrooms')])
                .then(([sts, cls]) => {
                    setAllStudents(sts || []);
                    setAllClasses(cls || []);
                    initDistribution();
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else {
            initDistribution();
        }
    }, []);

    // --- 5. GESTION DES NIVEAUX (QUESTIONS) ---
    const handleAddLevel = () => {
        setFormData(prev => ({
            ...prev,
            levels: [...prev.levels, { ...DEFAULT_LEVEL }]
        }));
        setActiveLevelIdx(formData.levels.length); // Switch to new tab
    };

    const handleRemoveLevel = (e, idx) => {
        e.stopPropagation();
        if (formData.levels.length === 1) return alert("Il faut au moins une question.");
        if (!confirm("Supprimer cette question ?")) return;
        
        const newLevels = formData.levels.filter((_, i) => i !== idx);
        setFormData(prev => ({ ...prev, levels: newLevels }));
        setActiveLevelIdx(prev => Math.min(prev, newLevels.length - 1));
    };

    const updateCurrentLevel = (field, value) => {
        const newLevels = [...formData.levels];
        newLevels[activeLevelIdx] = { ...newLevels[activeLevelIdx], [field]: value };
        setFormData(prev => ({ ...prev, levels: newLevels }));
    };

    // --- 6. GESTION UPLOAD ---
    const triggerUpload = (type) => {
        setUploadType(type);
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        setLoading(true);
        const fd = new FormData();
        // Support multi-upload pour 'docs', single pour 'sheet' (mais l'API gère array)
        Array.from(files).forEach(f => fd.append('files', f));

        try {
            const res = await fetch('/api/homework/upload', { method: 'POST', body: fd }).then(r => r.json());
            if (res.urls && res.urls.length > 0) {
                const currentLv = formData.levels[activeLevelIdx];
                
                if (uploadType === 'sheet') {
                    // REMPLACE la fiche existante (Règle US: Une seule fiche par question)
                    updateCurrentLevel('instructionUrls', [res.urls[0]]);
                } else {
                    // AJOUTE aux documents existants
                    updateCurrentLevel('attachmentUrls', [...currentLv.attachmentUrls, ...res.urls]);
                }
            }
        } catch(err) { alert("Erreur Upload"); }
        
        setLoading(false);
        e.target.value = ""; // Reset input
    };

    const removeAttachment = (type, urlIdx) => {
        const currentLv = formData.levels[activeLevelIdx];
        if (type === 'sheet') {
            updateCurrentLevel('instructionUrls', []);
        } else {
            const newDocs = currentLv.attachmentUrls.filter((_, i) => i !== urlIdx);
            updateCurrentLevel('attachmentUrls', newDocs);
        }
    };

    // --- 7. SAUVEGARDE (Mode Groupé) ---
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
                
                // Gestion ID (Update vs Create Clone)
                if (formData._id && key === Object.keys(groups)[0]) {
                    // Update premier
                } else {
                    delete payload._id; 
                }

                await api.post('/homework', payload); 
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde: " + e.message); }
        setLoading(false);
    };

    // Raccourcis pour l'affichage
    const currentLvl = formData.levels[activeLevelIdx];

    return (
        <div className="v84-hw-container">
            <input type="file" ref={fileInputRef} className="hidden" multiple={uploadType === 'docs'} onChange={handleFileChange} />
            
            <div className="v84-hw-header">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">📝</span>
                    <input 
                        className="v84-hw-title-input" 
                        value={formData.title} 
                        onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} 
                        placeholder="TITRE DU DEVOIR..." 
                        autoFocus 
                    />
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase text-red-500 flex items-center gap-2 cursor-pointer bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                        <input 
                            type="checkbox" 
                            checked={formData.isPunishment} 
                            onChange={e => setFormData(p => ({ ...p, isPunishment: e.target.checked }))} 
                        />
                        Punition
                    </label>
                    <input 
                        type="date" 
                        className="v84-hw-date-input" 
                        value={formData.date} 
                        onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} 
                    />
                    <button onClick={onClose} className="v84-close-btn">✕</button>
                </div>
            </div>

            <div className="v84-hw-body">
                {/* --- PANNEAU GAUCHE : ÉDITEUR MULTI-PAGES --- */}
                <div className="v84-hw-editor custom-scrollbar">
                    
                    {/* BARRE D'ONGLETS */}
                    <div className="hw-level-tabs">
                        {formData.levels.map((lvl, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => setActiveLevelIdx(idx)}
                                className={`hw-tab-btn ${activeLevelIdx === idx ? 'active' : ''}`}
                            >
                                <span>Question {idx + 1}</span>
                                {formData.levels.length > 1 && (
                                    <span className="hw-tab-delete" onClick={(e) => handleRemoveLevel(e, idx)}>✕</span>
                                )}
                            </div>
                        ))}
                        <button className="hw-tab-add" onClick={handleAddLevel}>+</button>
                    </div>

                    <div className="v84-hw-card">
                        {/* 1. CONSIGNE TEXTE */}
                        <div>
                            <div className="hw-section-title">Consigne textuelle</div>
                            <textarea 
                                className="v84-hw-textarea custom-scrollbar" 
                                placeholder="Écrivez votre question ou consigne ici..." 
                                value={currentLvl.instruction} 
                                onChange={e => updateCurrentLevel('instruction', e.target.value)} 
                            />
                        </div>

                        {/* 2. FICHE SUJET (IMAGE) */}
                        <div>
                            <div className="hw-section-title">Fiche Question (Image/Scan)</div>
                            {currentLvl.instructionUrls && currentLvl.instructionUrls.length > 0 ? (
                                <div className="hw-sheet-zone" style={{borderColor: '#22c55e', background: '#f0fdf4'}}>
                                    <img src={currentLvl.instructionUrls[0]} className="hw-sheet-preview" alt="Sujet" />
                                    <button className="hw-sheet-remove" onClick={() => removeAttachment('sheet')}>Supprimer</button>
                                </div>
                            ) : (
                                <div className="hw-sheet-zone" onClick={() => triggerUpload('sheet')}>
                                    <div className="hw-sheet-placeholder">
                                        <span style={{fontSize: '2rem'}}>🖼️</span>
                                        <span>Déposer la fiche ici</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. DOCUMENTS ANNEXES */}
                        <div>
                            <div className="hw-section-title">Documents de travail (Aide)</div>
                            <div className="v84-hw-attachments">
                                {currentLvl.attachmentUrls.map((url, i) => (
                                    <div key={i} className="v84-att-chip">
                                        <span>📎 Doc {i+1}</span>
                                        <button onClick={() => removeAttachment('docs', i)} className="ml-2 text-red-400 font-bold hover:text-red-600">✕</button>
                                    </div>
                                ))}
                                <button onClick={() => triggerUpload('docs')} className="v84-att-add-btn">+ DOC</button>
                            </div>
                        </div>

                        {/* 4. IA HINTS */}
                        <div>
                            <div className="hw-section-title" style={{color: '#7c3aed'}}>🧠 Indices Correction IA (Secret)</div>
                            <div className="hw-ai-box">
                                <textarea 
                                    className="hw-ai-input custom-scrollbar" 
                                    placeholder="Donnez ici les mots-clés ou les réponses attendues pour aider l'IA à corriger..."
                                    value={currentLvl.aiHints}
                                    onChange={e => updateCurrentLevel('aiHints', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- PANNEAU DROITE : DISTRIBUTION UNIFIÉE --- */}
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
