// @signatures: GameStudio, handleAddLevel, handleAddQuestion, handleDeleteLevel, handleDeleteQuestion, handleGenerateAI, handleInput, handleSave, loadData, updateQuestion, getAvailableChapters, findBestDefaultChapter
import React, { useState, useEffect, useRef } from 'react';
import './GameStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

const DEFAULT_QUIZ_DATA = { 
    title: '', chapterId: '', teacherId: null, subject: "GÉNÉRAL",
    targetClassrooms: [], assignedStudents: [], isAllClass: true, 
    levels: [ { name: "Niveau 1", intro: { sheetUrl: "", videoUrl: "" }, questions: [{ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }] } ]
};

export default function GameStudio({ initialData, chapters, globalClass, globalLevel, user, targetSection, onClose }) {
    
    // --- LOGIQUE CHAPITRES (Filtrage par section + classe/niveau) ---
    const getAvailableChapters = (clsName, allClassesList, currentSec) => {
        const safeChapters = Array.isArray(chapters) ? chapters : [];
        const cleanSection = (currentSec || "GÉNÉRAL").toUpperCase().trim();
        const clsObj = (allClassesList || []).find(c => c.name === clsName);
        return safeChapters.filter(c => {
            if (c.isArchived) return false;
            // Filtre Matière
            if ((c.section || "GÉNÉRAL").toUpperCase().trim() !== cleanSection) return false;
            
            // Filtre Portée
            if (c.classroom === clsName) return true;
            if (c.sharedLevel && clsObj && String(c.sharedLevel) === String(clsObj.level)) return true;
            if (!c.classroom && !c.sharedLevel) return !c.hiddenIn || !c.hiddenIn.includes(clsName);
            return false;
        }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    const findBestDefaultChapter = (clsName, allClassesList, currentSec) => {
        const av = getAvailableChapters(clsName, allClassesList, currentSec);
        return av.length > 0 ? av[0]._id : "";
    };

    const initData = () => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...DEFAULT_QUIZ_DATA };
        if (base.questions && base.questions.length > 0 && (!base.levels || base.levels.length === 0)) {
            base.levels = [{ name: "Niveau 1", questions: base.questions, intro: {} }];
            delete base.questions;
        } else if (!base.levels || base.levels.length === 0) {
            base.levels = [{ name: "Niveau 1", questions: [{ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }], intro: {} }];
        }
        base.teacherId = user.id || user._id;
        // Si pas de sujet, on prend celui passé en props (contexte d'ouverture)
        if (!base.subject) base.subject = targetSection || "GÉNÉRAL";
        return base;
    };

    const [formData, setFormData] = useState(initData());
    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [activeQIdx, setActiveQIdx] = useState(0);
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [teacherSections, setTeacherSections] = useState([]); // Liste des matières
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(globalClass || "");
    const [studentSearch, setStudentSearch] = useState(""); 
    const [loading, setLoading] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiCount, setAiCount] = useState(5);
    const [aiGenerating, setAiGenerating] = useState(false);
    const assetInputRef = useRef(null);
    const [uploadTarget, setUploadTarget] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            // CORRECTION CRITIQUE : Encodage de la classe pour l'URL
            const encodedClass = encodeURIComponent(globalClass || "");
            const uid = user.id || user._id;

            const [sts, cls, sections] = await Promise.all([ 
                api.get('/admin/students'), 
                api.get('/admin/classrooms'),
                api.get(`/structure/sections/${uid}?classContext=${encodedClass}`)
            ]);

            setAllStudents(sts || []); setAllClasses(cls || []); 
            
            // Préparation sections
            let secs = (Array.isArray(sections) ? sections : []).filter(s => s.name !== "GÉNÉRAL");
            secs.unshift({ name: "GÉNÉRAL", color: "#64748b" });
            setTeacherSections(secs);

            if (formData) {
                const newDist = {};
                const targets = formData.targetClassrooms && formData.targetClassrooms.length > 0 ? formData.targetClassrooms : [globalClass];
                const currentSubject = formData.subject || "GÉNÉRAL";

                targets.forEach(clsName => {
                    if(!clsName) return;
                    const clsObj = (cls || []).find(c => c.name === clsName);
                    const ids = (sts || []).filter(s => {
                        const isM = (s.currentClass||"").trim().toUpperCase() === clsName.toUpperCase();
                        const isO = clsObj && (s.assignedGroups||[]).some(gId => String(gId) === String(clsObj._id));
                        return (isM || isO) && (formData.assignedStudents||[]).includes(String(s._id));
                    }).map(s => String(s._id));
                    
                    newDist[clsName] = { 
                        chapterId: formData.chapterId || findBestDefaultChapter(clsName, cls, currentSubject), 
                        studentIds: ids 
                    };
                });
                setDistribution(newDist);
            }
        } catch(e) { console.error("GameStudio Load Error", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const handleInput = (field, value) => {
        setFormData(p => ({ ...p, [field]: value }));
        
        // Mise à jour des dossiers par défaut si changement de matière
        if (field === 'subject') {
            const newSubject = value;
            setDistribution(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(clsName => {
                    next[clsName].chapterId = findBestDefaultChapter(clsName, allClasses, newSubject);
                });
                return next;
            });
        }
    };

    const handleAddLevel = () => { setFormData(p => ({ ...p, levels: [...p.levels, { name: `Niveau ${p.levels.length + 1}`, questions: [{ q: '', options: ['', '', '', ''], a: 0 }], intro: { sheetUrl: "", videoUrl: "" } }] })); setActiveLevelIdx(formData.levels.length); setActiveQIdx(0); };
    const handleDeleteLevel = (e, lIdx) => { e.stopPropagation(); if(!confirm("Supprimer ce niveau ?")) return; setFormData(p => { let newLevels = p.levels.filter((_, i) => i !== lIdx); if (newLevels.length === 0) newLevels = [{ name: "Niveau 1", questions: [{q:'', options:['','','',''], a:0}], intro: {} }]; return { ...p, levels: newLevels }; }); setActiveLevelIdx(0); setActiveQIdx(0); };
    const handleAddQuestion = () => { setFormData(p => { const newLevels = [...p.levels]; newLevels[activeLevelIdx].questions.push({ q: '', options: ['', '', '', ''], a: 0 }); return { ...p, levels: newLevels }; }); setTimeout(() => setActiveQIdx(formData.levels[activeLevelIdx].questions.length - 1), 0); };
    const handleDeleteQuestion = (e, lIdx, qIdx) => { e.stopPropagation(); if(!confirm("Supprimer ?")) return; setFormData(p => { const newLevels = [...p.levels]; newLevels[lIdx].questions = newLevels[lIdx].questions.filter((_, i) => i !== qIdx); return { ...p, levels: newLevels }; }); if(activeQIdx >= qIdx) setActiveQIdx(Math.max(0, activeQIdx - 1)); };
    const updateQuestion = (field, value, optionIndex = null) => { setFormData(p => { const newLevels = [...p.levels]; const currentQ = { ...newLevels[activeLevelIdx].questions[activeQIdx] }; if (field === 'q' || field === 'a') currentQ[field] = value; else if (field === 'options') { currentQ.options[optionIndex] = value; } newLevels[activeLevelIdx].questions[activeQIdx] = currentQ; return { ...p, levels: newLevels }; }); };

    const handleGenerateAI = async (mode = 'manual') => {
        const currentLevel = formData.levels[activeLevelIdx]; if (!currentLevel) return;
        setAiGenerating(true);
        try {
            const fd = new FormData();
            if (mode === 'sheet') { const sheetUrl = currentLevel.intro?.sheetUrl; if (!sheetUrl) return alert("Pas de fiche !"); fd.append('sheetUrl', sheetUrl); } 
            else { if (!aiTopic.trim()) { setAiGenerating(false); return alert("Sujet requis !"); } fd.append('topic', aiTopic); }
            fd.append('count', aiCount);
            const res = await fetch('/api/games/generate-content', { method: 'POST', body: fd });
            const cleaned = await res.json();
            if (Array.isArray(cleaned) && cleaned.length > 0) {
                setFormData(p => { const newLevels = [...p.levels]; if (newLevels[activeLevelIdx].questions.length === 1 && !newLevels[activeLevelIdx].questions[0].q.trim()) { newLevels[activeLevelIdx].questions = cleaned; } else { newLevels[activeLevelIdx].questions = [...newLevels[activeLevelIdx].questions, ...cleaned]; } return { ...p, levels: newLevels }; });
                setAiTopic(""); setActiveQIdx(0);
            }
        } catch(e) { alert("Erreur IA"); } finally { setAiGenerating(false); }
    };

    // --- SAUVEGARDE ATOMIQUE (1 Classe = 1 Jeu) ---
    const handleSave = async () => {
        const targets = Object.keys(distribution); 
        if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
        setLoading(true);
        try {
            const originalId = initialData?._id;
            const originalClass = initialData?.targetClassrooms?.[0];
            let idUsed = false;

            for (const clsName of targets) {
                const cfg = distribution[clsName];
                const { actType, typeLabel, date, __v, createdAt, updatedAt, chapterId, targetClassrooms, assignedStudents, isAllClass, teacherId, ...contentData } = formData;

                const payload = { 
                    ...contentData, 
                    chapterId: cfg.chapterId || findBestDefaultChapter(clsName, allClasses, formData.subject), 
                    targetClassrooms: [clsName], 
                    assignedStudents: cfg.studentIds, 
                    isAllClass: cfg.studentIds.length === 0, 
                    teacherId: user.id || user._id, 
                    type: 'zombie',
                    // On force le sujet choisi
                    subject: formData.subject || "GÉNÉRAL"
                };

                if (originalId && clsName === originalClass && !idUsed) {
                    payload._id = originalId; idUsed = true;
                } else {
                    delete payload._id;
                }
                await api.post('/games', payload);
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde."); } setLoading(false);
    };

    const handleUploadAsset = async (e) => { const file = e.target.files[0]; if (!file || uploadTarget === null) return; setLoading(true); const fd = new FormData(); fd.append('file', file); try { const res = await fetch('/api/games/upload-asset', { method: 'POST', body: fd }); const data = await res.json(); if (data.url) { setFormData(prev => { const next = { ...prev }; if (uploadTarget === -1) next.globalIntro = { ...next.globalIntro, sheetUrl: data.url }; else next.levels[uploadTarget].intro = { ...next.levels[uploadTarget].intro, sheetUrl: data.url }; return next; }); } } catch(err) { alert("Erreur upload"); } setLoading(false); e.target.value = null; };

    const currentLevelData = formData.levels[activeLevelIdx];
    const currentQ = currentLevelData?.questions[activeQIdx];

    return (
        <div className="v84-game-container">
            <input type="file" ref={assetInputRef} className="hidden" onChange={handleUploadAsset} />
            <div className="v84-game-header">
                <div className="flex items-center gap-4"><span className="v84-game-icon">🎮</span><input className="v84-game-title-input" value={formData.title} onChange={e => handleInput('title', e.target.value)} placeholder="TITRE DU QUIZ..." /></div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            <div className="v84-game-body">
                <div className="v84-q-list-sidebar custom-scrollbar">
                    {formData.levels.map((lvl, lIdx) => (
                        <div key={lIdx} className="v84-level-block">
                            <div className={`v84-level-header ${activeLevelIdx === lIdx ? 'active-lvl' : ''}`} onClick={() => { setActiveLevelIdx(lIdx); setActiveQIdx(0); }}>
                                {lvl.name} ({lvl.questions.length})
                                <button className="v84-del-btn" onClick={(e) => handleDeleteLevel(e, lIdx)}>✕</button>
                            </div>
                            {activeLevelIdx === lIdx && (
                                <div className="v84-q-list">
                                    {lvl.questions.map((q, qIdx) => (
                                        <div key={qIdx} className={`v84-q-item ${activeQIdx === qIdx ? 'active' : ''}`} onClick={() => setActiveQIdx(qIdx)}>
                                            <div className="v84-q-preview">Q{qIdx + 1}: {q.q ? q.q.substring(0, 20) : '...'}</div>
                                            <button className="v84-del-btn" onClick={(e) => handleDeleteQuestion(e, lIdx, qIdx)}>✕</button>
                                        </div>
                                    ))}
                                    <button className="v84-add-q-btn" onClick={handleAddQuestion}>+ QUESTION</button>
                                </div>
                            )}
                        </div>
                    ))}
                    <button className="v84-add-level-btn" onClick={handleAddLevel}>+ NOUVEAU NIVEAU</button>
                </div>
                
                <div className="v84-game-editor custom-scrollbar">
                    {currentLevelData ? (
                        <>
                            <div className="v84-resources-level">
                                <div className="v84-res-title local"><span>📍</span> RESSOURCES {currentLevelData.name}</div>
                                <div className="v84-res-row">
                                    {currentLevelData.intro?.sheetUrl ? <div className="v84-res-badge">📄 FICHE PRÊTE <span className="v84-res-remove" onClick={() => handleInput('levels', formData.levels.map((l,i)=>i===activeLevelIdx?{...l, intro:{...l.intro, sheetUrl:""}}:l))}>✕</span></div> : <button className="v84-res-btn upload" onClick={() => { setUploadTarget(activeLevelIdx); assetInputRef.current.click(); }}>📤 FICHE NIVEAU</button>}
                                    <input className="v84-res-input" placeholder="Lien Vidéo..." value={currentLevelData.intro?.videoUrl || ""} onChange={e => handleInput('levels', formData.levels.map((l,i)=>i===activeLevelIdx?{...l, intro:{...l.intro, videoUrl:e.target.value}}:l))} />
                                </div>
                            </div>
                            <div className="v84-ai-widget">
                                <div className="v84-ai-row"><span className="text-2xl">🤖</span><input type="number" className="v84-ai-count-input" value={aiCount} onChange={e => setAiCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} /><input className="v84-ai-input" placeholder="Sujet du quiz..." value={aiTopic} onChange={e => setAiTopic(e.target.value)} disabled={aiGenerating} /></div>
                                <div className="flex gap-2">
                                    {currentLevelData.intro?.sheetUrl && <button className="v84-gen-btn !bg-emerald-600" onClick={() => handleGenerateAI('sheet')} disabled={aiGenerating}>{aiGenerating ? 'ANALYSE...' : `📄 GÉNÉRER ${aiCount} QUESTIONS VIA LA FICHE`}</button>}
                                    <button className="v84-gen-btn" onClick={() => handleGenerateAI('manual')} disabled={aiGenerating || !aiTopic.trim()}>{aiGenerating ? 'CRÉATION...' : `✨ GÉNÉRER ${aiCount} QUESTIONS VIA LE SUJET`}</button>
                                </div>
                            </div>
                            {currentQ ? (
                                <div className="v84-q-card animate-in fade-in">
                                    <textarea className="v84-q-input" value={currentQ.q} onChange={e => updateQuestion('q', e.target.value)} placeholder="Tapez la question..." rows="3" />
                                    <div className="v84-answers-grid">{(currentQ.options || ['', '', '', '']).map((opt, i) => (<div key={i} className={`v84-ans-row ${currentQ.a === i ? 'correct' : ''}`}><div className="v84-correct-radio" onClick={() => updateQuestion('a', i)}>{currentQ.a === i ? '✓' : ''}</div><input className="v84-ans-input" value={opt} onChange={e => updateQuestion('options', e.target.value, i)} placeholder={`Option ${i+1}`} /></div>))}</div>
                                </div>
                            ) : <div className="p-10 text-center text-slate-300 font-bold uppercase">Ajoutez une question ou utilisez l'IA</div>}
                        </>
                    ) : <div className="p-10 text-center text-slate-300 font-bold uppercase">Sélectionnez un niveau</div>}
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
                    targetLevel={globalLevel} 
                    loading={loading} 
                    onSave={handleSave}
                    saveLabel={initialData ? "MODIFIER" : "PUBLIER LE JEU 🚀"}
                    // NOUVEAUX PROPS POUR LA SECTION
                    sections={teacherSections}
                    currentSection={formData.subject}
                    onSectionChange={(s) => handleInput('subject', s)}
                />
            </div>
        </div>
    );
}
