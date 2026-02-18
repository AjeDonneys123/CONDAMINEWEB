// @signatures: GameStudio, handleAddLevel, handleAddQuestion, handleDeleteLevel, handleDeleteQuestion, handleDrop, handleFileSelect, handleGenerateAI, handleInput, handleMoveQuestions, handleOpenSheet, handlePaste, handleRemoveAsset, handleRemoveFile, handleSave, handleSelectQuestion, handleToggleSelect, handleUpdateAssetVideo, handleUploadAsset, isQuestionSelected, updateQuestion
import React, { useState, useEffect, useRef } from 'react';
import './GameStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

export default function GameStudio({ initialData, chapters, user, targetSection, onClose, allStudents: propStudents, allClasses: propClasses }) {
    
    // --- ÉTATS DONNÉES ---
    const [formData, setFormData] = useState(initialData || { 
        title: '', 
        levels: [{ name: "Niveau 1", questions: [{ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }], intro: {} }],
        globalIntro: { sheetUrl: "", videoUrl: "" }
    });
    
    // --- ÉTATS UI ÉDITEUR ---
    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [activeQIdx, setActiveQIdx] = useState(0);
    const [selectedForMove, setSelectedForMove] = useState([]); 
    const [moveTargetLevel, setMoveTargetLevel] = useState("");
    
    // --- ÉTATS DISTRIBUTION (SIDEBAR) ---
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState("");
    const [studentSearch, setStudentSearch] = useState("");
    
    const [loading, setLoading] = useState(false);
    
    // --- ÉTATS IA & ASSETS ---
    const [aiTopic, setAiTopic] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    
    const fileInputRef = useRef(null);
    const assetInputRef = useRef(null);
    const [uploadTarget, setUploadTarget] = useState(null); // -1 = Global, 0+ = Level Index

    // CHARGEMENT DE SECOURS SI PROPS MANQUANTES
    useEffect(() => {
        if ((!propStudents || propStudents.length === 0) || (!propClasses || propClasses.length === 0)) {
            const load = async () => {
                setLoading(true);
                try {
                    const [sts, cls] = await Promise.all([api.get('/admin/students'), api.get('/admin/classrooms')]);
                    setAllStudents(sts || []);
                    setAllClasses(cls || []);
                } catch(e) {}
                setLoading(false);
            };
            load();
        }

        // RECONSTRUCTION DISTRIBUTION SI ÉDITION
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
    }, []);

    // --- LOGIQUE ÉDITEUR (RESTAURÉE) ---
    const handleInput = (field, value) => setFormData(p => ({ ...p, [field]: value }));
    const handleSelectQuestion = (lIdx, qIdx) => { setActiveLevelIdx(lIdx); setActiveQIdx(qIdx); };
    
    const handleAddLevel = () => { setFormData(p => ({ ...p, levels: [...p.levels, { name: `Niveau ${p.levels.length + 1}`, questions: [], intro: { sheetUrl: "", videoUrl: "" } }] })); setActiveLevelIdx(formData.levels.length); setActiveQIdx(0); };
    const handleDeleteLevel = (e, lIdx) => { e.stopPropagation(); if(!confirm("Supprimer ce niveau ?")) return; setFormData(p => { let newLevels = p.levels.filter((_, i) => i !== lIdx); if (newLevels.length === 0) newLevels = [{ name: "Niveau 1", questions: [], intro: {} }]; return { ...p, levels: newLevels }; }); setActiveLevelIdx(0); setActiveQIdx(0); };
    const handleAddQuestion = () => { setFormData(p => { const newLevels = [...p.levels]; newLevels[activeLevelIdx].questions.push({ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }); return { ...p, levels: newLevels }; }); setTimeout(() => setActiveQIdx(formData.levels[activeLevelIdx].questions.length), 0); };
    const handleDeleteQuestion = (e, lIdx, qIdx) => { e.stopPropagation(); if(!confirm("Supprimer ?")) return; setFormData(p => { const newLevels = [...p.levels]; newLevels[lIdx].questions = newLevels[lIdx].questions.filter((_, i) => i !== qIdx); return { ...p, levels: newLevels }; }); if(activeQIdx >= qIdx) setActiveQIdx(Math.max(0, activeQIdx - 1)); setSelectedForMove(prev => prev.filter(s => !(s.lIdx === lIdx && s.qIdx === qIdx))); };
    const updateQuestion = (field, value, optionIndex = null) => { setFormData(p => { const newLevels = [...p.levels]; if(!newLevels[activeLevelIdx] || !newLevels[activeLevelIdx].questions[activeQIdx]) return p; const currentQ = { ...newLevels[activeLevelIdx].questions[activeQIdx] }; if (field === 'q' || field === 'a') { currentQ[field] = value; } else if (field === 'options' && optionIndex !== null) { const nextOptions = [...currentQ.options]; nextOptions[optionIndex] = value; currentQ.options = nextOptions; } newLevels[activeLevelIdx].questions[activeQIdx] = currentQ; return { ...p, levels: newLevels }; }); };

    const handleToggleSelect = (e, lIdx, qIdx) => { e.stopPropagation(); const exists = selectedForMove.some(s => s.lIdx === lIdx && s.qIdx === qIdx); if (exists) setSelectedForMove(prev => prev.filter(s => !(s.lIdx === lIdx && s.qIdx === qIdx))); else setSelectedForMove(prev => [...prev, { lIdx, qIdx }]); };
    const isQuestionSelected = (lIdx, qIdx) => selectedForMove.some(s => s.lIdx === lIdx && s.qIdx === qIdx);
    const handleMoveQuestions = () => { if (moveTargetLevel === "" || isNaN(parseInt(moveTargetLevel))) return; const targetIdx = parseInt(moveTargetLevel); setFormData(prev => { const newLevels = prev.levels.map(l => ({ ...l, questions: [...l.questions] })); const questionsToMove = []; newLevels.forEach((lvl, lIdx) => { lvl.questions.forEach((q, qIdx) => { if (isQuestionSelected(lIdx, qIdx)) questionsToMove.push(q); }); }); newLevels.forEach((lvl, lIdx) => { lvl.questions = lvl.questions.filter((_, qIdx) => !isQuestionSelected(lIdx, qIdx)); }); newLevels[targetIdx].questions.push(...questionsToMove); return { ...prev, levels: newLevels }; }); setSelectedForMove([]); setActiveLevelIdx(targetIdx); setActiveQIdx(0); };

    const handleUploadAsset = async (e) => { const file = e.target.files[0]; if (!file || uploadTarget === null) return; setLoading(true); const fd = new FormData(); fd.append('file', file); try { const res = await fetch('/api/games/upload-asset', { method: 'POST', body: fd }); const data = await res.json(); if (data.url) { setFormData(prev => { const next = { ...prev }; if (uploadTarget === -1) next.globalIntro = { ...next.globalIntro, sheetUrl: data.url }; else next.levels[uploadTarget].intro = { ...next.levels[uploadTarget].intro, sheetUrl: data.url }; return next; }); } } catch(err) { alert("Erreur upload"); } setLoading(false); e.target.value = null; };
    const handleRemoveAsset = (idx) => { setFormData(prev => { const next = { ...prev }; if (idx === -1) next.globalIntro.sheetUrl = ""; else next.levels[idx].intro.sheetUrl = ""; return next; }); };
    const handleUpdateAssetVideo = (idx, url) => { setFormData(prev => { const next = { ...prev }; if (idx === -1) next.globalIntro.videoUrl = url; else next.levels[idx].intro.videoUrl = url; return next; }); };
    const handleOpenSheet = (url) => { window.open(url, '_blank'); };
    
    // --- LOGIQUE IA ---
    const handleGenerateAI = async (mode = 'manual') => {
        setAiGenerating(true);
        try {
            const fd = new FormData();
            if (mode === 'sheet') { const sheetUrl = currentLevel.intro?.sheetUrl; if (!sheetUrl) return alert("Pas de fiche !"); fd.append('sheetUrl', sheetUrl); } 
            else { if (!aiTopic) { setAiGenerating(false); return alert("Sujet requis !"); } }
            fd.append('topic', aiTopic || "Quiz"); fd.append('count', 5);
            const res = await fetch('/api/games/generate-content', { method: 'POST', body: fd });
            const cleaned = await res.json();
            if (Array.isArray(cleaned) && cleaned.length > 0) {
                setFormData(p => { const newLevels = [...p.levels]; if (newLevels[activeLevelIdx].questions.length === 1 && newLevels[activeLevelIdx].questions[0].q === 'Nouvelle question') { newLevels[activeLevelIdx].questions = cleaned; } else { newLevels[activeLevelIdx].questions = [...newLevels[activeLevelIdx].questions, ...cleaned]; } return { ...p, levels: newLevels }; });
                setActiveQIdx(0); setAiTopic("");
            } else { alert("Rien généré."); }
        } catch(e) { alert("Erreur IA"); } setAiGenerating(false); 
    };

    // --- SAUVEGARDE ---
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
                    type: 'zombie' // Par défaut pour le moment
                };
                if (formData._id && key === Object.keys(groups)[0]) { /* update */ } else { delete payload._id; }
                await api.post('/games', payload);
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde."); }
        setLoading(false);
    };

    const currentLevel = formData.levels[activeLevelIdx];
    const currentQ = currentLevel ? currentLevel.questions[activeQIdx] : null;
    const hasLevelSheet = !!currentLevel?.intro?.sheetUrl;
    const totalQuestionsCount = formData.levels.reduce((acc, l) => acc + l.questions.length, 0);

    return (
        <div className="v84-game-container">
             <input type="file" ref={assetInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleUploadAsset} />
             <div className="v84-game-header">
                <div className="flex items-center"><span className="v84-game-icon">🎮</span><input className="v84-game-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU QUIZ..." /></div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            
            <div className="v84-game-body">
                
                {/* 1. SIDEBAR GAUCHE : ARBRE DES NIVEAUX */}
                <div className="v84-q-list-sidebar custom-scrollbar">
                    {formData.levels.map((lvl, lIdx) => (
                        <div key={lIdx} className="v84-level-block">
                            <div className={`v84-level-header ${activeLevelIdx === lIdx ? 'active-lvl' : ''}`} onClick={() => { setActiveLevelIdx(lIdx); setActiveQIdx(0); }}>
                                {lvl.name} ({lvl.questions.length})
                                {formData.levels.length > 1 && <button className="v84-del-btn" onClick={(e) => handleDeleteLevel(e, lIdx)}>✕</button>}
                            </div>
                            {activeLevelIdx === lIdx && (
                                <div className="v84-q-list">
                                    {lvl.questions.map((q, qIdx) => (
                                        <div key={qIdx} className={`v84-q-item ${activeQIdx === qIdx ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); handleSelectQuestion(lIdx, qIdx); }}>
                                            <input type="checkbox" className="v84-q-checkbox" checked={isQuestionSelected(lIdx, qIdx)} onChange={(e) => handleToggleSelect(e, lIdx, qIdx)} onClick={e => e.stopPropagation()} />
                                            <div className="v84-q-preview">Q{qIdx + 1}: {(q.q || "Question vide").substring(0, 30)}...</div>
                                            <button className="v84-del-btn" onClick={(e) => handleDeleteQuestion(e, lIdx, qIdx)}>✕</button>
                                        </div>
                                    ))}
                                    <button className="v84-add-q-btn" onClick={handleAddQuestion} disabled={loading}>+ QUESTION</button>
                                </div>
                            )}
                        </div>
                    ))}
                    {selectedForMove.length > 0 && (
                        <div className="v84-move-box">
                            <div className="v84-move-title">{selectedForMove.length} Sélectionné(s)</div>
                            <div className="v84-move-actions">
                                <select className="v84-move-select" value={moveTargetLevel} onChange={e => setMoveTargetLevel(e.target.value)}><option value="">Vers niveau...</option>{formData.levels.map((l, idx) => <option key={idx} value={idx}>{l.name}</option>)}</select>
                                <button className="v84-move-go-btn" onClick={handleMoveQuestions}>GO</button>
                            </div>
                        </div>
                    )}
                    <button className="v84-add-level-btn" onClick={handleAddLevel}>+ NOUVEAU NIVEAU</button>
                </div>

                {/* 2. CENTRE : ÉDITEUR DE CONTENU */}
                <div className="v84-game-editor custom-scrollbar">
                    {/* ZONE RESSOURCES (INTRO) */}
                    {activeLevelIdx === 0 && activeQIdx === 0 && (
                        <div className="v84-resources-global">
                            <div className="v84-res-title global"><span>🌍</span> RESSOURCES GLOBALES (INTRO JEU)</div>
                            <div className="v84-res-row">
                                {formData.globalIntro.sheetUrl ? (
                                    <div className="v84-res-badge" onClick={() => handleOpenSheet(formData.globalIntro.sheetUrl)}>📄 FICHE PRÊTE <span className="v84-res-remove" onClick={(e) => { e.stopPropagation(); handleRemoveAsset(-1); }}>✕</span></div>
                                ) : ( <button className="v84-res-btn upload" onClick={() => { setUploadTarget(-1); assetInputRef.current.click(); }}>📤 AJOUTER FICHE</button> )}
                                <input className="v84-res-input" placeholder="Lien Vidéo..." value={formData.globalIntro.videoUrl} onChange={e => handleUpdateAssetVideo(-1, e.target.value)} />
                            </div>
                        </div>
                    )}
                    {currentLevel && (
                        <div className="v84-resources-level">
                            <div className="v84-res-title local"><span>📍</span> RESSOURCES {currentLevel.name}</div>
                            <div className="v84-res-row">
                                {currentLevel.intro?.sheetUrl ? (
                                    <div className="v84-res-badge" onClick={() => handleOpenSheet(currentLevel.intro.sheetUrl)}>📄 FICHE NIVEAU <span className="v84-res-remove" onClick={(e) => { e.stopPropagation(); handleRemoveAsset(activeLevelIdx); }}>✕</span></div>
                                ) : ( <button className="v84-res-btn upload" onClick={() => { setUploadTarget(activeLevelIdx); assetInputRef.current.click(); }}>📤 FICHE NIVEAU</button> )}
                                <input className="v84-res-input" placeholder="Vidéo..." value={currentLevel.intro?.videoUrl || ""} onChange={e => handleUpdateAssetVideo(activeLevelIdx, e.target.value)} />
                            </div>
                        </div>
                    )}
                    
                    {/* ZONE IA */}
                    <div className="v84-ai-widget">
                        <div className="v84-ai-row"><span className="text-2xl">🤖</span><input className="v84-ai-input" placeholder="Sujet / Consigne IA..." value={aiTopic} onChange={e => setAiTopic(e.target.value)} /></div>
                        {hasLevelSheet && <button className="v84-gen-btn mb-2" onClick={() => handleGenerateAI('sheet')} disabled={aiGenerating}>{aiGenerating ? 'ANALYSE...' : '📄 GÉNÉRER D\'APRÈS LA FICHE DU NIVEAU'}</button>}
                        <button className={`v84-gen-btn ${hasLevelSheet ? 'bg-slate-400' : ''}`} onClick={() => handleGenerateAI('manual')} disabled={aiGenerating}>{aiGenerating ? '...' : (hasLevelSheet ? 'OU GÉNÉRER VIA LE SUJET' : 'GÉNÉRER VIA CE SUJET')}</button>
                    </div>

                    {/* ZONE QUESTION */}
                    {currentQ ? (
                        <div className="v84-q-card">
                            <span className="text-xs font-black text-slate-400 uppercase mb-4 block">{currentLevel.name} - Question {activeQIdx + 1}</span>
                            <textarea className="v84-q-input" value={currentQ.q || ""} onChange={e => updateQuestion('q', e.target.value)} rows="3" disabled={loading}/>
                            <div className="v84-answers-grid">{(currentQ.options || ['','','','']).map((opt, index) => (<div key={index} className={`v84-ans-row ${currentQ.a === index ? 'correct' : ''}`}><div className="v84-correct-radio" onClick={() => updateQuestion('a', index)}>{currentQ.a === index ? '✓' : ''}</div><input className="v84-ans-input" placeholder={`Opt ${index + 1}`} value={opt} onChange={e => updateQuestion('options', e.target.value, index)} disabled={loading}/></div>))}</div>
                        </div>
                    ) : <div className="flex items-center justify-center h-full text-slate-300 font-bold uppercase">Sélectionnez une question</div>}
                </div>

                {/* 3. SIDEBAR DROITE : DISTRIBUTION UNIFIÉE */}
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
